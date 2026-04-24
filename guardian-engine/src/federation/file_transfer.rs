//! File transfer between federated instances.
//!
//! Protocol:
//! 1. Sender sends FileOffer with metadata (name, size, sha256, chunk count)
//! 2. Receiver responds with FileAck (accept/reject)
//! 3. If accepted, sender streams FileChunk messages
//! 4. Receiver assembles and verifies SHA-256
//!
//! Chunk size: 64KB (fits comfortably in a WebSocket text frame as hex)

use sha2::{Sha256, Digest};
use tracing::{info, warn};

use crate::federation::types::{FileOfferData, FileChunkData, FileAckData, FederationPayload};
use crate::federation::protocol;
use crate::state::AppState;

pub const CHUNK_SIZE: usize = 64 * 1024; // 64KB

/// Initiate a file transfer to a specific peer.
/// Returns the file_id for tracking, or None if peer is not connected.
pub async fn offer_file(
    state: &AppState,
    target_instance: &str,
    filename: &str,
    data: &[u8],
) -> Option<String> {
    let file_id = uuid::Uuid::new_v4().to_string();
    let total_chunks = ((data.len() + CHUNK_SIZE - 1) / CHUNK_SIZE) as u32;

    // Compute SHA-256
    let mut hasher = Sha256::new();
    hasher.update(data);
    let sha256 = hex::encode(hasher.finalize());

    let offer = protocol::envelope(
        &state.config().instance_id,
        &state.config().instance_name,
        Some(target_instance.to_string()),
        FederationPayload::FileOffer(FileOfferData {
            file_id: file_id.clone(),
            filename: filename.to_string(),
            size_bytes: data.len() as u64,
            sha256,
            total_chunks,
        }),
    );

    if state.peers().send_msg_to(target_instance, &offer).await {
        info!(
            file_id = %file_id,
            filename = %filename,
            size = data.len(),
            chunks = total_chunks,
            target = %target_instance,
            "file offer sent to peer"
        );
        Some(file_id)
    } else {
        warn!(
            target = %target_instance,
            filename = %filename,
            "file offer failed: peer not connected"
        );
        None
    }
}

/// Stream file chunks to a peer after offer acceptance.
pub async fn send_chunks(
    state: &AppState,
    target_instance: &str,
    file_id: &str,
    data: &[u8],
) -> usize {
    let mut sent = 0;
    for (i, chunk) in data.chunks(CHUNK_SIZE).enumerate() {
        let msg = protocol::envelope(
            &state.config().instance_id,
            &state.config().instance_name,
            Some(target_instance.to_string()),
            FederationPayload::FileChunk(FileChunkData {
                file_id: file_id.to_string(),
                chunk_index: i as u32,
                data: chunk.to_vec(),
            }),
        );

        if state.peers().send_msg_to(target_instance, &msg).await {
            sent += 1;
        } else {
            warn!(
                file_id = %file_id,
                chunk = i,
                "file chunk send failed, aborting transfer"
            );
            break;
        }
    }
    sent
}

/// Accept or reject an incoming file offer.
pub async fn respond_to_offer(
    state: &AppState,
    target_instance: &str,
    file_id: &str,
    accept: bool,
    reason: Option<String>,
) -> bool {
    let ack = protocol::envelope(
        &state.config().instance_id,
        &state.config().instance_name,
        Some(target_instance.to_string()),
        FederationPayload::FileAck(FileAckData {
            file_id: file_id.to_string(),
            accepted: accept,
            reason,
        }),
    );

    state.peers().send_msg_to(target_instance, &ack).await
}
