//! Federation API routes — peer management, chat, data sharing.

use axum::{
    Router,
    routing::{get, post},
    extract::{Query, State, Path},
    response::IntoResponse,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::info;

use crate::auth::middleware::AuthSession;
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

// ── Federation intel types ──

#[derive(Deserialize)]
struct IntelQuery {
    source: Option<String>,
    severity: Option<i32>,
    search: Option<String>,
    limit: Option<i64>,
}

#[derive(sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
struct FederatedIntelRow {
    id: String,
    #[sqlx(rename = "sourceInstanceId")]
    source_instance_id: String,
    #[sqlx(rename = "sourceInstanceName")]
    source_instance_name: String,
    #[sqlx(rename = "remoteReportId")]
    remote_report_id: String,
    title: String,
    #[sqlx(rename = "reportType")]
    report_type: String,
    severity: i32,
    description: Option<String>,
    #[sqlx(rename = "starSystem")]
    star_system: Option<String>,
    #[sqlx(rename = "hostileGroup")]
    hostile_group: Option<String>,
    #[sqlx(rename = "receivedAt")]
    received_at: chrono::DateTime<chrono::Utc>,
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

/// GET /api/federation/intel — list intel received from federation peers.
async fn get_intel(
    State(state): State<AppState>,
    _session: AuthSession,
    Query(params): Query<IntelQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool();
    let limit = params.limit.unwrap_or(50).min(200).max(1);

    let mut sql = String::from(
        r#"SELECT id::text, "sourceInstanceId", "sourceInstanceName", "remoteReportId",
                  title, "reportType", severity, description, "starSystem",
                  "hostileGroup", "receivedAt"
           FROM "FederatedIntel" WHERE true"#,
    );
    let mut bind_idx = 1u32;

    if params.source.is_some() {
        sql.push_str(&format!(r#" AND "sourceInstanceName" ILIKE ${bind_idx}"#));
        bind_idx += 1;
    }
    if params.severity.filter(|&s| s >= 1 && s <= 5).is_some() {
        sql.push_str(&format!(r#" AND severity >= ${bind_idx}"#));
        bind_idx += 1;
    }
    if params.search.is_some() {
        sql.push_str(&format!(
            r#" AND (title ILIKE ${bind_idx} OR description ILIKE ${bind_idx})"#,
        ));
        bind_idx += 1;
    }

    sql.push_str(&format!(r#" ORDER BY "receivedAt" DESC LIMIT ${bind_idx}"#));

    let mut query = sqlx::query_as::<_, FederatedIntelRow>(&sql);

    if let Some(ref source) = params.source {
        query = query.bind(format!("%{source}%"));
    }
    if let Some(sev) = params.severity.filter(|&s| s >= 1 && s <= 5) {
        query = query.bind(sev);
    }
    if let Some(ref search) = params.search {
        query = query.bind(format!("%{search}%"));
    }
    query = query.bind(limit);

    let items = query.fetch_all(pool).await.map_err(|e| {
        tracing::error!("Failed to fetch federated intel: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Database error." })),
        )
    })?;

    let count = items.len();
    Ok(Json(json!({ "ok": true, "items": items, "count": count })))
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
        .route("/api/federation/intel", get(get_intel))
        .route("/api/federation/chat", post(send_chat))
        .route("/api/federation/share/intel/{id}", post(share_intel))
        .route("/api/federation/share/mission/{id}", post(share_mission))
        .route("/api/federation/share/qrf", post(share_qrf))
}
