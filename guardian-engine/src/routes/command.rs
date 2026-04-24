//! AI Command HTTP route for the Guardian Engine.
//!
//! POST /api/ai/command — natural language command interface

use axum::{
    Router,
    routing::post,
    extract::State,
    Json,
    response::IntoResponse,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};

use crate::state::AppState;
use crate::auth::middleware::AuthSession;
use crate::ai::command::{self, CommandMessage};

// ---------------------------------------------------------------------------
// POST /api/ai/command
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct CommandRequest {
    message: String,
    #[serde(default)]
    history: Vec<CommandMessage>,
}

#[derive(Serialize)]
struct CommandResponseBody {
    response: String,
    tools_used: Vec<String>,
}

async fn handle_command(
    State(state): State<AppState>,
    session: AuthSession,
    Json(body): Json<CommandRequest>,
) -> impl IntoResponse {
    // Require configured + enabled AI
    let provider = match state.ai().provider().await {
        Some(p) => p,
        None => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "No AI provider configured or enabled. Configure one in Admin > AI Configuration."
            })),
        ).into_response(),
    };

    let org_id = match &session.org_id {
        Some(id) => id.clone(),
        None => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No organization context" })),
        ).into_response(),
    };

    tracing::info!(
        user = %session.handle,
        role = %session.role,
        message_len = body.message.len(),
        history_len = body.history.len(),
        "AI command request"
    );

    match command::process_command(
        provider,
        state.pool(),
        &org_id,
        &session.handle,
        &session.role,
        &session.user_id,
        &body.message,
        body.history,
    ).await {
        Ok(result) => {
            tracing::info!(
                tools_used = ?result.tools_used,
                response_len = result.response.len(),
                "AI command complete"
            );
            Json(serde_json::json!({
                "response": result.response,
                "tools_used": result.tools_used,
            })).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "AI command failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            ).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/ai/command", post(handle_command))
}
