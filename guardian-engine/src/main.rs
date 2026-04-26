mod config;
mod db;
mod routes;
mod compute;
mod federation;
mod discord;
mod state;
mod ai;
mod auth;
mod helpers;
mod tls;
mod proxy;
mod security;

use tracing::info;
use tokio_rustls::TlsAcceptor;

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
    info!(
        internal = %cfg.listen_addr,
        https = %cfg.https_listen_addr,
        tls = ?cfg.tls_mode,
        "guardian-engine starting"
    );

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

    // Start Discord bot if configured
    match discord::start_or_restart(&app_state).await {
        Ok(()) => info!("discord bot init complete"),
        Err(e) => tracing::warn!(error = %e, "discord bot failed to start (non-fatal)"),
    }

    // Start compute tick loop (30-second interval)
    let compute_state = app_state.clone();
    let compute_handle = tokio::spawn(async move {
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

    // Start AI analysis tick loop
    let ai_state = app_state.clone();
    let ai_handle = tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        loop {
            let interval_secs = match ai_state.ai().config().await {
                Some(cfg) if cfg.enabled => cfg.tick_interval_secs as u64,
                _ => 300,
            };
            tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;
            ai::tick(&ai_state).await;
        }
    });
    info!("AI analysis tick loop started");

    // --- Listeners ---

    // Internal plain HTTP listener (health checks, inter-container comms)
    let internal_app = routes::internal_router(app_state.clone());
    let internal_listener = tokio::net::TcpListener::bind(&cfg.listen_addr).await?;
    info!(addr = %cfg.listen_addr, "internal HTTP listener ready");

    let internal_handle = tokio::spawn(async move {
        axum::serve(internal_listener, internal_app).await.ok();
    });

    // External listener (HTTPS or plain HTTP depending on TLS mode)
    let external_app = routes::external_router(app_state.clone());

    match &cfg.tls_mode {
        config::TlsMode::None => {
            // Development mode: plain HTTP on the HTTPS port
            info!("TLS disabled — serving plain HTTP (development mode)");
            let listener = tokio::net::TcpListener::bind(&cfg.https_listen_addr).await?;
            info!(addr = %cfg.https_listen_addr, "external HTTP listener ready (no TLS)");
            axum::serve(listener, external_app)
                .with_graceful_shutdown(shutdown_signal())
                .await?;
        }
        tls_mode => {
            // Production: TLS-terminated HTTPS
            let acceptor = tls::build_acceptor(
                tls_mode,
                &cfg.cert_dir,
                &cfg.site_domain,
            )?;
            info!(mode = ?tls_mode, "edge TLS configured");

            // Optional: HTTP redirect listener
            let http_redirect_handle = spawn_http_redirect(
                cfg.http_listen_addr,
                &cfg.site_domain,
            ).await;

            // Run TLS accept loop
            let tls_listener = tokio::net::TcpListener::bind(&cfg.https_listen_addr).await?;
            info!(addr = %cfg.https_listen_addr, "external HTTPS listener ready");

            serve_tls(tls_listener, acceptor, external_app).await;

            if let Some(h) = http_redirect_handle {
                h.abort();
            }
        }
    }

    // Cleanup
    discord::stop(&app_state).await;
    compute_handle.abort();
    ai_handle.abort();
    fed_handle.abort();
    consumer_handle.abort();
    internal_handle.abort();
    info!("guardian-engine stopped");
    Ok(())
}

/// TLS accept loop using hyper directly for full WebSocket upgrade support.
async fn serve_tls(
    listener: tokio::net::TcpListener,
    acceptor: TlsAcceptor,
    app: axum::Router,
) {
    use hyper_util::rt::{TokioExecutor, TokioIo};
    use hyper_util::server::conn::auto::Builder;
    use tower::ServiceExt;

    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);

    loop {
        tokio::select! {
            result = listener.accept() => {
                let (stream, peer) = match result {
                    Ok(conn) => conn,
                    Err(e) => {
                        tracing::error!(error = %e, "TCP accept failed");
                        continue;
                    }
                };

                let acceptor = acceptor.clone();
                let app = app.clone();

                tokio::spawn(async move {
                    let tls_stream = match acceptor.accept(stream).await {
                        Ok(s) => s,
                        Err(e) => {
                            tracing::debug!(error = %e, peer = %peer, "TLS handshake failed");
                            return;
                        }
                    };

                    let io = TokioIo::new(tls_stream);
                    let service = hyper::service::service_fn(move |req: hyper::Request<hyper::body::Incoming>| {
                        let app = app.clone();
                        async move {
                            let (parts, body) = req.into_parts();
                            let body = axum::body::Body::new(body);
                            let req = hyper::Request::from_parts(parts, body);
                            Ok::<_, std::convert::Infallible>(
                                app.oneshot(req).await.unwrap_or_else(|e| match e {})
                            )
                        }
                    });

                    if let Err(e) = Builder::new(TokioExecutor::new())
                        .serve_connection_with_upgrades(io, service)
                        .await
                    {
                        tracing::debug!(error = %e, peer = %peer, "connection error");
                    }
                });
            }
            _ = &mut shutdown => {
                info!("shutdown signal received, stopping TLS listener");
                break;
            }
        }
    }
}

/// Spawn an HTTP listener that redirects all requests to HTTPS.
async fn spawn_http_redirect(
    addr: std::net::SocketAddr,
    site_domain: &str,
) -> Option<tokio::task::JoinHandle<()>> {
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::warn!(addr = %addr, error = %e, "HTTP redirect listener failed to bind (non-fatal)");
            return None;
        }
    };

    info!(addr = %addr, "HTTP redirect listener ready");
    let site = site_domain.to_string();

    Some(tokio::spawn(async move {
        let app = axum::Router::new().fallback(
            move |req: axum::http::Request<axum::body::Body>| {
                let site = site.clone();
                async move {
                    let path = req.uri().path_and_query()
                        .map(|pq| pq.as_str())
                        .unwrap_or("/");
                    let location = format!("https://{}{}", site, path);
                    axum::response::Redirect::permanent(&location)
                }
            },
        );
        axum::serve(listener, app).await.ok();
    }))
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl+c");
    tracing::info!("shutdown signal received");
}
