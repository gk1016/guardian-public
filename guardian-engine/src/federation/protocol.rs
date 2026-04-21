//! Federation wire protocol helpers.
//!
//! Messages are JSON-encoded FederationMessage envelopes sent over WebSocket
//! text frames. Binary frames reserved for future raw file chunk streaming.

use crate::federation::types::{FederationMessage, FederationPayload, HelloData};
use chrono::Utc;

/// Create a new outbound message envelope.
pub fn envelope(
    from_id: &str,
    from_name: &str,
    to_instance: Option<String>,
    payload: FederationPayload,
) -> FederationMessage {
    FederationMessage {
        id: uuid::Uuid::new_v4().to_string(),
        from_instance: from_id.to_string(),
        from_name: from_name.to_string(),
        to_instance,
        timestamp: Utc::now(),
        payload,
    }
}

/// Create the initial Hello handshake message.
pub fn hello_message(
    instance_id: &str,
    instance_name: &str,
    psk_hash: Option<String>,
) -> FederationMessage {
    envelope(
        instance_id,
        instance_name,
        None,
        FederationPayload::Hello(HelloData {
            instance_id: instance_id.to_string(),
            instance_name: instance_name.to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            auth_token: psk_hash,
        }),
    )
}

/// Serialize a message for transmission.
pub fn encode(msg: &FederationMessage) -> Result<String, serde_json::Error> {
    serde_json::to_string(msg)
}

/// Deserialize a received message.
pub fn decode(raw: &str) -> Result<FederationMessage, serde_json::Error> {
    serde_json::from_str(raw)
}
