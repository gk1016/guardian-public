use anyhow::Result;
use serenity::all::{
    CommandInteraction, Context, CreateEmbed, CreateInteractionResponse,
    CreateInteractionResponseMessage, Colour,
};

use crate::state::AppState;

/// /status \u{2014} org overview: active missions, QRF readiness, threat level, member count
pub async fn handle_status(
    ctx: &Context,
    cmd: &CommandInteraction,
    state: &AppState,
) -> Result<()> {
    let pool = state.pool();

    let active_missions: (i64,) =
        sqlx::query_as(r#"SELECT COUNT(*) FROM "Mission" WHERE "status" IN ('planning','active','executing')"#)
            .fetch_one(pool)
            .await
            .unwrap_or((0,));

    let member_count: (i64,) =
        sqlx::query_as(r#"SELECT COUNT(*) FROM "OrgMember""#)
            .fetch_one(pool)
            .await
            .unwrap_or((0,));

    let qrf_ready: (i64,) =
        sqlx::query_as(r#"SELECT COUNT(*) FROM "QrfReadiness" WHERE "status" IN ('redcon1','redcon2')"#)
            .fetch_one(pool)
            .await
            .unwrap_or((0,));

    let open_threats: (i64,) =
        sqlx::query_as(r#"SELECT COUNT(*) FROM "IntelReport" WHERE "isActive" = true AND "severity" <= 2"#)
            .fetch_one(pool)
            .await
            .unwrap_or((0,));

    let open_rescues: (i64,) =
        sqlx::query_as(r#"SELECT COUNT(*) FROM "RescueRequest" WHERE "status" IN ('open','in_progress')"#)
            .fetch_one(pool)
            .await
            .unwrap_or((0,));

    let threat_color = if open_threats.0 > 0 {
        Colour::RED
    } else if active_missions.0 > 3 {
        Colour::ORANGE
    } else {
        Colour::from_rgb(0, 200, 100)
    };

    let embed = CreateEmbed::new()
        .title("Guardian Flight -- Status")
        .color(threat_color)
        .field("Active Missions", format!("{}", active_missions.0), true)
        .field("QRF Ready", format!("{}", qrf_ready.0), true)
        .field("High Threats", format!("{}", open_threats.0), true)
        .field("Open Rescues", format!("{}", open_rescues.0), true)
        .field("Members", format!("{}", member_count.0), true)
        .footer(serenity::all::CreateEmbedFooter::new("Guardian Engine"));

    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Message(
            CreateInteractionResponseMessage::new().embed(embed),
        ),
    )
    .await?;

    Ok(())
}

/// /intel \u{2014} recent intel reports
pub async fn handle_intel(
    ctx: &Context,
    cmd: &CommandInteraction,
    state: &AppState,
) -> Result<()> {
    let count = cmd
        .data
        .options
        .iter()
        .find(|o| o.name == "count")
        .and_then(|o| o.value.as_i64())
        .unwrap_or(5)
        .min(10) as i64;

    let rows: Vec<(String, String, i32, Option<String>, bool, Option<String>)> = sqlx::query_as(
        r#"SELECT "title", "reportType", "severity", "starSystem", "isVerified", "hostileGroup"
           FROM "IntelReport"
           WHERE "isActive" = true
           ORDER BY "severity" ASC, "createdAt" DESC
           LIMIT $1"#,
    )
    .bind(count)
    .fetch_all(state.pool())
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        cmd.create_response(
            &ctx.http,
            CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .embed(CreateEmbed::new().title("Intel").description("No active intel reports.").color(Colour::DARK_GREY)),
            ),
        )
        .await?;
        return Ok(());
    }

    let mut description = String::new();
    for (title, report_type, severity, system, verified, hostile) in &rows {
        let sev_icon = match severity {
            1 => "\u{1f534}",
            2 => "\u{1f7e0}",
            3 => "\u{1f7e1}",
            4 => "\u{1f7e2}",
            _ => "\u{26aa}",
        };
        let ver = if *verified { " [VERIFIED]" } else { "" };
        let loc = system.as_deref().unwrap_or("Unknown");
        let grp = hostile
            .as_deref()
            .map(|h| format!(" | {h}"))
            .unwrap_or_default();

        description.push_str(&format!(
            "{sev_icon} **{title}**{ver}\n  {report_type} | {loc}{grp}\n\n"
        ));
    }

    let embed = CreateEmbed::new()
        .title(format!("Intel -- {} Active Reports", rows.len()))
        .description(description)
        .color(Colour::from_rgb(139, 92, 246));

    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Message(
            CreateInteractionResponseMessage::new().embed(embed),
        ),
    )
    .await?;

    Ok(())
}

/// /missions \u{2014} active missions
pub async fn handle_missions(
    ctx: &Context,
    cmd: &CommandInteraction,
    state: &AppState,
) -> Result<()> {
    let rows: Vec<(String, String, String, String, Option<String>)> = sqlx::query_as(
        r#"SELECT m."callsign", m."title", m."status", m."priority", m."areaOfOperation"
           FROM "Mission" m
           WHERE m."status" IN ('planning','active','executing')
           ORDER BY
             CASE m."priority"
               WHEN 'flash' THEN 1
               WHEN 'immediate' THEN 2
               WHEN 'priority' THEN 3
               WHEN 'routine' THEN 4
               ELSE 5
             END,
             m."createdAt" DESC
           LIMIT 10"#,
    )
    .fetch_all(state.pool())
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        cmd.create_response(
            &ctx.http,
            CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .embed(CreateEmbed::new().title("Missions").description("No active missions.").color(Colour::DARK_GREY)),
            ),
        )
        .await?;
        return Ok(());
    }

    let mut description = String::new();
    for (callsign, title, status, priority, ao) in &rows {
        let pri_icon = match priority.as_str() {
            "flash" => "\u{26a1}",
            "immediate" => "\u{1f534}",
            "priority" => "\u{1f7e0}",
            _ => "\u{1f7e2}",
        };
        let area = ao.as_deref().unwrap_or("TBD");
        description.push_str(&format!(
            "{pri_icon} **{callsign}** \u{2014} {title}\n  {status} | {area}\n\n"
        ));
    }

    let embed = CreateEmbed::new()
        .title(format!("Missions -- {} Active", rows.len()))
        .description(description)
        .color(Colour::from_rgb(6, 182, 212));

    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Message(
            CreateInteractionResponseMessage::new().embed(embed),
        ),
    )
    .await?;

    Ok(())
}

/// /qrf \u{2014} QRF readiness board
pub async fn handle_qrf(
    ctx: &Context,
    cmd: &CommandInteraction,
    state: &AppState,
) -> Result<()> {
    let rows: Vec<(String, String, Option<String>, i32, Option<String>)> = sqlx::query_as(
        r#"SELECT "callsign", "status", "platform", "availableCrew", "locationName"
           FROM "QrfReadiness"
           ORDER BY
             CASE "status"
               WHEN 'redcon1' THEN 1
               WHEN 'redcon2' THEN 2
               WHEN 'redcon3' THEN 3
               WHEN 'redcon4' THEN 4
               ELSE 5
             END"#,
    )
    .fetch_all(state.pool())
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        cmd.create_response(
            &ctx.http,
            CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .embed(CreateEmbed::new().title("QRF Board").description("No QRF teams registered.").color(Colour::DARK_GREY)),
            ),
        )
        .await?;
        return Ok(());
    }

    let mut description = String::new();
    for (callsign, status, platform, crew, location) in &rows {
        let status_icon = match status.as_str() {
            "redcon1" => "\u{1f7e2}",
            "redcon2" => "\u{1f7e1}",
            "redcon3" => "\u{1f7e0}",
            _ => "\u{1f534}",
        };
        let plat = platform.as_deref().unwrap_or("Unknown");
        let loc = location.as_deref().unwrap_or("Unset");
        description.push_str(&format!(
            "{status_icon} **{callsign}** [{status}]\n  {plat} | {crew} crew | {loc}\n\n"
        ));
    }

    let embed = CreateEmbed::new()
        .title(format!("QRF Board -- {} Teams", rows.len()))
        .description(description)
        .color(Colour::from_rgb(245, 158, 11));

    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Message(
            CreateInteractionResponseMessage::new().embed(embed),
        ),
    )
    .await?;

    Ok(())
}

/// /sitrep \u{2014} AI-generated situation report
pub async fn handle_sitrep(
    ctx: &Context,
    cmd: &CommandInteraction,
    state: &AppState,
) -> Result<()> {
    // Defer the response since AI generation may take a few seconds
    cmd.create_response(&ctx.http, CreateInteractionResponse::Defer(
        CreateInteractionResponseMessage::new(),
    ))
    .await?;

    // Check if AI is configured
    let ai_enabled: Option<(bool,)> = sqlx::query_as(
        r#"SELECT "enabled" FROM "AiConfig" LIMIT 1"#,
    )
    .fetch_optional(state.pool())
    .await
    .unwrap_or(None);

    let ai_active = ai_enabled.map(|r| r.0).unwrap_or(false);

    if !ai_active {
        // Fall back to data-only sitrep
        let summary = generate_data_sitrep(state).await;
        cmd.edit_response(
            &ctx.http,
            serenity::all::EditInteractionResponse::new().embed(
                CreateEmbed::new()
                    .title("SITREP -- Data Summary")
                    .description(summary)
                    .color(Colour::from_rgb(100, 150, 255))
                    .footer(serenity::all::CreateEmbedFooter::new(
                        "AI not configured \u{2014} showing raw data summary",
                    )),
            ),
        )
        .await?;
        return Ok(());
    }

    // Trigger AI analysis
    let analyze_result = reqwest::Client::new()
        .post(format!(
            "http://127.0.0.1:{}/api/ai/analyze",
            state.config().listen_addr.port()
        ))
        .json(&serde_json::json!({"type": "sitrep"}))
        .send()
        .await;

    match analyze_result {
        Ok(res) if res.status().is_success() => {
            // Fetch the latest sitrep analysis
            let analysis: Option<(String,)> = sqlx::query_as(
                r#"SELECT "summary" FROM "AiAnalysis"
                   WHERE "analysisType" = 'sitrep'
                   ORDER BY "createdAt" DESC LIMIT 1"#,
            )
            .fetch_optional(state.pool())
            .await
            .unwrap_or(None);

            let summary = analysis
                .map(|a| a.0)
                .unwrap_or_else(|| "Analysis completed but no summary available.".into());

            cmd.edit_response(
                &ctx.http,
                serenity::all::EditInteractionResponse::new().embed(
                    CreateEmbed::new()
                        .title("SITREP -- AI Analysis")
                        .description(truncate(&summary, 4000))
                        .color(Colour::from_rgb(16, 185, 129)),
                ),
            )
            .await?;
        }
        Ok(res) => {
            let err_text = res.text().await.unwrap_or_default();
            cmd.edit_response(
                &ctx.http,
                serenity::all::EditInteractionResponse::new().embed(
                    CreateEmbed::new()
                        .title("SITREP -- Error")
                        .description(format!("AI analysis failed: {err_text}"))
                        .color(Colour::RED),
                ),
            )
            .await?;
        }
        Err(e) => {
            cmd.edit_response(
                &ctx.http,
                serenity::all::EditInteractionResponse::new().embed(
                    CreateEmbed::new()
                        .title("SITREP -- Error")
                        .description(format!("Failed to reach AI service: {e}"))
                        .color(Colour::RED),
                ),
            )
            .await?;
        }
    }

    Ok(())
}

/// Generate a data-only SITREP when AI is not available
async fn generate_data_sitrep(state: &AppState) -> String {
    let pool = state.pool();

    let missions: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM "Mission" WHERE "status" IN ('planning','active','executing')"#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or((0,));

    let high_threats: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM "IntelReport" WHERE "isActive" = true AND "severity" <= 2"#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or((0,));

    let open_rescues: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM "RescueRequest" WHERE "status" IN ('open','in_progress')"#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or((0,));

    let qrf_hot: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM "QrfReadiness" WHERE "status" IN ('redcon1','redcon2')"#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or((0,));

    let recent_incidents: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM "Incident" WHERE "status" = 'open'"#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or((0,));

    format!(
        "**Operational Summary**\n\
         Active Missions: {}\n\
         High-Severity Threats: {}\n\
         Open Rescues: {}\n\
         QRF Teams Hot: {}\n\
         Open Incidents: {}",
        missions.0, high_threats.0, open_rescues.0, qrf_hot.0, recent_incidents.0
    )
}

fn truncate(s: &str, max: usize) -> &str {
    if s.len() <= max {
        s
    } else {
        &s[..s.floor_char_boundary(max)]
    }
}
