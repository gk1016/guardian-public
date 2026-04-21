//! Federation wire types — the message envelope and payload definitions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Top-level federation message envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederationMessage {
    /// Unique message ID
    pub id: String,
    /// Sender instance ID
    pub from_instance: String,
    /// Sender instance display name
    pub from_name: String,
    /// Target instance ID (None = broadcast to all peers)
    pub to_instance: Option<String>,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Message payload
    pub payload: FederationPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum FederationPayload {
    /// Handshake / peer introduction
    Hello(HelloData),
    /// Heartbeat keepalive
    Ping,
    /// Heartbeat response
    Pong,
    /// Chat message between instances
    Chat(ChatData),
    /// File transfer initiation
    FileOffer(FileOfferData),
    /// File chunk
    FileChunk(FileChunkData),
    /// File transfer acknowledgement
    FileAck(FileAckData),
    /// Shared operational data (intel, mission status, etc.)
    DataSync(DataSyncPayload),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloData {
    pub instance_id: String,
    pub instance_name: String,
    pub version: String,
    /// Pre-shared key hash for authentication (temporary until mTLS)
    pub auth_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatData {
    /// Channel name (e.g., "general", "ops", "intel")
    pub channel: String,
    /// Sender display handle
    pub sender_handle: String,
    /// Message text
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOfferData {
    pub file_id: String,
    pub filename: String,
    pub size_bytes: u64,
    pub sha256: String,
    pub total_chunks: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChunkData {
    pub file_id: String,
    pub chunk_index: u32,
    #[serde(with = "base64_serde")]
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileAckData {
    pub file_id: String,
    pub accepted: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum DataSyncPayload {
    /// Share an intel report with a peer
    IntelReport {
        report_id: String,
        title: String,
        report_type: String,
        severity: i32,
        description: Option<String>,
        star_system: Option<String>,
        hostile_group: Option<String>,
    },
    /// Share mission status summary (no sensitive details)
    MissionStatus {
        mission_id: String,
        callsign: String,
        status: String,
        mission_type: String,
    },
    /// Share a QRF readiness snapshot
    QrfStatus {
        callsign: String,
        status: String,
        available_crew: i32,
    },
}

/// Broadcast event for internal federation event bus.
#[derive(Debug, Clone)]
pub enum FederationEvent {
    PeerConnected { instance_id: String, name: String },
    PeerDisconnected { instance_id: String },
    MessageReceived(FederationMessage),
}

/// Base64 serde helper for file chunk data.
mod base64_serde {
    use serde::{Deserialize, Deserializer, Serializer};
    use serde::de::Error;

    pub fn serialize<S: Serializer>(data: &[u8], s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::Serialize;
        // Use standard base64 encoding via a simple implementation
        let encoded = data.iter().map(|b| format!("{:02x}", b)).collect::<String>();
        encoded.serialize(s)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<u8>, D::Error> {
        let s = String::deserialize(d)?;
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i+2], 16).map_err(D::Error::custom))
            .collect()
    }
}
