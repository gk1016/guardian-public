use axum::{
    extract::{Path, State},
    routing::{patch, post},
    Json, Router,
};
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::middleware::AuthSession;
use crate::helpers::audit::audit_log;
use crate::helpers::notifications::create_notification;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        // Intel
        .route("/api/intel", post(create_intel))
        .route("/api/intel/{intelId}", patch(update_intel))
        .route("/api/intel/{intelId}/archive", post(archive_intel))
        // Rescues
        .route("/api/rescues", post(create_rescue))
        .route("/api/rescues/{rescueId}", patch(update_rescue))
        // QRF
        .route("/api/qrf", post(create_qrf))
        .route("/api/qrf/{qrfId}", patch(update_qrf))
        .route("/api/qrf/{qrfId}/dispatch", post(create_dispatch))
        .route("/api/qrf/dispatches/{dispatchId}", patch(update_dispatch))
        // Incidents
        .route("/api/incidents", post(create_incident))
        .route("/api/incidents/{incidentId}", patch(update_incident))
}

fn require_ops(session: &crate::auth::session::Session) -> Result<(), (StatusCode, Json<Value>)> {
    if !session.can_manage_operations() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Operations authority required."}))));
    }
    Ok(())
}

async fn require_org(pool: &sqlx::PgPool, user_id: &str) -> Result<crate::helpers::org::OrgInfo, (StatusCode, Json<Value>)> {
    get_org_for_user(pool, user_id).await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))
}

/// Helper: auto-create a comms channel tied to an operational entity.
async fn auto_create_comms_channel(
    state: &AppState,
    org_id: &str,
    user_id: &str,
    ref_type: guardian_comms::types::RefType,
    ref_id: &str,
    channel_name: &str,
    system_msg: &str,
) {
    let op_handle: String = sqlx::query_scalar(r#"SELECT handle FROM "User" WHERE id = $1"#)
        .bind(user_id)
        .fetch_optional(state.pool()).await
        .ok().flatten()
        .unwrap_or_else(|| "OPERATOR".to_string());

    match guardian_comms::channel::create_channel(
        state.pool(),
        &guardian_comms::types::CreateChannelRequest {
            org_id: org_id.to_string(),
            channel_type: guardian_comms::types::ChannelType::Group,
            scope: guardian_comms::types::ChannelScope::Local,
            ref_type: Some(ref_type),
            ref_id: Some(ref_id.to_string()),
            name: channel_name.to_string(),
            encrypted: false,
            parent_channel_id: None,
        },
    ).await {
        Ok(ch) => {
            let _ = guardian_comms::participant::add_participant(
                state.pool(), &ch.id, Some(user_id), &op_handle,
                guardian_comms::types::Clearance::Full,
                guardian_comms::types::ParticipantRole::Admin,
            ).await;
            let _ = guardian_comms::message::send_system_message(
                state.pool(), &ch.id, system_msg,
            ).await;
            tracing::info!(channel_id = %ch.id, name = %channel_name, "auto-created comms channel");
        }
        Err(e) => {
            tracing::warn!(error = %e, name = %channel_name, "failed to auto-create comms channel");
        }
    }
}

// ============ INTEL ============

#[derive(Deserialize)]
struct CreateIntelRequest {
    title: String,
    #[serde(rename = "reportType")]
    report_type: String,
    description: Option<String>,
    severity: i32,
    #[serde(rename = "locationName")]
    location_name: Option<String>,
    #[serde(rename = "starSystem")]
    star_system: Option<String>,
    #[serde(rename = "hostileGroup")]
    hostile_group: Option<String>,
    confidence: String,
    tags: Option<Vec<String>>,
    #[serde(rename = "sourceReliability")]
    source_reliability: Option<String>,
    #[serde(rename = "infoCredibility")]
    info_credibility: Option<i32>,
}

async fn create_intel(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateIntelRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let id = cuid2::create_id();
    let title = body.title.to_uppercase();
    let tags: Vec<String> = body.tags.unwrap_or_default();

    let src_rel = body.source_reliability.as_deref().unwrap_or("F");
    let info_cred = body.info_credibility.unwrap_or(6);

    sqlx::query(
        r#"INSERT INTO "IntelReport" (id, "orgId", title, "reportType", description, severity, "locationName", "starSystem", "hostileGroup", confidence, tags, "sourceReliability", "infoCredibility", "isActive", "observedAt", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(&title).bind(&body.report_type).bind(body.description.as_deref())
    .bind(body.severity).bind(body.location_name.as_deref()).bind(body.star_system.as_deref())
    .bind(body.hostile_group.as_deref()).bind(&body.confidence).bind(&tags)
    .bind(src_rel).bind(info_cred)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create intel report."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "intel", Some(&id),
        Some(json!({"title": title, "severity": body.severity}))).await;

    Ok(Json(json!({"ok": true, "report": {"id": id, "title": title, "severity": body.severity}})))
}

#[derive(Deserialize)]
struct UpdateIntelRequest {
    title: Option<String>,
    #[serde(rename = "reportType")]
    report_type: Option<String>,
    severity: Option<i32>,
    confidence: Option<String>,
    #[serde(rename = "isActive")]
    is_active: Option<bool>,
    #[serde(rename = "isVerified")]
    is_verified: Option<bool>,
    description: Option<String>,
    #[serde(rename = "hostileGroup")]
    hostile_group: Option<String>,
    #[serde(rename = "locationName")]
    location_name: Option<String>,
    #[serde(rename = "starSystem")]
    star_system: Option<String>,
    tags: Option<Vec<String>>,
    #[serde(rename = "sourceReliability")]
    source_reliability: Option<String>,
    #[serde(rename = "infoCredibility")]
    info_credibility: Option<i32>,
    #[serde(rename = "reportPhase")]
    report_phase: Option<String>,
}

async fn update_intel(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(intel_id): Path<String>,
    Json(body): Json<UpdateIntelRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    // Verify exists in org
    let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "IntelReport" WHERE id = $1 AND "orgId" = $2"#)
        .bind(&intel_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Intel report not found."}))));
    }

    let title_upper = body.title.as_ref().map(|t| t.to_uppercase());

    sqlx::query(
        r#"UPDATE "IntelReport" SET
           title = COALESCE($1, title),
           "reportType" = COALESCE($2, "reportType"),
           severity = COALESCE($3, severity),
           confidence = COALESCE($4, confidence),
           "isActive" = COALESCE($5, "isActive"),
           "isVerified" = COALESCE($6, "isVerified"),
           description = COALESCE($7, description),
           "hostileGroup" = COALESCE($8, "hostileGroup"),
           "locationName" = COALESCE($9, "locationName"),
           "starSystem" = COALESCE($10, "starSystem"),
           tags = COALESCE($11, tags),
           "sourceReliability" = COALESCE($12, "sourceReliability"),
           "infoCredibility" = COALESCE($13, "infoCredibility"),
           "reportPhase" = COALESCE($14, "reportPhase"),
           "updatedAt" = NOW()
           WHERE id = $15"#
    ).bind(title_upper.as_deref()).bind(body.report_type.as_deref())
    .bind(body.severity).bind(body.confidence.as_deref())
    .bind(body.is_active).bind(body.is_verified)
    .bind(body.description.as_deref()).bind(body.hostile_group.as_deref())
    .bind(body.location_name.as_deref()).bind(body.star_system.as_deref())
    .bind(body.tags.as_ref()).bind(body.source_reliability.as_deref())
    .bind(body.info_credibility).bind(body.report_phase.as_deref())
    .bind(&intel_id)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "intel", Some(&intel_id), None).await;

    Ok(Json(json!({"ok": true, "report": {"id": intel_id}})))
}


async fn archive_intel(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(intel_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let rows = sqlx::query(
        r#"UPDATE "IntelReport" SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1 AND "orgId" = $2"#
    ).bind(&intel_id).bind(&org.id)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Archive failed."}))))?
    .rows_affected();

    if rows == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Intel report not found."}))));
    }

    audit_log(state.pool(), &session.user_id, Some(&org.id), "archive", "intel", Some(&intel_id), None).await;

    Ok(Json(json!({"ok": true})))
}

// ============ RESCUES ============

#[derive(Deserialize)]
struct CreateRescueRequest {
    #[serde(rename = "survivorHandle")]
    survivor_handle: String,
    #[serde(rename = "locationName")]
    location_name: Option<String>,
    urgency: String,
    #[serde(rename = "threatSummary")]
    threat_summary: Option<String>,
    #[serde(rename = "rescueNotes")]
    rescue_notes: Option<String>,
    #[serde(rename = "survivorCondition")]
    survivor_condition: Option<String>,
    #[serde(rename = "escortRequired")]
    escort_required: bool,
    #[serde(rename = "medicalRequired")]
    medical_required: bool,
    #[serde(rename = "offeredPayment")]
    offered_payment: Option<i32>,
}

async fn create_rescue(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateRescueRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let id = cuid2::create_id();
    let handle = body.survivor_handle.to_uppercase();

    sqlx::query(
        r#"INSERT INTO "RescueRequest" (id, "orgId", "requesterId", "survivorHandle", "locationName", urgency, status, "threatSummary", "rescueNotes", "survivorCondition", "escortRequired", "medicalRequired", "offeredPayment", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10, $11, $12, NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(&session.user_id).bind(&handle)
    .bind(body.location_name.as_deref()).bind(&body.urgency)
    .bind(body.threat_summary.as_deref()).bind(body.rescue_notes.as_deref())
    .bind(body.survivor_condition.as_deref()).bind(body.escort_required)
    .bind(body.medical_required).bind(body.offered_payment)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create rescue request."}))))?;

    // Auto-create CSAR comms channel
    auto_create_comms_channel(
        &state, &org.id, &session.user_id,
        guardian_comms::types::RefType::Csar, &id,
        &format!("CSAR-{}", handle),
        "CSAR channel auto-created",
    ).await;

    let severity = if body.urgency == "flash" { "critical" } else { "warning" };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "rescue", severity,
        &format!("New rescue intake / {}", handle),
        "Rescue request opened. Review escort requirement and survivor condition.",
        Some("/rescues")).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "rescue", Some(&id),
        Some(json!({"survivorHandle": handle, "urgency": body.urgency}))).await;

    Ok(Json(json!({"ok": true, "rescue": {"id": id, "survivorHandle": handle, "status": "open"}})))
}

#[derive(Deserialize)]
struct UpdateRescueRequest {
    status: String,
    #[serde(rename = "operatorId")]
    operator_id: Option<String>,
    #[serde(rename = "survivorCondition")]
    survivor_condition: Option<String>,
    #[serde(rename = "rescueNotes")]
    rescue_notes: Option<String>,
    #[serde(rename = "outcomeSummary")]
    outcome_summary: Option<String>,
}

async fn update_rescue(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(rescue_id): Path<String>,
    Json(body): Json<UpdateRescueRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "RescueRequest" WHERE id = $1 AND "orgId" = $2"#)
        .bind(&rescue_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Rescue request not found."}))));
    }

    sqlx::query(
        r#"UPDATE "RescueRequest" SET status = $1, "operatorId" = $2, "survivorCondition" = $3, "rescueNotes" = $4, "outcomeSummary" = $5, "updatedAt" = NOW() WHERE id = $6"#
    ).bind(&body.status).bind(body.operator_id.as_deref()).bind(body.survivor_condition.as_deref())
    .bind(body.rescue_notes.as_deref()).bind(body.outcome_summary.as_deref()).bind(&rescue_id)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    let severity = match body.status.as_str() {
        "closed" | "recovered" => "info",
        "cancelled" => "warning",
        _ => "warning",
    };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "rescue", severity,
        &format!("Rescue updated / {}", body.status),
        &format!("Rescue {} changed to {}.", rescue_id, body.status),
        Some("/rescues")).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "rescue", Some(&rescue_id),
        Some(json!({"status": body.status}))).await;

    Ok(Json(json!({"ok": true, "rescue": {"id": rescue_id, "status": body.status}})))
}

// ============ QRF ============

#[derive(Deserialize)]
struct CreateQrfRequest {
    callsign: String,
    status: String,
    platform: Option<String>,
    #[serde(rename = "locationName")]
    location_name: Option<String>,
    #[serde(rename = "availableCrew")]
    available_crew: i32,
    notes: Option<String>,
}

async fn create_qrf(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateQrfRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let callsign = body.callsign.to_uppercase();
    let exists: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "QrfReadiness" WHERE "orgId" = $1 AND callsign = $2"#
    ).bind(&org.id).bind(&callsign).fetch_optional(state.pool()).await.unwrap_or(None);
    if exists.is_some() {
        return Err((StatusCode::CONFLICT, Json(json!({"error": "QRF callsign already exists."}))));
    }

    let id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "QrfReadiness" (id, "orgId", callsign, status, platform, "locationName", "availableCrew", notes, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(&callsign).bind(&body.status)
    .bind(body.platform.as_deref()).bind(body.location_name.as_deref())
    .bind(body.available_crew).bind(body.notes.as_deref())
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create QRF."}))))?;

    // Auto-create QRF comms channel
    auto_create_comms_channel(
        &state, &org.id, &session.user_id,
        guardian_comms::types::RefType::Qrf, &id,
        &format!("QRF-{}", callsign),
        "QRF channel auto-created",
    ).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "qrf", Some(&id),
        Some(json!({"callsign": callsign, "status": body.status}))).await;

    Ok(Json(json!({"ok": true, "qrf": {"id": id, "callsign": callsign, "status": body.status}})))
}

#[derive(Deserialize)]
struct UpdateQrfRequest {
    status: String,
    platform: Option<String>,
    #[serde(rename = "locationName")]
    location_name: Option<String>,
    #[serde(rename = "availableCrew")]
    available_crew: i32,
    notes: Option<String>,
}

async fn update_qrf(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(qrf_id): Path<String>,
    Json(body): Json<UpdateQrfRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let callsign: Option<String> = sqlx::query_scalar(
        r#"SELECT callsign FROM "QrfReadiness" WHERE id = $1 AND "orgId" = $2"#
    ).bind(&qrf_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
    let callsign = callsign.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "QRF asset not found."}))))?;

    sqlx::query(
        r#"UPDATE "QrfReadiness" SET status = $1, platform = $2, "locationName" = $3, "availableCrew" = $4, notes = $5, "updatedAt" = NOW() WHERE id = $6"#
    ).bind(&body.status).bind(body.platform.as_deref()).bind(body.location_name.as_deref())
    .bind(body.available_crew).bind(body.notes.as_deref()).bind(&qrf_id)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "qrf", Some(&qrf_id),
        Some(json!({"callsign": callsign, "status": body.status}))).await;

    Ok(Json(json!({"ok": true, "qrf": {"id": qrf_id, "callsign": callsign, "status": body.status}})))
}

// --- QRF Dispatch ---

#[derive(Deserialize)]
struct CreateDispatchRequest {
    #[serde(rename = "missionId")]
    mission_id: Option<String>,
    #[serde(rename = "rescueId")]
    rescue_id: Option<String>,
    notes: Option<String>,
}

async fn create_dispatch(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(qrf_id): Path<String>,
    Json(body): Json<CreateDispatchRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    // Exactly one target required
    if body.mission_id.is_some() == body.rescue_id.is_some() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Dispatch requires exactly one target."}))));
    }

    #[derive(sqlx::FromRow)]
    struct QrfRow { id: String, callsign: String }
    let qrf = sqlx::query_as::<_, QrfRow>(r#"SELECT id, callsign FROM "QrfReadiness" WHERE id = $1 AND "orgId" = $2"#)
        .bind(&qrf_id).bind(&org.id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;
    let qrf = qrf.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "QRF asset not found."}))))?;

    // Validate targets
    if let Some(ref mid) = body.mission_id {
        let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "Mission" WHERE id = $1 AND "orgId" = $2"#)
            .bind(mid).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
        if exists.is_none() { return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Mission target not found."})))); }
    }
    if let Some(ref rid) = body.rescue_id {
        let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "RescueRequest" WHERE id = $1 AND "orgId" = $2"#)
            .bind(rid).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
        if exists.is_none() { return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Rescue target not found."})))); }
    }

    let dispatch_id = cuid2::create_id();
    let mut tx = state.pool().begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    sqlx::query(
        r#"INSERT INTO "QrfDispatch" (id, "orgId", "qrfId", "missionId", "rescueId", "dispatchedById", status, notes, "dispatchedAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, 'tasked', $7, NOW(), NOW())"#
    ).bind(&dispatch_id).bind(&org.id).bind(&qrf_id).bind(body.mission_id.as_deref())
    .bind(body.rescue_id.as_deref()).bind(&session.user_id).bind(body.notes.as_deref())
    .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create dispatch."}))))?;

    sqlx::query(r#"UPDATE "QrfReadiness" SET status = 'tasked', "updatedAt" = NOW() WHERE id = $1"#)
        .bind(&qrf_id).execute(&mut *tx).await.ok();

    if let Some(ref mid) = body.mission_id {
        let log_id = cuid2::create_id();
        sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'dispatch', $4, NOW())"#)
            .bind(&log_id).bind(mid).bind(&session.user_id).bind(format!("{} tasked to sortie.", qrf.callsign))
            .execute(&mut *tx).await.ok();
    }
    if let Some(ref rid) = body.rescue_id {
        sqlx::query(r#"UPDATE "RescueRequest" SET status = 'dispatching', "updatedAt" = NOW() WHERE id = $1"#)
            .bind(rid).execute(&mut *tx).await.ok();
    }

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Commit failed."}))))?;

    let target_desc = if body.mission_id.is_some() { "mission package" } else { "rescue package" };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "qrf", "warning",
        &format!("{} dispatched", qrf.callsign),
        &format!("{} has been tasked to a {}.", qrf.callsign, target_desc),
        Some("/qrf")).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "dispatch", "qrf_dispatch", Some(&dispatch_id),
        Some(json!({"qrfId": qrf_id, "callsign": qrf.callsign, "missionId": body.mission_id, "rescueId": body.rescue_id}))).await;

    Ok(Json(json!({"ok": true, "dispatch": {"id": dispatch_id, "status": "tasked"}})))
}

#[derive(Deserialize)]
struct UpdateDispatchRequest {
    status: String,
}

async fn update_dispatch(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(dispatch_id): Path<String>,
    Json(body): Json<UpdateDispatchRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    #[derive(sqlx::FromRow)]
    struct DispatchRow {
        id: String,
        #[sqlx(rename = "qrfId")] qrf_id: String,
        #[sqlx(rename = "missionId")] mission_id: Option<String>,
        #[sqlx(rename = "rescueId")] rescue_id: Option<String>,
        callsign: String,
    }
    let dispatch = sqlx::query_as::<_, DispatchRow>(
        r#"SELECT d.id, d."qrfId", d."missionId", d."rescueId", q.callsign
           FROM "QrfDispatch" d JOIN "QrfReadiness" q ON d."qrfId" = q.id
           WHERE d.id = $1 AND d."orgId" = $2"#
    ).bind(&dispatch_id).bind(&org.id).fetch_optional(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;
    let dispatch = dispatch.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Dispatch not found."}))))?;

    let qrf_status = match body.status.as_str() {
        "rtb" | "complete" => "redcon2",
        "aborted" => "redcon3",
        "tasked" => "tasked",
        _ => "launched",
    };

    let mut tx = state.pool().begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    // Update dispatch with timing fields
    match body.status.as_str() {
        "on_scene" => {
            sqlx::query(r#"UPDATE "QrfDispatch" SET status = $1, "arrivedAt" = NOW(), "updatedAt" = NOW() WHERE id = $2"#)
                .bind(&body.status).bind(&dispatch_id).execute(&mut *tx).await.ok();
        }
        "rtb" | "complete" | "aborted" => {
            sqlx::query(r#"UPDATE "QrfDispatch" SET status = $1, "rtbAt" = NOW(), "updatedAt" = NOW() WHERE id = $2"#)
                .bind(&body.status).bind(&dispatch_id).execute(&mut *tx).await.ok();
        }
        _ => {
            sqlx::query(r#"UPDATE "QrfDispatch" SET status = $1, "updatedAt" = NOW() WHERE id = $2"#)
                .bind(&body.status).bind(&dispatch_id).execute(&mut *tx).await.ok();
        }
    }

    sqlx::query(r#"UPDATE "QrfReadiness" SET status = $1, "updatedAt" = NOW() WHERE id = $2"#)
        .bind(qrf_status).bind(&dispatch.qrf_id).execute(&mut *tx).await.ok();

    if let Some(ref mid) = dispatch.mission_id {
        let log_id = cuid2::create_id();
        sqlx::query(r#"INSERT INTO "MissionLog" (id, "missionId", "authorId", "entryType", message, "createdAt") VALUES ($1, $2, $3, 'dispatch', $4, NOW())"#)
            .bind(&log_id).bind(mid).bind(&session.user_id)
            .bind(format!("{} dispatch updated to {}.", dispatch.callsign, body.status))
            .execute(&mut *tx).await.ok();
    }
    if let Some(ref rid) = dispatch.rescue_id {
        let rescue_status = match body.status.as_str() {
            "on_scene" => "on_scene",
            "complete" => "closed",
            "en_route" => "en_route",
            "aborted" => "open",
            _ => "dispatching",
        };
        sqlx::query(r#"UPDATE "RescueRequest" SET status = $1, "updatedAt" = NOW() WHERE id = $2"#)
            .bind(rescue_status).bind(rid).execute(&mut *tx).await.ok();
    }

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Commit failed."}))))?;

    let severity = match body.status.as_str() {
        "aborted" => "critical",
        "complete" | "rtb" => "info",
        _ => "warning",
    };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "qrf", severity,
        &format!("{} / {}", dispatch.callsign, body.status),
        &format!("{} dispatch state changed to {}.", dispatch.callsign, body.status),
        Some("/qrf")).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "qrf_dispatch", Some(&dispatch_id),
        Some(json!({"callsign": dispatch.callsign, "status": body.status}))).await;

    Ok(Json(json!({"ok": true})))
}

// ============ INCIDENTS ============

#[derive(Deserialize)]
struct CreateIncidentRequest {
    title: String,
    category: String,
    severity: i32,
    status: String,
    #[serde(rename = "missionId")]
    mission_id: Option<String>,
    #[serde(rename = "rescueId")]
    rescue_id: Option<String>,
    summary: String,
    #[serde(rename = "lessonsLearned")]
    lessons_learned: Option<String>,
    #[serde(rename = "actionItems")]
    action_items: Option<String>,
    #[serde(rename = "publicSummary")]
    public_summary: Option<String>,
}

async fn create_incident(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<CreateIncidentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    // Validate links
    if let Some(ref mid) = body.mission_id {
        let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "Mission" WHERE id = $1 AND "orgId" = $2"#)
            .bind(mid).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
        if exists.is_none() { return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Mission link is invalid."})))); }
    }
    if let Some(ref rid) = body.rescue_id {
        let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "RescueRequest" WHERE id = $1 AND "orgId" = $2"#)
            .bind(rid).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
        if exists.is_none() { return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Rescue link is invalid."})))); }
    }

    let id = cuid2::create_id();
    let reviewer_id = if body.status == "closed" { Some(session.user_id.as_str()) } else { None };
    let closed_at = if body.status == "closed" { "NOW()" } else { "NULL" };

    sqlx::query(
        r#"INSERT INTO "Incident" (id, "orgId", "missionId", "rescueId", "reporterId", "reviewerId", title, category, severity, status, summary, "lessonsLearned", "actionItems", "publicSummary", "closedAt", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CASE WHEN $10 = 'closed' THEN NOW() ELSE NULL END, NOW(), NOW())"#
    ).bind(&id).bind(&org.id).bind(body.mission_id.as_deref()).bind(body.rescue_id.as_deref())
    .bind(&session.user_id).bind(reviewer_id)
    .bind(&body.title).bind(&body.category).bind(body.severity).bind(&body.status)
    .bind(&body.summary).bind(body.lessons_learned.as_deref()).bind(body.action_items.as_deref())
    .bind(body.public_summary.as_deref())
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create incident."}))))?;

    let severity = if body.severity >= 4 { "critical" } else { "warning" };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "incident", severity,
        &body.title, "Incident opened. Review and lessons-learned capture required.",
        Some("/incidents")).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "create", "incident", Some(&id),
        Some(json!({"title": body.title, "severity": body.severity}))).await;

    Ok(Json(json!({"ok": true, "incident": {"id": id, "title": body.title, "status": body.status}})))
}

#[derive(Deserialize)]
struct UpdateIncidentRequest {
    status: String,
    #[serde(rename = "lessonsLearned")]
    lessons_learned: Option<String>,
    #[serde(rename = "actionItems")]
    action_items: Option<String>,
    #[serde(rename = "publicSummary")]
    public_summary: Option<String>,
}

async fn update_incident(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(incident_id): Path<String>,
    Json(body): Json<UpdateIncidentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_ops(&session)?;
    let org = require_org(state.pool(), &session.user_id).await?;

    let exists: Option<String> = sqlx::query_scalar(r#"SELECT id FROM "Incident" WHERE id = $1 AND "orgId" = $2"#)
        .bind(&incident_id).bind(&org.id).fetch_optional(state.pool()).await.unwrap_or(None);
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Incident not found."}))));
    }

    sqlx::query(
        r#"UPDATE "Incident" SET status = $1, "lessonsLearned" = $2, "actionItems" = $3, "publicSummary" = $4,
           "reviewerId" = $5, "closedAt" = CASE WHEN $1 IN ('closed', 'archived') THEN NOW() ELSE NULL END,
           "updatedAt" = NOW() WHERE id = $6"#
    ).bind(&body.status).bind(body.lessons_learned.as_deref()).bind(body.action_items.as_deref())
    .bind(body.public_summary.as_deref()).bind(&session.user_id).bind(&incident_id)
    .execute(state.pool()).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Update failed."}))))?;

    let severity = match body.status.as_str() {
        "closed" | "archived" => "info",
        _ => "warning",
    };
    create_notification(state.pool(), &org.id, Some(&session.user_id), "incident", severity,
        &format!("Incident {}", body.status),
        &format!("Incident {} changed to {}.", incident_id, body.status),
        Some("/incidents")).await;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "update", "incident", Some(&incident_id),
        Some(json!({"status": body.status}))).await;

    Ok(Json(json!({"ok": true, "incident": {"id": incident_id, "status": body.status}})))
}
