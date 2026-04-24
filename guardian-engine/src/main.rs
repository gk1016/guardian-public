mod config;
mod db;
mod routes;
mod compute;
mod federation;
mod state;
mod ai;
mod auth;
mod helpers;

use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env if present (dev convenience)
    let _ = dotenvy::dotenv();

    // Init tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "guardian_engine=info,tower_http=info".into()),
        )
        .init();

    // Install rustls crypto provider (required before any TLS config is built)
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("failed to install rustls CryptoProvider");

    let cfg = config::Config::from_env()?;
    info!(listen = %cfg.listen_addr, "guardian-engine starting");

    // Initialize federation TLS identity
    let identity = federation::tls::ensure_identity(&cfg.cert_dir, &cfg.instance_name)?;
    info!(
        fingerprint = %identity.fingerprint,
        cert = %identity.cert_path.display(),
        "federation TLS identity ready"
    );

    // Connect to PostgreSQL
    let pool = db::connect(&cfg.database_url).await?;
    info!("database connected");

    // Build shared app state
    let app_state = state::AppState::new(pool, cfg.clone(), identity.fingerprint.clone());

    // Initialize AI state — load provider from DB config
    if let Err(e) = app_state.ai().reload(app_state.pool()).await {
        tracing::warn!(error = %e, "failed to load AI config on startup (non-fatal)");
    }

    // Start federation manager (background task) with TLS
    let fed_handle = federation::manager::start(app_state.clone(), identity);
    info!("federation manager started (TLS enabled)");

    // Start federation inbound message consumer
    let consumer_handle = federation::consumer::start(app_state.clone());
    info!("federation inbound consumer started");

    // Start compute tick loop (30-second interval)
    let compute_state = app_state.clone();
    let compute_handle = tokio::spawn(async move {
        // Wait 5 seconds on startup before first tick (let things settle)
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            info!("compute tick starting");
            compute::tick(compute_state.pool(), compute_state.event_tx()).await;
            info!("compute tick complete");
        }
    });
    info!("compute tick loop started (30s interval)");

    // Start AI analysis tick loop (configurable interval, default 5 minutes)
    let ai_state = app_state.clone();
    let ai_handle = tokio::spawn(async move {
        // Wait 15 seconds on startup before first AI tick
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        loop {
            // Read tick interval from current config (allows runtime changes)
            let interval_secs = match ai_state.ai().config().await {
                Some(cfg) if cfg.enabled => cfg.tick_interval_secs as u64,
                _ => 300, // default 5 min if not configured
            };
            tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;
            ai::tick(&ai_state).await;
        }
    });
    info!("AI analysis tick loop started");

    // Build router
    let app = routes::router(app_state);

    // Bind and serve
    let listener = tokio::net::TcpListener::bind(&cfg.listen_addr).await?;
    info!(addr = %cfg.listen_addr, "listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    // Cleanup
    compute_handle.abort();
    ai_handle.abort();
    fed_handle.abort();
    consumer_handle.abort();
    info!("guardian-engine stopped");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl+c");
    tracing::info!("shutdown signal received");
}
