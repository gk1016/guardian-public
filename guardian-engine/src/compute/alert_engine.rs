//! Alert Generation Engine
//!
//! Takes computed results from package_discipline and threat_correlation,
//! deduplicates against recent notifications (24h window), and:
//! 1. Inserts new Notification rows into the DB (visible in Next.js UI)
//! 2. Broadcasts events on the WebSocket channel (real-time push)

use sqlx::{PgPool, Row};
use tokio::sync::broadcast;
use chrono::Utc;
use serde_json::json;
use tracing::{info, error};

use super::package_discipline::{ComplianceResult, ViolationSeverity};
use super::threat_correlation::{ThreatCluster, ClusterConfidence};

/// Evaluate computed state and generate alerts.
pub async fn evaluate(
    pool: &PgPool,
    event_tx: &broadcast::Sender<String>,
    compliance_results: &[ComplianceResult],
    threat_clusters: &[ThreatCluster],
) -> anyhow::Result<()> {
    let mut alerts_created = 0u32;

    // Process doctrine violations
    for result in compliance_results {
        for violation in &result.violations {
            let title = format!("DISCIPLINE: {}", violation.message);
            let severity = match violation.severity {
                ViolationSeverity::Critical => "critical",
                ViolationSeverity::Warning => "warning",
            };

            // Check for existing recent notification with same title in same org
            if is_duplicate(pool, &result.org_id, &title).await? {
                continue;
            }

            let body = format!(
                "Package discipline violation on mission {}: {} [{}]",
                result.callsign, violation.message, violation.field
            );
            let href = format!("/missions/{}", result.mission_id);

            insert_notification(
                pool,
                &result.org_id,
                "ops",
                severity,
                &title,
                &body,
                Some(&href),
            ).await?;

            // Broadcast to WebSocket clients
            let ws_event = json!({
                "type": "alert",
                "category": "doctrine_violation",
                "severity": severity,
                "title": title,
                "mission_id": result.mission_id,
                "callsign": result.callsign,
                "field": violation.field,
                "org_id": result.org_id,
            });
            let _ = event_tx.send(ws_event.to_string());

            alerts_created += 1;
        }
    }

    // Process threat clusters
    for cluster in threat_clusters {
        // Only alert on Medium+ confidence clusters
        if cluster.confidence == ClusterConfidence::Low {
            continue;
        }

        let group_label = cluster.hostile_group.as_deref().unwrap_or("Unknown group");
        let system_label = cluster.star_system.as_deref().unwrap_or("unknown system");

        let title = format!(
            "THREAT: {} activity in {} ({} reports, sev {})",
            group_label, system_label, cluster.report_count, cluster.max_severity
        );

        if is_duplicate(pool, &cluster.org_id, &title).await? {
            continue;
        }

        let severity = match cluster.confidence {
            ClusterConfidence::High => "critical",
            ClusterConfidence::Medium => "warning",
            ClusterConfidence::Low => "info",
        };

        let mut body = format!(
            "Correlated {} intel reports indicating {} activity in {}. Max severity: {}, avg: {:.1}.",
            cluster.report_count, group_label, system_label,
            cluster.max_severity, cluster.avg_severity
        );

        if !cluster.overlapping_missions.is_empty() {
            body.push_str(&format!(
                " WARNING: Active missions in area: {}",
                cluster.overlapping_missions.join(", ")
            ));
        }

        insert_notification(
            pool,
            &cluster.org_id,
            "intel",
            severity,
            &title,
            &body,
            None,
        ).await?;

        let ws_event = json!({
            "type": "alert",
            "category": "threat_cluster",
            "severity": severity,
            "title": title,
            "hostile_group": cluster.hostile_group,
            "star_system": cluster.star_system,
            "report_count": cluster.report_count,
            "max_severity": cluster.max_severity,
            "overlapping_missions": cluster.overlapping_missions,
            "org_id": cluster.org_id,
        });
        let _ = event_tx.send(ws_event.to_string());

        alerts_created += 1;
    }

    if alerts_created > 0 {
        info!(count = alerts_created, "alerts generated");
    }

    Ok(())
}

/// Check if a notification with the same title exists in the same org within the last 24 hours.
async fn is_duplicate(pool: &PgPool, org_id: &str, title: &str) -> anyhow::Result<bool> {
    let cutoff = Utc::now() - chrono::Duration::hours(24);
    let row = sqlx::query(
        r#"
        SELECT COUNT(*) as cnt
        FROM "Notification"
        WHERE "orgId" = $1 AND title = $2 AND "createdAt" > $3
        "#
    )
    .bind(org_id)
    .bind(title)
    .bind(cutoff)
    .fetch_one(pool)
    .await?;

    let count: i64 = row.get("cnt");
    Ok(count > 0)
}

/// Insert a new Notification row. Uses UUID for id since Prisma's cuid() is client-side.
async fn insert_notification(
    pool: &PgPool,
    org_id: &str,
    category: &str,
    severity: &str,
    title: &str,
    body: &str,
    href: Option<&str>,
) -> anyhow::Result<()> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    let result = sqlx::query(
        r#"
        INSERT INTO "Notification" (id, "orgId", "createdById", category, severity, title, body, href, status, "createdAt", "updatedAt")
        VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 'unread', $8, $8)
        "#
    )
    .bind(&id)
    .bind(org_id)
    .bind(category)
    .bind(severity)
    .bind(title)
    .bind(body)
    .bind(href)
    .bind(now)
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            info!(title = %title, severity = %severity, "notification created");
            Ok(())
        }
        Err(e) => {
            error!(error = %e, title = %title, "failed to insert notification");
            Err(e.into())
        }
    }
}
