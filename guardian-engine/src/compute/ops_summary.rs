//! Ops summary — live operational metrics broadcast after each compute tick.

use anyhow::Result;
use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct ReadinessBreakdown {
    pub qrf_posture: u8,
    pub package_discipline: u8,
    pub rescue_response: u8,
    pub threat_awareness: u8,
}

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
    pub readiness_score: u8,
    pub readiness: ReadinessBreakdown,
    pub timestamp: String,
}

pub async fn query(
    pool: &PgPool,
    threat_cluster_count: usize,
    violation_count: usize,
) -> Result<OpsSummary> {
    // Run all counts in parallel
    let (
        active,
        planning,
        qrf_ready,
        qrf_total,
        open_rescues,
        rescues_responded,
        unread_alerts,
        active_intel,
        missions_with_violations,
    ) = tokio::try_join!(
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
            r#"SELECT COUNT(*) FROM "RescueRequest" WHERE "status" IN ('accepted', 'en_route')"#
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
        // Count distinct missions that have violations (approximation: if violation_count > 0
        // and we have active missions, assume violations spread across some missions)
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(DISTINCT m.id) FROM "Mission" m
               WHERE m.status IN ('active', 'ready', 'planning')
               AND (m."roeCode" IS NULL OR m."mettTc" IS NULL)"#
        )
        .fetch_one(pool),
    )?;

    // Compute readiness sub-scores (each 0-100)
    let qrf_posture = if qrf_total > 0 {
        ((qrf_ready as f64 / qrf_total as f64) * 100.0).round() as u8
    } else {
        50 // no QRF configured = neutral
    };

    let total_missions = active + planning;
    let package_discipline = if total_missions > 0 {
        let clean = (total_missions - missions_with_violations).max(0);
        ((clean as f64 / total_missions as f64) * 100.0).round() as u8
    } else {
        100 // no missions = no violations
    };

    let rescue_response = if open_rescues > 0 {
        ((rescues_responded as f64 / open_rescues as f64) * 100.0).round() as u8
    } else {
        100 // no open rescues = fully responded
    };

    let threat_awareness = if active_intel > 0 {
        // Score based on having missions relative to threats
        // More missions covering threats = better awareness
        let coverage = if active > 0 {
            let ratio = active as f64 / active_intel as f64;
            (ratio.min(1.0) * 80.0 + 20.0).round() as u8 // 20-100 range
        } else {
            20 // threats exist but no active missions = low awareness
        };
        coverage
    } else {
        100 // no active threats = full awareness
    };

    // Weighted composite: QRF 30%, discipline 25%, rescue 20%, awareness 25%
    let readiness_score = (
        (qrf_posture as f64 * 0.30)
        + (package_discipline as f64 * 0.25)
        + (rescue_response as f64 * 0.20)
        + (threat_awareness as f64 * 0.25)
    ).round() as u8;

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
        readiness_score,
        readiness: ReadinessBreakdown {
            qrf_posture,
            package_discipline,
            rescue_response,
            threat_awareness,
        },
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}
