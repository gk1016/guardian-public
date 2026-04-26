use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::info;

use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/setup", post(setup))
}

#[derive(Deserialize)]
struct SetupBody {
    #[serde(rename = "orgName")]
    org_name: String,
    #[serde(rename = "orgTag")]
    org_tag: String,
    #[serde(rename = "orgDescription")]
    org_description: Option<String>,
    email: String,
    handle: String,
    #[serde(rename = "displayName")]
    display_name: String,
    password: String,
}

async fn setup(
    State(state): State<AppState>,
    Json(body): Json<SetupBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool();

    // Guard: only works when no organization exists
    let org_count: i64 = sqlx::query_scalar(r#"SELECT COUNT(*) FROM "Organization""#)
        .fetch_one(pool).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    if org_count > 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Setup has already been completed."}))));
    }

    // Validate
    let tag = body.org_tag.trim().to_uppercase();
    if tag.len() < 2 || tag.len() > 10 || !tag.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Tag must be 2-10 uppercase alphanumeric characters."}))));
    }

    let handle = body.handle.trim().to_uppercase();
    if handle.len() < 2 || handle.len() > 30 || !handle.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Handle must be 2-30 characters (letters, numbers, underscores)."}))));
    }

    if body.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Password must be at least 8 characters."}))));
    }

    let email = body.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "A valid email is required."}))));
    }

    let display_name = body.display_name.trim().to_string();
    if display_name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Display name is required."}))));
    }

    let org_name = body.org_name.trim().to_string();
    if org_name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Organization name is required."}))));
    }

    // Check duplicates
    let dup: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM "User" WHERE LOWER(email) = $1 OR UPPER(handle) = $2"#,
    ).bind(&email).bind(&handle).fetch_optional(pool).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?;

    if dup.is_some() {
        return Err((StatusCode::CONFLICT, Json(json!({"error": "A user with that email or handle already exists."}))));
    }

    // Hash password
    let pw = body.password.clone();
    let password_hash = tokio::task::spawn_blocking(move || bcrypt::hash(pw, 12))
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Internal error."}))))?
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to hash password."}))))?;

    // Transaction
    let org_id = cuid2::create_id();
    let user_id = cuid2::create_id();
    let member_id = cuid2::create_id();
    let org_desc = body.org_description.as_deref().unwrap_or("");

    let mut tx = pool.begin().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Transaction failed."}))))?;

    sqlx::query(
        r#"INSERT INTO "Organization" (id, name, tag, description, "isPublic", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())"#,
    ).bind(&org_id).bind(&org_name).bind(&tag).bind(org_desc)
    .execute(&mut *tx).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create organization."}))))?;

    sqlx::query(
        r#"INSERT INTO "User" (id, email, handle, "displayName", "passwordHash", role, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'commander', 'active', NOW(), NOW())"#,
    ).bind(&user_id).bind(&email).bind(&handle).bind(&display_name).bind(&password_hash)
    .execute(&mut *tx).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create user."}))))?;

    sqlx::query(
        r#"INSERT INTO "OrgMember" (id, "userId", "orgId", rank, title, "joinedAt")
           VALUES ($1, $2, $3, 'commander', 'Organization Commander', NOW())"#,
    ).bind(&member_id).bind(&user_id).bind(&org_id)
    .execute(&mut *tx).await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create membership."}))))?;

    tx.commit().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Setup failed."}))))?;

    info!(org = %org_name, tag = %tag, handle = %handle, "first-run setup completed");

    Ok(Json(json!({"ok": true, "message": "Organization created. You can now sign in."})))
}
