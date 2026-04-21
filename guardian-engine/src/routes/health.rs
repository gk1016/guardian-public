use axum::{Router, routing::get, extract::State, Json};
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub instance_id: String,
    pub instance_name: String,
    pub version: &'static str,
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        instance_id: state.config().instance_id.clone(),
        instance_name: state.config().instance_name.clone(),
        version: env!("CARGO_PKG_VERSION"),
    })
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/health", get(health))
}
