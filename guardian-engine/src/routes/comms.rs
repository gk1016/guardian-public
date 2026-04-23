use axum::{
    extract::{Multipart, Path, Query, State},
    response::IntoResponse,
    routing::{delete, get, patch, post},
    Json, Router,
};
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::middleware::AuthSession;
use crate::helpers::audit::audit_log;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        // Notifications
        .route("/api/notifications", get(list_notifications).post(create_notification_route))
        .route("/api/notifications/{notificationId}", patch(ack_notification))
        .route("/api/notifications/bulk-acknowledge", patch(bulk_ack))
        // Alert rules
        .route("/api/alert-rules", post(create_alert_rule))
        .route("/api/alert-rules/{ruleId}", patch(update_alert_rule).delete(delete_alert_rule))
        // Doctrine
        .route("/api/doctrine", post(create_doctrine))
        // Manual entries
        .route("/api/manual", get(list_manual).post(create_manual_article))
        .route("/api/manual/upload", post(create_manual_upload))
        .route("/api/manual/{entryId}", get(get_manual).patch(update_manual).delete(delete_manual))
        .route("/api/manual/{entryId}/download", get(download_manual))
}

fn require_ops(session: &crate::auth::session::Session) -> Result<(), (StatusCode, Json<Value>)> {
    if !session.can_manage_operations() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Operations authority required."}))));
    }
    Ok(())
}

fn require_admin_role(session: &crate::auth::session::Session) -> Result<(), (StatusCode, Json<Value>)> {
    if !session.can_manage_administration() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Admin authority required."}))));
    }
    Ok(())
}

async fn require_org(pool: &sqlx::PgPool, user_id: &str) -> Result<crate::helpers::org::OrgInfo, (StatusCode, Json<Value>)> {
    get_org_for_user(pool, user_id).await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))
}

// ============ NOTIFICATIONS ============

#[derive(Deserialize)]
struct NotificationListQuery {
    category: Option<String>,
    severity: Option<String>,
    status: Option<String>,
}

async fn list_notifications(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Query(q): Query<NotificationListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = require_org(state.pool(), &session.user_id).await?;

    let mut where_clause = r#""orgId" = $1"#.to_string();
    let mut binds: Vec<String> = vec![];
    let mut idx = 2u32;

    if let Some(ref c) = q.category { if c != "all" { where_clause.push_str(&format!(" AND category = ${}", idx)); binds.push(c.clone()); idx += 1; } }
    if let Some(ref s) = q.severity { if s != "all" { where_clause.push_str(&format!(" AND severity = ${}", idx)); binds.push(s.clone()); idx += 1; } }
    if let Some(ref st) = q.status { if st != "all" { where_clause.push_str(&format!(" AND status = ${}", idx)); binds.push(st.clone()); idx += 1; } }

    let sql = format!(
        r#"SELECT id, category, severity, title, body, href, status, "createdAt", "acknowledgedAt"
           FROM "Notification" WHERE {} ORDER BY status ASC, "createdAt" DESC LIMIT 100"#, where_clause
    );

    #[derive(sqlx::FromRow)]
    struct NRow {
        id: String, category: String, severity: String, title: String, body: String,
        href: Option<String>, status: String,
        #[sqlx(rename = "createdAt")] created_at: chrono::NaiveDateTime,
        #[sqlx(rename = "acknowledgedAt")] acknowledged_at: Option<chrono::NaiveDateTime>,
    }

    let mut query = sqlx::query_as::<_, NRow>(&sql).bind(&org.id);
    for b in &binds { query = query.bind(b); }
    let items: Vec<NRow> = query.fetch_all(state.pool()).await.unwrap_or_default();

    #[derive(sqlx::FromRow)]
    struct CountRow { status: String, count: i64 }
    let counts: Vec<CountRow> = sqlx::query_as(
        r#"SELECT status, COUNT(*)::bigint as count FROM "Notification" WHERE "orgId" = $1 GROUP BY status"#
    ).bind(&org.id).fetch_all(state.pool()).await.unwrap_or_default();

    let unread = counts.iter().find(|c| c.status == "unread").map(|c| c.count).unwrap_or(0);
    let total: i64 = counts.iter().map(|c| c.count).sum();

    Ok(Json(json!({
        "ok": true,
        "items": items.iter().map(|n| json!({
            "id": n.id, "category": n.category, "severity": n.severity,
            "title": n.title, "body": n.body, "href": n.href, "status": n.status,
            "createdAt": n.created_at.and_utc().to_rfc3339(),
            "acknowledgedAt": n.acknowledged_at.map(|a| a.and_utc().to_rfc3339()),
        })).collect::<Vec<_>>(),
        "stats": { "total": total, "unread": unread, "acknowledged": total - unread },
    })))
}

#[derive(Deserialize)]
struct CreateNotificationRequest {
    category: String,
    severity: String,
    title: String,
    body: String,
    href: Option<String>,
}

async fn create_notification_route(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateNotificationRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "Notification" (id, "orgId", "createdById", category, severity, title, body, href, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unread', NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(&session.user_id).bind(&body.category)
    .bind(&body.severity).bind(&body.title).bind(&body.body).bind(body.href.as_deref())
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create notification."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "notification", Some(&id),
        Some(json!({"category": body.category, "severity": body.severity}))).await;

    Ok(Json(json!({"ok": true, "notification": {"id": id}})))
}

#[derive(Deserialize)]
struct AckRequest { status: String }

async fn ack_notification(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(notification_id): Path<String>,
    Json(_body): Json<AckRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = require_org(state.pool(), &session.user_id).await?;

    let exists: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "Notification" WHERE id = $1 AND "orgId" = $2"#
    ).bind(&notification_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Notification not found."}))));
    }

    sqlx::query(r#"UPDATE "Notification" SET status = 'acknowledged', "acknowledgedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1"#)
        .bind(&notification_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Acknowledge failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "acknowledge", "notification", Some(&notification_id), None).await;

    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct BulkAckRequest { ids: Vec<String> }

async fn bulk_ack(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<BulkAckRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = require_org(state.pool(), &session.user_id).await?;

    if body.ids.is_empty() || body.ids.len() > 100 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Provide 1-100 ids."}))));
    }

    let placeholders: Vec<String> = (2..=body.ids.len() as u32 + 1).map(|i| format!("${}", i)).collect();
    let sql = format!(
        r#"UPDATE "Notification" SET status = 'acknowledged', "acknowledgedAt" = NOW(), "updatedAt" = NOW()
           WHERE "orgId" = $1 AND status = 'unread' AND id IN ({})"#,
        placeholders.join(", ")
    );

    let mut query = sqlx::query(&sql).bind(&org.id);
    for id in &body.ids { query = query.bind(id); }
    let result = query.execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Bulk acknowledge failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "bulk_acknowledge", "notification", None,
        Some(json!({"count": result.rows_affected(), "ids": body.ids}))).await;

    Ok(Json(json!({"ok": true, "acknowledged": result.rows_affected()})))
}

// ============ ALERT RULES ============

#[derive(Deserialize)]
struct CreateAlertRuleRequest {
    name: String,
    metric: String,
    operator: String,
    threshold: f64,
    severity: Option<String>,
    #[serde(rename = "cooldownMinutes")]
    cooldown_minutes: Option<i32>,
}

async fn create_alert_rule(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateAlertRuleRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin_role(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let id = cuid2::create_id();
    let severity = body.severity.as_deref().unwrap_or("warning");
    let cooldown = body.cooldown_minutes.unwrap_or(60);

    sqlx::query(
        r#"INSERT INTO "AlertRule" (id, "orgId", name, metric, operator, threshold, severity, "isEnabled", "cooldownMinutes", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(&body.name).bind(&body.metric).bind(&body.operator)
    .bind(body.threshold).bind(severity).bind(cooldown)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create alert rule."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "alert_rule", Some(&id),
        Some(json!({"name": body.name, "metric": body.metric}))).await;

    Ok(Json(json!({"ok": true, "rule": {"id": id, "name": body.name}})))
}

async fn update_alert_rule(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(rule_id): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin_role(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    if let Some(name) = body.get("name").and_then(|v| v.as_str()) {
        sqlx::query(r#"UPDATE "AlertRule" SET name = $1, "updatedAt" = NOW() WHERE id = $2 AND "orgId" = $3"#)
            .bind(name).bind(&rule_id).bind(&org.id).execute(state.pool()).await.ok();
    }
    if let Some(metric) = body.get("metric").and_then(|v| v.as_str()) {
        sqlx::query(r#"UPDATE "AlertRule" SET metric = $1, "updatedAt" = NOW() WHERE id = $2 AND "orgId" = $3"#)
            .bind(metric).bind(&rule_id).bind(&org.id).execute(state.pool()).await.ok();
    }
    if let Some(operator) = body.get("operator").and_then(|v| v.as_str()) {
        sqlx::query(r#"UPDATE "AlertRule" SET operator = $1, "updatedAt" = NOW() WHERE id = $2 AND "orgId" = $3"#)
            .bind(operator).bind(&rule_id).bind(&org.id).execute(state.pool()).await.ok();
    }
    if let Some(threshold) = body.get("threshold").and_then(|v| v.as_f64()) {
        sqlx::query(r#"UPDATE "AlertRule" SET threshold = $1, "updatedAt" = NOW() WHERE id = $2 AND "orgId" = $3"#)
            .bind(threshold).bind(&rule_id).bind(&org.id).execute(state.pool()).await.ok();
    }
    if let Some(severity) = body.get("severity").and_then(|v| v.as_str()) {
        sqlx::query(r#"UPDATE "AlertRule" SET severity = $1, "updatedAt" = NOW() WHERE id = $2 AND "orgId" = $3"#)
            .bind(severity).bind(&rule_id).bind(&org.id).execute(state.pool()).await.ok();
    }
    if let Some(enabled) = body.get("isEnabled").and_then(|v| v.as_bool()) {
        sqlx::query(r#"UPDATE "AlertRule" SET "isEnabled" = $1, "updatedAt" = NOW() WHERE id = $2 AND "orgId" = $3"#)
            .bind(enabled).bind(&rule_id).bind(&org.id).execute(state.pool()).await.ok();
    }
    if let Some(cooldown) = body.get("cooldownMinutes").and_then(|v| v.as_i64()) {
        sqlx::query(r#"UPDATE "AlertRule" SET "cooldownMinutes" = $1, "updatedAt" = NOW() WHERE id = $2 AND "orgId" = $3"#)
            .bind(cooldown as i32).bind(&rule_id).bind(&org.id).execute(state.pool()).await.ok();
    }

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "alert_rule", Some(&rule_id), Some(body)).await;

    Ok(Json(json!({"ok": true})))
}

async fn delete_alert_rule(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(rule_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_admin_role(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    sqlx::query(r#"DELETE FROM "AlertRule" WHERE id = $1 AND "orgId" = $2"#)
        .bind(&rule_id).bind(&org.id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Delete failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "delete", "alert_rule", Some(&rule_id), None).await;

    Ok(Json(json!({"ok": true})))
}

// ============ DOCTRINE ============

#[derive(Deserialize)]
struct CreateDoctrineRequest {
    code: String,
    title: String,
    category: String,
    summary: String,
    body: String,
    escalation: Option<String>,
    #[serde(rename = "isDefault")]
    is_default: Option<bool>,
}

async fn create_doctrine(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateDoctrineRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !session.can_manage_missions() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Command authority required."}))));
    }
    let org = require_org(state.pool(), &session.user_id).await?;

    let code = body.code.to_lowercase().replace(' ', "_");
    let exists: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "DoctrineTemplate" WHERE "orgId" = $1 AND code = $2"#
    ).bind(&org.id).bind(&code).fetch_optional(state.pool()).await.unwrap_or(None);
    if exists.is_some() {
        return Err((StatusCode::CONFLICT, Json(json!({"error": "Doctrine code already exists."}))));
    }

    let id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "DoctrineTemplate" (id, "orgId", code, title, category, summary, body, escalation, "isDefault", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(&code).bind(&body.title).bind(&body.category)
    .bind(&body.summary).bind(&body.body).bind(body.escalation.as_deref())
    .bind(body.is_default.unwrap_or(false))
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create doctrine."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "doctrine", Some(&id),
        Some(json!({"code": code, "title": body.title}))).await;

    Ok(Json(json!({"ok": true, "doctrine": {"id": id, "code": code, "title": body.title, "category": body.category}})))
}

// ============ MANUAL ENTRIES ============

#[derive(Deserialize)]
struct ManualListQuery {
    category: Option<String>,
    cursor: Option<String>,
    limit: Option<i64>,
}

async fn list_manual(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Query(q): Query<ManualListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = require_org(state.pool(), &session.user_id).await?;
    let limit = q.limit.unwrap_or(50).min(200);

    let mut where_clause = r#"m."orgId" = $1"#.to_string();
    let mut binds: Vec<String> = vec![];
    let mut idx = 2u32;

    if let Some(ref c) = q.category { if c != "all" { where_clause.push_str(&format!(" AND m.category = ${}", idx)); binds.push(c.clone()); idx += 1; } }
    if let Some(ref cursor) = q.cursor { where_clause.push_str(&format!(" AND m.id > ${}", idx)); binds.push(cursor.clone()); idx += 1; }

    let sql = format!(
        r#"SELECT m.id, m.title, m.category, m."entryType", m.body, m."fileName", m."fileSize", m."fileMimeType",
                  m."createdAt", m."updatedAt", u.handle, u."displayName"
           FROM "ManualEntry" m JOIN "User" u ON m."authorId" = u.id
           WHERE {} ORDER BY m.category ASC, m."updatedAt" DESC LIMIT {}"#, where_clause, limit + 1
    );

    #[derive(sqlx::FromRow)]
    struct MRow {
        id: String, title: String, category: String,
        #[sqlx(rename = "entryType")] entry_type: String,
        body: Option<String>,
        #[sqlx(rename = "fileName")] file_name: Option<String>,
        #[sqlx(rename = "fileSize")] file_size: Option<i32>,
        #[sqlx(rename = "fileMimeType")] file_mime_type: Option<String>,
        #[sqlx(rename = "createdAt")] created_at: chrono::NaiveDateTime,
        #[sqlx(rename = "updatedAt")] updated_at: chrono::NaiveDateTime,
        handle: String,
        #[sqlx(rename = "displayName")] display_name: Option<String>,
    }

    let mut query = sqlx::query_as::<_, MRow>(&sql).bind(&org.id);
    for b in &binds { query = query.bind(b); }
    let mut entries: Vec<MRow> = query.fetch_all(state.pool()).await.unwrap_or_default();

    let has_more = entries.len() > limit as usize;
    if has_more { entries.pop(); }
    let next_cursor = if has_more { entries.last().map(|e| e.id.clone()) } else { None };

    Ok(Json(json!({
        "ok": true,
        "items": entries.iter().map(|e| json!({
            "id": e.id, "title": e.title, "category": e.category, "entryType": e.entry_type,
            "body": e.body.as_deref().unwrap_or(""),
            "bodyPreview": e.body.as_deref().unwrap_or("").chars().take(200).collect::<String>(),
            "fileName": e.file_name, "fileSize": e.file_size, "fileMimeType": e.file_mime_type,
            "createdAt": e.created_at.and_utc().to_rfc3339(),
            "updatedAt": e.updated_at.and_utc().to_rfc3339(),
            "authorDisplay": e.display_name.as_deref().unwrap_or(&e.handle),
        })).collect::<Vec<_>>(),
        "nextCursor": next_cursor,
    })))
}

#[derive(Deserialize)]
struct CreateArticleRequest {
    title: String,
    category: String,
    body: String,
}

async fn create_manual_article(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(article): Json<CreateArticleRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "ManualEntry" (id, "orgId", "authorId", title, category, "entryType", body, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'article', $6, NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(&session.user_id).bind(&article.title).bind(&article.category).bind(&article.body)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create article."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "manual_entry", Some(&id),
        Some(json!({"title": article.title, "entryType": "article"}))).await;

    Ok(Json(json!({"ok": true, "entry": {"id": id}})))
}

async fn create_manual_upload(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    mut multipart: Multipart,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let mut title = String::new();
    let mut category = "general".to_string();
    let mut file_name = String::new();
    let mut file_mime = String::new();
    let mut file_data: Vec<u8> = vec![];

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "title" => title = field.text().await.unwrap_or_default(),
            "category" => category = field.text().await.unwrap_or_default(),
            "file" => {
                file_name = field.file_name().unwrap_or("upload").to_string();
                file_mime = field.content_type().unwrap_or("application/octet-stream").to_string();
                file_data = field.bytes().await.map_err(|_| (StatusCode::BAD_REQUEST, Json(json!({"error": "File read failed."}))))?.to_vec();
            }
            _ => {}
        }
    }

    if title.len() < 2 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Title required (min 2 chars)."}))));
    }
    if file_data.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "File required."}))));
    }
    if file_data.len() > 10 * 1024 * 1024 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "File exceeds 10MB limit."}))));
    }

    let id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "ManualEntry" (id, "orgId", "authorId", title, category, "entryType", body, "fileName", "fileSize", "fileMimeType", "fileData", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'file', '', $6, $7, $8, $9, NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(&session.user_id).bind(&title).bind(&category)
    .bind(&file_name).bind(file_data.len() as i32).bind(&file_mime).bind(&file_data)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save file."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "manual_entry", Some(&id),
        Some(json!({"title": title, "entryType": "file", "fileName": file_name}))).await;

    Ok(Json(json!({"ok": true, "entry": {"id": id}})))
}

async fn get_manual(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(entry_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = require_org(state.pool(), &session.user_id).await?;

    #[derive(sqlx::FromRow)]
    struct Row {
        id: String, title: String, category: String,
        #[sqlx(rename = "entryType")] entry_type: String,
        body: Option<String>,
        #[sqlx(rename = "fileName")] file_name: Option<String>,
        #[sqlx(rename = "fileSize")] file_size: Option<i32>,
        #[sqlx(rename = "fileMimeType")] file_mime_type: Option<String>,
        #[sqlx(rename = "createdAt")] created_at: chrono::NaiveDateTime,
        #[sqlx(rename = "updatedAt")] updated_at: chrono::NaiveDateTime,
        handle: String,
        #[sqlx(rename = "displayName")] display_name: Option<String>,
    }

    let entry = sqlx::query_as::<_, Row>(
        r#"SELECT m.id, m.title, m.category, m."entryType", m.body, m."fileName", m."fileSize", m."fileMimeType",
                  m."createdAt", m."updatedAt", u.handle, u."displayName"
           FROM "ManualEntry" m JOIN "User" u ON m."authorId" = u.id
           WHERE m.id = $1 AND m."orgId" = $2"#
    ).bind(&entry_id).bind(&org.id).fetch_optional(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let entry = entry.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Entry not found."}))))?;

    Ok(Json(json!({
        "ok": true,
        "entry": {
            "id": entry.id, "title": entry.title, "category": entry.category,
            "entryType": entry.entry_type, "body": entry.body,
            "fileName": entry.file_name, "fileSize": entry.file_size, "fileMimeType": entry.file_mime_type,
            "createdAt": entry.created_at.and_utc().to_rfc3339(),
            "updatedAt": entry.updated_at.and_utc().to_rfc3339(),
            "authorDisplay": entry.display_name.as_deref().unwrap_or(&entry.handle),
        }
    })))
}

#[derive(Deserialize)]
struct UpdateManualRequest {
    title: Option<String>,
    category: Option<String>,
    body: Option<String>,
}

async fn update_manual(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(entry_id): Path<String>,
    Json(body): Json<UpdateManualRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "ManualEntry" WHERE id = $1 AND "orgId" = $2"#)
        .bind(&entry_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Entry not found."}))));
    }

    sqlx::query(
        r#"UPDATE "ManualEntry" SET title = COALESCE($1, title), category = COALESCE($2, category), body = COALESCE($3, body), "updatedAt" = NOW() WHERE id = $4"#
    ).bind(body.title.as_deref()).bind(body.category.as_deref()).bind(body.body.as_deref()).bind(&entry_id)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "manual_entry", Some(&entry_id), None).await;

    Ok(Json(json!({"ok": true})))
}

async fn delete_manual(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(entry_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "ManualEntry" WHERE id = $1 AND "orgId" = $2"#)
        .bind(&entry_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Entry not found."}))));
    }

    sqlx::query(r#"DELETE FROM "ManualEntry" WHERE id = $1"#)
        .bind(&entry_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Delete failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "delete", "manual_entry", Some(&entry_id), None).await;

    Ok(Json(json!({"ok": true})))
}

async fn download_manual(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(entry_id): Path<String>,
) -> Result<axum::response::Response, (StatusCode, Json<Value>)> {
    let org = require_org(state.pool(), &session.user_id).await?;

    #[derive(sqlx::FromRow)]
    struct FileRow {
        #[sqlx(rename = "fileName")] file_name: Option<String>,
        #[sqlx(rename = "fileMimeType")] file_mime_type: Option<String>,
        #[sqlx(rename = "fileData")] file_data: Option<Vec<u8>>,
    }

    let entry = sqlx::query_as::<_, FileRow>(
        r#"SELECT "fileName", "fileMimeType", "fileData" FROM "ManualEntry" WHERE id = $1 AND "orgId" = $2 AND "entryType" = 'file'"#
    ).bind(&entry_id).bind(&org.id).fetch_optional(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let entry = entry.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "File not found."}))))?;
    let data = entry.file_data.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "File not found."}))))?;

    let safe_name = entry.file_name.unwrap_or_else(|| "download".to_string())
        .chars().filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-').collect::<String>();
    let mime = entry.file_mime_type.unwrap_or_else(|| "application/octet-stream".to_string());

    Ok(axum::response::Response::builder()
        .header("Content-Type", &mime)
        .header("Content-Disposition", format!("attachment; filename=\"{}\"", safe_name))
        .header("Content-Length", data.len().to_string())
        .body(axum::body::Body::from(data))
        .unwrap())
}
