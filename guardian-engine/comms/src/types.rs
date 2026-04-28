//! Core types for the tactical comms system.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ── Channel types ──────────────────────────────────────────────────────────

/// Channel hierarchy level — concentric rings of trust.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ChannelType {
    /// Org-wide or federation-wide. "All stations this net."
    Net,
    /// Mission/CSAR/QRF scoped. Membership tied to operational context.
    Group,
    /// Sub-unit within a group. Flight lead + wingman, rescue bird + escort.
    Team,
    /// 1:1 private channel.
    Direct,
}

/// What the channel is attached to (polymorphic reference).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RefType {
    Csar,
    Mission,
    Qrf,
    Federation,
    Org,
}

/// Whether channel traffic stays local or relays to federation peers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ChannelScope {
    /// Internal org chat. Never leaves the instance.
    Local,
    /// Inter-org channel. Messages relay to connected federation peers.
    Federated,
}

// ── Participant types ──────────────────────────────────────────────────────

/// Access tier for a participant — determines what they can see.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum Clearance {
    /// CSAR survivor or QRF client. Single channel, limited visibility.
    Customer = 0,
    /// Federation/indigenous forces. Sees messages but filtered participant list.
    Tactical = 1,
    /// Full access. All messages, all participants, all metadata.
    Full = 2,
}

/// Role within the channel (for display and moderation).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ParticipantRole {
    Member,
    Admin,
    Observer,
}

// ── Message types ──────────────────────────────────────────────────────────

/// Message classification — controls delivery to lower-clearance participants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum Classification {
    /// Visible to all clearance levels.
    Unclass = 0,
    /// Visible to Tactical and Full only. Customers don't see these.
    Restricted = 1,
    /// Full clearance only.
    Internal = 2,
}

/// What kind of message this is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    Text,
    System,
    Encrypted,
    File,
}

/// Who sent the message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum SenderType {
    User,
    System,
    Operator,
    Federation,
}

// ── Row types (from database) ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChannelRow {
    pub id: String,
    #[sqlx(rename = "orgId")]
    pub org_id: String,
    #[sqlx(rename = "channelType")]
    pub channel_type: String,
    pub scope: String,
    #[sqlx(rename = "refType")]
    pub ref_type: Option<String>,
    #[sqlx(rename = "refId")]
    pub ref_id: Option<String>,
    pub name: String,
    pub encrypted: bool,
    #[sqlx(rename = "parentChannelId")]
    pub parent_channel_id: Option<String>,
    #[sqlx(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MessageRow {
    pub id: String,
    #[sqlx(rename = "channelId")]
    pub channel_id: String,
    #[sqlx(rename = "senderId")]
    pub sender_id: Option<String>,
    #[sqlx(rename = "senderHandle")]
    pub sender_handle: String,
    #[sqlx(rename = "senderType")]
    pub sender_type: String,
    pub content: String,
    #[sqlx(rename = "messageType")]
    pub message_type: String,
    pub classification: String,
    pub encrypted: bool,
    #[sqlx(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantRow {
    pub id: String,
    #[sqlx(rename = "channelId")]
    pub channel_id: String,
    #[sqlx(rename = "userId")]
    pub user_id: Option<String>,
    pub handle: String,
    pub clearance: String,
    pub role: String,
    #[sqlx(rename = "lastReadAt")]
    pub last_read_at: Option<DateTime<Utc>>,
    #[sqlx(rename = "joinedAt")]
    pub joined_at: DateTime<Utc>,
}

// ── Request / event types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChannelRequest {
    pub org_id: String,
    pub channel_type: ChannelType,
    pub scope: ChannelScope,
    pub ref_type: Option<RefType>,
    pub ref_id: Option<String>,
    pub name: String,
    pub encrypted: bool,
    pub parent_channel_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageRequest {
    pub sender_id: Option<String>,
    pub sender_handle: String,
    pub sender_type: SenderType,
    pub content: String,
    pub message_type: MessageType,
    pub classification: Classification,
}

/// Real-time event pushed over WebSocket.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum WsEvent {
    #[serde(rename = "chat:message")]
    Message {
        channel_id: String,
        message: MessageRow,
    },
    #[serde(rename = "chat:typing")]
    Typing {
        channel_id: String,
        user_id: String,
        handle: String,
        active: bool,
    },
    #[serde(rename = "chat:presence")]
    Presence {
        channel_id: String,
        user_id: String,
        handle: String,
        online: bool,
    },
    #[serde(rename = "chat:joined")]
    ParticipantJoined {
        channel_id: String,
        participant: ParticipantRow,
    },
    #[serde(rename = "chat:left")]
    ParticipantLeft {
        channel_id: String,
        user_id: String,
    },
}
