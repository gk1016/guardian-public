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

use sqlx::{PgPool, Row};
use tracing::{info, warn};

use crate::federation::types::{DataSyncPayload, FederationPayload};
use crate::federation::protocol;
use crate::state::AppState;

/// Share an intel report with all federated peers.
pub async fn share_intel(
    state: &AppState,
    pool: &PgPool,
    report_id: &str,
) -> anyhow::Result<usize> {
    let row = sqlx::query(
        r#"
        SELECT id, title, "reportType", severity, description,
               "starSystem", "hostileGroup"
        FROM "IntelReport"
        WHERE id = $1
        "#
    )
    .bind(report_id)
    .fetch_optional(pool)
    .await?;

    if let Some(r) = row {
        let msg = protocol::envelope(
            &state.config().instance_id,
            &state.config().instance_name,
            None, // broadcast
            FederationPayload::DataSync(DataSyncPayload::IntelReport {
                report_id: r.get("id"),
                title: r.get("title"),
                report_type: r.get("reportType"),
                severity: r.get("severity"),
                description: r.get("description"),
                star_system: r.get("starSystem"),
                hostile_group: r.get("hostileGroup"),
            }),
        );

        let sent = state.peers().broadcast_msg(&msg).await;
        info!(
            report_id = %report_id,
            peers_reached = sent,
            "shared intel report with federation"
        );
        Ok(sent)
    } else {
        warn!(report_id = %report_id, "intel report not found for federation share");
        Ok(0)
    }
}

/// Share a mission status summary with all federated peers.
pub async fn share_mission_status(
    state: &AppState,
    pool: &PgPool,
    mission_id: &str,
) -> anyhow::Result<usize> {
    let row = sqlx::query(
        r#"
        SELECT id, callsign, status, "missionType"
        FROM "Mission"
        WHERE id = $1
        "#
    )
    .bind(mission_id)
    .fetch_optional(pool)
    .await?;

    if let Some(m) = row {
        let msg = protocol::envelope(
            &state.config().instance_id,
            &state.config().instance_name,
            None,
            FederationPayload::DataSync(DataSyncPayload::MissionStatus {
                mission_id: m.get("id"),
                callsign: m.get("callsign"),
                status: m.get("status"),
                mission_type: m.get("missionType"),
            }),
        );

        let sent = state.peers().broadcast_msg(&msg).await;
        info!(
            mission_id = %mission_id,
            peers_reached = sent,
            "shared mission status with federation"
        );
        Ok(sent)
    } else {
        warn!(mission_id = %mission_id, "mission not found for federation share");
        Ok(0)
    }
}

/// Share a QRF readiness snapshot with all federated peers.
pub async fn share_qrf_status(
    state: &AppState,
    pool: &PgPool,
) -> anyhow::Result<usize> {
    let rows = sqlx::query(
        r#"
        SELECT callsign, status, "crewCount"
        FROM "QrfTeam"
        "#
    )
    .fetch_all(pool)
    .await?;

    let mut total_sent = 0;
    for r in &rows {
        let msg = protocol::envelope(
            &state.config().instance_id,
            &state.config().instance_name,
            None,
            FederationPayload::DataSync(DataSyncPayload::QrfStatus {
                callsign: r.get("callsign"),
                status: r.get("status"),
                available_crew: r.get("crewCount"),
            }),
        );
        total_sent += state.peers().broadcast_msg(&msg).await;
    }

    if !rows.is_empty() {
        info!(
            teams = rows.len(),
            messages_sent = total_sent,
            "shared QRF status with federation"
        );
    }
    Ok(total_sent)
}
