//! Inter-instance chat — relay chat messages between federated Guardian instances.
//!
//! Channels:
//! - "general" — open chat between all connected instances
//! - "ops" — operational coordination
//! - "intel" — intel sharing discussions
//! - Custom org-specific channels

use tracing::{info, warn};

use crate::federation::types::{ChatData, FederationPayload};
use crate::federation::protocol;
use crate::state::AppState;

/// Send a chat message to all connected peers.
pub async fn broadcast_chat(
    state: &AppState,
    channel: &str,
    sender_handle: &str,
    text: &str,
) -> usize {
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

    let sent = state.peers().broadcast_msg(&msg).await;
    info!(
        channel = %channel,
        sender = %sender_handle,
        peers_reached = sent,
        "federation chat broadcast"
    );
    sent
}

/// Send a chat message to a specific peer instance.
pub async fn direct_chat(
    state: &AppState,
    target_instance: &str,
    channel: &str,
    sender_handle: &str,
    text: &str,
) -> bool {
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

    let ok = state.peers().send_msg_to(target_instance, &msg).await;
    if ok {
        info!(
            target = %target_instance,
            channel = %channel,
            sender = %sender_handle,
            "federation direct chat sent"
        );
    } else {
        warn!(
            target = %target_instance,
            channel = %channel,
            "federation direct chat failed: peer not connected"
        );
    }
    ok
}
