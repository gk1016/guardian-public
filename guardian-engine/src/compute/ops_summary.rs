//! Ops summary — live operational metrics broadcast after each compute tick.

use anyhow::Result;
use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct OpsSummary {
    pub active_missions: i64,
    pub planning_missions: i64,
    pub qrf_ready: i64,
    pub qrf_total: i64,
    pub open_rescues: i64,
    pub unread_alerts: i64,
    pub active_intel: i64,
    pub threat_clusters: usize,
    pub compliance_violations: usize,
    pub timestamp: String,
}

pub async fn query(
    pool: &PgPool,
    threat_cluster_count: usize,
    violation_count: usize,
) -> Result<OpsSummary> {
    // Run all counts in parallel
    let (active, planning, qrf_ready, qrf_total, open_rescues, unread_alerts, active_intel) = tokio::try_join!(
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "Mission" WHERE "status" IN ('active', 'ready')"#
        )
        .fetch_one(pool),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "Mission" WHERE "status" = 'planning'"#
        )
        .fetch_one(pool),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "QrfReadiness" WHERE "status" IN ('redcon1', 'redcon2')"#
        )
        .fetch_one(pool),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "QrfReadiness""#
        )
        .fetch_one(pool),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "RescueRequest" WHERE "status" IN ('open', 'accepted', 'en_route')"#
        )
        .fetch_one(pool),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "Notification" WHERE "status" = 'unread'"#
        )
        .fetch_one(pool),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "IntelReport" WHERE "isActive" = true"#
        )
        .fetch_one(pool),
    )?;

    Ok(OpsSummary {
        active_missions: active,
        planning_missions: planning,
        qrf_ready,
        qrf_total,
        open_rescues,
        unread_alerts,
        active_intel,
        threat_clusters: threat_cluster_count,
        compliance_violations: violation_count,
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}
