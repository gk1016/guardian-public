//! Federation Module — ATAK-style peer mesh
//!
//! Guardian instances can form a federated mesh where they:
//! - Discover and authenticate peer instances
//! - Exchange chat messages in real-time
//! - Share files (doctrine docs, imagery, etc.)
//! - Sync operational data (intel reports, mission status)
//!
//! Architecture mirrors ATAK's federated server model:
//! - Each instance has a unique ID and display name
//! - Peers connect via WebSocket (upgradeable to mTLS)
//! - Messages are typed envelopes with routing metadata
//! - No central authority — pure mesh topology

pub mod types;
pub mod protocol;
pub mod peer;
pub mod manager;
pub mod chat;
pub mod file_transfer;
pub mod data_sync;
