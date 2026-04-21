//! Threat Correlation Engine
//!
//! Analyzes active intel reports to identify patterns:
//! - Multiple sightings of the same hostile group across systems
//! - Escalating severity trends in a region
//! - Correlations between intel reports and active missions
//! - Time-based pattern detection (repeat contacts at same location)

use std::collections::HashMap;
use sqlx::{PgPool, Row};
use chrono::{DateTime, Utc};

/// A correlated threat cluster - multiple intel reports that together
/// indicate a coherent threat.
#[derive(Debug)]
pub struct ThreatCluster {
    pub cluster_key: String,
    pub org_id: String,
    pub hostile_group: Option<String>,
    pub star_system: Option<String>,
    pub report_ids: Vec<String>,
    pub report_count: usize,
    pub max_severity: i32,
    pub avg_severity: f64,
    pub confidence: ClusterConfidence,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    /// Active mission callsigns operating in the same area
    pub overlapping_missions: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ClusterConfidence {
    Low,
    Medium,
    High,
}

impl std::fmt::Display for ClusterConfidence {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Low => write!(f, "low"),
            Self::Medium => write!(f, "medium"),
            Self::High => write!(f, "high"),
        }
    }
}

struct IntelRow {
    id: String,
    org_id: String,
    severity: i32,
    star_system: Option<String>,
    hostile_group: Option<String>,
    created_at: DateTime<Utc>,
}

/// Run threat correlation across all active intel reports.
pub async fn correlate(pool: &PgPool) -> anyhow::Result<Vec<ThreatCluster>> {
    // Fetch active intel reports
    let rows = sqlx::query(
        r#"
        SELECT id, "orgId", severity, "starSystem", "hostileGroup", "createdAt"
        FROM "IntelReport"
        WHERE "isActive" = true
        ORDER BY "createdAt" DESC
        LIMIT 500
        "#
    )
    .fetch_all(pool)
    .await?;

    let reports: Vec<IntelRow> = rows.iter().map(|r| IntelRow {
        id: r.get("id"),
        org_id: r.get("orgId"),
        severity: r.get("severity"),
        star_system: r.get("starSystem"),
        hostile_group: r.get("hostileGroup"),
        created_at: r.get("createdAt"),
    }).collect();

    if reports.is_empty() {
        return Ok(vec![]);
    }

    // Group by (org_id, hostile_group, star_system) where at least one is non-null
    let mut clusters_map: HashMap<String, Vec<&IntelRow>> = HashMap::new();

    for report in &reports {
        // Skip reports with neither hostile group nor star system
        if report.hostile_group.is_none() && report.star_system.is_none() {
            continue;
        }

        let key = format!(
            "{}:{}:{}",
            report.org_id,
            report.hostile_group.as_deref().unwrap_or("_"),
            report.star_system.as_deref().unwrap_or("_")
        );

        clusters_map.entry(key).or_default().push(report);
    }

    // Only keep clusters with 2+ reports
    let multi_clusters: Vec<(String, Vec<&IntelRow>)> = clusters_map
        .into_iter()
        .filter(|(_, reports)| reports.len() >= 2)
        .collect();

    if multi_clusters.is_empty() {
        return Ok(vec![]);
    }

    // Fetch active missions for area overlap check
    let mission_rows = sqlx::query(
        r#"
        SELECT callsign, "areaOfOperation"
        FROM "Mission"
        WHERE status IN ('active', 'in_progress')
        AND "areaOfOperation" IS NOT NULL
        "#
    )
    .fetch_all(pool)
    .await?;

    let active_missions: Vec<(String, String)> = mission_rows.iter().map(|r| {
        let callsign: String = r.get("callsign");
        let area: String = r.get("areaOfOperation");
        (callsign, area.to_lowercase())
    }).collect();

    // Build ThreatCluster results
    let mut clusters = Vec::new();

    for (key, reports) in &multi_clusters {
        let report_count = reports.len();
        let max_severity = reports.iter().map(|r| r.severity).max().unwrap_or(1);
        let avg_severity = reports.iter().map(|r| r.severity as f64).sum::<f64>() / report_count as f64;
        let first_seen = reports.iter().map(|r| r.created_at).min().unwrap();
        let last_seen = reports.iter().map(|r| r.created_at).max().unwrap();
        let org_id = reports[0].org_id.clone();
        let hostile_group = reports[0].hostile_group.clone();
        let star_system = reports[0].star_system.clone();

        // Score confidence based on report count and severity
        let confidence = if report_count >= 4 || max_severity >= 5 {
            ClusterConfidence::High
        } else if report_count >= 3 || max_severity >= 4 {
            ClusterConfidence::Medium
        } else {
            ClusterConfidence::Low
        };

        // Check for mission overlap
        let system_lower = star_system.as_deref().unwrap_or("").to_lowercase();
        let overlapping_missions: Vec<String> = if !system_lower.is_empty() {
            active_missions.iter()
                .filter(|(_, area)| area.contains(&system_lower) || system_lower.contains(area.as_str()))
                .map(|(callsign, _)| callsign.clone())
                .collect()
        } else {
            vec![]
        };

        clusters.push(ThreatCluster {
            cluster_key: key.clone(),
            org_id,
            hostile_group,
            star_system,
            report_ids: reports.iter().map(|r| r.id.clone()).collect(),
            report_count,
            max_severity,
            avg_severity,
            confidence,
            first_seen,
            last_seen,
            overlapping_missions,
        });
    }

    // Sort by max severity descending, then by report count
    clusters.sort_by(|a, b| {
        b.max_severity.cmp(&a.max_severity)
            .then(b.report_count.cmp(&a.report_count))
    });

    Ok(clusters)
}
