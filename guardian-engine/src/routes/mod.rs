pub mod health;
pub mod ws;
pub mod ai;
pub mod auth;
pub mod admin;
pub mod missions;
pub mod ops;
pub mod comms;

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
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
