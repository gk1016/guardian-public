use axum::{
    extract::State,
    http::StatusCode,
    routing::patch,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::middleware::AuthSession;
use crate::helpers::audit::audit_log;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/user/profile", patch(change_password))
}

#[derive(Deserialize)]
struct ChangePasswordBody {
    #[serde(rename = "currentPassword")]
    current_password: String,
    #[serde(rename = "newPassword")]
    new_password: String,
}

async fn change_password(
    State(state): State<AppState>,
    session: AuthSession,
    Json(body): Json<ChangePasswordBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.new_password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "New password must be at least 8 characters."}))));
    }

    let hash: Option<String> = sqlx::query_scalar(
        r#"SELECT "passwordHash" FROM "User" WHERE id = $1"#,
    )
    .bind(&session.user_id)
    .fetch_optional(state.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
    .flatten();

    let password_hash = hash.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Account not found."})))
    })?;

    // Verify current password (blocking)
    let current = body.current_password.clone();
    let hash_clone = password_hash.clone();
    let valid = tokio::task::spawn_blocking(move || bcrypt::verify(current, &hash_clone))
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Verification failed."}))))?
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Verification failed."}))))?;

    if !valid {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Current password is incorrect."}))));
    }

    // Hash new password (blocking)
    let new_pw = body.new_password.clone();
    let new_hash = tokio::task::spawn_blocking(move || bcrypt::hash(new_pw, 12))
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to hash password."}))))?
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to hash password."}))))?;

    sqlx::query(r#"UPDATE "User" SET "passwordHash" = $1 WHERE id = $2"#)
        .bind(&new_hash).bind(&session.user_id)
        .execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update password."}))))?;

    let org = get_org_for_user(state.pool(), &session.user_id).await;
    audit_log(state.pool(), &session.user_id, org.as_ref().map(|o| o.id.as_str()),
        "password_change", "user", Some(&session.user_id), Some(json!({"self": true}))).await;

    Ok(Json(json!({"ok": true})))
}
