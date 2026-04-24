//! Peer registry — tracks connected federation peers and their message channels.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use chrono::{DateTime, Utc};
use tracing::{info, warn};

use crate::federation::protocol;
use crate::federation::types::FederationMessage;

#[derive(Debug, Clone)]
pub struct PeerInfo {
    pub instance_id: String,
    pub instance_name: String,
    pub address: String,
    pub version: String,
    pub connected_at: DateTime<Utc>,
    pub last_heartbeat: DateTime<Utc>,
}

/// Thread-safe peer registry with message routing.
#[derive(Clone, Default)]
pub struct PeerRegistry {
    peers: Arc<RwLock<HashMap<String, PeerInfo>>>,
    /// Write channels to each connected peer's writer task.
    /// Key: instance_id, Value: unbounded sender of serialized JSON messages.
    senders: Arc<RwLock<HashMap<String, mpsc::UnboundedSender<String>>>>,
}

impl PeerRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register peer metadata.
    pub async fn register(&self, info: PeerInfo) {
        let id = info.instance_id.clone();
        self.peers.write().await.insert(id, info);
    }

    /// Register a sender channel for a connected peer.
    pub async fn register_sender(&self, instance_id: &str, tx: mpsc::UnboundedSender<String>) {
        self.senders.write().await.insert(instance_id.to_string(), tx);
    }

    /// Remove a peer entirely (metadata + sender).
    pub async fn remove(&self, instance_id: &str) {
        self.peers.write().await.remove(instance_id);
        self.senders.write().await.remove(instance_id);
    }

    /// Update heartbeat timestamp for a peer.
    pub async fn heartbeat(&self, instance_id: &str) {
        if let Some(peer) = self.peers.write().await.get_mut(instance_id) {
            peer.last_heartbeat = Utc::now();
        }
    }

    /// List all connected peers.
    pub async fn list(&self) -> Vec<PeerInfo> {
        self.peers.read().await.values().cloned().collect()
    }

    /// Get a specific peer by instance_id.
    pub async fn get(&self, instance_id: &str) -> Option<PeerInfo> {
        self.peers.read().await.get(instance_id).cloned()
    }

    /// Number of connected peers.
    pub async fn count(&self) -> usize {
        self.peers.read().await.len()
    }

    /// Send a serialized message to a specific peer.
    /// Returns true if the message was queued, false if peer not found or channel closed.
    pub async fn send_to(&self, instance_id: &str, message: &str) -> bool {
        let senders = self.senders.read().await;
        if let Some(tx) = senders.get(instance_id) {
            match tx.send(message.to_string()) {
                Ok(()) => true,
                Err(_) => {
                    warn!(peer = %instance_id, "peer sender channel closed");
                    false
                }
            }
        } else {
            warn!(peer = %instance_id, "no sender registered for peer");
            false
        }
    }

    /// Send a typed FederationMessage to a specific peer.
    pub async fn send_msg_to(&self, instance_id: &str, msg: &FederationMessage) -> bool {
        match protocol::encode(msg) {
            Ok(encoded) => self.send_to(instance_id, &encoded).await,
            Err(e) => {
                warn!(error = %e, "failed to encode federation message");
                false
            }
        }
    }

    /// Broadcast a serialized message to all connected peers.
    /// Returns the number of peers the message was successfully queued to.
    pub async fn broadcast(&self, message: &str) -> usize {
        let senders = self.senders.read().await;
        let mut sent = 0;
        for (id, tx) in senders.iter() {
            match tx.send(message.to_string()) {
                Ok(()) => sent += 1,
                Err(_) => {
                    warn!(peer = %id, "broadcast: peer sender channel closed");
                }
            }
        }
        sent
    }

    /// Broadcast a typed FederationMessage to all connected peers.
    pub async fn broadcast_msg(&self, msg: &FederationMessage) -> usize {
        match protocol::encode(msg) {
            Ok(encoded) => self.broadcast(&encoded).await,
            Err(e) => {
                warn!(error = %e, "failed to encode federation message for broadcast");
                0
            }
        }
    }

    /// Get list of connected instance IDs.
    pub async fn connected_ids(&self) -> Vec<String> {
        self.senders.read().await.keys().cloned().collect()
    }
}
