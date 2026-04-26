pub mod health;
pub mod ws;
pub mod ai;
pub mod auth;
pub mod admin;
pub mod missions;
pub mod ops;
pub mod comms;
pub mod federation;
pub mod discord;
pub mod command;
pub mod recruit;
pub mod ollama_scan;

use std::time::Duration;

use axum::{middleware, Router};
use axum::http::{header, Method};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::proxy;
use crate::security;
use crate::state::AppState;

/// Build the external (TLS) router — serves engine routes under /engine/*,
/// WebSocket at /ws, and proxies everything else to the upstream frontend.
pub fn external_router(state: AppState) -> Router {
    // All engine route handlers (served under /engine/* prefix for frontend compat)
    let engine = engine_routes();

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .max_age(Duration::from_secs(86400));

    let mut router = Router::new()
        // WebSocket at root path (clients connect to wss://host/ws)
        .merge(ws::routes())
        // Engine routes under /engine/* prefix (frontend compatibility)
        .nest("/engine", engine)
        // Health at root for convenience
        .merge(health::routes());

    // Add proxy fallback if upstream is configured
    if state.config().upstream_frontend.is_some() {
        router = router.fallback(proxy::handler);
    }

    router
        .layer(middleware::from_fn(security::headers))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Build the internal (plain HTTP) router — health checks only.
pub fn internal_router(state: AppState) -> Router {
    Router::new()
        .merge(health::routes())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// All engine route handlers grouped (no state attached yet).
fn engine_routes() -> Router<AppState> {
    Router::new()
        .merge(health::routes())
        .merge(ai::routes())
        .merge(auth::routes())
        .merge(admin::routes())
        .merge(missions::routes())
        .merge(ops::routes())
        .merge(comms::routes())
        .merge(federation::routes())
        .merge(discord::routes())
        .merge(command::routes())
        .merge(recruit::routes())
        .merge(ollama_scan::routes())
}
