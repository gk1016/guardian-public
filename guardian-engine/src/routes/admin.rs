use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing::info;

use crate::auth::middleware::AuthSession;
use crate::auth::password;
use crate::helpers::audit::audit_log;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/admin/stats", get(stats))
        .route("/api/admin/audit-logs", get(audit_list))
        .route("/api/admin/audit-logs/export", get(audit_export))
        .route("/api/admin/users", post(create_user))
        .route("/api/admin/users/{userId}", axum::routing::patch(update_user))
        .route("/api/admin/users/{userId}/revoke-sessions", post(revoke_sessions))
        .route("/api/admin/users/{userId}/reset-totp", post(reset_totp))
        .route("/api/admin/factory-reset", post(factory_reset))
}


// --- POST /api/admin/factory-reset ---

#[derive(Deserialize)]
struct FactoryResetRequest {
    confirm: String,
}

async fn factory_reset(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<FactoryResetRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    if body.confirm != "RESET" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Confirmation text must be RESET."}))));
    }

    info!(user = %session.handle, org = %org.tag, "Factory reset initiated");

    let tables: &[&str] = &[
        r#"DELETE FROM "MissionLog" WHERE "missionId" IN (SELECT id FROM "Mission" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "MissionIntelLink" WHERE "missionId" IN (SELECT id FROM "Mission" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "MissionParticipant" WHERE "missionId" IN (SELECT id FROM "Mission" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "Mission" WHERE "orgId" = $1"#,
        r#"DELETE FROM "IntelReport" WHERE "orgId" = $1"#,
        r#"DELETE FROM "FederatedIntel" WHERE "orgId" = $1"#,
        r#"DELETE FROM "RescueRequest" WHERE "orgId" = $1"#,
        r#"DELETE FROM "QrfDispatch" WHERE "qrfId" IN (SELECT id FROM "QrfReadiness" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "QrfReadiness" WHERE "orgId" = $1"#,
        r#"DELETE FROM "Incident" WHERE "orgId" = $1"#,
        r#"DELETE FROM "Notification" WHERE "orgId" = $1"#,
        r#"DELETE FROM "AlertRule" WHERE "orgId" = $1"#,
        r#"DELETE FROM "AiAnalysis" WHERE "configId" IN (SELECT id FROM "AiConfig" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "AiConfig" WHERE "orgId" = $1"#,
        r#"DELETE FROM "AuditLog" WHERE "orgId" = $1"#,
        r#"DELETE FROM "DiscordConfig" WHERE "orgId" = $1"#,
    ];

    let mut cleared = 0i32;
    for sql in tables {
        sqlx::query(sql).bind(&org.id).execute(state.pool()).await
            .map_err(|e| {
                tracing::error!("Factory reset failed at step {cleared}: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed after clearing {cleared} tables: {e}")})))
            })?;
        cleared += 1;
    }

    crate::discord::stop(&state).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "factory_reset", "organization", Some(&org.id),
        Some(json!({"tables_cleared": cleared}))).await;

    info!(user = %session.handle, org = %org.tag, tables = cleared, "Factory reset complete");

    Ok(Json(json!({"ok": true, "tables_cleared": cleared})))
}

// --- Helpers ---

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

// --- GET /api/admin/stats ---

async fn stats(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    // User counts
    #[derive(sqlx::FromRow)]
    struct StatusCount { status: String, count: i64 }
    let user_counts: Vec<StatusCount> = sqlx::query_as(
        r#"SELECT u.status, COUNT(*)::bigint as count
           FROM "OrgMember" m JOIN "User" u ON m."userId" = u.id
           WHERE m."orgId" = $1 GROUP BY u.status"#
    ).bind(&org.id).fetch_all(state.pool()).await.unwrap_or_default();

    let mut users: HashMap<String, i64> = HashMap::new();
    let mut total_users: i64 = 0;
    for uc in &user_counts {
        users.insert(uc.status.clone(), uc.count);
        total_users += uc.count;
    }

    // TOTP enabled count
    let totp_enabled: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM "User" u
           JOIN "OrgMember" m ON m."userId" = u.id
           WHERE m."orgId" = $1 AND u."totpEnabled" = true"#
    ).bind(&org.id).fetch_one(state.pool()).await.unwrap_or(0);

    // Mission counts
    #[derive(sqlx::FromRow)]
    struct MissionCount { status: String, count: i64 }
    let mission_counts: Vec<MissionCount> = sqlx::query_as(
        r#"SELECT status, COUNT(*)::bigint as count FROM "Mission" WHERE "orgId" = $1 GROUP BY status"#
    ).bind(&org.id).fetch_all(state.pool()).await.unwrap_or_default();
    let missions: HashMap<String, i64> = mission_counts.into_iter().map(|m| (m.status, m.count)).collect();

    // Other counts
    let active_intel: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM "IntelReport" WHERE "orgId" = $1 AND "isActive" = true"#
    ).bind(&org.id).fetch_one(state.pool()).await.unwrap_or(0);

    let open_rescues: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM "RescueRequest" WHERE "orgId" = $1 AND status IN ('open', 'in_progress')"#
    ).bind(&org.id).fetch_one(state.pool()).await.unwrap_or(0);

    let open_incidents: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM "Incident" WHERE "orgId" = $1 AND status = 'open'"#
    ).bind(&org.id).fetch_one(state.pool()).await.unwrap_or(0);

    let unread_notifications: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM "Notification" WHERE "orgId" = $1 AND status = 'unread'"#
    ).bind(&org.id).fetch_one(state.pool()).await.unwrap_or(0);

    // Recent activity
    #[derive(sqlx::FromRow)]
    struct ActivityRow { action: String, #[sqlx(rename = "targetType")] target_type: String, handle: String, #[sqlx(rename = "createdAt")] created_at: chrono::NaiveDateTime }
    let activity: Vec<ActivityRow> = sqlx::query_as(
        r#"SELECT a.action, a."targetType", u.handle, a."createdAt"
           FROM "AuditLog" a JOIN "User" u ON a."userId" = u.id
           WHERE a."orgId" = $1 ORDER BY a."createdAt" DESC LIMIT 10"#
    ).bind(&org.id).fetch_all(state.pool()).await.unwrap_or_default();

    Ok(Json(json!({
        "ok": true,
        "org": { "id": org.id, "name": org.name, "tag": org.tag },
        "users": {
            "active": users.get("active").unwrap_or(&0),
            "pending": users.get("pending").unwrap_or(&0),
            "disabled": users.get("disabled").unwrap_or(&0),
            "total": total_users,
            "totpEnabled": totp_enabled,
        },
        "missions": missions,
        "intel": { "active": active_intel },
        "rescues": { "open": open_rescues },
        "incidents": { "open": open_incidents },
        "notifications": { "unread": unread_notifications },
        "recentActivity": activity.iter().map(|a| json!({
            "action": a.action,
            "targetType": a.target_type,
            "actor": a.handle,
            "at": a.created_at.and_utc().to_rfc3339(),
        })).collect::<Vec<_>>(),
    })))
}

// --- GET /api/admin/audit-logs ---

#[derive(Deserialize)]
struct AuditListQuery {
    #[serde(rename = "targetType")]
    target_type: Option<String>,
    action: Option<String>,
    #[serde(rename = "userId")]
    user_id: Option<String>,
    limit: Option<i64>,
    cursor: Option<String>,
}

async fn audit_list(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Query(q): Query<AuditListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let limit = q.limit.unwrap_or(100).min(500);

    // Build dynamic query
    let mut sql = String::from(
        r#"SELECT a.id, a.action, a."targetType", a."targetId", a.metadata, a."createdAt",
                  u.handle, u."displayName"
           FROM "AuditLog" a JOIN "User" u ON a."userId" = u.id
           WHERE a."orgId" = $1"#
    );
    let mut param_idx = 2u32;
    let mut binds: Vec<String> = vec![];

    if let Some(ref tt) = q.target_type {
        sql.push_str(&format!(r#" AND a."targetType" = ${}"#, param_idx));
        binds.push(tt.clone());
        param_idx += 1;
    }
    if let Some(ref act) = q.action {
        sql.push_str(&format!(" AND a.action = ${}", param_idx));
        binds.push(act.clone());
        param_idx += 1;
    }
    if let Some(ref uid) = q.user_id {
        sql.push_str(&format!(r#" AND a."userId" = ${}"#, param_idx));
        binds.push(uid.clone());
        param_idx += 1;
    }
    if let Some(ref cursor) = q.cursor {
        sql.push_str(&format!(r#" AND a."createdAt" < ${}"#, param_idx));
        binds.push(cursor.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(r#" ORDER BY a."createdAt" DESC LIMIT {}"#, limit));

    // Use raw query with dynamic binds
    let mut query = sqlx::query_as::<_, AuditLogRow>(&sql).bind(&org.id);
    for b in &binds {
        query = query.bind(b);
    }

    let logs: Vec<AuditLogRow> = query.fetch_all(state.pool()).await.unwrap_or_default();

    let next_cursor = if logs.len() == limit as usize {
        logs.last().map(|l| l.created_at.and_utc().to_rfc3339())
    } else {
        None
    };

    Ok(Json(json!({
        "ok": true,
        "items": logs.iter().map(|l| json!({
            "id": l.id,
            "action": l.action,
            "targetType": l.target_type,
            "targetId": l.target_id,
            "metadata": l.metadata,
            "createdAt": l.created_at.and_utc().to_rfc3339(),
            "actor": l.display_name.as_deref().unwrap_or(&l.handle),
        })).collect::<Vec<_>>(),
        "nextCursor": next_cursor,
    })))
}

#[derive(sqlx::FromRow)]
struct AuditLogRow {
    id: String,
    action: String,
    #[sqlx(rename = "targetType")]
    target_type: String,
    #[sqlx(rename = "targetId")]
    target_id: Option<String>,
    metadata: Option<Value>,
    #[sqlx(rename = "createdAt")]
    created_at: chrono::NaiveDateTime,
    handle: String,
    #[sqlx(rename = "displayName")]
    display_name: Option<String>,
}

// --- GET /api/admin/audit-logs/export ---

#[derive(Deserialize)]
struct AuditExportQuery {
    from: Option<String>,
    to: Option<String>,
    format: Option<String>,
}

async fn audit_export(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Query(q): Query<AuditExportQuery>,
) -> Result<axum::response::Response, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    // Build query with optional date range
    let mut sql = String::from(
        r#"SELECT a.id, a.action, a."targetType", a."targetId", a.metadata, a."createdAt",
                  u.handle, u."displayName", u.email
           FROM "AuditLog" a JOIN "User" u ON a."userId" = u.id
           WHERE a."orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![];
    let mut idx = 2u32;

    if let Some(ref from) = q.from {
        sql.push_str(&format!(r#" AND a."createdAt" >= ${}"#, idx));
        binds.push(from.clone());
        idx += 1;
    }
    if let Some(ref to) = q.to {
        sql.push_str(&format!(r#" AND a."createdAt" <= ${}"#, idx));
        binds.push(to.clone());
        idx += 1;
    }

    sql.push_str(r#" ORDER BY a."createdAt" DESC LIMIT 10000"#);

    #[derive(sqlx::FromRow)]
    struct ExportRow {
        id: String,
        action: String,
        #[sqlx(rename = "targetType")] target_type: String,
        #[sqlx(rename = "targetId")] target_id: Option<String>,
        metadata: Option<Value>,
        #[sqlx(rename = "createdAt")] created_at: chrono::NaiveDateTime,
        handle: String,
        #[sqlx(rename = "displayName")] display_name: Option<String>,
        email: String,
    }

    let mut query = sqlx::query_as::<_, ExportRow>(&sql).bind(&org.id);
    for b in &binds {
        query = query.bind(b);
    }
    let logs: Vec<ExportRow> = query.fetch_all(state.pool()).await.unwrap_or_default();

    // Audit the export itself
    audit_log(state.pool(), &session.user_id, Some(&org.id), "export_audit_logs", "audit_log", None,
        Some(json!({"from": q.from, "to": q.to, "format": q.format, "count": logs.len()}))).await;

    let format = q.format.as_deref().unwrap_or("json");

    if format == "csv" {
        let mut csv = String::from("id,timestamp,actor_handle,actor_email,action,target_type,target_id,metadata\n");
        for l in &logs {
            let meta = l.metadata.as_ref().map(|m| m.to_string().replace('"', "\"\"" )).unwrap_or_default();
            csv.push_str(&format!("{},{},{},{},{},{},{},\"{}\"\n",
                l.id, l.created_at.and_utc().to_rfc3339(), l.handle, l.email,
                l.action, l.target_type, l.target_id.as_deref().unwrap_or(""), meta));
        }
        let today = chrono::Utc::now().format("%Y-%m-%d");
        return Ok(axum::response::Response::builder()
            .header("Content-Type", "text/csv; charset=utf-8")
            .header("Content-Disposition", format!("attachment; filename=\"guardian-audit-{}.csv\"", today))
            .body(axum::body::Body::from(csv))
            .unwrap());
    }

    // JSON format
    let items: Vec<Value> = logs.iter().map(|l| json!({
        "id": l.id,
        "timestamp": l.created_at.and_utc().to_rfc3339(),
        "actor": { "handle": l.handle, "displayName": l.display_name, "email": l.email },
        "action": l.action,
        "targetType": l.target_type,
        "targetId": l.target_id,
        "metadata": l.metadata,
    })).collect();

    Ok(Json(json!({
        "ok": true,
        "exported": items.len(),
        "from": q.from,
        "to": q.to,
        "items": items,
    })).into_response())
}

use axum::response::IntoResponse;

// --- POST /api/admin/users ---

#[derive(Deserialize)]
struct CreateUserRequest {
    email: String,
    handle: String,
    #[serde(rename = "displayName")]
    display_name: String,
    password: String,
    role: String,
    status: String,
    rank: String,
    title: Option<String>,
}

async fn create_user(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateUserRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    // Validate password
    password::validate_password(&body.password)
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": e}))))?;

    let email = body.email.to_lowercase();
    let handle = body.handle.replace(' ', "").to_uppercase();

    // Check uniqueness
    let existing: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "User" WHERE email = $1 OR handle = $2 LIMIT 1"#
    ).bind(&email).bind(&handle).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    if existing.is_some() {
        return Err((StatusCode::CONFLICT, Json(json!({"error": "Email or handle already exists."}))));
    }

    // Hash password
    let pass = body.password.clone();
    let password_hash = tokio::task::spawn_blocking(move || password::hash_password(&pass))
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to hash password."}))))?;
    let password_hash = password_hash
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to hash password."}))))?;

    let user_id = cuid2::create_id();
    let member_id = cuid2::create_id();

    // Create user + membership in transaction
    let mut tx = state.pool().begin().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    sqlx::query(
        r#"INSERT INTO "User" (id, email, handle, "displayName", "passwordHash", role, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())"#
    )
    .bind(&user_id).bind(&email).bind(&handle).bind(&body.display_name)
    .bind(&password_hash).bind(&body.role).bind(&body.status)
    .execute(&mut *tx).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create user."}))))?;

    sqlx::query(
        r#"INSERT INTO "OrgMember" (id, "userId", "orgId", rank, title, "joinedAt")
           VALUES ($1, $2, $3, $4, $5, NOW())"#
    )
    .bind(&member_id).bind(&user_id).bind(&org.id)
    .bind(&body.rank).bind(body.title.as_deref().unwrap_or(&body.display_name))
    .execute(&mut *tx).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create membership."}))))?;

    tx.commit().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction commit failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "user", Some(&user_id),
        Some(json!({"handle": handle, "email": email, "role": body.role}))).await;

    Ok(Json(json!({"ok": true, "user": {"id": user_id, "handle": handle, "email": email}})))
}

// --- PATCH /api/admin/users/:userId ---

#[derive(Deserialize)]
struct UpdateUserRequest {
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    role: String,
    status: String,
    rank: String,
    title: Option<String>,
    password: Option<String>,
}

async fn update_user(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(user_id): Path<String>,
    Json(body): Json<UpdateUserRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    // Verify membership
    let member_id: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "OrgMember" WHERE "orgId" = $1 AND "userId" = $2"#
    ).bind(&org.id).bind(&user_id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let member_id = member_id
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Member not found in this organization."}))))?;

    // Check role/status change for session invalidation
    #[derive(sqlx::FromRow)]
    struct CurrentUser { role: String, status: String }
    let current: CurrentUser = sqlx::query_as(
        r#"SELECT role, status FROM "User" WHERE id = $1"#
    ).bind(&user_id).fetch_one(state.pool()).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "User not found."}))))?;

    let role_or_status_changed = current.role != body.role || current.status != body.status;

    // Optional password hash
    let password_hash = if let Some(ref pw) = body.password {
        if !pw.trim().is_empty() {
            password::validate_password(pw)
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": e}))))?;
            let pw_clone = pw.clone();
            let h = tokio::task::spawn_blocking(move || password::hash_password(&pw_clone))
                .await
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Hash failed."}))))?;
            Some(h.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Hash failed."}))))?)
        } else { None }
    } else { None };

    let mut tx = state.pool().begin().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    // Update user
    if let Some(ref ph) = password_hash {
        if role_or_status_changed {
            sqlx::query(r#"UPDATE "User" SET "displayName" = $1, role = $2, status = $3, "passwordHash" = $4, "sessionsInvalidatedAt" = NOW(), "updatedAt" = NOW() WHERE id = $5"#)
                .bind(body.display_name.as_deref()).bind(&body.role).bind(&body.status).bind(ph).bind(&user_id)
                .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;
        } else {
            sqlx::query(r#"UPDATE "User" SET "displayName" = $1, role = $2, status = $3, "passwordHash" = $4, "updatedAt" = NOW() WHERE id = $5"#)
                .bind(body.display_name.as_deref()).bind(&body.role).bind(&body.status).bind(ph).bind(&user_id)
                .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;
        }
    } else if role_or_status_changed {
        sqlx::query(r#"UPDATE "User" SET "displayName" = $1, role = $2, status = $3, "sessionsInvalidatedAt" = NOW(), "updatedAt" = NOW() WHERE id = $4"#)
            .bind(body.display_name.as_deref()).bind(&body.role).bind(&body.status).bind(&user_id)
            .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;
    } else {
        sqlx::query(r#"UPDATE "User" SET "displayName" = $1, role = $2, status = $3, "updatedAt" = NOW() WHERE id = $4"#)
            .bind(body.display_name.as_deref()).bind(&body.role).bind(&body.status).bind(&user_id)
            .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;
    }

    // Update membership
    sqlx::query(r#"UPDATE "OrgMember" SET rank = $1, title = $2 WHERE id = $3"#)
        .bind(&body.rank).bind(body.title.as_deref()).bind(&member_id)
        .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    tx.commit().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Commit failed."}))))?;

    // Get updated handle for audit
    let handle: String = sqlx::query_scalar(r#"SELECT handle FROM "User" WHERE id = $1"#)
        .bind(&user_id).fetch_one(state.pool()).await.unwrap_or_default();

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "user", Some(&user_id),
        Some(json!({"handle": handle, "role": body.role, "status": body.status, "passwordChanged": password_hash.is_some(), "sessionsInvalidated": role_or_status_changed}))).await;

    Ok(Json(json!({"ok": true, "user": {"id": user_id, "handle": handle, "role": body.role, "status": body.status}})))
}

// --- POST /api/admin/users/:userId/revoke-sessions ---

async fn revoke_sessions(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(user_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let _: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "OrgMember" WHERE "orgId" = $1 AND "userId" = $2"#
    ).bind(&org.id).bind(&user_id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let handle: String = sqlx::query_scalar(r#"SELECT handle FROM "User" WHERE id = $1"#)
        .bind(&user_id).fetch_one(state.pool()).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "User not found."}))))?;

    sqlx::query(r#"UPDATE "User" SET "sessionsInvalidatedAt" = NOW() WHERE id = $1"#)
        .bind(&user_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to revoke sessions."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "revoke_sessions", "user", Some(&user_id),
        Some(json!({"handle": handle}))).await;

    info!(target_handle = %handle, by = %session.handle, "Sessions revoked");

    Ok(Json(json!({"ok": true, "message": format!("All sessions revoked for {}.", handle)})))
}

// --- POST /api/admin/users/:userId/reset-totp ---

async fn reset_totp(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(user_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let _: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "OrgMember" WHERE "orgId" = $1 AND "userId" = $2"#
    ).bind(&org.id).bind(&user_id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let handle: String = sqlx::query_scalar(r#"SELECT handle FROM "User" WHERE id = $1"#)
        .bind(&user_id).fetch_one(state.pool()).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "User not found."}))))?;

    sqlx::query(r#"UPDATE "User" SET "totpSecret" = NULL, "totpEnabled" = false, "sessionsInvalidatedAt" = NOW() WHERE id = $1"#)
        .bind(&user_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to reset TOTP."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "admin_reset_totp", "user", Some(&user_id),
        Some(json!({"handle": handle}))).await;

    info!(target_handle = %handle, by = %session.handle, "Admin TOTP reset");

    Ok(Json(json!({"ok": true, "message": format!("TOTP cleared and sessions revoked for {}. User can re-enroll.", handle)})))
}
