//! Operational data synchronization between federated instances.
//!
//! Allows instances to selectively share:
//! - Intel reports (threat sightings, hostile contacts)
//! - Mission status summaries (non-sensitive)
//! - QRF readiness snapshots
//!
//! Data sharing is opt-in per organization and per data type.
//! No PII or sensitive mission details cross instance boundaries
//! unless explicitly authorized.

use sqlx::PgPool;
use crate::federation::types::{DataSyncPayload, FederationPayload};
use crate::federation::protocol;
use crate::state::AppState;

/// Share an intel report with all federated peers.
pub async fn share_intel(
    state: &AppState,
    pool: &PgPool,
    report_id: &str,
) -> anyhow::Result<()> {
    let report = sqlx::query!(
        r#"
        SELECT id, title, report_type, severity, description,
               star_system, hostile_group
        FROM "IntelReport"
        WHERE id = $1
        "#,
        report_id
    )
    .fetch_optional(pool)
    .await?;

    if let Some(r) = report {
        let msg = protocol::envelope(
            &state.config().instance_id,
            &state.config().instance_name,
            None, // broadcast
            FederationPayload::DataSync(DataSyncPayload::IntelReport {
                report_id: r.id,
                title: r.title,
                report_type: r.report_type,
                severity: r.severity,
                description: r.description,
                star_system: r.star_system,
                hostile_group: r.hostile_group,
            }),
        );

        // TODO: Send to all peers via federation manager
        let _ = msg;
    }

    Ok(())
}

/// Share a mission status summary with all federated peers.
pub async fn share_mission_status(
    state: &AppState,
    pool: &PgPool,
    mission_id: &str,
) -> anyhow::Result<()> {
    let mission = sqlx::query!(
        r#"
        SELECT id, callsign, status, mission_type
        FROM "Mission"
        WHERE id = $1
        "#,
        mission_id
    )
    .fetch_optional(pool)
    .await?;

    if let Some(m) = mission {
        let msg = protocol::envelope(
            &state.config().instance_id,
            &state.config().instance_name,
            None,
            FederationPayload::DataSync(DataSyncPayload::MissionStatus {
                mission_id: m.id,
                callsign: m.callsign,
                status: m.status,
                mission_type: m.mission_type,
            }),
        );

        let _ = msg;
    }

    Ok(())
}
