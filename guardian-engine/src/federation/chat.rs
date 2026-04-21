//! Inter-instance chat — relay chat messages between federated Guardian instances.
//!
//! Channels:
//! - "general" — open chat between all connected instances
//! - "ops" — operational coordination
//! - "intel" — intel sharing discussions
//! - Custom org-specific channels

use crate::federation::types::{ChatData, FederationPayload};
use crate::federation::protocol;
use crate::state::AppState;

/// Send a chat message to all connected peers.
pub async fn broadcast_chat(
    state: &AppState,
    channel: &str,
    sender_handle: &str,
    text: &str,
) {
    let msg = protocol::envelope(
        &state.config().instance_id,
        &state.config().instance_name,
        None, // broadcast
        FederationPayload::Chat(ChatData {
            channel: channel.to_string(),
            sender_handle: sender_handle.to_string(),
            text: text.to_string(),
        }),
    );

    // TODO: Send to all connected peers via their WebSocket connections.
    // For now, the federation manager will handle routing when we add
    // a peer connection write-half registry.
    let _ = msg;
}

/// Send a chat message to a specific peer instance.
pub async fn direct_chat(
    state: &AppState,
    target_instance: &str,
    channel: &str,
    sender_handle: &str,
    text: &str,
) {
    let msg = protocol::envelope(
        &state.config().instance_id,
        &state.config().instance_name,
        Some(target_instance.to_string()),
        FederationPayload::Chat(ChatData {
            channel: channel.to_string(),
            sender_handle: sender_handle.to_string(),
            text: text.to_string(),
        }),
    );

    // TODO: Route to specific peer connection
    let _ = msg;
}
