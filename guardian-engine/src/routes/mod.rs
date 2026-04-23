pub mod health;
pub mod ws;
pub mod ai;
pub mod auth;

use axum::Router;
use tower_http::trace::TraceLayer;

use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .merge(health::routes())
        .merge(ws::routes())
        .merge(ai::routes())
        .merge(auth::routes())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
