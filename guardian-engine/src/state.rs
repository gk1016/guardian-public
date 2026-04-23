use std::sync::Arc;
use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::auth::rate_limit::RateLimiter;
use crate::config::Config;
use crate::federation::types::FederationEvent;
use crate::ai::AiState;

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
    /// AI provider state (runtime-swappable)
    pub ai: Arc<AiState>,
    /// Login rate limiter
    pub rate_limiter: Arc<RateLimiter>,
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
                ai: Arc::new(AiState::new()),
                rate_limiter: Arc::new(RateLimiter::new()),
            }),
        }
    }

    pub fn pool(&self) -> &PgPool {
        &self.inner.pool
    }

    pub fn config(&self) -> &Config {
        &self.inner.config
    }

    pub fn auth_secret(&self) -> &str {
        &self.inner.config.auth_secret
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

    pub fn ai(&self) -> &AiState {
        &self.inner.ai
    }

    pub fn rate_limiter(&self) -> &RateLimiter {
        &self.inner.rate_limiter
    }
}

/// Allow extractors to get AppState from &AppState
impl AsRef<AppState> for AppState {
    fn as_ref(&self) -> &AppState {
        self
    }
}
