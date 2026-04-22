//! AI Analysis Jobs
//!
//! Each job queries operational data, builds a prompt, calls the AI provider,
//! and stores the result in the AiAnalysis table.

use anyhow::Result;
use sqlx::{PgPool, Row};
use tokio::sync::broadcast;
use tracing::{info, warn};
use chrono::Utc;

use super::provider::{AiProvider, ChatMessage, CompletionOptions};
use super::prompts;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Check if an analysis of the given type was run within the cooldown window.
async fn is_recent(pool: &PgPool, analysis_type: &str, cooldown_secs: i64) -> Result<bool> {
    let cutoff = (Utc::now() - chrono::Duration::seconds(cooldown_secs)).naive_utc();
    let count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "AiAnalysis" WHERE "analysisType" = $1 AND "createdAt" > $2"#
    )
    .bind(analysis_type)
    .bind(cutoff)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

/// Store an analysis result.
async fn store_analysis(
    pool: &PgPool,
    org_id: &str,
    analysis_type: &str,
    target_id: Option<&str>,
    summary: &str,
    provider: &str,
    model: &str,
) -> Result<String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().naive_utc();

    sqlx::query(
        r#"
        INSERT INTO "AiAnalysis" (id, "orgId", "analysisType", "targetId", summary,
                                   provider, model, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        "#
    )
    .bind(&id)
    .bind(org_id)
    .bind(analysis_type)
    .bind(target_id)
    .bind(summary)
    .bind(provider)
    .bind(model)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(id)
}

fn broadcast_analysis(
    event_tx: &broadcast::Sender<String>,
    analysis_type: &str,
    org_id: &str,
    target_id: Option<&str>,
) {
    let event = serde_json::json!({
        "type": "ai_analysis",
        "analysisType": analysis_type,
        "orgId": org_id,
        "targetId": target_id,
        "timestamp": Utc::now().to_rfc3339(),
    });
    let _ = event_tx.send(event.to_string());
}

// ---------------------------------------------------------------------------
// Threat Assessment
// ---------------------------------------------------------------------------

pub async fn run_threat_assessment(
    pool: &PgPool,
    provider: &dyn AiProvider,
    event_tx: &broadcast::Sender<String>,
) -> Result<()> {
    if is_recent(pool, "threat_assessment", 240).await? {
        return Ok(());
    }

    // Gather active intel
    let rows = sqlx::query(
        r#"
        SELECT ir.title, ir."reportType", ir.description, ir.severity,
               ir."locationName", ir."hostileGroup", ir.confidence, ir.tags,
               ir."createdAt", o.id as org_id
        FROM "IntelReport" ir
        JOIN "Organization" o ON o.id = ir."orgId"
        WHERE ir."isActive" = true
        ORDER BY ir.severity DESC
        LIMIT 50
        "#
    )
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    let org_id: String = rows[0].get("org_id");

    // Build context
    let mut context = String::from("ACTIVE INTEL REPORTS:\n\n");
    for r in &rows {
        let title: String = r.get("title");
        let rtype: String = r.get("reportType");
        let desc: Option<String> = r.get("description");
        let sev: i32 = r.get("severity");
        let loc: Option<String> = r.get("locationName");
        let group: Option<String> = r.get("hostileGroup");
        let conf: String = r.get("confidence");
        let tags: Vec<String> = r.get("tags");

        context.push_str(&format!(
            "- {} [{}] Sev:{} Loc:{} Group:{} Conf:{} Tags:{}\n  {}\n\n",
            title, rtype, sev,
            loc.as_deref().unwrap_or("unknown"),
            group.as_deref().unwrap_or("unknown"),
            conf,
            tags.join(", "),
            desc.as_deref().unwrap_or("No description"),
        ));
    }

    // Add active missions for overlap analysis
    let missions = sqlx::query(
        r#"SELECT callsign, "missionType", "areaOfOperation", status, "roeCode"
           FROM "Mission" WHERE status IN ('active', 'ready')
           ORDER BY status"#
    )
    .fetch_all(pool)
    .await?;

    if !missions.is_empty() {
        context.push_str("ACTIVE/READY MISSIONS:\n\n");
        for m in &missions {
            let cs: String = m.get("callsign");
            let mt: String = m.get("missionType");
            let ao: Option<String> = m.get("areaOfOperation");
            let st: String = m.get("status");
            let roe: Option<String> = m.get("roeCode");
            context.push_str(&format!(
                "- {} [{}] Status:{} AO:{} ROE:{}\n",
                cs, mt, st,
                ao.as_deref().unwrap_or("unset"),
                roe.as_deref().unwrap_or("none"),
            ));
        }
    }

    let messages = vec![
        ChatMessage { role: "system".into(), content: format!("{}\n\n{}", prompts::SYSTEM_BASE, prompts::THREAT_ASSESSMENT) },
        ChatMessage { role: "user".into(), content: context },
    ];

    let options = CompletionOptions { max_tokens: 2048, temperature: 0.3 };
    let result = provider.complete(messages, options).await?;

    store_analysis(pool, &org_id, "threat_assessment", None, &result, provider.name(), provider.model()).await?;
    broadcast_analysis(event_tx, "threat_assessment", &org_id, None);
    info!("threat assessment complete");

    Ok(())
}

// ---------------------------------------------------------------------------
// SITREP Summary
// ---------------------------------------------------------------------------

pub async fn run_sitrep_summary(
    pool: &PgPool,
    provider: &dyn AiProvider,
    event_tx: &broadcast::Sender<String>,
) -> Result<()> {
    if is_recent(pool, "sitrep", 240).await? {
        return Ok(());
    }

    let cutoff = (Utc::now() - chrono::Duration::hours(6)).naive_utc();

    // Recent notifications
    let notifs = sqlx::query(
        r#"SELECT n.category, n.severity, n.title, n.body, n."createdAt", o.id as org_id
           FROM "Notification" n
           JOIN "Organization" o ON o.id = n."orgId"
           WHERE n."createdAt" > $1
           ORDER BY n."createdAt" DESC LIMIT 30"#
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await?;

    if notifs.is_empty() {
        return Ok(());
    }

    let org_id: String = notifs[0].get("org_id");

    let mut context = String::from("RECENT EVENTS (last 6 hours):\n\n");
    for n in &notifs {
        let cat: String = n.get("category");
        let sev: String = n.get("severity");
        let title: String = n.get("title");
        let body: String = n.get("body");
        context.push_str(&format!("[{}] {} — {} : {}\n", sev.to_uppercase(), cat, title, body));
    }

    // Current mission statuses
    let missions = sqlx::query(
        r#"SELECT callsign, status, "missionType", title FROM "Mission"
           WHERE status IN ('planning', 'ready', 'active')
           ORDER BY status, callsign"#
    )
    .fetch_all(pool)
    .await?;

    context.push_str("\nCURRENT MISSIONS:\n");
    for m in &missions {
        let cs: String = m.get("callsign");
        let st: String = m.get("status");
        let mt: String = m.get("missionType");
        let t: String = m.get("title");
        context.push_str(&format!("- {} [{}] {} — {}\n", cs, mt, st, t));
    }

    // QRF posture
    let qrf = sqlx::query(
        r#"SELECT callsign, status, platform FROM "QrfReadiness" ORDER BY status"#
    )
    .fetch_all(pool)
    .await?;

    context.push_str("\nQRF POSTURE:\n");
    for q in &qrf {
        let cs: String = q.get("callsign");
        let st: String = q.get("status");
        let pl: Option<String> = q.get("platform");
        context.push_str(&format!("- {} {} ({})\n", cs, st, pl.as_deref().unwrap_or("unknown")));
    }

    // Open rescues
    let rescues = sqlx::query(
        r#"SELECT "survivorHandle", status, urgency, "locationName"
           FROM "RescueRequest" WHERE status NOT IN ('completed', 'cancelled')"#
    )
    .fetch_all(pool)
    .await?;

    if !rescues.is_empty() {
        context.push_str("\nOPEN RESCUES:\n");
        for r in &rescues {
            let sh: String = r.get("survivorHandle");
            let st: String = r.get("status");
            let urg: String = r.get("urgency");
            let loc: Option<String> = r.get("locationName");
            context.push_str(&format!("- {} [{}] {} at {}\n", sh, urg, st, loc.as_deref().unwrap_or("unknown")));
        }
    }

    let messages = vec![
        ChatMessage { role: "system".into(), content: format!("{}\n\n{}", prompts::SYSTEM_BASE, prompts::SITREP_SUMMARY) },
        ChatMessage { role: "user".into(), content: context },
    ];

    let options = CompletionOptions { max_tokens: 1536, temperature: 0.3 };
    let result = provider.complete(messages, options).await?;

    store_analysis(pool, &org_id, "sitrep", None, &result, provider.name(), provider.model()).await?;
    broadcast_analysis(event_tx, "sitrep", &org_id, None);
    info!("sitrep summary complete");

    Ok(())
}

// ---------------------------------------------------------------------------
// Mission Advisories
// ---------------------------------------------------------------------------

pub async fn run_mission_advisories(
    pool: &PgPool,
    provider: &dyn AiProvider,
    event_tx: &broadcast::Sender<String>,
) -> Result<()> {
    // Get active/ready missions that haven't had an advisory in the last 10 minutes
    let missions = sqlx::query(
        r#"SELECT m.id, m."orgId", m.callsign, m."missionType", m.status, m.priority,
                  m."areaOfOperation", m."missionBrief", m."roeCode", m.phases
           FROM "Mission" m
           WHERE m.status IN ('active', 'ready')
           AND NOT EXISTS (
               SELECT 1 FROM "AiAnalysis" a
               WHERE a."analysisType" = 'mission_advisory'
               AND a."targetId" = m.id
               AND a."createdAt" > $1
           )
           ORDER BY m.status, m.priority DESC"#
    )
    .bind((Utc::now() - chrono::Duration::minutes(10)).naive_utc())
    .fetch_all(pool)
    .await?;

    if missions.is_empty() {
        return Ok(());
    }

    // Gather intel for context
    let intel_rows = sqlx::query(
        r#"SELECT title, severity, "locationName", "hostileGroup", confidence
           FROM "IntelReport" WHERE "isActive" = true ORDER BY severity DESC LIMIT 20"#
    )
    .fetch_all(pool)
    .await?;

    let mut intel_ctx = String::from("THREAT PICTURE:\n");
    for i in &intel_rows {
        let t: String = i.get("title");
        let s: i32 = i.get("severity");
        let loc: Option<String> = i.get("locationName");
        intel_ctx.push_str(&format!("- {} Sev:{} Loc:{}\n", t, s, loc.as_deref().unwrap_or("unknown")));
    }

    for m in &missions {
        let mission_id: String = m.get("id");
        let org_id: String = m.get("orgId");
        let callsign: String = m.get("callsign");
        let mtype: String = m.get("missionType");
        let status: String = m.get("status");
        let priority: String = m.get("priority");
        let ao: Option<String> = m.get("areaOfOperation");
        let brief: Option<String> = m.get("missionBrief");
        let roe: Option<String> = m.get("roeCode");

        // Get participants
        let parts = sqlx::query(
            r#"SELECT handle, role, platform, status FROM "MissionParticipant" WHERE "missionId" = $1"#
        )
        .bind(&mission_id)
        .fetch_all(pool)
        .await?;

        let mut mission_ctx = format!(
            "MISSION: {} [{}]\nStatus: {} Priority: {} AO: {} ROE: {}\nBrief: {}\n\nPARTICIPANTS:\n",
            callsign, mtype, status, priority,
            ao.as_deref().unwrap_or("unset"),
            roe.as_deref().unwrap_or("none"),
            brief.as_deref().unwrap_or("No brief"),
        );

        for p in &parts {
            let h: String = p.get("handle");
            let r: String = p.get("role");
            let pl: Option<String> = p.get("platform");
            let st: String = p.get("status");
            mission_ctx.push_str(&format!("- {} ({}) Platform:{} Status:{}\n", h, r, pl.as_deref().unwrap_or("unknown"), st));
        }

        if parts.is_empty() {
            mission_ctx.push_str("  (NO PARTICIPANTS ASSIGNED)\n");
        }

        let full_context = format!("{}\n\n{}", mission_ctx, intel_ctx);

        let messages = vec![
            ChatMessage { role: "system".into(), content: format!("{}\n\n{}", prompts::SYSTEM_BASE, prompts::MISSION_ADVISORY) },
            ChatMessage { role: "user".into(), content: full_context },
        ];

        let options = CompletionOptions { max_tokens: 1024, temperature: 0.3 };
        match provider.complete(messages, options).await {
            Ok(result) => {
                store_analysis(pool, &org_id, "mission_advisory", Some(&mission_id), &result, provider.name(), provider.model()).await?;
                broadcast_analysis(event_tx, "mission_advisory", &org_id, Some(&mission_id));
                info!(callsign = %callsign, "mission advisory complete");
            }
            Err(e) => {
                warn!(callsign = %callsign, error = %e, "mission advisory failed");
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Rescue Triage
// ---------------------------------------------------------------------------

pub async fn run_rescue_triage(
    pool: &PgPool,
    provider: &dyn AiProvider,
    event_tx: &broadcast::Sender<String>,
) -> Result<()> {
    let rescues = sqlx::query(
        r#"SELECT r.id, r."orgId", r."survivorHandle", r."locationName", r.urgency,
                  r."threatSummary", r."survivorCondition", r."escortRequired",
                  r."medicalRequired", r."roeCode", r.status
           FROM "RescueRequest" r
           WHERE r.status NOT IN ('completed', 'cancelled')
           AND NOT EXISTS (
               SELECT 1 FROM "AiAnalysis" a
               WHERE a."analysisType" = 'rescue_triage'
               AND a."targetId" = r.id
               AND a."createdAt" > $1
           )"#
    )
    .bind((Utc::now() - chrono::Duration::minutes(10)).naive_utc())
    .fetch_all(pool)
    .await?;

    if rescues.is_empty() {
        return Ok(());
    }

    // Gather intel and QRF for context
    let intel = sqlx::query(
        r#"SELECT title, severity, "locationName", "hostileGroup"
           FROM "IntelReport" WHERE "isActive" = true ORDER BY severity DESC LIMIT 20"#
    )
    .fetch_all(pool)
    .await?;

    let qrf = sqlx::query(
        r#"SELECT callsign, status, platform, "locationName"
           FROM "QrfReadiness" WHERE status IN ('redcon1', 'redcon2', 'redcon3')
           ORDER BY status"#
    )
    .fetch_all(pool)
    .await?;

    let mut support_ctx = String::from("AVAILABLE QRF ASSETS:\n");
    for q in &qrf {
        let cs: String = q.get("callsign");
        let st: String = q.get("status");
        let pl: Option<String> = q.get("platform");
        let loc: Option<String> = q.get("locationName");
        support_ctx.push_str(&format!("- {} {} {} at {}\n", cs, st, pl.as_deref().unwrap_or("unknown"), loc.as_deref().unwrap_or("unknown")));
    }

    support_ctx.push_str("\nACTIVE INTEL:\n");
    for i in &intel {
        let t: String = i.get("title");
        let s: i32 = i.get("severity");
        let loc: Option<String> = i.get("locationName");
        let grp: Option<String> = i.get("hostileGroup");
        support_ctx.push_str(&format!("- {} Sev:{} Loc:{} Group:{}\n", t, s, loc.as_deref().unwrap_or("unknown"), grp.as_deref().unwrap_or("unknown")));
    }

    for r in &rescues {
        let rescue_id: String = r.get("id");
        let org_id: String = r.get("orgId");
        let survivor: String = r.get("survivorHandle");
        let loc: Option<String> = r.get("locationName");
        let urgency: String = r.get("urgency");
        let threat: Option<String> = r.get("threatSummary");
        let condition: Option<String> = r.get("survivorCondition");
        let escort: bool = r.get("escortRequired");
        let medical: bool = r.get("medicalRequired");
        let roe: Option<String> = r.get("roeCode");

        let rescue_ctx = format!(
            "RESCUE REQUEST: {}\nLocation: {} Urgency: {} Status: {}\n\
             Threat: {}\nCondition: {}\n\
             Escort Required: {} Medical Required: {} ROE: {}\n\n{}",
            survivor,
            loc.as_deref().unwrap_or("unknown"),
            urgency,
            {let s: String = r.get("status"); s},
            threat.as_deref().unwrap_or("None reported"),
            condition.as_deref().unwrap_or("Unknown"),
            escort, medical,
            roe.as_deref().unwrap_or("none"),
            support_ctx,
        );

        let messages = vec![
            ChatMessage { role: "system".into(), content: format!("{}\n\n{}", prompts::SYSTEM_BASE, prompts::RESCUE_TRIAGE) },
            ChatMessage { role: "user".into(), content: rescue_ctx },
        ];

        let options = CompletionOptions { max_tokens: 1024, temperature: 0.3 };
        match provider.complete(messages, options).await {
            Ok(result) => {
                store_analysis(pool, &org_id, "rescue_triage", Some(&rescue_id), &result, provider.name(), provider.model()).await?;
                broadcast_analysis(event_tx, "rescue_triage", &org_id, Some(&rescue_id));
                info!(survivor = %survivor, "rescue triage complete");
            }
            Err(e) => {
                warn!(survivor = %survivor, error = %e, "rescue triage failed");
            }
        }
    }

    Ok(())
}
