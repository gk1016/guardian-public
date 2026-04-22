pub mod config;
pub mod provider;
pub mod analysis;
pub mod prompts;

use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

use crate::state::AppState;
use config::AiConfig;
use provider::AiProvider;

/// Shared AI state — provider can be swapped at runtime when admin changes config.
pub struct AiState {
    provider: RwLock<Option<Arc<dyn AiProvider>>>,
    config: RwLock<Option<AiConfig>>,
}

impl AiState {
    pub fn new() -> Self {
        Self {
            provider: RwLock::new(None),
            config: RwLock::new(None),
        }
    }

    /// Reload provider from DB config. Called on startup and when admin updates config.
    pub async fn reload(&self, pool: &sqlx::PgPool) -> anyhow::Result<()> {
        match config::load_from_db(pool).await? {
            Some(cfg) if cfg.enabled => {
                let p = provider::build_provider(&cfg)?;
                info!(provider = %cfg.provider, model = %cfg.model, "AI provider loaded");
                *self.provider.write().await = Some(p);
                *self.config.write().await = Some(cfg);
            }
            Some(_cfg) => {
                info!("AI configured but disabled");
                *self.provider.write().await = None;
                *self.config.write().await = Some(_cfg);
            }
            None => {
                info!("no AI configuration found");
                *self.provider.write().await = None;
                *self.config.write().await = None;
            }
        }
        Ok(())
    }

    pub async fn provider(&self) -> Option<Arc<dyn AiProvider>> {
        self.provider.read().await.clone()
    }

    pub async fn config(&self) -> Option<AiConfig> {
        self.config.read().await.clone()
    }

    pub async fn is_enabled(&self) -> bool {
        self.provider.read().await.is_some()
    }
}

/// AI tick — runs analysis jobs if a provider is configured.
pub async fn tick(app: &AppState) {
    let ai = app.ai();
    if !ai.is_enabled().await {
        return;
    }

    let provider = match ai.provider().await {
        Some(p) => p,
        None => return,
    };

    let pool = app.pool();
    let event_tx = app.event_tx();

    // Run analysis jobs — each one is independent and logs its own errors
    if let Err(e) = analysis::run_threat_assessment(pool, &*provider, event_tx).await {
        error!(error = %e, "threat assessment failed");
    }

    if let Err(e) = analysis::run_sitrep_summary(pool, &*provider, event_tx).await {
        error!(error = %e, "sitrep summary failed");
    }

    if let Err(e) = analysis::run_mission_advisories(pool, &*provider, event_tx).await {
        error!(error = %e, "mission advisories failed");
    }

    if let Err(e) = analysis::run_rescue_triage(pool, &*provider, event_tx).await {
        error!(error = %e, "rescue triage failed");
    }

    info!("AI analysis tick complete");
}
