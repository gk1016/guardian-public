use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, patch, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::middleware::AuthSession;
use crate::helpers::audit::audit_log;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

// ── Request types ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateDoctrineRequest {
    code: String,
    title: String,
    category: String,
    summary: String,
    body: String,
    escalation: Option<String>,
}

#[derive(Deserialize)]
struct UpdateDoctrineRequest {
    code: Option<String>,
    title: Option<String>,
    category: Option<String>,
    summary: Option<String>,
    body: Option<String>,
    escalation: Option<String>,
    #[serde(rename = "isDefault")]
    is_default: Option<bool>,
}

// ── Routes ────────────────────────────────────────────────────────────────────

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/doctrine", post(create_doctrine))
        .route("/api/doctrine/{id}", patch(update_doctrine).delete(delete_doctrine))
}

// ── POST /api/doctrine ────────────────────────────────────────────────────────

async fn create_doctrine(
    State(state): State<AppState>,
    session: AuthSession,
    Json(body): Json<CreateDoctrineRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !session.can_manage_administration() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Admin authority required."}))));
    }

    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))?;

    if body.code.is_empty() || body.title.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Code and title are required."}))));
    }

    let id = cuid2::create_id();

    sqlx::query(
        r#"INSERT INTO "DoctrineTemplate" (id, "orgId", code, title, category, summary, body, escalation, "isDefault", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())"#,
    )
    .bind(&id)
    .bind(&org.id)
    .bind(&body.code)
    .bind(&body.title)
    .bind(&body.category)
    .bind(&body.summary)
    .bind(&body.body)
    .bind(&body.escalation)
    .execute(state.pool())
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") || e.to_string().contains("unique constraint") {
            (StatusCode::CONFLICT, Json(json!({"error": "A doctrine with this code already exists."})))
        } else {
            tracing::error!(error = %e, "doctrine create failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create doctrine."})))
        }
    })?;

    audit_log(
        state.pool(), &session.user_id, Some(&org.id),
        "create_doctrine", "doctrine_template", Some(&id),
        Some(json!({"code": body.code, "title": body.title})),
    ).await;

    Ok(Json(json!({"ok": true, "id": id})))
}

// ── PATCH /api/doctrine/{id} ──────────────────────────────────────────────────

async fn update_doctrine(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
    Json(body): Json<UpdateDoctrineRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !session.can_manage_administration() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Admin authority required."}))));
    }

    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))?;

    // Verify ownership
    let exists: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "DoctrineTemplate" WHERE id = $1 AND "orgId" = $2"#,
    )
    .bind(&id)
    .bind(&org.id)
    .fetch_optional(state.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Doctrine not found."}))));
    }

    // Build dynamic SET clause
    let mut sets: Vec<String> = vec![r#""updatedAt" = NOW()"#.to_string()];
    let mut bind_idx = 3u32; // $1=id, $2=orgId
    let mut binds: Vec<Option<String>> = Vec::new();

    if let Some(ref v) = body.code {
        sets.push(format!("code = ${bind_idx}"));
        binds.push(Some(v.clone()));
        bind_idx += 1;
    }
    if let Some(ref v) = body.title {
        sets.push(format!("title = ${bind_idx}"));
        binds.push(Some(v.clone()));
        bind_idx += 1;
    }
    if let Some(ref v) = body.category {
        sets.push(format!("category = ${bind_idx}"));
        binds.push(Some(v.clone()));
        bind_idx += 1;
    }
    if let Some(ref v) = body.summary {
        sets.push(format!("summary = ${bind_idx}"));
        binds.push(Some(v.clone()));
        bind_idx += 1;
    }
    if let Some(ref v) = body.body {
        sets.push(format!("body = ${bind_idx}"));
        binds.push(Some(v.clone()));
        bind_idx += 1;
    }
    if body.escalation.is_some() {
        sets.push(format!("escalation = ${bind_idx}"));
        binds.push(body.escalation.clone());
        bind_idx += 1;
    }

    let sql = format!(
        r#"UPDATE "DoctrineTemplate" SET {} WHERE id = $1 AND "orgId" = $2"#,
        sets.join(", ")
    );

    let mut query = sqlx::query(&sql).bind(&id).bind(&org.id);
    for b in &binds {
        query = query.bind(b);
    }

    // Handle isDefault separately (bool, not string)
    if let Some(is_default) = body.is_default {
        // If setting as default, clear other defaults first
        if is_default {
            sqlx::query(r#"UPDATE "DoctrineTemplate" SET "isDefault" = false WHERE "orgId" = $1 AND id != $2"#)
                .bind(&org.id)
                .bind(&id)
                .execute(state.pool())
                .await
                .ok();
        }
        // Update this one in a separate query since we can't mix bind types easily
        sqlx::query(r#"UPDATE "DoctrineTemplate" SET "isDefault" = $1 WHERE id = $2 AND "orgId" = $3"#)
            .bind(is_default)
            .bind(&id)
            .bind(&org.id)
            .execute(state.pool())
            .await
            .ok();
    }

    query.execute(state.pool()).await.map_err(|e| {
        if e.to_string().contains("duplicate key") || e.to_string().contains("unique constraint") {
            (StatusCode::CONFLICT, Json(json!({"error": "A doctrine with this code already exists."})))
        } else {
            tracing::error!(error = %e, "doctrine update failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update doctrine."})))
        }
    })?;

    audit_log(
        state.pool(), &session.user_id, Some(&org.id),
        "update_doctrine", "doctrine_template", Some(&id), None,
    ).await;

    let _ = bind_idx; // suppress unused warning

    Ok(Json(json!({"ok": true})))
}

// ── DELETE /api/doctrine/{id} ─────────────────────────────────────────────────

async fn delete_doctrine(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !session.can_manage_administration() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Admin authority required."}))));
    }

    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))?;

    let result = sqlx::query(
        r#"DELETE FROM "DoctrineTemplate" WHERE id = $1 AND "orgId" = $2"#,
    )
    .bind(&id)
    .bind(&org.id)
    .execute(state.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Delete failed."}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Doctrine not found."}))));
    }

    audit_log(
        state.pool(), &session.user_id, Some(&org.id),
        "delete_doctrine", "doctrine_template", Some(&id), None,
    ).await;

    Ok(Json(json!({"ok": true})))
}
