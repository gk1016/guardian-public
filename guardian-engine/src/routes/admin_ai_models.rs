//! Admin AI model registry routes.
//!
//! GET  /api/admin/ai-models         — list model options
//! POST /api/admin/ai-models/custom  — add custom model
//! POST /api/admin/ai-models/refresh — refresh models from provider API

use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;

use crate::auth::middleware::AuthSession;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/admin/ai-models", get(list_models))
        .route("/api/admin/ai-models/custom", post(add_custom))
        .route("/api/admin/ai-models/refresh", post(refresh_models))
}

fn require_admin(session: &crate::auth::session::Session) -> Result<(), (StatusCode, Json<Value>)> {
    if !session.can_manage_administration() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Admin authority required."}))));
    }
    Ok(())
}

// ── GET /api/admin/ai-models ────────────────────────────────────────────────

#[derive(Deserialize)]
struct ListQuery {
    provider: Option<String>,
}

#[derive(FromRow, serde::Serialize)]
struct ModelRow {
    id: String,
    provider: String,
    #[sqlx(rename = "modelId")]
    #[serde(rename = "modelId")]
    model_id: String,
    #[sqlx(rename = "displayName")]
    #[serde(rename = "displayName")]
    display_name: String,
    category: String,
    #[sqlx(rename = "isDefault")]
    #[serde(rename = "isDefault")]
    is_default: bool,
}

async fn list_models(
    State(state): State<AppState>,
    session: AuthSession,
    Query(params): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;

    let models = if let Some(ref provider) = params.provider {
        sqlx::query_as::<_, ModelRow>(
            r#"SELECT id, provider, "modelId", "displayName", category, "isDefault"
               FROM "AiModelOption" WHERE provider = $1
               ORDER BY provider ASC, "sortOrder" ASC"#,
        ).bind(provider).fetch_all(state.pool()).await
    } else {
        sqlx::query_as::<_, ModelRow>(
            r#"SELECT id, provider, "modelId", "displayName", category, "isDefault"
               FROM "AiModelOption"
               ORDER BY provider ASC, "sortOrder" ASC"#,
        ).fetch_all(state.pool()).await
    }.map_err(|e| {
        tracing::error!(error = %e, "failed to list AI models");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."})))
    })?;

    Ok(Json(json!({ "models": models })))
}

// ── POST /api/admin/ai-models/custom ────────────────────────────────────────

#[derive(Deserialize)]
struct AddCustomBody {
    provider: String,
    #[serde(rename = "modelId")]
    model_id: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    category: Option<String>,
}

async fn add_custom(
    State(state): State<AppState>,
    session: AuthSession,
    Json(body): Json<AddCustomBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;

    if body.provider.is_empty() || body.model_id.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Provider and modelId are required."}))));
    }

    // Check duplicate
    let existing: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "AiModelOption" WHERE provider = $1 AND "modelId" = $2"#,
    ).bind(&body.provider).bind(&body.model_id)
    .fetch_optional(state.pool()).await.unwrap_or(None);

    if existing.is_some() {
        return Err((StatusCode::CONFLICT, Json(json!({"error": "Model already exists in registry."}))));
    }

    // Get max sort order
    let max_sort: Option<i32> = sqlx::query_scalar(
        r#"SELECT MAX("sortOrder") FROM "AiModelOption" WHERE provider = $1"#,
    ).bind(&body.provider).fetch_one(state.pool()).await.unwrap_or(None);

    let id = cuid2::create_id();
    let display = body.display_name.clone().unwrap_or_else(|| body.model_id.clone());
    let category = body.category.clone().unwrap_or_else(|| "chat".into());
    let sort_order = max_sort.unwrap_or(0) + 10;

    sqlx::query(
        r#"INSERT INTO "AiModelOption" (id, provider, "modelId", "displayName", category, "isDefault", "sortOrder", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, false, $6, NOW(), NOW())"#,
    ).bind(&id).bind(&body.provider).bind(&body.model_id)
    .bind(&display).bind(&category).bind(sort_order)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to add model."}))))?;

    Ok(Json(json!({"ok": true, "model": {"id": id, "provider": body.provider, "modelId": body.model_id, "displayName": display, "category": category}})))
}

// ── POST /api/admin/ai-models/refresh ───────────────────────────────────────

#[derive(Deserialize)]
struct RefreshBody {
    provider: String,
}

/// Refresh models from provider API. This is a simplified version that
/// handles the most common providers. The full provider-specific API
/// fetching (Anthropic, OpenAI, Google, Ollama) runs through the engine's
/// existing AI config system for live model discovery.
async fn refresh_models(
    State(state): State<AppState>,
    session: AuthSession,
    Json(body): Json<RefreshBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;

    if body.provider.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Provider is required."}))));
    }

    // Get the provider's API config
    #[derive(FromRow)]
    struct AiConfigRow {
        #[sqlx(rename = "apiKey")] api_key: Option<String>,
        #[sqlx(rename = "baseUrl")] base_url: Option<String>,
    }
    let config = sqlx::query_as::<_, AiConfigRow>(
        r#"SELECT "apiKey", "baseUrl" FROM "AiConfig" WHERE provider = $1"#,
    ).bind(&body.provider).fetch_optional(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let config = config.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": format!("No config found for provider '{}'.", body.provider)})))
    })?;

    // Fetch models from provider API
    let models = fetch_provider_models(
        state.http_client(),
        &body.provider,
        config.api_key.as_deref(),
        config.base_url.as_deref(),
    ).await.map_err(|e| {
        (StatusCode::BAD_GATEWAY, Json(json!({"error": e})))
    })?;

    if models.is_empty() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "No models returned from provider."}))));
    }

    // Upsert models
    let mut upserted = 0u64;
    for (i, m) in models.iter().enumerate() {
        let sort_order = ((i + 1) * 10) as i32;
        let id = cuid2::create_id();
        let result = sqlx::query(
            r#"INSERT INTO "AiModelOption" (id, provider, "modelId", "displayName", category, "isDefault", "sortOrder", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, false, $6, NOW(), NOW())
               ON CONFLICT (provider, "modelId") DO UPDATE SET
                   "displayName" = EXCLUDED."displayName", category = EXCLUDED.category,
                   "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = NOW()"#,
        ).bind(&id).bind(&body.provider).bind(&m.model_id)
        .bind(&m.display_name).bind(&m.category).bind(sort_order)
        .execute(state.pool()).await;

        if result.is_ok() { upserted += 1; }
    }

    // Prune stale models (not in fetched set and not actively configured)
    let fetched_ids: Vec<&str> = models.iter().map(|m| m.model_id.as_str()).collect();
    let active_models: Vec<String> = sqlx::query_scalar(
        r#"SELECT model FROM "AiConfig" WHERE provider = $1"#,
    ).bind(&body.provider).fetch_all(state.pool()).await.unwrap_or_default();

    // Delete models not in fetched set and not actively used
    let existing: Vec<(String, String)> = sqlx::query_as(
        r#"SELECT id, "modelId" FROM "AiModelOption" WHERE provider = $1"#,
    ).bind(&body.provider).fetch_all(state.pool()).await.unwrap_or_default();

    let mut pruned = 0u64;
    for (eid, emid) in &existing {
        if !fetched_ids.contains(&emid.as_str()) && !active_models.contains(emid) {
            let _ = sqlx::query(r#"DELETE FROM "AiModelOption" WHERE id = $1"#)
                .bind(eid).execute(state.pool()).await;
            pruned += 1;
        }
    }

    Ok(Json(json!({
        "ok": true,
        "provider": body.provider,
        "modelsFound": models.len(),
        "upserted": upserted,
        "pruned": pruned,
    })))
}

// ── Provider model fetchers ───────────────────────────��─────────────────────

struct ProviderModel {
    model_id: String,
    display_name: String,
    category: String,
}

async fn fetch_provider_models(
    client: &reqwest::Client,
    provider: &str,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> Result<Vec<ProviderModel>, String> {
    match provider {
        "anthropic" => fetch_anthropic(client, api_key).await,
        "openai" => fetch_openai(client, api_key, base_url).await,
        "google" => fetch_google(client, api_key).await,
        "ollama_cloud" | "ollama_local" => fetch_ollama(client, api_key, base_url, provider).await,
        _ => Err(format!("Unknown provider: {provider}")),
    }
}

async fn fetch_anthropic(client: &reqwest::Client, api_key: Option<&str>) -> Result<Vec<ProviderModel>, String> {
    let key = api_key.ok_or("No API key configured.")?;
    let resp = client.get("https://api.anthropic.com/v1/models?limit=100")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Ok(vec![]); }
    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut models = vec![];
    for m in data["data"].as_array().unwrap_or(&vec![]) {
        let id = m["id"].as_str().unwrap_or_default();
        if id.is_empty() || id.starts_with("claude-instant") { continue; }
        let cat = if id.contains("haiku") { "fast" } else if id.contains("opus") { "reasoning" } else { "chat" };
        models.push(ProviderModel {
            model_id: id.to_string(),
            display_name: m["display_name"].as_str().unwrap_or(id).to_string(),
            category: cat.to_string(),
        });
    }
    Ok(models)
}

async fn fetch_openai(client: &reqwest::Client, api_key: Option<&str>, base_url: Option<&str>) -> Result<Vec<ProviderModel>, String> {
    let key = api_key.ok_or("No API key configured.")?;
    let url = format!("{}/v1/models", base_url.unwrap_or("https://api.openai.com"));
    let resp = client.get(&url).bearer_auth(key).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Ok(vec![]); }
    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut models = vec![];
    for m in data["data"].as_array().unwrap_or(&vec![]) {
        let id = m["id"].as_str().unwrap_or_default();
        let dominated = id.starts_with("gpt-") || id.starts_with("o3") || id.starts_with("o4") || id.starts_with("chatgpt-");
        if !dominated { continue; }
        let cat = if id.starts_with('o') { "reasoning" } else if id.contains("mini") { "fast" } else { "chat" };
        models.push(ProviderModel { model_id: id.to_string(), display_name: id.to_string(), category: cat.to_string() });
    }
    Ok(models)
}

async fn fetch_google(client: &reqwest::Client, api_key: Option<&str>) -> Result<Vec<ProviderModel>, String> {
    let key = api_key.ok_or("No API key configured.")?;
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={key}");
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Ok(vec![]); }
    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut models = vec![];
    for m in data["models"].as_array().unwrap_or(&vec![]) {
        let raw_name = m["name"].as_str().unwrap_or_default();
        let id = raw_name.strip_prefix("models/").unwrap_or(raw_name);
        if !id.starts_with("gemini-") { continue; }
        let cat = if id.contains("flash") || id.contains("lite") { "fast" } else if id.contains("pro") || id.contains("ultra") { "reasoning" } else { "chat" };
        models.push(ProviderModel {
            model_id: id.to_string(),
            display_name: m["displayName"].as_str().unwrap_or(id).to_string(),
            category: cat.to_string(),
        });
    }
    Ok(models)
}

async fn fetch_ollama(client: &reqwest::Client, api_key: Option<&str>, base_url: Option<&str>, provider: &str) -> Result<Vec<ProviderModel>, String> {
    let url = base_url
        .filter(|u| !u.is_empty())
        .or_else(|| if provider == "ollama_local" { Some("http://localhost:11434") } else { None })
        .ok_or("No base URL configured.")?;
    let mut req = client.get(format!("{url}/api/tags"));
    if let Some(key) = api_key { req = req.bearer_auth(key); }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Ok(vec![]); }
    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut models = vec![];
    for m in data["models"].as_array().unwrap_or(&vec![]) {
        let id = m["name"].as_str().or_else(|| m["model"].as_str()).unwrap_or_default();
        if id.is_empty() { continue; }
        let size = m["details"]["parameter_size"].as_str().unwrap_or("");
        let display = if size.is_empty() { id.to_string() } else { format!("{id} ({size})") };
        let cat = if id.contains("deepseek-r1") || id.contains("qwq") { "reasoning" } else { "chat" };
        models.push(ProviderModel { model_id: id.to_string(), display_name: display, category: cat.to_string() });
    }
    Ok(models)
}
