use std::sync::Arc;
use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::config::Config;
use crate::federation::types::FederationEvent;

/// Shared application state passed to all route handlers and background tasks.
#[derive(Clone)]
pub struct AppState {
    inner: Arc<Inner>,
}

struct Inner {
    pub pool: PgPool,
    pub config: Config,
    /// Broadcast channel for real-time events pushed to WebSocket clients
    pub event_tx: broadcast::Sender<String>,
    /// Broadcast channel for federation events (inter-instance)
    pub federation_tx: broadcast::Sender<FederationEvent>,
    /// This instance's TLS certificate fingerprint (SHA-256 hex)
    pub cert_fingerprint: String,
}

impl AppState {
    pub fn new(pool: PgPool, config: Config, cert_fingerprint: String) -> Self {
        let (event_tx, _) = broadcast::channel(256);
        let (federation_tx, _) = broadcast::channel(256);
        Self {
            inner: Arc::new(Inner {
                pool,
                config,
                event_tx,
                federation_tx,
                cert_fingerprint,
            }),
        }
    }

    pub fn pool(&self) -> &PgPool {
        &self.inner.pool
    }

    pub fn config(&self) -> &Config {
        &self.inner.config
    }

    pub fn event_tx(&self) -> &broadcast::Sender<String> {
        &self.inner.event_tx
    }

    pub fn federation_tx(&self) -> &broadcast::Sender<FederationEvent> {
        &self.inner.federation_tx
    }

    pub fn cert_fingerprint(&self) -> &str {
        &self.inner.cert_fingerprint
    }
}
