//! Threat Correlation Engine
//!
//! Analyzes active intel reports to identify patterns:
//! - Multiple sightings of the same hostile group across systems
//! - Escalating severity trends in a region
//! - Correlations between intel reports and active missions
//! - Time-based pattern detection (repeat contacts at same location)

use sqlx::PgPool;
use chrono::{DateTime, Utc};

/// A correlated threat cluster - multiple intel reports that together
/// indicate a coherent threat.
#[derive(Debug)]
pub struct ThreatCluster {
    pub cluster_id: String,
    pub hostile_group: Option<String>,
    pub star_system: Option<String>,
    pub report_ids: Vec<String>,
    pub max_severity: i32,
    pub confidence: ClusterConfidence,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy)]
pub enum ClusterConfidence {
    Low,
    Medium,
    High,
}

/// Run threat correlation across all active intel reports.
pub async fn correlate(pool: &PgPool) -> anyhow::Result<Vec<ThreatCluster>> {
    // Fetch active intel reports
    let _reports = sqlx::query!(
        r#"
        SELECT id, report_type, severity, location_name, star_system,
               hostile_group, confidence, tags, observed_at, created_at
        FROM "IntelReport"
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 500
        "#
    )
    .fetch_all(pool)
    .await;

    // TODO: Implement correlation logic:
    // 1. Group by hostile_group + star_system
    // 2. Score clusters by recency, severity, report count
    // 3. Flag clusters that overlap with active mission AOs
    // 4. Generate ThreatCluster results
    Ok(vec![])
}
