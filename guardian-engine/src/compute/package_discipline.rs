//! Package Discipline Validator
//!
//! Checks active missions against their attached doctrine templates to verify
//! that all required elements (METT-TC, phases, ROE, participants, etc.) are
//! present and correctly configured.
//!
//! This is the automated enforcement side of doctrine compliance.

use sqlx::PgPool;

/// Compliance status for a single mission against its doctrine.
#[derive(Debug)]
pub struct ComplianceResult {
    pub mission_id: String,
    pub doctrine_code: Option<String>,
    pub violations: Vec<Violation>,
}

#[derive(Debug)]
pub struct Violation {
    pub field: String,
    pub severity: ViolationSeverity,
    pub message: String,
}

#[derive(Debug, Clone, Copy)]
pub enum ViolationSeverity {
    Warning,
    Critical,
}

/// Check all active missions for doctrine compliance.
pub async fn check_all(pool: &PgPool) -> anyhow::Result<Vec<ComplianceResult>> {
    // Query active missions with their doctrine templates
    let missions = sqlx::query_as!(
        MissionRow,
        r#"
        SELECT m.id, m.callsign, m.status, m.misson_brief,
               m.mett_tc, m.phases, m.roe_code,
               m.doctrine_template_id,
               dt.code as "doctrine_code?"
        FROM "Mission" m
        LEFT JOIN "DoctrineTemplate" dt ON m.doctrine_template_id = dt.id
        WHERE m.status IN ('planning', 'active', 'in_progress')
        "#
    )
    .fetch_all(pool)
    .await;

    // TODO: For now return empty results - implement validation logic
    // against each doctrine template's requirements
    let _ = missions;
    Ok(vec![])
}

#[allow(dead_code)]
struct MissionRow {
    id: String,
    callsign: String,
    status: String,
    misson_brief: Option<String>,
    mett_tc: Option<serde_json::Value>,
    phases: Option<serde_json::Value>,
    roe_code: Option<String>,
    doctrine_template_id: Option<String>,
    doctrine_code: Option<String>,
}
