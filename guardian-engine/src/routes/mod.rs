pub mod health;
pub mod ws;
pub mod ai;
pub mod auth;
pub mod admin;
pub mod admin_ai_models;
pub mod missions;
pub mod ops;
pub mod comms;
pub mod federation;
pub mod discord;
pub mod command;
pub mod recruit;
pub mod ollama_scan;
pub mod fleet;
pub mod user;
pub mod setup;
pub mod mobile;
pub mod views;
pub mod doctrine;

use std::time::Duration;

use axum::{middleware, Router};
use axum::http::{header, Method};
use axum_extra::extract::CookieJar;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::proxy;
use crate::security;
use crate::state::AppState;

/// Build the external (TLS) router — serves engine API routes at /api/*,
/// backward-compat mirror at /engine/api/*, WebSocket at /ws, and proxies
/// everything else to the upstream frontend.
pub fn external_router(state: AppState) -> Router {
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

    // Build comms crate router with auth bridge middleware.
    // This returns Router<()> — merged after with_state() below.
    let comms_inner = state.comms().router();
    let auth_secret = state.config().auth_secret.clone();
    let comms_with_auth = comms_inner.layer(axum::middleware::from_fn(
        move |req: axum::http::Request<axum::body::Body>, next: axum::middleware::Next| {
            let secret = auth_secret.clone();
            comms_auth_bridge(secret, req, next)
        },
    ));

    // Build the engine router (all routes that need AppState)
    let mut engine_router = Router::new()
        .merge(ws::routes())
        .merge(health::routes())
        .merge(engine_routes())
        .nest("/engine", engine_routes());

    // Serve requests: proxy to upstream if configured, otherwise serve SPA
    if state.config().upstream_frontend.is_some() {
        engine_router = engine_router.fallback(proxy::handler);
    } else {
        engine_router = engine_router.fallback(crate::spa::fallback);
    }

    // Provide state (Router<AppState> -> Router<()>), then merge comms
    // (also Router<()>), then apply shared layers to both.
    engine_router
        .with_state(state)
        .merge(comms_with_auth)
        .layer(middleware::from_fn(security::headers))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
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
        .merge(ai::routes())
        .merge(auth::routes())
        .merge(admin::routes())
        .merge(admin_ai_models::routes())
        .merge(missions::routes())
        .merge(ops::routes())
        .merge(comms::routes())
        .merge(federation::routes())
        .merge(discord::routes())
        .merge(command::routes())
        .merge(recruit::routes())
        .merge(ollama_scan::routes())
        .merge(fleet::routes())
        .merge(user::routes())
        .merge(setup::routes())
        .merge(mobile::routes())
        .merge(views::routes())
        .merge(doctrine::routes())
}

/// Auth bridge middleware for comms crate routes.
///
/// Reads the guardian_session cookie, verifies the JWT, and injects
/// x-comms-* headers so the comms crate can extract user identity
/// without being coupled to the engine's auth system.
async fn comms_auth_bridge(
    auth_secret: String,
    mut req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let jar = CookieJar::from_headers(req.headers());
    if let Some(cookie) = jar.get("guardian_session") {
        if let Ok(claims) = crate::auth::jwt::verify_session(cookie.value(), &auth_secret) {
            if let Ok(v) = claims.sub.parse() {
                req.headers_mut().insert("x-comms-user-id", v);
            }
            if let Ok(v) = claims.handle.parse() {
                req.headers_mut().insert("x-comms-handle", v);
            }
            if let Some(ref org_id) = claims.org_id {
                if let Ok(v) = org_id.parse() {
                    req.headers_mut().insert("x-comms-org-id", v);
                }
            }
        }
    }
    next.run(req).await
}
