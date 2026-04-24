//! Inbound federation message consumer.
//!
//! Subscribes to the federation broadcast channel and processes incoming
//! messages from connected peers:
//! - Chat → relay to local WebSocket clients
//! - DataSync/IntelReport → insert into local DB as federated intel
//! - DataSync/MissionStatus → relay to frontend for situational awareness
//! - DataSync/QrfStatus → relay to frontend
//! - FileOffer → auto-accept (configurable)
//! - FileChunk → reassemble and store

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use sqlx::PgPool;
use tracing::{info, warn, error};

use crate::state::AppState;
use crate::federation::types::{FederationEvent, FederationPayload, DataSyncPayload};
use crate::federation::file_transfer;

/// In-progress file transfer state.
struct InFlightFile {
    filename: String,
    expected_sha256: String,
    total_chunks: u32,
    chunks: HashMap<u32, Vec<u8>>,
}

/// Start the inbound message consumer as a background task.
pub fn start(state: AppState) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut rx = state.federation_tx().subscribe();
        let in_flight: Arc<RwLock<HashMap<String, InFlightFile>>> =
            Arc::new(RwLock::new(HashMap::new()));

        info!("federation inbound consumer started");

        loop {
            match rx.recv().await {
                Ok(event) => {
                    match event {
                        FederationEvent::PeerConnected { instance_id, name } => {
                            // Notify frontend about peer connection
                            let event_json = serde_json::json!({
                                "type": "federation_peer_connected",
                                "instance_id": instance_id,
                                "name": name,
                            });
                            let _ = state.event_tx().send(event_json.to_string());
                            info!(
                                instance = %instance_id,
                                name = %name,
                                "peer connected event relayed to frontend"
                            );
                        }
                        FederationEvent::PeerDisconnected { instance_id } => {
                            let event_json = serde_json::json!({
                                "type": "federation_peer_disconnected",
                                "instance_id": instance_id,
                            });
                            let _ = state.event_tx().send(event_json.to_string());
                        }
                        FederationEvent::MessageReceived(msg) => {
                            match msg.payload {
                                FederationPayload::Chat(chat) => {
                                    handle_chat(
                                        &state,
                                        &msg.from_instance,
                                        &msg.from_name,
                                        &chat.channel,
                                        &chat.sender_handle,
                                        &chat.text,
                                    ).await;
                                }
                                FederationPayload::DataSync(sync) => {
                                    handle_data_sync(
                                        &state,
                                        state.pool(),
                                        &msg.from_instance,
                                        &msg.from_name,
                                        sync,
                                    ).await;
                                }
                                FederationPayload::FileOffer(offer) => {
                                    info!(
                                        from = %msg.from_name,
                                        file = %offer.filename,
                                        size = offer.size_bytes,
                                        "incoming file offer"
                                    );
                                    // Auto-accept file offers
                                    file_transfer::respond_to_offer(
                                        &state,
                                        &msg.from_instance,
                                        &offer.file_id,
                                        true,
                                        None,
                                    ).await;

                                    // Track in-flight transfer
                                    in_flight.write().await.insert(
                                        offer.file_id.clone(),
                                        InFlightFile {
                                            filename: offer.filename,
                                            expected_sha256: offer.sha256,
                                            total_chunks: offer.total_chunks,
                                            chunks: HashMap::new(),
                                        },
                                    );
                                }
                                FederationPayload::FileChunk(chunk) => {
                                    let mut transfers = in_flight.write().await;
                                    if let Some(file) = transfers.get_mut(&chunk.file_id) {
                                        file.chunks.insert(chunk.chunk_index, chunk.data);

                                        // Check if transfer is complete
                                        if file.chunks.len() as u32 == file.total_chunks {
                                            let mut assembled = Vec::new();
                                            for i in 0..file.total_chunks {
                                                if let Some(data) = file.chunks.get(&i) {
                                                    assembled.extend_from_slice(data);
                                                }
                                            }

                                            // Verify SHA-256
                                            use sha2::{Sha256, Digest};
                                            let mut hasher = Sha256::new();
                                            hasher.update(&assembled);
                                            let actual_sha = hex::encode(hasher.finalize());

                                            if actual_sha == file.expected_sha256 {
                                                info!(
                                                    file_id = %chunk.file_id,
                                                    filename = %file.filename,
                                                    size = assembled.len(),
                                                    "file transfer complete, SHA-256 verified"
                                                );
                                                // Store to federation received files directory
                                                let recv_dir = state.config().cert_dir
                                                    .parent()
                                                    .unwrap_or(std::path::Path::new("/data/guardian"))
                                                    .join("received_files");
                                                let _ = tokio::fs::create_dir_all(&recv_dir).await;
                                                let dest = recv_dir.join(&file.filename);
                                                if let Err(e) = tokio::fs::write(&dest, &assembled).await {
                                                    error!(error = %e, "failed to write received file");
                                                } else {
                                                    info!(path = %dest.display(), "received file saved");
                                                }
                                            } else {
                                                warn!(
                                                    file_id = %chunk.file_id,
                                                    expected = %file.expected_sha256,
                                                    actual = %actual_sha,
                                                    "file transfer SHA-256 mismatch"
                                                );
                                            }

                                            transfers.remove(&chunk.file_id);
                                        }
                                    }
                                }
                                FederationPayload::FileAck(ack) => {
                                    info!(
                                        file_id = %ack.file_id,
                                        accepted = ack.accepted,
                                        reason = ?ack.reason,
                                        "file ack received from peer"
                                    );
                                    // TODO: trigger chunk streaming if accepted
                                }
                                // Hello/Ping/Pong handled by manager, shouldn't reach here
                                _ => {}
                            }
                        }
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    warn!(missed = n, "federation consumer lagged, dropped messages");
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    info!("federation broadcast channel closed, consumer exiting");
                    break;
                }
            }
        }
    })
}

/// Relay a chat message from a federated peer to local WebSocket clients.
async fn handle_chat(
    state: &AppState,
    from_instance: &str,
    from_name: &str,
    channel: &str,
    sender_handle: &str,
    text: &str,
) {
    let event_json = serde_json::json!({
        "type": "federation_chat",
        "from_instance": from_instance,
        "from_name": from_name,
        "channel": channel,
        "sender_handle": sender_handle,
        "text": text,
    });
    let _ = state.event_tx().send(event_json.to_string());
    info!(
        from = %from_name,
        channel = %channel,
        sender = %sender_handle,
        "federation chat relayed to frontend"
    );
}

/// Process incoming data sync payloads.
async fn handle_data_sync(
    state: &AppState,
    pool: &PgPool,
    from_instance: &str,
    from_name: &str,
    sync: DataSyncPayload,
) {
    match sync {
        DataSyncPayload::IntelReport {
            report_id,
            title,
            report_type,
            severity,
            description,
            star_system,
            hostile_group,
        } => {
            // Insert as federated intel (source tracked)
            let result = sqlx::query(
                r#"
                INSERT INTO "FederatedIntel" (
                    id, "sourceInstanceId", "sourceInstanceName",
                    "remoteReportId", title, "reportType", severity,
                    description, "starSystem", "hostileGroup",
                    "receivedAt"
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
                )
                ON CONFLICT ("sourceInstanceId", "remoteReportId") DO UPDATE SET
                    title = EXCLUDED.title,
                    severity = EXCLUDED.severity,
                    description = EXCLUDED.description,
                    "starSystem" = EXCLUDED."starSystem",
                    "hostileGroup" = EXCLUDED."hostileGroup",
                    "receivedAt" = NOW()
                "#
            )
            .bind(from_instance)
            .bind(from_name)
            .bind(&report_id)
            .bind(&title)
            .bind(&report_type)
            .bind(severity)
            .bind(&description)
            .bind(&star_system)
            .bind(&hostile_group)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {
                    info!(
                        from = %from_name,
                        report = %title,
                        "federated intel report ingested"
                    );
                    // Relay to frontend
                    let event_json = serde_json::json!({
                        "type": "federation_intel",
                        "from_instance": from_instance,
                        "from_name": from_name,
                        "report_id": report_id,
                        "title": title,
                        "report_type": report_type,
                        "severity": severity,
                        "star_system": star_system,
                        "hostile_group": hostile_group,
                    });
                    let _ = state.event_tx().send(event_json.to_string());
                }
                Err(e) => {
                    // Table may not exist yet — relay to frontend anyway
                    warn!(
                        error = %e,
                        from = %from_name,
                        "failed to insert federated intel (table may not exist yet)"
                    );
                    let event_json = serde_json::json!({
                        "type": "federation_intel",
                        "from_instance": from_instance,
                        "from_name": from_name,
                        "report_id": report_id,
                        "title": title,
                        "report_type": report_type,
                        "severity": severity,
                        "star_system": star_system,
                        "hostile_group": hostile_group,
                    });
                    let _ = state.event_tx().send(event_json.to_string());
                }
            }
        }
        DataSyncPayload::MissionStatus {
            mission_id,
            callsign,
            status,
            mission_type,
        } => {
            // Relay to frontend for situational awareness (don't store locally)
            let event_json = serde_json::json!({
                "type": "federation_mission_status",
                "from_instance": from_instance,
                "from_name": from_name,
                "mission_id": mission_id,
                "callsign": callsign,
                "status": status,
                "mission_type": mission_type,
            });
            let _ = state.event_tx().send(event_json.to_string());
            info!(
                from = %from_name,
                callsign = %callsign,
                status = %status,
                "federated mission status relayed"
            );
        }
        DataSyncPayload::QrfStatus {
            callsign,
            status,
            available_crew,
        } => {
            let event_json = serde_json::json!({
                "type": "federation_qrf_status",
                "from_instance": from_instance,
                "from_name": from_name,
                "callsign": callsign,
                "status": status,
                "available_crew": available_crew,
            });
            let _ = state.event_tx().send(event_json.to_string());
            info!(
                from = %from_name,
                callsign = %callsign,
                "federated QRF status relayed"
            );
        }
    }
}
