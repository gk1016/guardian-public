use std::sync::Arc;
use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::auth::rate_limit::RateLimiter;
use crate::config::Config;
use crate::federation::peer::PeerRegistry;
use crate::federation::types::FederationEvent;
use crate::ai::AiState;
use guardian_comms::CommsEngine;

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
    /// Federation peer registry (shared with manager and outbound functions)
    pub peer_registry: PeerRegistry,
    /// Discord bot task handle (for start/stop lifecycle)
    pub discord_handle: Arc<tokio::sync::Mutex<Option<tokio::task::JoinHandle<()>>>>,
    /// HTTP client for reverse proxying to upstream frontend
    pub http_client: reqwest::Client,
    /// Tactical comms engine (channels, messages, WS rooms)
    pub comms: CommsEngine,
}

impl AppState {
    pub fn new(pool: PgPool, config: Config, cert_fingerprint: String) -> Self {
        let (event_tx, _) = broadcast::channel(256);
        let (federation_tx, _) = broadcast::channel(256);

        // Build a shared HTTP client for proxying
        let http_client = reqwest::Client::builder()
            .no_proxy()  // internal traffic, skip proxy env vars
            .pool_max_idle_per_host(20)
            .build()
            .expect("failed to build HTTP client");

        // Comms engine shares the DB pool
        let comms = CommsEngine::new(pool.clone());

        Self {
            inner: Arc::new(Inner {
                pool,
                config,
                event_tx,
                federation_tx,
                cert_fingerprint,
                ai: Arc::new(AiState::new()),
                rate_limiter: Arc::new(RateLimiter::new()),
                peer_registry: PeerRegistry::new(),
                discord_handle: Arc::new(tokio::sync::Mutex::new(None)),
                http_client,
                comms,
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

    pub fn peers(&self) -> &PeerRegistry {
        &self.inner.peer_registry
    }

    pub fn discord_handle(&self) -> &tokio::sync::Mutex<Option<tokio::task::JoinHandle<()>>> {
        &self.inner.discord_handle
    }

    /// HTTP client for reverse proxying to upstream frontend.
    pub fn http_client(&self) -> &reqwest::Client {
        &self.inner.http_client
    }

    /// Tactical comms engine.
    pub fn comms(&self) -> &CommsEngine {
        &self.inner.comms
    }
}

/// Allow extractors to get AppState from &AppState
impl AsRef<AppState> for AppState {
    fn as_ref(&self) -> &AppState {
        self
    }
}
