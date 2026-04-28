//! REST API routes for the comms system.

use axum::{
    extract::{Path, Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, delete},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    access, channel, invite, message, participant,
    types::*,
    ws::{self, TaggedEvent},
    CommsEngine,
};

#[derive(Clone)]
pub struct CommsState {
    pub engine: CommsEngine,
}

#[derive(Debug, Clone)]
pub struct CommsUser {
    pub user_id: String,
    pub handle: String,
    pub org_id: String,
}

impl<S> axum::extract::FromRequestParts<S> for CommsUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<Value>);

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let user_id = parts
            .headers
            .get("x-comms-user-id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .ok_or((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Authentication required."})),
            ))?;

        let handle = parts
            .headers
            .get("x-comms-handle")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let org_id = parts
            .headers
            .get("x-comms-org-id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_default();

        Ok(CommsUser {
            user_id,
            handle,
            org_id,
        })
    }
}

pub fn build_router(engine: CommsEngine) -> Router<()> {
    let state = CommsState { engine };

    Router::new()
        .route("/api/comms/channels", get(list_channels).post(create_channel_route))
        .route("/api/comms/channels/{channelId}", get(get_channel_route))
        .route("/api/comms/channels/{channelId}/children", get(list_children_route))
        .route("/api/comms/channels/{channelId}/messages", get(get_messages).post(send_message_route))
        .route("/api/comms/channels/{channelId}/participants", get(list_participants_route).post(add_participant_route))
        .route("/api/comms/channels/{channelId}/participants/{userId}", delete(remove_participant_route))
        .route("/api/comms/channels/{channelId}/read", post(mark_read_route))
        .route("/api/comms/channels/{channelId}/invites", get(list_invites_route).post(create_invite_route))
        .route("/api/comms/invites/{tokenId}/revoke", post(revoke_invite_route))
        .route("/api/comms/join/{token}", post(redeem_invite_route))
        .route("/api/comms/unread", get(batch_unread))
        .route("/ws/comms", get(ws_upgrade))
        .with_state(state)
}

async fn list_channels(
    State(state): State<CommsState>,
    user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let channels = channel::list_user_channels(state.engine.pool(), &user.user_id, &user.org_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;
    Ok(Json(json!({"channels": channels})))
}

async fn create_channel_route(
    State(state): State<CommsState>,
    user: CommsUser,
    Json(body): Json<CreateChannelRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let ch = channel::create_channel(state.engine.pool(), &body)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "channel create failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create channel."})))
        })?;

    let _ = participant::add_participant(
        state.engine.pool(),
        &ch.id,
        Some(&user.user_id),
        &user.handle,
        Clearance::Full,
        ParticipantRole::Admin,
    )
    .await;

    let _ = message::send_system_message(
        state.engine.pool(),
        &ch.id,
        &format!("Channel created by {}", user.handle),
    )
    .await;

    Ok(Json(json!({"ok": true, "channel": ch})))
}

async fn get_channel_route(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    _user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let ch = channel::get_channel(state.engine.pool(), &channel_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "Channel not found."}))))?;
    Ok(Json(json!({"channel": ch})))
}

async fn list_children_route(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    _user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let children = channel::list_children(state.engine.pool(), &channel_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;
    Ok(Json(json!({"channels": children})))
}

#[derive(Deserialize)]
struct MessageQuery {
    cursor: Option<String>,
    limit: Option<i64>,
}

async fn get_messages(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    user: CommsUser,
    Query(q): Query<MessageQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let p = participant::get_participant(state.engine.pool(), &channel_id, &user.user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
        .ok_or((StatusCode::FORBIDDEN, Json(json!({"error": "Not a participant."}))))?;

    let ch = channel::get_channel(state.engine.pool(), &channel_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "Channel not found."}))))?;

    let messages = message::get_history(
        state.engine.pool(),
        &channel_id,
        ch.encrypted,
        &p.clearance,
        q.cursor.as_deref(),
        q.limit.unwrap_or(50).min(100),
    )
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    Ok(Json(json!({"messages": messages})))
}

async fn send_message_route(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    user: CommsUser,
    Json(body): Json<SendMessageRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let p = participant::get_participant(state.engine.pool(), &channel_id, &user.user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
        .ok_or((StatusCode::FORBIDDEN, Json(json!({"error": "Not a participant."}))))?;

    let sender_clearance = access::parse_clearance(&p.clearance);
    if !access::can_send_classification(sender_clearance, body.classification) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Classification exceeds your clearance."})),
        ));
    }

    let ch = channel::get_channel(state.engine.pool(), &channel_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "Channel not found."}))))?;

    let mut msg_req = body;
    msg_req.sender_id = Some(user.user_id.clone());
    msg_req.sender_handle = user.handle.clone();

    let row = message::send_message(state.engine.pool(), &channel_id, ch.encrypted, &msg_req)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "message send failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to send message."})))
        })?;

    let mut display_row = row.clone();
    if ch.encrypted && display_row.encrypted {
        display_row.content = msg_req.content.clone();
    }

    let event = WsEvent::Message {
        channel_id: channel_id.clone(),
        message: display_row,
    };
    let payload = serde_json::to_string(&event).unwrap();
    state.engine.registry().broadcast(
        &channel_id,
        TaggedEvent {
            classification: msg_req.classification,
            payload,
        },
    );

    Ok(Json(json!({"ok": true, "message": {"id": row.id}})))
}

async fn list_participants_route(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let p = participant::get_participant(state.engine.pool(), &channel_id, &user.user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
        .ok_or((StatusCode::FORBIDDEN, Json(json!({"error": "Not a participant."}))))?;

    let clearance = access::parse_clearance(&p.clearance);
    let participants = participant::list_participants(state.engine.pool(), &channel_id, clearance)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let online = state.engine.registry().get_online(&channel_id);
    let online_ids: Vec<&str> = online.iter().map(|(id, _)| id.as_str()).collect();

    let enriched: Vec<Value> = participants
        .iter()
        .map(|p| {
            let mut v = serde_json::to_value(p).unwrap();
            v["online"] = json!(p.user_id.as_ref().map_or(false, |uid| online_ids.contains(&uid.as_str())));
            v
        })
        .collect();

    Ok(Json(json!({"participants": enriched})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddParticipantRequest {
    user_id: Option<String>,
    handle: String,
    clearance: Clearance,
    role: Option<ParticipantRole>,
}

async fn add_participant_route(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    _user: CommsUser,
    Json(body): Json<AddParticipantRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let p = participant::add_participant(
        state.engine.pool(),
        &channel_id,
        body.user_id.as_deref(),
        &body.handle,
        body.clearance,
        body.role.unwrap_or(ParticipantRole::Member),
    )
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "add participant failed");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to add participant."})))
    })?;

    let event = WsEvent::ParticipantJoined {
        channel_id: channel_id.clone(),
        participant: p.clone(),
    };
    let payload = serde_json::to_string(&event).unwrap();
    state.engine.registry().broadcast(
        &channel_id,
        TaggedEvent {
            classification: Classification::Unclass,
            payload,
        },
    );

    let _ = message::send_system_message(
        state.engine.pool(),
        &channel_id,
        &format!("{} joined the channel", body.handle),
    )
    .await;

    Ok(Json(json!({"ok": true, "participant": p})))
}

async fn remove_participant_route(
    State(state): State<CommsState>,
    Path((channel_id, target_user_id)): Path<(String, String)>,
    _user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let removed = participant::remove_participant(state.engine.pool(), &channel_id, &target_user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    if removed {
        let event = WsEvent::ParticipantLeft {
            channel_id: channel_id.clone(),
            user_id: target_user_id.clone(),
        };
        let payload = serde_json::to_string(&event).unwrap();
        state.engine.registry().broadcast(
            &channel_id,
            TaggedEvent {
                classification: Classification::Unclass,
                payload,
            },
        );
    }

    Ok(Json(json!({"ok": true})))
}

async fn mark_read_route(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    participant::mark_read(state.engine.pool(), &channel_id, &user.user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateInviteRequest {
    clearance: Clearance,
    handle: Option<String>,
    ttl_hours: Option<i64>,
    max_uses: Option<i32>,
}

async fn create_invite_route(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    _user: CommsUser,
    Json(body): Json<CreateInviteRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let token = invite::create_invite(
        state.engine.pool(),
        &channel_id,
        body.clearance,
        body.handle.as_deref(),
        body.ttl_hours.unwrap_or(24),
        body.max_uses.unwrap_or(1),
    )
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create invite."}))))?;
    Ok(Json(json!({"ok": true, "invite": token})))
}

async fn list_invites_route(
    State(state): State<CommsState>,
    Path(channel_id): Path<String>,
    _user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let invites = invite::list_invites(state.engine.pool(), &channel_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;
    Ok(Json(json!({"invites": invites})))
}

async fn revoke_invite_route(
    State(state): State<CommsState>,
    Path(token_id): Path<String>,
    _user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    invite::revoke_invite(state.engine.pool(), &token_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct RedeemRequest {
    handle: Option<String>,
}

async fn redeem_invite_route(
    State(state): State<CommsState>,
    Path(token): Path<String>,
    Json(body): Json<RedeemRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let invite_token = invite::redeem_invite(state.engine.pool(), &token)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "Invalid or expired invite."}))))?;

    let clearance = access::parse_clearance(&invite_token.clearance);
    let handle = body
        .handle
        .or(invite_token.handle.clone())
        .unwrap_or_else(|| "Guest".to_string());

    let p = participant::add_participant(
        state.engine.pool(),
        &invite_token.channel_id,
        None,
        &handle,
        clearance,
        ParticipantRole::Member,
    )
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to join channel."}))))?;

    let _ = message::send_system_message(
        state.engine.pool(),
        &invite_token.channel_id,
        &format!("{} joined via invite", handle),
    )
    .await;

    Ok(Json(json!({
        "ok": true,
        "channelId": invite_token.channel_id,
        "participant": p,
    })))
}

/// Batch unread counts for all channels the user is in.
async fn batch_unread(
    State(state): State<CommsState>,
    user: CommsUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let channels = channel::list_user_channels(state.engine.pool(), &user.user_id, &user.org_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    let mut counts = serde_json::Map::new();
    for ch in &channels {
        let count = message::unread_count(state.engine.pool(), &ch.id, &user.user_id)
            .await
            .unwrap_or(0);
        if count > 0 {
            counts.insert(ch.id.clone(), json!(count));
        }
    }

    Ok(Json(json!({"counts": counts})))
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<CommsState>,
    user: CommsUser,
) -> impl IntoResponse {
    let pool = state.engine.pool().clone();
    let registry = state.engine.registry().clone();
    let user_id = user.user_id;
    let handle = user.handle;
    ws.on_upgrade(move |socket| ws::handle_comms_ws(socket, pool, registry, user_id, handle))
}
