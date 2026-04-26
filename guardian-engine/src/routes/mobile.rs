//! Mobile API routes for G2 glasses and companion app.
//!
//! All endpoints use Bearer token auth (MobileAuthSession) instead of cookies.

use axum::{
    body::Body,
    extract::State,
    http::StatusCode,
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::{info, warn, error};

use crate::auth::jwt;
use crate::auth::middleware::MobileAuthSession;
use crate::auth::password;
use crate::helpers::audit::audit_log;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

// ── Routes ──────────────────────────────────────────────────────────────────

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/m/status", get(get_status))
        .route("/api/m/alerts", get(get_alerts))
        .route("/api/m/missions", get(get_missions))
        .route("/api/m/qrf", get(get_qrf))
        .route("/api/m/auth/login", post(mobile_login))
        .route("/api/m/chat", post(chat))
        .route("/api/m/chat/sessions", get(chat_sessions))
}

// ── Row types ───────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct NotificationRow {
    id: String,
    title: String,
    severity: String,
    category: String,
    #[sqlx(rename = "createdAt")]
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(sqlx::FromRow)]
struct IntelAlertRow {
    id: String,
    title: String,
    severity: i32,
    #[sqlx(rename = "reportType")]
    report_type: String,
    #[sqlx(rename = "hostileGroup")]
    hostile_group: Option<String>,
    #[sqlx(rename = "createdAt")]
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(sqlx::FromRow)]
struct MissionRow {
    id: String,
    callsign: String,
    title: String,
    #[sqlx(rename = "missionType")]
    mission_type: String,
    status: String,
    priority: String,
    #[sqlx(rename = "areaOfOperation")]
    area_of_operation: Option<String>,
    #[sqlx(rename = "updatedAt")]
    updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(sqlx::FromRow)]
struct QrfRow {
    id: String,
    callsign: String,
    status: String,
    platform: Option<String>,
    #[sqlx(rename = "locationName")]
    location_name: Option<String>,
    #[sqlx(rename = "availableCrew")]
    available_crew: i32,
}

#[derive(sqlx::FromRow)]
struct LoginUserRow {
    id: String,
    email: String,
    handle: String,
    #[sqlx(rename = "displayName")]
    display_name: Option<String>,
    #[sqlx(rename = "passwordHash")]
    password_hash: Option<String>,
    role: String,
    status: String,
    #[sqlx(rename = "totpSecret")]
    totp_secret: Option<String>,
    #[sqlx(rename = "totpEnabled")]
    totp_enabled: bool,
}

#[derive(sqlx::FromRow)]
struct OrgMembershipRow {
    org_id: String,
    org_tag: String,
}

#[derive(sqlx::FromRow)]
struct AiConfigRow {
    provider: String,
    model: String,
    #[sqlx(rename = "apiKey")]
    api_key: Option<String>,
    #[sqlx(rename = "baseUrl")]
    base_url: Option<String>,
    #[sqlx(rename = "maxTokens")]
    max_tokens: i32,
    temperature: f64,
}

#[derive(sqlx::FromRow)]
struct MissionContextRow {
    callsign: String,
    title: String,
    status: String,
    priority: String,
    #[sqlx(rename = "areaOfOperation")]
    area_of_operation: Option<String>,
}

#[derive(sqlx::FromRow)]
struct IntelContextRow {
    title: String,
    severity: i32,
    #[sqlx(rename = "reportType")]
    report_type: String,
    #[sqlx(rename = "hostileGroup")]
    hostile_group: Option<String>,
    #[sqlx(rename = "locationName")]
    location_name: Option<String>,
}

#[derive(sqlx::FromRow)]
struct NotifContextRow {
    title: String,
    severity: String,
}

// ── Request types ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct LoginBody {
    email: Option<String>,
    username: Option<String>,
    password: String,
}

#[derive(Deserialize)]
struct ChatBody {
    message: String,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
}

// ── GET /api/m/status ───────────────────────────────────────────────────────

async fn get_status(
    State(state): State<AppState>,
    session: MobileAuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool();
    let org = get_org_for_user(pool, &session.user_id).await;

    if org.is_none() {
        return Ok(Json(json!({
            "threatLevel": "low",
            "activeMissionCount": 0,
            "recentAlertCount": 0,
            "qrfReady": false,
            "userRole": session.role,
            "activeMission": null,
        })));
    }
    let org = org.unwrap();

    let active_mission_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "Mission" WHERE "orgId" = $1 AND status IN ('planning', 'ready', 'active')"#,
    )
    .bind(&org.id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let recent_alert_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "Notification" WHERE "orgId" = $1 AND status = 'unread'"#,
    )
    .bind(&org.id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let qrf_ready_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "QrfReadiness" WHERE "orgId" = $1 AND status IN ('redcon1', 'redcon2')"#,
    )
    .bind(&org.id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let max_severity: Option<i32> = sqlx::query_scalar(
        r#"SELECT severity FROM "IntelReport" WHERE "orgId" = $1 AND "isActive" = true ORDER BY severity DESC LIMIT 1"#,
    )
    .bind(&org.id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let active_mission: Option<(String, String, String, String, String)> = sqlx::query_as(
        r#"SELECT id, callsign, title, status, priority
           FROM "Mission" WHERE "orgId" = $1 AND status = 'active'
           ORDER BY "updatedAt" DESC LIMIT 1"#,
    )
    .bind(&org.id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let severity = max_severity.unwrap_or(0);
    let threat_level = match severity {
        5.. => "critical",
        4 => "high",
        3 => "elevated",
        2 => "guarded",
        _ => "low",
    };

    let active_mission_json = active_mission.map(|(id, _callsign, title, status, priority)| {
        json!({
            "id": id,
            "name": title,
            "phase": status,
            "status": priority,
        })
    });

    Ok(Json(json!({
        "threatLevel": threat_level,
        "activeMissionCount": active_mission_count,
        "recentAlertCount": recent_alert_count,
        "qrfReady": qrf_ready_count > 0,
        "userRole": session.role,
        "activeMission": active_mission_json,
    })))
}

// ── GET /api/m/alerts ───────────────────────────────────────────────────────

async fn get_alerts(
    State(state): State<AppState>,
    session: MobileAuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool();
    let org = get_org_for_user(pool, &session.user_id).await;

    if org.is_none() {
        return Ok(Json(json!({ "alerts": [] })));
    }
    let org = org.unwrap();

    let notifications: Vec<NotificationRow> = sqlx::query_as(
        r#"SELECT id, title, severity, category, "createdAt"
           FROM "Notification"
           WHERE "orgId" = $1 AND status = 'unread' AND severity IN ('critical', 'warning')
           ORDER BY "createdAt" DESC LIMIT 8"#,
    )
    .bind(&org.id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let intel: Vec<IntelAlertRow> = sqlx::query_as(
        r#"SELECT id, title, severity, "reportType", "hostileGroup", "createdAt"
           FROM "IntelReport"
           WHERE "orgId" = $1 AND "isActive" = true AND severity >= 3
           ORDER BY severity DESC, "createdAt" DESC LIMIT 8"#,
    )
    .bind(&org.id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let severity_map = |s: i32| -> &str {
        match s {
            5 => "critical",
            4 => "high",
            3 => "elevated",
            2 => "guarded",
            _ => "low",
        }
    };

    let mut alerts: Vec<Value> = Vec::new();

    for n in &notifications {
        alerts.push(json!({
            "id": format!("notif-{}", n.id),
            "title": n.title,
            "severity": n.severity,
            "source": n.category,
            "createdAt": n.created_at.to_rfc3339(),
        }));
    }

    for i in &intel {
        alerts.push(json!({
            "id": format!("intel-{}", i.id),
            "title": i.title,
            "severity": severity_map(i.severity),
            "source": i.report_type,
            "createdAt": i.created_at.to_rfc3339(),
        }));
    }

    // Sort by createdAt descending, take top 10
    alerts.sort_by(|a, b| {
        let a_time = a["createdAt"].as_str().unwrap_or("");
        let b_time = b["createdAt"].as_str().unwrap_or("");
        b_time.cmp(a_time)
    });
    alerts.truncate(10);

    Ok(Json(json!({ "alerts": alerts })))
}

// ── GET /api/m/missions ─────────────────────────────────────────────────────

async fn get_missions(
    State(state): State<AppState>,
    session: MobileAuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool();
    let org = get_org_for_user(pool, &session.user_id).await;

    if org.is_none() {
        return Ok(Json(json!({ "missions": [] })));
    }
    let org = org.unwrap();

    let missions: Vec<MissionRow> = sqlx::query_as(
        r#"SELECT id, callsign, title, "missionType", status, priority,
                  "areaOfOperation", "updatedAt"
           FROM "Mission"
           WHERE "orgId" = $1 AND status IN ('planning', 'ready', 'active')
           ORDER BY priority DESC, "updatedAt" DESC
           LIMIT 10"#,
    )
    .bind(&org.id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let items: Vec<Value> = missions
        .iter()
        .map(|m| {
            json!({
                "id": m.id,
                "name": format!("{} / {}", m.callsign, m.title),
                "phase": m.status,
                "status": m.priority,
                "type": m.mission_type,
                "area": m.area_of_operation,
                "updatedAt": m.updated_at.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(json!({ "missions": items })))
}

// ── GET /api/m/qrf ──────────────────────────────────────────────────────────

async fn get_qrf(
    State(state): State<AppState>,
    session: MobileAuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool();
    let org = get_org_for_user(pool, &session.user_id).await;

    if org.is_none() {
        return Ok(Json(json!({ "assets": [] })));
    }
    let org = org.unwrap();

    let qrf: Vec<QrfRow> = sqlx::query_as(
        r#"SELECT id, callsign, status, platform, "locationName", "availableCrew"
           FROM "QrfReadiness"
           WHERE "orgId" = $1
           ORDER BY status ASC, "updatedAt" DESC
           LIMIT 10"#,
    )
    .bind(&org.id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let assets: Vec<Value> = qrf
        .iter()
        .map(|q| {
            json!({
                "id": q.id,
                "name": q.callsign,
                "type": q.platform.as_deref().unwrap_or("unknown"),
                "status": q.status,
                "location": q.location_name,
                "crew": q.available_crew,
            })
        })
        .collect();

    Ok(Json(json!({ "assets": assets })))
}

// ── POST /api/m/auth/login ──────────────────────────────────────────────────

async fn mobile_login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool();

    // Rate limit (uses same limiter as web login)
    let ip = "mobile"; // TODO: extract from x-forwarded-for
    if state.rate_limiter().check(ip) {
        warn!("Mobile login rate limited");
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({ "error": "Too many login attempts. Try again later." })),
        ));
    }

    // Validate input
    if body.password.is_empty() || body.password.len() > 128 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid credentials format." })),
        ));
    }

    let identifier = body
        .email
        .as_deref()
        .or(body.username.as_deref())
        .unwrap_or("")
        .trim()
        .to_lowercase();

    if identifier.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Email or username required." })),
        ));
    }

    // Look up by email first
    let mut user: Option<LoginUserRow> = sqlx::query_as(
        r#"SELECT id, email, handle, "displayName", "passwordHash", role, status,
                  "totpSecret", "totpEnabled"
           FROM "User" WHERE email = $1"#,
    )
    .bind(&identifier)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("DB error during mobile login: {e}");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Failed to sign in." })))
    })?;

    // Fall back to handle lookup
    if user.is_none() {
        user = sqlx::query_as(
            r#"SELECT id, email, handle, "displayName", "passwordHash", role, status,
                      "totpSecret", "totpEnabled"
               FROM "User" WHERE LOWER(handle) = $1"#,
        )
        .bind(&identifier)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            error!("DB error during mobile login: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Failed to sign in." })))
        })?;
    }

    let user = user.ok_or_else(|| {
        (StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid credentials." })))
    })?;

    let hash = user.password_hash.as_deref().ok_or_else(|| {
        (StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid credentials." })))
    })?;

    // Verify password (blocking)
    let hash_owned = hash.to_string();
    let pass_owned = body.password.clone();
    let valid = tokio::task::spawn_blocking(move || password::verify_password(&pass_owned, &hash_owned))
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Failed to sign in." }))))?
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Failed to sign in." }))))?;

    if !valid || user.status != "active" {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid credentials." })),
        ));
    }

    // TOTP-protected accounts cannot use mobile login
    if user.totp_enabled && user.totp_secret.is_some() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "TOTP-protected accounts cannot use mobile login. Disable TOTP or use web interface." })),
        ));
    }

    // Get org membership
    let membership: Option<OrgMembershipRow> = sqlx::query_as(
        r#"SELECT o.id as org_id, o.tag as org_tag
           FROM "OrgMember" m JOIN "Organization" o ON m."orgId" = o.id
           WHERE m."userId" = $1 ORDER BY m."joinedAt" ASC LIMIT 1"#,
    )
    .bind(&user.id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("DB error fetching membership: {e}");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Failed to sign in." })))
    })?;

    // Sign JWT
    let claims = jwt::new_session_claims(
        &user.id,
        &user.email,
        &user.handle,
        &user.role,
        user.display_name.as_deref(),
        &user.status,
        membership.as_ref().map(|m| m.org_id.as_str()),
        membership.as_ref().map(|m| m.org_tag.as_str()),
    );

    let token = jwt::sign_session(&claims, state.auth_secret())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Failed to sign in." }))))?;

    // Audit
    audit_log(
        pool,
        &user.id,
        membership.as_ref().map(|m| m.org_id.as_str()),
        "mobile_login",
        "session",
        None,
        Some(json!({ "handle": user.handle, "client": "g2" })),
    )
    .await;

    info!(handle = %user.handle, "Mobile login successful");

    Ok(Json(json!({
        "token": token,
        "role": user.role,
        "handle": user.handle,
        "displayName": user.display_name,
    })))
}

// ── POST /api/m/chat ────────────────────────────────────────────────────────

const COMMANDER_ROLES: &[&str] = &["commander", "director", "admin"];

async fn chat(
    State(state): State<AppState>,
    session: MobileAuthSession,
    Json(body): Json<ChatBody>,
) -> Result<Response, (StatusCode, Json<Value>)> {
    let pool = state.pool();

    if !COMMANDER_ROLES.contains(&session.role.as_str()) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "AI chat requires command authority." })),
        ));
    }

    let message = body.message.trim();
    if message.is_empty() || message.len() > 2000 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid chat payload." })),
        ));
    }

    let org = get_org_for_user(pool, &session.user_id)
        .await
        .ok_or_else(|| {
            (StatusCode::BAD_REQUEST, Json(json!({ "error": "No organization found." })))
        })?;

    // Load AI config from DB
    let ai_config: Option<AiConfigRow> = sqlx::query_as(
        r#"SELECT provider, model, "apiKey", "baseUrl", "maxTokens", temperature
           FROM "AiConfig" WHERE "orgId" = $1 AND enabled = true LIMIT 1"#,
    )
    .bind(&org.id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("Failed to load AI config: {e}");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Failed to load AI config." })))
    })?;

    let ai_config = ai_config.ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "AI is not configured for this organization. Set it up in the Guardian web interface." })),
        )
    })?;

    let api_key = ai_config.api_key.as_deref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "AI is not configured for this organization." })),
        )
    })?;

    // Gather ops context
    let active_missions: Vec<MissionContextRow> = sqlx::query_as(
        r#"SELECT callsign, title, status, priority, "areaOfOperation"
           FROM "Mission" WHERE "orgId" = $1 AND status IN ('planning', 'ready', 'active')
           LIMIT 6"#,
    )
    .bind(&org.id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let active_intel: Vec<IntelContextRow> = sqlx::query_as(
        r#"SELECT title, severity, "reportType", "hostileGroup", "locationName"
           FROM "IntelReport" WHERE "orgId" = $1 AND "isActive" = true
           ORDER BY severity DESC LIMIT 6"#,
    )
    .bind(&org.id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let qrf_ready: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "QrfReadiness" WHERE "orgId" = $1 AND status IN ('redcon1', 'redcon2')"#,
    )
    .bind(&org.id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let recent_notifs: Vec<NotifContextRow> = sqlx::query_as(
        r#"SELECT title, severity FROM "Notification"
           WHERE "orgId" = $1 AND status = 'unread'
           ORDER BY "createdAt" DESC LIMIT 4"#,
    )
    .bind(&org.id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Build ops context string
    let mut ops_lines = vec![
        format!("Organization: {}", org.name),
        format!("Active missions: {}", active_missions.len()),
    ];
    for m in &active_missions {
        let ao = m.area_of_operation.as_deref().map(|a| format!(" AO: {a}")).unwrap_or_default();
        ops_lines.push(format!("  - {}: {} [{}/{}]{ao}", m.callsign, m.title, m.status, m.priority));
    }
    ops_lines.push(format!("Active intel reports: {}", active_intel.len()));
    for i in &active_intel {
        let hostile = i.hostile_group.as_deref().map(|h| format!(" hostile: {h}")).unwrap_or_default();
        let loc = i.location_name.as_deref().map(|l| format!(" at {l}")).unwrap_or_default();
        ops_lines.push(format!("  - {} [sev {}/{}]{hostile}{loc}", i.title, i.severity, i.report_type));
    }
    ops_lines.push(format!("QRF ready assets: {qrf_ready}"));
    ops_lines.push(format!("Unread alerts: {}", recent_notifs.len()));
    for n in &recent_notifs {
        ops_lines.push(format!("  - [{}] {}", n.severity, n.title));
    }

    let system_prompt = format!(
        "You are Guardian AI, the operational intelligence assistant for a Star Citizen organization.\n\
         You have access to real-time operational data shown below.\n\
         Answer questions about missions, threats, intel, QRF status, and operational readiness.\n\
         Be concise — responses are displayed on smart glasses with limited screen space (~380 chars per page).\n\
         Use military/aviation brevity where appropriate.\n\n\
         CURRENT OPS STATUS:\n{}",
        ops_lines.join("\n")
    );

    // Build provider request
    let is_anthropic = ai_config.provider == "anthropic";

    let provider_url = get_provider_url(&ai_config.provider, ai_config.base_url.as_deref());
    let provider_headers = get_provider_headers(&ai_config.provider, api_key);

    let provider_body = if is_anthropic {
        json!({
            "model": ai_config.model,
            "max_tokens": ai_config.max_tokens,
            "temperature": ai_config.temperature,
            "stream": true,
            "system": system_prompt,
            "messages": [{ "role": "user", "content": message }],
        })
    } else {
        json!({
            "model": ai_config.model,
            "max_tokens": ai_config.max_tokens,
            "temperature": ai_config.temperature,
            "stream": true,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": message },
            ],
        })
    };

    let client = state.http_client();
    let mut req = client.post(&provider_url).json(&provider_body);
    for (k, v) in &provider_headers {
        req = req.header(k.as_str(), v.as_str());
    }

    let mut provider_res = req.send().await.map_err(|e| {
        error!("AI provider request failed: {e}");
        (StatusCode::BAD_GATEWAY, Json(json!({ "error": "AI provider unreachable." })))
    })?;

    if !provider_res.status().is_success() {
        let status = provider_res.status().as_u16();
        error!("AI provider returned {status}");
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("AI provider returned {status}") })),
        ));
    }

    let session_id = body.session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    if is_anthropic {
        // Transform Anthropic SSE to OpenAI-compatible SSE via channel
        let (tx, rx) = tokio::sync::mpsc::channel::<Result<bytes::Bytes, std::io::Error>>(32);

        tokio::spawn(async move {
            let mut buffer = String::new();
            loop {
                match provider_res.chunk().await {
                    Ok(Some(chunk)) => {
                        buffer.push_str(&String::from_utf8_lossy(&chunk));
                        while let Some(pos) = buffer.find('\n') {
                            let line = buffer[..pos].to_string();
                            buffer = buffer[pos + 1..].to_string();

                            if !line.starts_with("data: ") {
                                continue;
                            }
                            let data = line[6..].trim();
                            if data.is_empty() || data == "[DONE]" {
                                continue;
                            }

                            if let Ok(parsed) = serde_json::from_str::<Value>(data) {
                                if parsed["type"] == "content_block_delta" {
                                    if let Some(text) = parsed["delta"]["text"].as_str() {
                                        let openai_chunk = json!({
                                            "choices": [{ "delta": { "content": text } }]
                                        });
                                        let sse = format!("data: {openai_chunk}\n\n");
                                        if tx.send(Ok(bytes::Bytes::from(sse))).await.is_err() {
                                            return;
                                        }
                                    }
                                } else if parsed["type"] == "message_stop" {
                                    let _ = tx.send(Ok(bytes::Bytes::from("data: [DONE]\n\n"))).await;
                                    return;
                                }
                            }
                        }
                    }
                    Ok(None) => {
                        let _ = tx.send(Ok(bytes::Bytes::from("data: [DONE]\n\n"))).await;
                        return;
                    }
                    Err(_) => return,
                }
            }
        });

        let stream = futures_util::stream::unfold(rx, |mut rx| async move {
            rx.recv().await.map(|item| (item, rx))
        });

        let body = Body::from_stream(stream);
        Ok(Response::builder()
            .status(200)
            .header("Content-Type", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .header("Connection", "keep-alive")
            .header("X-Session-Id", session_id)
            .body(body)
            .unwrap())
    } else {
        // OpenAI/Ollama: pass through the SSE stream directly
        let body = Body::from_stream(provider_res.bytes_stream());
        Ok(Response::builder()
            .status(200)
            .header("Content-Type", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .header("Connection", "keep-alive")
            .header("X-Session-Id", session_id)
            .body(body)
            .unwrap())
    }
}

// ── GET /api/m/chat/sessions ────────────────────────────────────────────────

async fn chat_sessions(
    _session: MobileAuthSession,
) -> Json<Value> {
    // Stub — chat sessions not persisted yet
    Json(json!({ "sessions": [] }))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn get_provider_url(provider: &str, base_url: Option<&str>) -> String {
    if let Some(base) = base_url {
        let base = base.trim_end_matches('/');
        return if provider == "anthropic" {
            format!("{base}/v1/messages")
        } else {
            format!("{base}/v1/chat/completions")
        };
    }

    match provider {
        "anthropic" => "https://api.anthropic.com/v1/messages".to_string(),
        "openai" => "https://api.openai.com/v1/chat/completions".to_string(),
        "ollama" | "ollama_local" => "http://localhost:11434/v1/chat/completions".to_string(),
        _ => "https://api.openai.com/v1/chat/completions".to_string(),
    }
}

fn get_provider_headers(provider: &str, api_key: &str) -> Vec<(String, String)> {
    let mut headers = vec![("Content-Type".to_string(), "application/json".to_string())];
    match provider {
        "anthropic" => {
            headers.push(("x-api-key".to_string(), api_key.to_string()));
            headers.push(("anthropic-version".to_string(), "2023-06-01".to_string()));
        }
        _ => {
            headers.push(("Authorization".to_string(), format!("Bearer {api_key}")));
        }
    }
    headers
}
