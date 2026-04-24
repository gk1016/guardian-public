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
//! - Peers connect via TLS WebSocket with certificate fingerprint pinning
//! - Messages are typed envelopes with routing metadata
//! - No central authority — pure mesh topology
//!
//! Security:
//! - Self-signed TLS cert generated on first boot (stored on disk)
//! - SHA-256 cert fingerprint used for peer identity verification
//! - Configurable trusted fingerprints or trust-on-first-use mode
//! - Optional pre-shared key (PSK) validation in Hello handshake

pub mod types;
pub mod protocol;
pub mod peer;
pub mod manager;
pub mod chat;
pub mod file_transfer;
pub mod data_sync;
pub mod tls;
pub mod consumer;
