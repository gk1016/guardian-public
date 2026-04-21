mod config;
mod db;
mod routes;
mod compute;
mod federation;
mod state;

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

    let cfg = config::Config::from_env()?;
    info!(listen = %cfg.listen_addr, "guardian-engine starting");

    // Connect to PostgreSQL
    let pool = db::connect(&cfg.database_url).await?;
    info!("database connected");

    // Build shared app state
    let app_state = state::AppState::new(pool, cfg.clone());

    // Start federation manager (background task)
    let fed_handle = federation::manager::start(app_state.clone());
    info!("federation manager started");

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
    fed_handle.abort();
    info!("guardian-engine stopped");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl+c");
    tracing::info!("shutdown signal received");
}
