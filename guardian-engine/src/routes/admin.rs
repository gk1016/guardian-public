use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, patch, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};

use crate::auth::{require_admin, require_org, AuthSession};
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/admin/stats", get(stats))
        .route("/api/admin/audit-logs", get(audit_list))
        .route("/api/admin/audit-logs/export", get(audit_export))
        .route("/api/admin/users", post(create_user))
        .route("/api/admin/users/{userId}", patch(update_user))
        .route("/api/admin/users/{userId}/revoke-sessions", post(revoke_sessions))
        .route("/api/admin/users/{userId}/reset-totp", post(reset_totp))
        .route("/api/admin/factory-reset", post(factory_reset))
}

// ---------------------------------------------------------------------------
// Factory Reset
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct FactoryResetRequest {
    confirm: String,
}

#[derive(Serialize)]
struct FactoryResetResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tables_cleared: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

async fn factory_reset(
    session: AuthSession,
    State(state): State<AppState>,
    Json(body): Json<FactoryResetRequest>,
) -> Result<Json<FactoryResetResponse>, StatusCode> {
    require_admin(&session)?;

    if body.confirm != "RESET" {
        return Ok(Json(FactoryResetResponse {
            ok: false,
            tables_cleared: None,
            error: Some("Confirmation text must be 'RESET'.".into()),
        }));
    }

    let pool = state.pool();
    let org = require_org(pool, &session.user_id).await?;

    info!("Factory reset initiated by {} for org {}", session.user_id, org.org_id);

    // Delete order matters for FK constraints. Wipe operational data only.
    // Preserve: Organization, User, OrgMember, ManualEntry, DoctrineTemplate
    let tables = [
        // Mission sub-resources first
        r#"DELETE FROM "MissionLog" WHERE "missionId" IN (SELECT "id" FROM "Mission" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "MissionIntelLink" WHERE "missionId" IN (SELECT "id" FROM "Mission" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "MissionParticipant" WHERE "missionId" IN (SELECT "id" FROM "Mission" WHERE "orgId" = $1)"#,
        // Top-level operational tables
        r#"DELETE FROM "Mission" WHERE "orgId" = $1"#,
        r#"DELETE FROM "IntelReport" WHERE "orgId" = $1"#,
        r#"DELETE FROM "FederatedIntel" WHERE "orgId" = $1"#,
        r#"DELETE FROM "RescueRequest" WHERE "orgId" = $1"#,
        r#"DELETE FROM "QrfDispatch" WHERE "qrfId" IN (SELECT "id" FROM "QrfReadiness" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "QrfReadiness" WHERE "orgId" = $1"#,
        r#"DELETE FROM "Incident" WHERE "orgId" = $1"#,
        r#"DELETE FROM "Notification" WHERE "orgId" = $1"#,
        r#"DELETE FROM "AlertRule" WHERE "orgId" = $1"#,
        r#"DELETE FROM "AiAnalysis" WHERE "configId" IN (SELECT "id" FROM "AiConfig" WHERE "orgId" = $1)"#,
        r#"DELETE FROM "AiConfig" WHERE "orgId" = $1"#,
        r#"DELETE FROM "AuditLog" WHERE "orgId" = $1"#,
        r#"DELETE FROM "DiscordConfig" WHERE "orgId" = $1"#,
    ];

    let mut cleared = 0i32;
    for sql in &tables {
        match sqlx::query(sql).bind(&org.org_id).execute(pool).await {
            Ok(_) => cleared += 1,
            Err(e) => {
                error!("Factory reset failed at table {cleared}: {e}");
                return Ok(Json(FactoryResetResponse {
                    ok: false,
                    tables_cleared: Some(cleared),
                    error: Some(format!("Failed after clearing {cleared} tables: {e}")),
                }));
            }
        }
    }

    // Stop Discord bot since its config is gone
    if let Err(e) = crate::discord::stop(&state).await {
        warn!("Failed to stop Discord bot after factory reset: {e}");
    }

    info!("Factory reset complete: {cleared} table groups cleared for org {}", org.org_id);

    Ok(Json(FactoryResetResponse {
        ok: true,
        tables_cleared: Some(cleared),
        error: None,
    }))
}

// ---------------------------------------------------------------------------
// Existing admin handlers below — unchanged
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct StatsResponse {
    members: i64,
    active_missions: i64,
    open_intel: i64,
    open_rescues: i64,
    qrf_ready: i64,
    open_incidents: i64,
    recent_logins_24h: i64,
    pending_users: i64,
}

async fn stats(
    session: AuthSession,
    State(state): State<AppState>,
) -> Result<Json<StatsResponse>, StatusCode> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let pool = state.pool();

    let members: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "OrgMember" WHERE "orgId" = $1"#)
        .bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));
    let active_missions: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "Mission" WHERE "orgId" = $1 AND "status" IN ('planning','active','executing')"#)
        .bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));
    let open_intel: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "IntelReport" WHERE "orgId" = $1 AND "isActive" = true"#)
        .bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));
    let open_rescues: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "RescueRequest" WHERE "orgId" = $1 AND "status" IN ('open','in_progress')"#)
        .bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));
    let qrf_ready: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "QrfReadiness" WHERE "orgId" = $1 AND "status" IN ('redcon1','redcon2')"#)
        .bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));
    let open_incidents: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "Incident" WHERE "orgId" = $1 AND "status" = 'open'"#)
        .bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));
    let recent_logins: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "AuditLog" WHERE "orgId" = $1 AND "action" = 'login' AND "createdAt" > NOW() - INTERVAL '24 hours'"#)
        .bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));
    let pending: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM "User" u JOIN "OrgMember" om ON om."userId" = u."id" WHERE om."orgId" = $1 AND u."status" = 'pending'"#,
    ).bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));

    Ok(Json(StatsResponse {
        members: members.0,
        active_missions: active_missions.0,
        open_intel: open_intel.0,
        open_rescues: open_rescues.0,
        qrf_ready: qrf_ready.0,
        open_incidents: open_incidents.0,
        recent_logins_24h: recent_logins.0,
        pending_users: pending.0,
    }))
}

// --- Audit logs list ---
#[derive(Serialize)]
struct AuditEntry {
    id: String,
    user_id: Option<String>,
    action: String,
    target_type: Option<String>,
    target_id: Option<String>,
    metadata: Option<serde_json::Value>,
    created_at: chrono::NaiveDateTime,
}

#[derive(Deserialize)]
struct AuditQuery {
    page: Option<i64>,
    per_page: Option<i64>,
}

async fn audit_list(
    session: AuthSession,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<AuditQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let pool = state.pool();
    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(50).min(200);
    let offset = (page - 1) * per_page;

    let total: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "AuditLog" WHERE "orgId" = $1"#)
        .bind(&org.org_id).fetch_one(pool).await.unwrap_or((0,));

    let rows: Vec<(String, Option<String>, String, Option<String>, Option<String>, Option<serde_json::Value>, chrono::NaiveDateTime)> = sqlx::query_as(
        r#"SELECT "id", "userId", "action", "targetType", "targetId", "metadata", "createdAt"
           FROM "AuditLog" WHERE "orgId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3"#,
    ).bind(&org.org_id).bind(per_page).bind(offset).fetch_all(pool).await.unwrap_or_default();

    let entries: Vec<AuditEntry> = rows.into_iter().map(|(id, uid, action, tt, tid, meta, ts)| AuditEntry {
        id, user_id: uid, action, target_type: tt, target_id: tid, metadata: meta, created_at: ts,
    }).collect();

    Ok(Json(serde_json::json!({
        "items": entries,
        "total": total.0,
        "page": page,
        "per_page": per_page,
    })))
}

// --- Audit export (CSV) ---
async fn audit_export(
    session: AuthSession,
    State(state): State<AppState>,
) -> Result<axum::response::Response, StatusCode> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let pool = state.pool();

    let rows: Vec<(String, Option<String>, String, Option<String>, Option<String>, Option<serde_json::Value>, chrono::NaiveDateTime)> = sqlx::query_as(
        r#"SELECT "id", "userId", "action", "targetType", "targetId", "metadata", "createdAt"
           FROM "AuditLog" WHERE "orgId" = $1 ORDER BY "createdAt" DESC LIMIT 10000"#,
    ).bind(&org.org_id).fetch_all(pool).await.unwrap_or_default();

    let mut csv = String::from("id,userId,action,targetType,targetId,metadata,createdAt\n");
    for (id, uid, action, tt, tid, meta, ts) in &rows {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            id,
            uid.as_deref().unwrap_or(""),
            action,
            tt.as_deref().unwrap_or(""),
            tid.as_deref().unwrap_or(""),
            meta.as_ref().map(|m| m.to_string()).unwrap_or_default().replace(',', ";"  ),
            ts,
        ));
    }

    Ok(axum::response::Response::builder()
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", "attachment; filename=audit-logs.csv")
        .body(axum::body::Body::from(csv))
        .unwrap())
}

// --- Create user ---
#[derive(Deserialize)]
struct CreateUserRequest {
    email: String,
    handle: String,
    display_name: Option<String>,
    password: String,
    role: Option<String>,
}

async fn create_user(
    session: AuthSession,
    State(state): State<AppState>,
    Json(body): Json<CreateUserRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let pool = state.pool();

    // Validate password
    if body.password.len() < 10 || body.password.len() > 128 {
        return Ok(Json(serde_json::json!({ "error": "Password must be 10-128 characters." })));
    }

    let hash = bcrypt::hash(body.password.as_bytes(), 12).map_err(|e| {
        error!("bcrypt error: {e}"); StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let role = body.role.as_deref().unwrap_or("pilot");
    let user_id: (String,) = sqlx::query_as(
        r#"INSERT INTO "User" ("id", "email", "handle", "displayName", "passwordHash", "role", "status", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'active', NOW()) RETURNING "id""#,
    )
    .bind(body.email.to_lowercase())
    .bind(body.handle.to_uppercase())
    .bind(&body.display_name)
    .bind(&hash)
    .bind(role)
    .fetch_one(pool).await.map_err(|e| {
        error!("Failed to create user: {e}"); StatusCode::INTERNAL_SERVER_ERROR
    })?;

    sqlx::query(
        r#"INSERT INTO "OrgMember" ("id", "userId", "orgId", "rank") VALUES (gen_random_uuid()::text, $1, $2, 'member')"#,
    ).bind(&user_id.0).bind(&org.org_id).execute(pool).await.map_err(|e| {
        error!("Failed to create membership: {e}"); StatusCode::INTERNAL_SERVER_ERROR
    })?;

    crate::audit::log(pool, Some(&session.user_id), Some(&org.org_id), "create_user", Some("user"), Some(&user_id.0), None).await;

    Ok(Json(serde_json::json!({ "ok": true, "userId": user_id.0 })))
}

// --- Update user ---
#[derive(Deserialize)]
struct UpdateUserRequest {
    display_name: Option<String>,
    role: Option<String>,
    status: Option<String>,
    rank: Option<String>,
    title: Option<String>,
    password: Option<String>,
}

async fn update_user(
    session: AuthSession,
    State(state): State<AppState>,
    axum::extract::Path(user_id): axum::extract::Path<String>,
    Json(body): Json<UpdateUserRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let pool = state.pool();

    // Verify target user is in same org
    let membership: Option<(String,)> = sqlx::query_as(
        r#"SELECT "id" FROM "OrgMember" WHERE "userId" = $1 AND "orgId" = $2"#,
    ).bind(&user_id).bind(&org.org_id).fetch_optional(pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if membership.is_none() {
        return Ok(Json(serde_json::json!({ "error": "User not found in this organization." })));
    }

    // Update user fields
    if body.display_name.is_some() || body.role.is_some() || body.status.is_some() || body.password.is_some() {
        let mut sets = vec![r#""updatedAt" = NOW()"#.to_string()];
        let mut idx = 1u32;
        let mut params: Vec<String> = vec![user_id.clone()];

        if let Some(ref dn) = body.display_name {
            idx += 1; sets.push(format!(r#""displayName" = ${idx}"#)); params.push(dn.clone());
        }
        if let Some(ref r) = body.role {
            idx += 1; sets.push(format!(r#""role" = ${idx}"#)); params.push(r.clone());
        }
        if let Some(ref s) = body.status {
            idx += 1; sets.push(format!(r#""status" = ${idx}"#)); params.push(s.clone());
        }
        if let Some(ref pw) = body.password {
            if pw.len() >= 10 {
                let hash = bcrypt::hash(pw.as_bytes(), 12).map_err(|e| {
                    error!("bcrypt: {e}"); StatusCode::INTERNAL_SERVER_ERROR
                })?;
                idx += 1; sets.push(format!(r#""passwordHash" = ${idx}"#)); params.push(hash);
            }
        }

        let sql = format!(r#"UPDATE "User" SET {} WHERE "id" = $1"#, sets.join(", "));
        let mut query = sqlx::query(&sql);
        for p in &params {
            query = query.bind(p);
        }
        query.execute(pool).await.map_err(|e| {
            error!("Failed to update user: {e}"); StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    // Update membership fields
    if body.rank.is_some() || body.title.is_some() {
        if let Some(ref rank) = body.rank {
            sqlx::query(r#"UPDATE "OrgMember" SET "rank" = $1 WHERE "userId" = $2 AND "orgId" = $3"#)
                .bind(rank).bind(&user_id).bind(&org.org_id).execute(pool).await.ok();
        }
        if let Some(ref title) = body.title {
            sqlx::query(r#"UPDATE "OrgMember" SET "title" = $1 WHERE "userId" = $2 AND "orgId" = $3"#)
                .bind(title).bind(&user_id).bind(&org.org_id).execute(pool).await.ok();
        }
    }

    crate::audit::log(pool, Some(&session.user_id), Some(&org.org_id), "update_user", Some("user"), Some(&user_id), None).await;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// --- Revoke sessions ---
async fn revoke_sessions(
    session: AuthSession,
    State(state): State<AppState>,
    axum::extract::Path(user_id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let pool = state.pool();

    sqlx::query(r#"UPDATE "User" SET "sessionsInvalidatedAt" = NOW() WHERE "id" = $1"#)
        .bind(&user_id).execute(pool).await.map_err(|e| {
            error!("Failed to revoke sessions: {e}"); StatusCode::INTERNAL_SERVER_ERROR
        })?;

    crate::audit::log(pool, Some(&session.user_id), Some(&org.org_id), "revoke_sessions", Some("user"), Some(&user_id), None).await;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// --- Reset TOTP ---
async fn reset_totp(
    session: AuthSession,
    State(state): State<AppState>,
    axum::extract::Path(user_id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    require_admin(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;
    let pool = state.pool();

    sqlx::query(r#"UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "updatedAt" = NOW() WHERE "id" = $1"#)
        .bind(&user_id).execute(pool).await.map_err(|e| {
            error!("Failed to reset TOTP: {e}"); StatusCode::INTERNAL_SERVER_ERROR
        })?;

    crate::audit::log(pool, Some(&session.user_id), Some(&org.org_id), "reset_totp", Some("user"), Some(&user_id), None).await;

    Ok(Json(serde_json::json!({ "ok": true })))
}
