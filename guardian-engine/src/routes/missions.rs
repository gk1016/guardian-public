use axum::{
    extract::{Path, State},
    routing::{delete, patch, post},
    Json, Router,
};
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::middleware::AuthSession;
use crate::helpers::audit::audit_log;
use crate::helpers::notifications::create_notification;
use crate::helpers::org::get_org_for_user;
use crate::helpers::mission_templates;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/missions", post(create_mission))
        .route("/api/missions/{missionId}", patch(update_mission))
        .route("/api/missions/{missionId}/transition", post(transition))
        .route("/api/missions/{missionId}/closeout", post(closeout))
        .route("/api/missions/{missionId}/reopen", post(reopen))
        .route("/api/missions/{missionId}/logs", post(create_log))
        .route("/api/missions/{missionId}/participants", post(create_participant))
        .route("/api/missions/{missionId}/participants/{participantId}", patch(update_participant).delete(delete_participant))
        .route("/api/missions/{missionId}/intel", post(link_intel))
        .route("/api/missions/{missionId}/intel/{intelId}", delete(unlink_intel))
        .route("/api/missions/{missionId}/doctrine", post(assign_doctrine))
}

fn require_missions(session: &crate::auth::session::Session) -> Result<(), (StatusCode, Json<Value>)> {
    if !session.can_manage_missions() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Command authority required."}))));
    }
    Ok(())
}

async fn require_org_helper(pool: &sqlx::PgPool, user_id: &str) -> Result<crate::helpers::org::OrgInfo, (StatusCode, Json<Value>)> {
    get_org_for_user(pool, user_id).await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))
}

async fn find_mission(pool: &sqlx::PgPool, mission_id: &str, org_id: &str) -> Result<MissionRow, (StatusCode, Json<Value>)> {
    sqlx::query_as::<_, MissionRow>(
        r#"SELECT id, callsign, title, status, "revisionNumber", "closeoutSummary", "aarSummary"
           FROM "Mission" WHERE id = $1 AND "orgId" = $2"#
    ).bind(mission_id).bind(org_id).fetch_optional(pool).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?.
        ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Mission not found."}))))
}

#[derive(sqlx::FromRow)]
struct MissionRow {
    id: String,
    callsign: String,
    title: String,
    status: String,
    #[sqlx(rename = "revisionNumber")]
    revision_number: i32,
    #[sqlx(rename = "closeoutSummary")]
    closeout_summary: Option<String>,
    #[sqlx(rename = "aarSummary")]
    aar_summary: Option<String>,
}

// --- POST /api/missions ---

#[derive(Deserialize)]
struct CreateMissionRequest {
    callsign: String,
    #[serde(rename = "templateCode")]
    template_code: Option<String>,
    title: String,
    #[serde(rename = "missionType")]
    mission_type: String,
    status: String,
    priority: String,
    #[serde(rename = "areaOfOperation")]
    area_of_operation: Option<String>,
    #[serde(rename = "missionBrief")]
    mission_brief: Option<String>,
}

async fn create_mission(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateMissionRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;

    let template = mission_templates::get_template(body.template_code.as_deref().unwrap_or(&body.mission_type));

    // Find matching doctrine template
    let doctrine_id: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "DoctrineTemplate" WHERE "orgId" = $1 AND code = $2 LIMIT 1"#
    ).bind(&org.id).bind(template.doctrine_code).fetch_optional(state.pool()).await.unwrap_or(None);

    let doctrine_code: Option<String> = if doctrine_id.is_some() { Some(template.doctrine_code.to_string()) } else { None };

    let mission_id = cuid2::create_id();
    let callsign = body.callsign.to_uppercase();

    let mut tx = state.pool().begin().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    sqlx::query(
        r#"INSERT INTO "Mission" (id, "orgId", "leadId", "doctrineTemplateId", callsign, title, "missionType", status, priority, "areaOfOperation", "missionBrief", "roeCode", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())"#
    )
    .bind(&mission_id).bind(&org.id).bind(&session.user_id).bind(&doctrine_id)
    .bind(&callsign).bind(&body.title).bind(&body.mission_type).bind(&body.status)
    .bind(&body.priority).bind(body.area_of_operation.as_deref()).bind(body.mission_brief.as_deref())
    .bind(doctrine_code.as_deref())
    .execute(&mut *tx).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create mission."}))))?;

    // Seed template slots
    for slot in template.slots {
        let slot_id = cuid2::create_id();
        sqlx::query(
            r#"INSERT INTO "MissionParticipant" (id, "missionId", handle, role, platform, status, notes, "createdAt")
               VALUES ($1, $2, 'OPEN SLOT', $3, $4, 'open', $5, NOW())"#
        ).bind(&slot_id).bind(&mission_id).bind(slot.role).bind(slot.platform).bind(slot.notes)
        .execute(&mut *tx).await.ok();
    }

    // Seed log
    let log_id = cuid2::create_id();
    let log_msg = format!("Template seeded: {} / {} open slot{}.", template.label, template.slots.len(), if template.slots.len() == 1 { "" } else { "s" });
    sqlx::query(
        r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt")
           VALUES ($1, $2, $3, 'package', $4, NOW())"#
    ).bind(&log_id).bind(&mission_id).bind(&session.user_id).bind(&log_msg)
    .execute(&mut *tx).await.ok();

    tx.commit().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Commit failed."}))))?;

    let severity = if body.priority == "critical" { "critical" } else { "info" };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "mission", severity,
        &format!("Mission created / {}", callsign),
        &format!("{} opened with status {}.", body.title, body.status),
        Some(&format!("/missions/{}", mission_id))).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "mission", Some(&mission_id),
        Some(json!({"callsign": callsign, "status": body.status}))).await;

    Ok(Json(json!({"ok": true, "mission": {"id": mission_id, "callsign": callsign, "status": body.status, "title": body.title}})))
}

// --- PATCH /api/missions/:missionId ---

#[derive(Deserialize)]
struct UpdateMissionRequest {
    callsign: String,
    title: String,
    #[serde(rename = "missionType")]
    mission_type: String,
    status: String,
    priority: String,
    #[serde(rename = "areaOfOperation")]
    area_of_operation: Option<String>,
    #[serde(rename = "missionBrief")]
    mission_brief: Option<String>,
}

async fn update_mission(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
    Json(body): Json<UpdateMissionRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let _ = find_mission(state.pool(), &mission_id, &org.id).await?;

    let callsign = body.callsign.to_uppercase();
    sqlx::query(
        r#"UPDATE "Mission" SET callsign = $1, title = $2, "missionType" = $3, status = $4, priority = $5,
           "areaOfOperation" = $6, "missionBrief" = $7, "updatedAt" = NOW() WHERE id = $8"#
    ).bind(&callsign).bind(&body.title).bind(&body.mission_type).bind(&body.status)
    .bind(&body.priority).bind(body.area_of_operation.as_deref()).bind(body.mission_brief.as_deref())
    .bind(&mission_id).execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "mission", Some(&mission_id),
        Some(json!({"callsign": callsign}))).await;

    Ok(Json(json!({"ok": true, "mission": {"id": mission_id, "callsign": callsign, "status": body.status, "title": body.title}})))
}

// --- POST /api/missions/:missionId/transition ---

#[derive(Deserialize)]
struct TransitionRequest {
    #[serde(rename = "targetStatus")]
    target_status: String,
}

async fn transition(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
    Json(body): Json<TransitionRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let mission = find_mission(state.pool(), &mission_id, &org.id).await?;

    let allowed: &[&str] = match mission.status.as_str() {
        "planning" => &["ready", "aborted"],
        "ready" => &["active", "planning", "aborted"],
        "active" => &["planning", "aborted"],
        _ => &[],
    };

    if !allowed.contains(&body.target_status.as_str()) {
        return Err((StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": format!("Cannot transition from {} to {}.", mission.status, body.target_status)}))));
    }

    // Package readiness checks
    if body.target_status == "ready" {
        let assigned: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)::bigint FROM "MissionParticipant" WHERE "missionId" = $1 AND status != 'open' AND handle != 'OPEN SLOT'"#
        ).bind(&mission_id).fetch_one(state.pool()).await.unwrap_or(0);
        if assigned < 1 {
            return Err((StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": "Ready check failed: at least 1 assigned participant required."}))));
        }
    }
    if body.target_status == "active" {
        let ready: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)::bigint FROM "MissionParticipant" WHERE "missionId" = $1 AND status IN ('ready', 'launched')"#
        ).bind(&mission_id).fetch_one(state.pool()).await.unwrap_or(0);
        if ready < 1 {
            return Err((StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": "Activation failed: at least 1 ready or launched participant required."}))));
        }
    }

    let next_rev = mission.revision_number + 1;
    let transition_label = format!("{} \u{2192} {}", mission.status, body.target_status);

    let mut tx = state.pool().begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    // Build update based on target status
    match body.target_status.as_str() {
        "active" => {
            sqlx::query(r#"UPDATE "Mission" SET status = $1, "revisionNumber" = $2, "startsAt" = NOW(), "updatedAt" = NOW() WHERE id = $3"#)
                .bind(&body.target_status).bind(next_rev).bind(&mission_id).execute(&mut *tx).await.ok();
        }
        "planning" => {
            sqlx::query(r#"UPDATE "Mission" SET status = $1, "revisionNumber" = $2, "startsAt" = NULL, "updatedAt" = NOW() WHERE id = $3"#)
                .bind(&body.target_status).bind(next_rev).bind(&mission_id).execute(&mut *tx).await.ok();
        }
        "aborted" => {
            sqlx::query(r#"UPDATE "Mission" SET status = $1, "revisionNumber" = $2, "completedAt" = NOW(), "updatedAt" = NOW() WHERE id = $3"#)
                .bind(&body.target_status).bind(next_rev).bind(&mission_id).execute(&mut *tx).await.ok();
        }
        _ => {
            sqlx::query(r#"UPDATE "Mission" SET status = $1, "revisionNumber" = $2, "updatedAt" = NOW() WHERE id = $3"#)
                .bind(&body.target_status).bind(next_rev).bind(&mission_id).execute(&mut *tx).await.ok();
        }
    }

    let log_id = cuid2::create_id();
    sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'status', $4, NOW())"#)
        .bind(&log_id).bind(&mission_id).bind(&session.user_id)
        .bind(format!("Status transition: {}. Rev {}.", transition_label, next_rev))
        .execute(&mut *tx).await.ok();

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Commit failed."}))))?;

    let severity = match body.target_status.as_str() {
        "aborted" => "warning",
        "active" => "critical",
        _ => "info",
    };
    let verb = match body.target_status.as_str() {
        "ready" => "passed ready check",
        "active" => "activated",
        "planning" => "stood down to planning",
        "aborted" => "aborted",
        _ => "transitioned",
    };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "mission", severity,
        &format!("{} {}", mission.callsign, verb),
        &format!("{} / {}", mission.title, transition_label),
        Some(&format!("/missions/{}", mission_id))).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "transition", "mission", Some(&mission_id),
        Some(json!({"callsign": mission.callsign, "from": mission.status, "to": body.target_status}))).await;

    Ok(Json(json!({"ok": true, "mission": {"id": mission_id, "callsign": mission.callsign, "status": body.target_status, "revisionNumber": next_rev}})))
}

// --- POST /api/missions/:missionId/closeout ---

#[derive(Deserialize)]
struct CloseoutRequest {
    #[serde(rename = "finalStatus")]
    final_status: String,
    #[serde(rename = "closeoutSummary")]
    closeout_summary: String,
    #[serde(rename = "aarSummary")]
    aar_summary: String,
}

async fn closeout(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
    Json(body): Json<CloseoutRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let mission = find_mission(state.pool(), &mission_id, &org.id).await?;

    let mut tx = state.pool().begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    sqlx::query(r#"UPDATE "Mission" SET status = $1, "completedAt" = NOW(), "closeoutSummary" = $2, "aarSummary" = $3, "updatedAt" = NOW() WHERE id = $4"#)
        .bind(&body.final_status).bind(&body.closeout_summary).bind(&body.aar_summary).bind(&mission_id)
        .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    let log_id = cuid2::create_id();
    sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'aar', $4, NOW())"#)
        .bind(&log_id).bind(&mission_id).bind(&session.user_id)
        .bind(format!("{}: {}", body.final_status.to_uppercase(), body.closeout_summary))
        .execute(&mut *tx).await.ok();

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Commit failed."}))))?;

    let severity = if body.final_status == "aborted" { "warning" } else { "info" };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "mission", severity,
        &format!("Mission {} / {}", body.final_status, mission.callsign),
        &format!("{} filed closeout and AAR packaging.", mission.title),
        Some(&format!("/missions/{}", mission_id))).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "closeout", "mission", Some(&mission_id),
        Some(json!({"callsign": mission.callsign, "finalStatus": body.final_status}))).await;

    Ok(Json(json!({"ok": true, "mission": {"id": mission_id, "callsign": mission.callsign, "status": body.final_status}})))
}

// --- POST /api/missions/:missionId/reopen ---

#[derive(Deserialize)]
struct ReopenRequest {
    status: String,
    reason: String,
}

async fn reopen(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
    Json(body): Json<ReopenRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let mission = find_mission(state.pool(), &mission_id, &org.id).await?;

    if mission.status != "complete" && mission.status != "aborted" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Only closed missions can be reopened."}))));
    }

    let next_rev = mission.revision_number + 1;
    let mut log_lines = vec![format!("REV {} REOPENED FROM {}: {}", next_rev, mission.status.to_uppercase(), body.reason)];
    if let Some(ref cs) = mission.closeout_summary { log_lines.push(format!("Archived closeout: {}", cs)); }
    if let Some(ref aar) = mission.aar_summary { log_lines.push(format!("Archived AAR: {}", aar)); }

    let mut tx = state.pool().begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    sqlx::query(r#"UPDATE "Mission" SET status = $1, "revisionNumber" = $2, "completedAt" = NULL, "closeoutSummary" = NULL, "aarSummary" = NULL, "updatedAt" = NOW() WHERE id = $3"#)
        .bind(&body.status).bind(next_rev).bind(&mission_id)
        .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    let log_id = cuid2::create_id();
    sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'reopen', $4, NOW())"#)
        .bind(&log_id).bind(&mission_id).bind(&session.user_id).bind(log_lines.join("\n"))
        .execute(&mut *tx).await.ok();

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Commit failed."}))))?;

    create_notification(state.pool(), &org.id, Some(&session.user_id), "mission", "warning",
        &format!("Mission reopened / {}", mission.callsign),
        &format!("{} moved back to {} for revision {}.", mission.callsign, body.status, next_rev),
        Some(&format!("/missions/{}", mission_id))).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "reopen", "mission", Some(&mission_id),
        Some(json!({"callsign": mission.callsign, "fromStatus": mission.status, "toStatus": body.status}))).await;

    Ok(Json(json!({"ok": true, "mission": {"id": mission_id, "callsign": mission.callsign, "status": body.status, "revisionNumber": next_rev}})))
}

// --- POST /api/missions/:missionId/logs ---

#[derive(Deserialize)]
struct CreateLogRequest {
    #[serde(rename = "entryType")]
    entry_type: String,
    message: String,
}

async fn create_log(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
    Json(body): Json<CreateLogRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let _ = find_mission(state.pool(), &mission_id, &org.id).await?;

    let log_id = cuid2::create_id();
    sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())"#)
        .bind(&log_id).bind(&mission_id).bind(&session.user_id).bind(&body.entry_type).bind(&body.message)
        .execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create log."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "mission_log", Some(&log_id),
        Some(json!({"missionId": mission_id, "entryType": body.entry_type}))).await;

    Ok(Json(json!({"ok": true, "log": {"id": log_id, "entryType": body.entry_type, "message": body.message}})))
}

// --- POST /api/missions/:missionId/participants ---

#[derive(Deserialize)]
struct CreateParticipantRequest {
    handle: String,
    role: String,
    platform: Option<String>,
    status: String,
    notes: Option<String>,
}

async fn create_participant(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
    Json(body): Json<CreateParticipantRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let _ = find_mission(state.pool(), &mission_id, &org.id).await?;

    let part_id = cuid2::create_id();
    let handle = body.handle.to_uppercase();
    sqlx::query(
        r#"INSERT INTO "MissionParticipant" (id, "missionId", handle, role, platform, status, notes, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())"#
    ).bind(&part_id).bind(&mission_id).bind(&handle).bind(&body.role)
    .bind(body.platform.as_deref()).bind(&body.status).bind(body.notes.as_deref())
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create participant."}))))?;

    let log_id = cuid2::create_id();
    sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'package', $4, NOW())"#)
        .bind(&log_id).bind(&mission_id).bind(&session.user_id)
        .bind(format!("Participant assigned: {} / {} / {}.", handle, body.role, body.status))
        .execute(state.pool()).await.ok();

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "mission_participant", Some(&part_id),
        Some(json!({"missionId": mission_id, "handle": handle, "role": body.role}))).await;

    Ok(Json(json!({"ok": true, "participant": {"id": part_id, "handle": handle, "role": body.role, "platform": body.platform, "status": body.status, "notes": body.notes}})))
}

// --- PATCH /api/missions/:missionId/participants/:participantId ---

#[derive(Deserialize)]
struct UpdateParticipantRequest {
    handle: String,
    status: String,
    role: String,
    platform: Option<String>,
    notes: Option<String>,
}

async fn update_participant(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path((mission_id, participant_id)): Path<(String, String)>,
    Json(body): Json<UpdateParticipantRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let _ = find_mission(state.pool(), &mission_id, &org.id).await?;

    let handle = body.handle.to_uppercase();
    sqlx::query(
        r#"UPDATE "MissionParticipant" SET handle = $1, status = $2, role = $3, platform = $4, notes = $5 WHERE id = $6 AND "missionId" = $7"#
    ).bind(&handle).bind(&body.status).bind(&body.role).bind(body.platform.as_deref()).bind(body.notes.as_deref())
    .bind(&participant_id).bind(&mission_id)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    let log_id = cuid2::create_id();
    sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'package', $4, NOW())"#)
        .bind(&log_id).bind(&mission_id).bind(&session.user_id)
        .bind(format!("Participant updated: {} / {} / {}.", handle, body.role, body.status))
        .execute(state.pool()).await.ok();

    Ok(Json(json!({"ok": true, "participant": {"id": participant_id, "handle": handle, "role": body.role, "status": body.status}})))
}

// --- DELETE /api/missions/:missionId/participants/:participantId ---

async fn delete_participant(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path((mission_id, participant_id)): Path<(String, String)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let _ = find_mission(state.pool(), &mission_id, &org.id).await?;

    // Get handle before delete
    #[derive(sqlx::FromRow)]
    struct PRow { handle: String, role: String }
    let p = sqlx::query_as::<_, PRow>(r#"SELECT handle, role FROM "MissionParticipant" WHERE id = $1 AND "missionId" = $2"#)
        .bind(&participant_id).bind(&mission_id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let p = p.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Participant not found."}))))?;

    sqlx::query(r#"DELETE FROM "MissionParticipant" WHERE id = $1"#)
        .bind(&participant_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Delete failed."}))))?;

    let log_id = cuid2::create_id();
    sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'package', $4, NOW())"#)
        .bind(&log_id).bind(&mission_id).bind(&session.user_id)
        .bind(format!("Participant removed: {} / {}.", p.handle, p.role))
        .execute(state.pool()).await.ok();

    Ok(Json(json!({"ok": true, "participantId": participant_id})))
}

// --- POST /api/missions/:missionId/intel ---

#[derive(Deserialize)]
struct LinkIntelRequest {
    #[serde(rename = "intelId")]
    intel_id: String,
}

async fn link_intel(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
    Json(body): Json<LinkIntelRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let _ = find_mission(state.pool(), &mission_id, &org.id).await?;

    // Verify intel exists in same org
    let intel_exists: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "IntelReport" WHERE id = $1 AND "orgId" = $2"#
    ).bind(&body.intel_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);

    if intel_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Intel report not found."}))));
    }

    // Upsert link
    let link_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "MissionIntelLink" (id, "missionId", "intelId", "createdAt")
           VALUES ($1, $2, $3, NOW()) ON CONFLICT ("missionId", "intelId") DO NOTHING"#
    ).bind(&link_id).bind(&mission_id).bind(&body.intel_id)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to link intel."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "link", "mission_intel", Some(&mission_id),
        Some(json!({"intelId": body.intel_id}))).await;

    Ok(Json(json!({"ok": true, "link": {"id": link_id, "missionId": mission_id, "intelId": body.intel_id}})))
}

// --- DELETE /api/missions/:missionId/intel/:intelId ---

async fn unlink_intel(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path((mission_id, intel_id)): Path<(String, String)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let _ = find_mission(state.pool(), &mission_id, &org.id).await?;

    let link_id: Option<String> = sqlx::query_scalar(
        r#"SELECT l.id FROM "MissionIntelLink" l
           JOIN "Mission" m ON l."missionId" = m.id
           WHERE l."missionId" = $1 AND l."intelId" = $2 AND m."orgId" = $3"#
    ).bind(&mission_id).bind(&intel_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);

    let link_id = link_id.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Intel link not found."}))))?;

    sqlx::query(r#"DELETE FROM "MissionIntelLink" WHERE id = $1"#)
        .bind(&link_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Delete failed."}))))?;

    Ok(Json(json!({"ok": true, "intelId": intel_id})))
}

// --- POST /api/missions/:missionId/doctrine ---

#[derive(Deserialize)]
struct AssignDoctrineRequest {
    #[serde(rename = "doctrineTemplateId")]
    doctrine_template_id: Option<String>,
}

async fn assign_doctrine(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
    Json(body): Json<AssignDoctrineRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_missions(&session)?;
    let org = require_org_helper(state.pool(), &session.user_id).await?;
    let mission = find_mission(state.pool(), &mission_id, &org.id).await?;

    let (doctrine_id, roe_code, doctrine_title): (Option<String>, Option<String>, Option<String>) =
        if let Some(ref dtid) = body.doctrine_template_id {
            #[derive(sqlx::FromRow)]
            struct DRow { id: String, code: String, title: String }
            let d = sqlx::query_as::<_, DRow>(
                r#"SELECT id, code, title FROM "DoctrineTemplate" WHERE id = $1 AND "orgId" = $2"#
            ).bind(dtid).bind(&org.id).fetch_optional(state.pool()).await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;
            let d = d.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Doctrine template not found."}))))?;
            (Some(d.id), Some(d.code), Some(d.title))
        } else {
            (None, None, None)
        };

    let mut tx = state.pool().begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    sqlx::query(r#"UPDATE "Mission" SET "doctrineTemplateId" = $1, "roeCode" = $2, "updatedAt" = NOW() WHERE id = $3"#)
        .bind(doctrine_id.as_deref()).bind(roe_code.as_deref()).bind(&mission_id)
        .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    let log_id = cuid2::create_id();
    let log_msg = if let Some(ref title) = doctrine_title {
        format!("Doctrine attached: {} ({}).", title, roe_code.as_deref().unwrap_or(""))
    } else {
        "Doctrine attachment cleared from mission package.".to_string()
    };
    sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'doctrine', $4, NOW())"#)
        .bind(&log_id).bind(&mission_id).bind(&session.user_id).bind(&log_msg)
        .execute(&mut *tx).await.ok();

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Commit failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "mission_doctrine", Some(&mission_id),
        Some(json!({"doctrineTemplateId": body.doctrine_template_id, "roeCode": roe_code}))).await;

    Ok(Json(json!({"ok": true, "mission": {"id": mission_id, "callsign": mission.callsign, "roeCode": roe_code}})))
}
