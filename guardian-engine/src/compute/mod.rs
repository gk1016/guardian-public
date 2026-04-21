pub mod package_discipline;
pub mod threat_correlation;
pub mod alert_engine;

/// Compute engine tick - runs periodic analysis jobs.
/// Called on a timer from the main loop or triggered by data changes.
pub async fn tick(pool: &sqlx::PgPool, event_tx: &tokio::sync::broadcast::Sender<String>) {
    // Phase 1: Check package discipline across active missions
    if let Err(e) = package_discipline::check_all(pool).await {
        tracing::error!(error = %e, "package discipline check failed");
    }

    // Phase 2: Correlate threat intel
    if let Err(e) = threat_correlation::correlate(pool).await {
        tracing::error!(error = %e, "threat correlation failed");
    }

    // Phase 3: Generate alerts from computed results
    if let Err(e) = alert_engine::evaluate(pool, event_tx).await {
        tracing::error!(error = %e, "alert evaluation failed");
    }
}
