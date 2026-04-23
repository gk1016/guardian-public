use axum::{Router, routing::get, extract::State, Json};
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub instance_id: String,
    pub instance_name: String,
    pub version: &'static str,
    pub cert_fingerprint: String,
    pub federation_port: u16,
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        instance_id: state.config().instance_id.clone(),
        instance_name: state.config().instance_name.clone(),
        version: env!("CARGO_PKG_VERSION"),
        cert_fingerprint: state.cert_fingerprint().to_string(),
        federation_port: state.config().federation_port,
    })
}

#[derive(Serialize)]
struct ApiHealthResponse {
    ok: bool,
    service: &'static str,
    timestamp: String,
}

async fn api_health() -> Json<ApiHealthResponse> {
    Json(ApiHealthResponse {
        ok: true,
        service: "guardian",
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/api/health", get(api_health))
}
