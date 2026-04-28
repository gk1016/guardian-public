//! Federation bridge — relay messages between federated instances.

use sqlx::PgPool;
use tracing::info;

use crate::access;
use crate::message;
use crate::types::{
    Classification, MessageType, SendMessageRequest, SenderType, WsEvent,
};
use crate::ws::{RoomRegistry, TaggedEvent};

/// Data structure for federation chat relay.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FederatedChatMessage {
    pub channel_id: String,
    pub channel_name: String,
    pub sender_handle: String,
    pub text: String,
    pub classification: String,
    pub source_instance_id: String,
    pub source_instance_name: String,
}

/// Ingest an inbound federated chat message.
pub async fn ingest_inbound(
    pool: &PgPool,
    registry: &RoomRegistry,
    msg: &FederatedChatMessage,
) -> Result<(), sqlx::Error> {
    let local_channel: Option<(String, bool)> = sqlx::query_as(
        r#"SELECT id, encrypted FROM "ChatChannel"
           WHERE name = $1 AND scope = 'federated'
           LIMIT 1"#,
    )
    .bind(&msg.channel_name)
    .fetch_optional(pool)
    .await?;

    let (channel_id, channel_encrypted) = match local_channel {
        Some((id, enc)) => (id, enc),
        None => {
            info!(
                channel_name = %msg.channel_name,
                source = %msg.source_instance_name,
                "no local federated channel found, dropping inbound message"
            );
            return Ok(());
        }
    };

    let classification = access::parse_classification(&msg.classification);
    let row = message::send_message(
        pool,
        &channel_id,
        channel_encrypted,
        &SendMessageRequest {
            sender_id: None,
            sender_handle: format!("[{}] {}", msg.source_instance_name, msg.sender_handle),
            sender_type: SenderType::Federation,
            content: msg.text.clone(),
            message_type: MessageType::Text,
            classification,
        },
    )
    .await?;

    let event = WsEvent::Message {
        channel_id: channel_id.clone(),
        message: row,
    };
    let payload = serde_json::to_string(&event).unwrap();
    registry.broadcast(
        &channel_id,
        TaggedEvent {
            classification,
            payload,
        },
    );

    info!(
        channel_name = %msg.channel_name,
        source = %msg.source_instance_name,
        sender = %msg.sender_handle,
        "federated message ingested"
    );

    Ok(())
}

/// Package an outbound message for federation relay.
pub fn package_outbound(
    channel_name: &str,
    sender_handle: &str,
    content: &str,
    classification: &str,
    instance_id: &str,
    instance_name: &str,
) -> FederatedChatMessage {
    FederatedChatMessage {
        channel_id: String::new(),
        channel_name: channel_name.to_string(),
        sender_handle: sender_handle.to_string(),
        text: content.to_string(),
        classification: classification.to_string(),
        source_instance_id: instance_id.to_string(),
        source_instance_name: instance_name.to_string(),
    }
}
