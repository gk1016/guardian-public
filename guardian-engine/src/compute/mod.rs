pub mod package_discipline;
pub mod threat_correlation;
pub mod alert_engine;
pub mod ops_summary;

use tracing::{info, error};

/// Compute engine tick - runs periodic analysis jobs.
/// Called every 30 seconds from the main loop.
pub async fn tick(pool: &sqlx::PgPool, event_tx: &tokio::sync::broadcast::Sender<String>) {
    // Phase 1: Check package discipline across active missions
    let compliance_results = match package_discipline::check_all(pool).await {
        Ok(results) => {
            let violation_count: usize = results.iter().map(|r| r.violations.len()).sum();
            if violation_count > 0 {
                info!(
                    missions_checked = results.len(),
                    violations = violation_count,
                    "package discipline check complete"
                );
            }
            results
        }
        Err(e) => {
            error!(error = %e, "package discipline check failed");
            vec![]
        }
    };

    // Phase 2: Correlate threat intel
    let threat_clusters = match threat_correlation::correlate(pool).await {
        Ok(clusters) => {
            if !clusters.is_empty() {
                info!(clusters = clusters.len(), "threat correlation complete");
            }
            clusters
        }
        Err(e) => {
            error!(error = %e, "threat correlation failed");
            vec![]
        }
    };

    // Phase 3: Generate alerts from computed results
    if let Err(e) = alert_engine::evaluate(pool, event_tx, &compliance_results, &threat_clusters).await {
        error!(error = %e, "alert evaluation failed");
    }

    // Phase 4: Broadcast live ops summary to all connected clients
    let violation_count: usize = compliance_results.iter().map(|r| r.violations.len()).sum();
    match ops_summary::query(pool, threat_clusters.len(), violation_count).await {
        Ok(summary) => {
            let event = serde_json::json!({
                "type": "ops_summary",
                "active_missions": summary.active_missions,
                "planning_missions": summary.planning_missions,
                "qrf_ready": summary.qrf_ready,
                "qrf_total": summary.qrf_total,
                "open_rescues": summary.open_rescues,
                "unread_alerts": summary.unread_alerts,
                "active_intel": summary.active_intel,
                "threat_clusters": summary.threat_clusters,
                "compliance_violations": summary.compliance_violations,
                "readiness_score": summary.readiness_score,
                "readiness": {
                    "qrf_posture": summary.readiness.qrf_posture,
                    "package_discipline": summary.readiness.package_discipline,
                    "rescue_response": summary.readiness.rescue_response,
                    "threat_awareness": summary.readiness.threat_awareness,
                },
                "timestamp": summary.timestamp,
            });
            let _ = event_tx.send(event.to_string());
        }
        Err(e) => {
            error!(error = %e, "ops summary query failed");
        }
    }
}
