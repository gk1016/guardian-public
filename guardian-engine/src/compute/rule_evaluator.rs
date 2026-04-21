//! Alert Rule Evaluator
//!
//! Evaluates user-defined threshold rules against the current ops summary.
//! When a rule's condition is met and cooldown has elapsed, creates a Notification
//! and broadcasts a WS alert event.

use sqlx::{PgPool, Row};
use chrono::Utc;
use tracing::{info, warn, error};

use super::ops_summary::OpsSummary;

struct AlertRule {
    id: String,
    org_id: String,
    name: String,
    metric: String,
    operator: String,
    threshold: f64,
    severity: String,
    cooldown_minutes: i32,
    last_triggered_at: Option<chrono::NaiveDateTime>,
}

/// Evaluate all enabled alert rules against the current ops summary.
pub async fn evaluate(
    pool: &PgPool,
    summary: &OpsSummary,
    event_tx: &tokio::sync::broadcast::Sender<String>,
) -> anyhow::Result<()> {
    let rows = sqlx::query(
        r#"SELECT id, "orgId", name, metric, operator, threshold, severity,
                  "cooldownMinutes", "lastTriggeredAt"
           FROM "AlertRule"
           WHERE "isEnabled" = true"#
    )
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    let mut triggered_count = 0u32;

    for row in &rows {
        let rule = AlertRule {
            id: row.get("id"),
            org_id: row.get("orgId"),
            name: row.get("name"),
            metric: row.get("metric"),
            operator: row.get("operator"),
            threshold: row.get("threshold"),
            severity: row.get("severity"),
            cooldown_minutes: row.get("cooldownMinutes"),
            last_triggered_at: row.get("lastTriggeredAt"),
        };

        // Resolve metric value from summary
        let metric_value = match rule.metric.as_str() {
            "qrf_ready" => Some(summary.qrf_ready as f64),
            "active_missions" => Some(summary.active_missions as f64),
            "readiness_score" => Some(summary.readiness_score as f64),
            "open_rescues" => Some(summary.open_rescues as f64),
            "unread_alerts" => Some(summary.unread_alerts as f64),
            "compliance_violations" => Some(summary.compliance_violations as f64),
            "threat_clusters" => Some(summary.threat_clusters as f64),
            "qrf_posture" => Some(summary.readiness.qrf_posture as f64),
            "package_discipline" => Some(summary.readiness.package_discipline as f64),
            "rescue_response" => Some(summary.readiness.rescue_response as f64),
            "threat_awareness" => Some(summary.readiness.threat_awareness as f64),
            _ => {
                warn!(metric = %rule.metric, rule = %rule.name, "unknown metric in alert rule");
                None
            }
        };

        let Some(value) = metric_value else { continue };

        // Evaluate threshold condition
        let triggered = match rule.operator.as_str() {
            "lt" => value < rule.threshold,
            "lte" => value <= rule.threshold,
            "gt" => value > rule.threshold,
            "gte" => value >= rule.threshold,
            "eq" => (value - rule.threshold).abs() < f64::EPSILON,
            _ => {
                warn!(operator = %rule.operator, rule = %rule.name, "unknown operator");
                false
            }
        };

        if !triggered {
            continue;
        }

        // Check cooldown window
        if let Some(last) = rule.last_triggered_at {
            let elapsed = Utc::now().naive_utc() - last;
            if elapsed.num_minutes() < rule.cooldown_minutes as i64 {
                continue;
            }
        }

        // Threshold breached and cooldown elapsed — fire alert
        let title = format!("RULE: {}", rule.name);
        let body = format!(
            "{} is {} {} (current: {:.0}, threshold: {:.0})",
            rule.metric,
            operator_label(&rule.operator),
            rule.threshold,
            value,
            rule.threshold
        );

        let notif_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().naive_utc();

        // Insert notification
        if let Err(e) = sqlx::query(
            r#"INSERT INTO "Notification" (id, "orgId", "createdById", category, severity, title, body, href, status, "createdAt", "updatedAt")
               VALUES ($1, $2, NULL, 'rule', $3, $4, $5, NULL, 'unread', $6, $6)"#
        )
        .bind(&notif_id)
        .bind(&rule.org_id)
        .bind(&rule.severity)
        .bind(&title)
        .bind(&body)
        .bind(now)
        .execute(pool)
        .await {
            error!(error = %e, rule = %rule.name, "failed to create rule notification");
            continue;
        }

        // Update lastTriggeredAt
        let _ = sqlx::query(
            r#"UPDATE "AlertRule" SET "lastTriggeredAt" = $1, "updatedAt" = $1 WHERE id = $2"#
        )
        .bind(now)
        .bind(&rule.id)
        .execute(pool)
        .await;

        // Broadcast WS alert
        let ws_event = serde_json::json!({
            "type": "alert",
            "category": "rule_triggered",
            "severity": rule.severity,
            "title": title,
            "body": body,
            "rule_name": rule.name,
            "metric": rule.metric,
            "value": value,
            "threshold": rule.threshold,
            "org_id": rule.org_id,
        });
        let _ = event_tx.send(ws_event.to_string());

        info!(rule = %rule.name, metric = %rule.metric, value = value, threshold = rule.threshold, "alert rule triggered");
        triggered_count += 1;
    }

    if triggered_count > 0 {
        info!(count = triggered_count, "alert rules evaluated");
    }

    Ok(())
}

fn operator_label(op: &str) -> &str {
    match op {
        "lt" => "below",
        "lte" => "at or below",
        "gt" => "above",
        "gte" => "at or above",
        "eq" => "equal to",
        _ => op,
    }
}
