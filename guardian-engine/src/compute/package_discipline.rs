//! Package Discipline Validator
//!
//! Checks active missions against their attached doctrine templates to verify
//! that all required elements are present and correctly configured.
//!
//! Checks performed:
//! 1. Active/planning missions with no ROE code
//! 2. Active missions with no mission brief
//! 3. Missions with doctrine attached but no METT-TC populated
//! 4. Active missions with zero participants assigned
//! 5. Active missions with no lead assigned

use sqlx::{PgPool, Row};

/// Compliance status for a single mission against its doctrine.
#[derive(Debug)]
pub struct ComplianceResult {
    pub mission_id: String,
    pub org_id: String,
    pub callsign: String,
    pub doctrine_code: Option<String>,
    pub violations: Vec<Violation>,
}

#[derive(Debug, Clone)]
pub struct Violation {
    pub field: String,
    pub severity: ViolationSeverity,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ViolationSeverity {
    Warning,
    Critical,
}

impl std::fmt::Display for ViolationSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Warning => write!(f, "warning"),
            Self::Critical => write!(f, "critical"),
        }
    }
}

/// Check all active missions for doctrine compliance.
pub async fn check_all(pool: &PgPool) -> anyhow::Result<Vec<ComplianceResult>> {
    // Query active/planning missions with doctrine and participant counts
    let rows = sqlx::query(
        r#"
        SELECT
            m.id,
            m."orgId",
            m.callsign,
            m.status,
            m."missionBrief",
            m."mettTc",
            m."roeCode",
            m."leadId",
            m."doctrineTemplateId",
            dt.code as doctrine_code,
            dt.category as doctrine_category,
            (SELECT COUNT(*) FROM "MissionParticipant" mp WHERE mp."missionId" = m.id) as participant_count
        FROM "Mission" m
        LEFT JOIN "DoctrineTemplate" dt ON m."doctrineTemplateId" = dt.id
        WHERE m.status IN ('planning', 'active', 'in_progress')
        "#
    )
    .fetch_all(pool)
    .await?;

    let mut results = Vec::new();

    for row in &rows {
        let mission_id: String = row.get("id");
        let org_id: String = row.get("orgId");
        let callsign: String = row.get("callsign");
        let status: String = row.get("status");
        let mission_brief: Option<String> = row.get("missionBrief");
        let mett_tc: Option<serde_json::Value> = row.get("mettTc");
        let roe_code: Option<String> = row.get("roeCode");
        let lead_id: Option<String> = row.get("leadId");
        let doctrine_template_id: Option<String> = row.get("doctrineTemplateId");
        let doctrine_code: Option<String> = row.get("doctrine_code");
        let participant_count: i64 = row.get("participant_count");

        let mut violations = Vec::new();
        let is_active = status == "active" || status == "in_progress";

        // Check 1: No ROE code on any non-completed mission
        if roe_code.as_ref().map_or(true, |s| s.trim().is_empty()) {
            violations.push(Violation {
                field: "roeCode".to_string(),
                severity: if is_active { ViolationSeverity::Critical } else { ViolationSeverity::Warning },
                message: format!("Mission {} has no ROE code assigned", callsign),
            });
        }

        // Check 2: Active mission with no mission brief
        if is_active && mission_brief.as_ref().map_or(true, |s| s.trim().is_empty()) {
            violations.push(Violation {
                field: "missionBrief".to_string(),
                severity: ViolationSeverity::Warning,
                message: format!("Active mission {} has no mission brief", callsign),
            });
        }

        // Check 3: Doctrine attached but METT-TC not populated
        if doctrine_template_id.is_some() {
            let mett_empty = match &mett_tc {
                None => true,
                Some(v) => v.is_null() || (v.is_object() && v.as_object().unwrap().is_empty()),
            };
            if mett_empty {
                violations.push(Violation {
                    field: "mettTc".to_string(),
                    severity: ViolationSeverity::Critical,
                    message: format!(
                        "Mission {} has doctrine {} attached but METT-TC is empty",
                        callsign,
                        doctrine_code.as_deref().unwrap_or("unknown")
                    ),
                });
            }
        }

        // Check 4: Active mission with zero participants
        if is_active && participant_count == 0 {
            violations.push(Violation {
                field: "participants".to_string(),
                severity: ViolationSeverity::Critical,
                message: format!("Active mission {} has no participants assigned", callsign),
            });
        }

        // Check 5: Active mission with no lead
        if is_active && lead_id.is_none() {
            violations.push(Violation {
                field: "leadId".to_string(),
                severity: ViolationSeverity::Warning,
                message: format!("Active mission {} has no mission lead assigned", callsign),
            });
        }

        if !violations.is_empty() {
            results.push(ComplianceResult {
                mission_id,
                org_id,
                callsign,
                doctrine_code,
                violations,
            });
        }
    }

    Ok(results)
}
