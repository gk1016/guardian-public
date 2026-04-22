//! AI HTTP routes for the Guardian Engine.
//!
//! Accessed through Caddy at /engine/api/ai/*
//! (Caddy strips the /engine prefix before forwarding)

use axum::{
    Router,
    routing::{get, put, post},
    extract::State,
    Json,
    response::IntoResponse,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::state::AppState;
use crate::ai;

// ---------------------------------------------------------------------------
// GET /api/ai/status
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct AiStatusResponse {
    configured: bool,
    enabled: bool,
    provider: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    has_api_key: bool,
    max_tokens: Option<i32>,
    temperature: Option<f64>,
    tick_interval_secs: Option<i32>,
}

async fn get_status(State(state): State<AppState>) -> Json<AiStatusResponse> {
    let ai = state.ai();
    match ai.config().await {
        Some(cfg) => Json(AiStatusResponse {
            configured: true,
            enabled: cfg.enabled,
            provider: Some(cfg.provider),
            model: Some(cfg.model),
            base_url: cfg.base_url,
            has_api_key: cfg.api_key.is_some(),
            max_tokens: Some(cfg.max_tokens),
            temperature: Some(cfg.temperature),
            tick_interval_secs: Some(cfg.tick_interval_secs),
        }),
        None => Json(AiStatusResponse {
            configured: false,
            enabled: false,
            provider: None,
            model: None,
            base_url: None,
            has_api_key: false,
            max_tokens: None,
            temperature: None,
            tick_interval_secs: None,
        }),
    }
}

// ---------------------------------------------------------------------------
// GET /api/ai/config
// ---------------------------------------------------------------------------

async fn get_config(State(state): State<AppState>) -> impl IntoResponse {
    match ai::config::load_from_db(state.pool()).await {
        Ok(Some(cfg)) => Json(serde_json::json!({
            "config": {
                "id": cfg.id,
                "provider": cfg.provider,
                "model": cfg.model,
                "baseUrl": cfg.base_url,
                "hasApiKey": cfg.api_key.is_some(),
                "maxTokens": cfg.max_tokens,
                "temperature": cfg.temperature,
                "enabled": cfg.enabled,
                "tickIntervalSecs": cfg.tick_interval_secs,
            }
        })).into_response(),
        Ok(None) => Json(serde_json::json!({ "config": null })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}

// ---------------------------------------------------------------------------
// PUT /api/ai/config
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct UpdateConfigRequest {
    org_id: Option<String>,
    provider: String,
    model: String,
    api_key: Option<String>,
    base_url: Option<String>,
    max_tokens: Option<i32>,
    temperature: Option<f64>,
    enabled: Option<bool>,
    tick_interval_secs: Option<i32>,
}

async fn put_config(
    State(state): State<AppState>,
    Json(body): Json<UpdateConfigRequest>,
) -> impl IntoResponse {
    // Resolve org_id — use provided or fall back to first org
    let org_id = match &body.org_id {
        Some(id) if !id.is_empty() => id.clone(),
        _ => {
            match sqlx::query_scalar::<_, String>(r#"SELECT id FROM "Organization" LIMIT 1"#)
                .fetch_optional(state.pool())
                .await
            {
                Ok(Some(id)) => id,
                Ok(None) => return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "No organization found" })),
                ).into_response(),
                Err(e) => return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": e.to_string() })),
                ).into_response(),
            }
        }
    };

    // Load existing or create new
    let existing = ai::config::load_from_db(state.pool()).await;
    let id = match &existing {
        Ok(Some(cfg)) => cfg.id.clone(),
        _ => uuid::Uuid::new_v4().to_string(),
    };

    // If api_key is None in the request but existing has one, keep existing
    let api_key = match (&body.api_key, &existing) {
        (Some(k), _) if !k.is_empty() => Some(k.clone()),
        (_, Ok(Some(cfg))) => cfg.api_key.clone(),
        _ => None,
    };

    let cfg = ai::config::AiConfig {
        id,
        org_id,
        provider: body.provider,
        model: body.model,
        api_key,
        base_url: body.base_url,
        max_tokens: body.max_tokens.unwrap_or(2048),
        temperature: body.temperature.unwrap_or(0.3),
        enabled: body.enabled.unwrap_or(false),
        tick_interval_secs: body.tick_interval_secs.unwrap_or(300),
    };

    if let Err(e) = ai::config::save_to_db(state.pool(), &cfg).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response();
    }

    // Reload the AI provider with new config
    if let Err(e) = state.ai().reload(state.pool()).await {
        tracing::warn!(error = %e, "failed to reload AI provider after config update");
    }

    Json(serde_json::json!({ "ok": true })).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/ai/test
// ---------------------------------------------------------------------------

async fn test_connection(State(state): State<AppState>) -> impl IntoResponse {
    let provider = match state.ai().provider().await {
        Some(p) => p,
        None => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No AI provider configured" })),
        ).into_response(),
    };

    match provider.health_check().await {
        Ok(()) => Json(serde_json::json!({
            "ok": true,
            "provider": provider.name(),
            "model": provider.model(),
        })).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({
                "ok": false,
                "error": e.to_string(),
            })),
        ).into_response(),
    }
}

// ---------------------------------------------------------------------------
// POST /api/ai/analyze
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct AnalyzeRequest {
    #[serde(rename = "type")]
    analysis_type: String,
    target_id: Option<String>,
}

async fn trigger_analysis(
    State(state): State<AppState>,
    Json(body): Json<AnalyzeRequest>,
) -> impl IntoResponse {
    let provider = match state.ai().provider().await {
        Some(p) => p,
        None => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No AI provider configured" })),
        ).into_response(),
    };

    let pool = state.pool();
    let event_tx = state.event_tx();

    let result = match body.analysis_type.as_str() {
        "threat_assessment" => ai::analysis::run_threat_assessment(pool, &*provider, event_tx).await,
        "sitrep" => ai::analysis::run_sitrep_summary(pool, &*provider, event_tx).await,
        "mission_advisory" => ai::analysis::run_mission_advisories(pool, &*provider, event_tx).await,
        "rescue_triage" => ai::analysis::run_rescue_triage(pool, &*provider, event_tx).await,
        other => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": format!("Unknown analysis type: {}", other) })),
        ).into_response(),
    };

    match result {
        Ok(()) => Json(serde_json::json!({ "ok": true })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}

// ---------------------------------------------------------------------------
// GET /api/ai/analyses
// ---------------------------------------------------------------------------

async fn get_analyses(State(state): State<AppState>) -> impl IntoResponse {
    let rows = sqlx::query(
        r#"
        SELECT id, "orgId", "analysisType", "targetId", summary,
               provider, model, "createdAt"
        FROM "AiAnalysis"
        ORDER BY "createdAt" DESC
        LIMIT 50
        "#
    )
    .fetch_all(state.pool())
    .await;

    match rows {
        Ok(rows) => {
            let analyses: Vec<serde_json::Value> = rows.iter().map(|r| {
                serde_json::json!({
                    "id": r.get::<String, _>("id"),
                    "orgId": r.get::<String, _>("orgId"),
                    "analysisType": r.get::<String, _>("analysisType"),
                    "targetId": r.get::<Option<String>, _>("targetId"),
                    "summary": r.get::<String, _>("summary"),
                    "provider": r.get::<String, _>("provider"),
                    "model": r.get::<String, _>("model"),
                    "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
                })
            }).collect();
            Json(serde_json::json!({ "analyses": analyses })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/ai/status", get(get_status))
        .route("/api/ai/config", get(get_config))
        .route("/api/ai/config", put(put_config))
        .route("/api/ai/test", post(test_connection))
        .route("/api/ai/analyze", post(trigger_analysis))
        .route("/api/ai/analyses", get(get_analyses))
}
