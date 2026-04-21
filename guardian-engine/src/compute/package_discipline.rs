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
    let _rows = sqlx::query(
        r#"
        SELECT m.id, m.callsign, m.status, m."missionBrief",
               m."mettTc", m.phases, m."roeCode",
               m."doctrineTemplateId",
               dt.code as doctrine_code
        FROM "Mission" m
        LEFT JOIN "DoctrineTemplate" dt ON m."doctrineTemplateId" = dt.id
        WHERE m.status IN ('planning', 'active', 'in_progress')
        "#
    )
    .fetch_all(pool)
    .await?;

    // TODO: Implement validation logic against each doctrine template's requirements
    // For each mission row:
    //   1. Check if METT-TC is populated when doctrine requires it
    //   2. Verify phases are defined for multi-phase doctrine types
    //   3. Confirm ROE code is set
    //   4. Check participant minimums
    Ok(vec![])
}
