use axum::{
    extract::{Path, Query, State},
    routing::{get, post, patch, put},
    Json, Router,
};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::info;

use crate::auth::middleware::AuthSession;
use crate::helpers::audit::audit_log;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        // Public (no auth)
        .route("/api/recruit/config", get(public_config))
        .route("/api/recruit/apply", post(apply))
        // Admin
        .route("/api/admin/recruit/config", get(admin_get_config))
        .route("/api/admin/recruit/config", put(admin_update_config))
        .route("/api/admin/applications", get(admin_list_applications))
        .route("/api/admin/applications/{id}", patch(admin_update_application))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn require_admin(session: &crate::auth::session::Session) -> Result<(), (StatusCode, Json<Value>)> {
    if !session.can_manage_administration() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Admin authority required."}))));
    }
    Ok(())
}

async fn require_org(pool: &sqlx::PgPool, user_id: &str) -> Result<crate::helpers::org::OrgInfo, (StatusCode, Json<Value>)> {
    get_org_for_user(pool, user_id)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))
}

/// Get the first org's ID (for public endpoints where there's no session).
async fn get_first_org_id(pool: &sqlx::PgPool) -> Result<String, (StatusCode, Json<Value>)> {
    sqlx::query_scalar::<_, String>(r#"SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1"#)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))
        .and_then(|opt| opt.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "No organization configured."})))))
}

// ─── Public: GET /api/recruit/config ─────────────────────────────────────────

async fn public_config(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org_id = get_first_org_id(state.pool()).await?;

    #[derive(sqlx::FromRow)]
    struct Row {
        headline: String,
        description: String,
        values: Value,
        #[sqlx(rename = "ctaText")]
        cta_text: String,
        #[sqlx(rename = "isEnabled")]
        is_enabled: bool,
    }

    let row = sqlx::query_as::<_, Row>(
        r#"SELECT headline, description, values, "ctaText", "isEnabled" FROM "RecruitConfig" WHERE "orgId" = $1"#
    )
    .bind(&org_id)
    .fetch_optional(state.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    // Also get org name for display
    let org_name: String = sqlx::query_scalar(r#"SELECT name FROM "Organization" WHERE id = $1"#)
        .bind(&org_id)
        .fetch_one(state.pool())
        .await
        .unwrap_or_else(|_| "Organization".to_string());

    match row {
        Some(r) if r.is_enabled => Ok(Json(json!({
            "ok": true,
            "enabled": true,
            "orgName": org_name,
            "headline": r.headline,
            "description": r.description,
            "values": r.values,
            "ctaText": r.cta_text,
        }))),
        _ => Ok(Json(json!({
            "ok": true,
            "enabled": false,
            "orgName": org_name,
        }))),
    }
}

// ─── Public: POST /api/recruit/apply ─────────────────────────────────────────

#[derive(Deserialize)]
struct ApplyRequest {
    handle: String,
    name: String,
    email: Option<String>,
    message: Option<String>,
}

async fn apply(
    State(state): State<AppState>,
    Json(body): Json<ApplyRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org_id = get_first_org_id(state.pool()).await?;

    // Check recruit is enabled
    let enabled: Option<bool> = sqlx::query_scalar(
        r#"SELECT "isEnabled" FROM "RecruitConfig" WHERE "orgId" = $1"#
    ).bind(&org_id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    if enabled != Some(true) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Recruitment is not currently open."}))));
    }

    // Validate
    let handle = body.handle.trim().to_string();
    let name = body.name.trim().to_string();
    if handle.is_empty() || handle.len() > 64 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Handle is required (max 64 chars)."}))));
    }
    if name.is_empty() || name.len() > 128 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Name is required (max 128 chars)."}))));
    }
    let message = body.message.as_deref().unwrap_or("").trim();
    if message.len() > 2000 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Message too long (max 2000 chars)."}))));
    }

    // Check for duplicate pending application
    let existing: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "Application" WHERE "orgId" = $1 AND handle = $2 AND status = 'pending'"#
    ).bind(&org_id).bind(&handle).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    if existing.is_some() {
        return Err((StatusCode::CONFLICT, Json(json!({"error": "An application for this handle is already pending."}))));
    }

    let app_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "Application" (id, "orgId", handle, name, email, message, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW())"#
    )
    .bind(&app_id).bind(&org_id).bind(&handle).bind(&name)
    .bind(body.email.as_deref()).bind(message)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to submit application."}))))?;

    info!(handle = %handle, name = %name, "New recruit application submitted");

    Ok(Json(json!({"ok": true, "id": app_id})))
}

// ─── Admin: GET /api/admin/recruit/config ────────────────────────────────────

async fn admin_get_config(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    #[derive(sqlx::FromRow)]
    struct Row {
        headline: String,
        description: String,
        values: Value,
        #[sqlx(rename = "ctaText")]
        cta_text: String,
        #[sqlx(rename = "isEnabled")]
        is_enabled: bool,
    }

    let row = sqlx::query_as::<_, Row>(
        r#"SELECT headline, description, values, "ctaText", "isEnabled" FROM "RecruitConfig" WHERE "orgId" = $1"#
    ).bind(&org.id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    match row {
        Some(r) => Ok(Json(json!({
            "ok": true,
            "headline": r.headline,
            "description": r.description,
            "values": r.values,
            "ctaText": r.cta_text,
            "isEnabled": r.is_enabled,
        }))),
        None => Ok(Json(json!({
            "ok": true,
            "headline": "Join the crew.",
            "description": "We're looking for new members. Submit an application below.",
            "values": [],
            "ctaText": "Submit Application",
            "isEnabled": false,
        }))),
    }
}

// ─── Admin: PUT /api/admin/recruit/config ────────────────────────────────────

#[derive(Deserialize)]
struct UpdateConfigRequest {
    headline: String,
    description: String,
    values: Value,
    #[serde(rename = "ctaText")]
    cta_text: String,
    #[serde(rename = "isEnabled")]
    is_enabled: bool,
}

async fn admin_update_config(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<UpdateConfigRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let config_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "RecruitConfig" (id, "orgId", headline, description, values, "ctaText", "isEnabled", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           ON CONFLICT ("orgId") DO UPDATE SET
             headline = EXCLUDED.headline,
             description = EXCLUDED.description,
             values = EXCLUDED.values,
             "ctaText" = EXCLUDED."ctaText",
             "isEnabled" = EXCLUDED."isEnabled",
             "updatedAt" = NOW()"#
    )
    .bind(&config_id).bind(&org.id)
    .bind(&body.headline).bind(&body.description)
    .bind(&body.values).bind(&body.cta_text).bind(body.is_enabled)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save recruit config."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "recruit_config", None,
        Some(json!({"isEnabled": body.is_enabled}))).await;

    info!(user = %session.handle, org = %org.tag, enabled = body.is_enabled, "Recruit config updated");

    Ok(Json(json!({"ok": true})))
}

// ─── Admin: GET /api/admin/applications ──────────────────────────────────────

#[derive(Deserialize)]
struct ListAppsQuery {
    status: Option<String>,
    limit: Option<i64>,
}

async fn admin_list_applications(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Query(q): Query<ListAppsQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let limit = q.limit.unwrap_or(100).min(500);

    #[derive(sqlx::FromRow, Serialize)]
    struct AppRow {
        id: String,
        handle: String,
        name: String,
        email: Option<String>,
        message: String,
        status: String,
        notes: Option<String>,
        #[sqlx(rename = "createdAt")]
        created_at: chrono::NaiveDateTime,
    }

    let apps = if let Some(ref status) = q.status {
        sqlx::query_as::<_, AppRow>(
            r#"SELECT id, handle, name, email, message, status, notes, "createdAt"
               FROM "Application" WHERE "orgId" = $1 AND status = $2
               ORDER BY "createdAt" DESC LIMIT $3"#
        ).bind(&org.id).bind(status).bind(limit)
            .fetch_all(state.pool()).await.unwrap_or_default()
    } else {
        sqlx::query_as::<_, AppRow>(
            r#"SELECT id, handle, name, email, message, status, notes, "createdAt"
               FROM "Application" WHERE "orgId" = $1
               ORDER BY "createdAt" DESC LIMIT $2"#
        ).bind(&org.id).bind(limit)
            .fetch_all(state.pool()).await.unwrap_or_default()
    };

    let pending_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM "Application" WHERE "orgId" = $1 AND status = 'pending'"#
    ).bind(&org.id).fetch_one(state.pool()).await.unwrap_or(0);

    Ok(Json(json!({
        "ok": true,
        "pendingCount": pending_count,
        "items": apps.iter().map(|a| json!({
            "id": a.id,
            "handle": a.handle,
            "name": a.name,
            "email": a.email,
            "message": a.message,
            "status": a.status,
            "notes": a.notes,
            "createdAt": a.created_at.and_utc().to_rfc3339(),
        })).collect::<Vec<_>>(),
    })))
}

// ─── Admin: PATCH /api/admin/applications/:id ────────────────────────────────

#[derive(Deserialize)]
struct UpdateAppRequest {
    status: String,
    notes: Option<String>,
}

async fn admin_update_application(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(app_id): Path<String>,
    Json(body): Json<UpdateAppRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let valid = ["pending", "approved", "rejected"];
    if !valid.contains(&body.status.as_str()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": format!("Status must be one of: {}", valid.join(", "))}))));
    }

    // Verify application belongs to this org
    let handle: Option<String> = sqlx::query_scalar(
        r#"SELECT handle FROM "Application" WHERE id = $1 AND "orgId" = $2"#
    ).bind(&app_id).bind(&org.id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let handle = handle.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Application not found."}))))?;

    sqlx::query(
        r#"UPDATE "Application" SET status = $1, notes = $2, "updatedAt" = NOW() WHERE id = $3"#
    ).bind(&body.status).bind(body.notes.as_deref()).bind(&app_id)
        .execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update application."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), &format!("application_{}", body.status),
        "application", Some(&app_id), Some(json!({"handle": handle}))).await;

    info!(user = %session.handle, app = %app_id, handle = %handle, status = %body.status, "Application updated");

    Ok(Json(json!({"ok": true, "id": app_id, "status": body.status})))
}
