pub mod package_discipline;
pub mod threat_correlation;
pub mod alert_engine;

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
}
