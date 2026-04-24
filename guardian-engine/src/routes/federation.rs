//! Federation API routes — peer management, chat, data sharing.

use axum::{
    Router,
    routing::{get, post},
    extract::{State, Path},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::state::AppState;
use crate::federation::{chat, data_sync};

// ── Response types ──

#[derive(Serialize)]
struct FederationStatus {
    instance_id: String,
    instance_name: String,
    cert_fingerprint: String,
    federation_port: u16,
    connected_peers: usize,
    trusted_fingerprints: Vec<String>,
    seeds: Vec<String>,
}

#[derive(Serialize)]
struct PeerEntry {
    instance_id: String,
    instance_name: String,
    address: String,
    version: String,
    connected_at: String,
    last_heartbeat: String,
}

#[derive(Deserialize)]
struct ChatRequest {
    channel: String,
    text: String,
    sender_handle: String,
    /// If set, send to this specific instance. Otherwise broadcast.
    target_instance: Option<String>,
}

#[derive(Serialize)]
struct ChatResponse {
    sent: bool,
    peers_reached: usize,
}

#[derive(Serialize)]
struct ShareResponse {
    peers_reached: usize,
}

// ── Handlers ──

/// GET /api/federation/status — this instance's federation identity and state.
async fn get_status(State(state): State<AppState>) -> impl IntoResponse {
    let cfg = state.config();
    let peer_count = state.peers().count().await;

    Json(FederationStatus {
        instance_id: cfg.instance_id.clone(),
        instance_name: cfg.instance_name.clone(),
        cert_fingerprint: state.cert_fingerprint().to_string(),
        federation_port: cfg.federation_port,
        connected_peers: peer_count,
        trusted_fingerprints: cfg.federation_trusted_fingerprints.clone(),
        seeds: cfg.federation_seeds.clone(),
    })
}

/// GET /api/federation/peers — list all connected federation peers.
async fn get_peers(State(state): State<AppState>) -> impl IntoResponse {
    let peers = state.peers().list().await;
    let entries: Vec<PeerEntry> = peers
        .into_iter()
        .map(|p| PeerEntry {
            instance_id: p.instance_id,
            instance_name: p.instance_name,
            address: p.address,
            version: p.version,
            connected_at: p.connected_at.to_rfc3339(),
            last_heartbeat: p.last_heartbeat.to_rfc3339(),
        })
        .collect();

    Json(entries)
}

/// POST /api/federation/chat — send a chat message to peers.
async fn send_chat(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> impl IntoResponse {
    let (sent, peers_reached) = if let Some(target) = &req.target_instance {
        let ok = chat::direct_chat(
            &state,
            target,
            &req.channel,
            &req.sender_handle,
            &req.text,
        ).await;
        (ok, if ok { 1 } else { 0 })
    } else {
        let count = chat::broadcast_chat(
            &state,
            &req.channel,
            &req.sender_handle,
            &req.text,
        ).await;
        (count > 0, count)
    };

    Json(ChatResponse { sent, peers_reached })
}

/// POST /api/federation/share/intel/:id — share an intel report with peers.
async fn share_intel(
    State(state): State<AppState>,
    Path(report_id): Path<String>,
) -> impl IntoResponse {
    match data_sync::share_intel(&state, state.pool(), &report_id).await {
        Ok(count) => Json(ShareResponse { peers_reached: count }),
        Err(e) => {
            tracing::error!(error = %e, "failed to share intel");
            Json(ShareResponse { peers_reached: 0 })
        }
    }
}

/// POST /api/federation/share/mission/:id — share a mission status with peers.
async fn share_mission(
    State(state): State<AppState>,
    Path(mission_id): Path<String>,
) -> impl IntoResponse {
    match data_sync::share_mission_status(&state, state.pool(), &mission_id).await {
        Ok(count) => Json(ShareResponse { peers_reached: count }),
        Err(e) => {
            tracing::error!(error = %e, "failed to share mission status");
            Json(ShareResponse { peers_reached: 0 })
        }
    }
}

/// POST /api/federation/share/qrf — share QRF readiness with peers.
async fn share_qrf(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match data_sync::share_qrf_status(&state, state.pool()).await {
        Ok(count) => Json(ShareResponse { peers_reached: count }),
        Err(e) => {
            tracing::error!(error = %e, "failed to share QRF status");
            Json(ShareResponse { peers_reached: 0 })
        }
    }
}

// ── Router ──

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/federation/status", get(get_status))
        .route("/api/federation/peers", get(get_peers))
        .route("/api/federation/chat", post(send_chat))
        .route("/api/federation/share/intel/{id}", post(share_intel))
        .route("/api/federation/share/mission/{id}", post(share_mission))
        .route("/api/federation/share/qrf", post(share_qrf))
}
