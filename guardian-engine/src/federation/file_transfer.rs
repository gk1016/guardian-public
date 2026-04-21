//! File transfer between federated instances.
//!
//! Protocol:
//! 1. Sender sends FileOffer with metadata (name, size, sha256, chunk count)
//! 2. Receiver responds with FileAck (accept/reject)
//! 3. If accepted, sender streams FileChunk messages
//! 4. Receiver assembles and verifies SHA-256
//!
//! Chunk size: 64KB (fits comfortably in a WebSocket text frame as hex)

use crate::federation::types::{FileOfferData, FileChunkData, FileAckData, FederationPayload};
use crate::federation::protocol;
use crate::state::AppState;

pub const CHUNK_SIZE: usize = 64 * 1024; // 64KB

/// Initiate a file transfer to a specific peer.
pub async fn offer_file(
    state: &AppState,
    target_instance: &str,
    filename: &str,
    data: &[u8],
) -> String {
    let file_id = uuid::Uuid::new_v4().to_string();
    let total_chunks = ((data.len() + CHUNK_SIZE - 1) / CHUNK_SIZE) as u32;

    // Compute SHA-256
    // TODO: Use a proper SHA-256 implementation (ring or sha2 crate)
    let sha256 = format!("{:x}", data.len()); // placeholder

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

    // TODO: Send offer via peer connection, wait for FileAck,
    // then stream chunks.
    let _ = offer;

    file_id
}

/// Accept or reject an incoming file offer.
pub async fn respond_to_offer(
    state: &AppState,
    target_instance: &str,
    file_id: &str,
    accept: bool,
    reason: Option<String>,
) {
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

    // TODO: Send via peer connection
    let _ = ack;
}
