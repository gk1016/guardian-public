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

use axum::Router;
use tower_http::trace::TraceLayer;

use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .merge(health::routes())
        .merge(ws::routes())
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
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
