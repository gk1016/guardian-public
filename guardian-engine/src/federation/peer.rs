//! Peer registry — tracks connected federation peers.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct PeerInfo {
    pub instance_id: String,
    pub instance_name: String,
    pub address: String,
    pub version: String,
    pub connected_at: DateTime<Utc>,
    pub last_heartbeat: DateTime<Utc>,
}

/// Thread-safe peer registry.
#[derive(Clone, Default)]
pub struct PeerRegistry {
    peers: Arc<RwLock<HashMap<String, PeerInfo>>>,
}

impl PeerRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn register(&self, info: PeerInfo) {
        let id = info.instance_id.clone();
        self.peers.write().await.insert(id, info);
    }

    pub async fn remove(&self, instance_id: &str) {
        self.peers.write().await.remove(instance_id);
    }

    pub async fn heartbeat(&self, instance_id: &str) {
        if let Some(peer) = self.peers.write().await.get_mut(instance_id) {
            peer.last_heartbeat = Utc::now();
        }
    }

    pub async fn list(&self) -> Vec<PeerInfo> {
        self.peers.read().await.values().cloned().collect()
    }

    pub async fn get(&self, instance_id: &str) -> Option<PeerInfo> {
        self.peers.read().await.get(instance_id).cloned()
    }

    pub async fn count(&self) -> usize {
        self.peers.read().await.len()
    }
}
