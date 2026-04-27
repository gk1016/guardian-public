use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::CookieJar;
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::{info, warn};

use crate::auth::{jwt, password, totp};
use crate::auth::middleware::AuthSession;
use crate::helpers::audit::audit_log;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/auth/me", get(me))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/totp/setup", post(totp_setup))
        .route("/api/auth/totp/verify", post(totp_verify))
        .route("/api/auth/totp/validate", post(totp_validate))
        .route("/api/auth/totp/disable", post(totp_disable))
}

// ── Session info (SPA bootstrap) ───────────────────────────────────────────

async fn me(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Json<Value> {
    let org = get_org_for_user(state.pool(), &session.user_id).await;

    Json(json!({
        "userId": session.user_id,
        "email": session.email,
        "handle": session.handle,
        "role": session.role,
        "displayName": session.display_name,
        "status": session.status,
        "orgId": session.org_id,
        "orgTag": session.org_tag,
        "orgName": org.map(|o| o.name),
    }))
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

async fn login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(body): Json<LoginRequest>,
) -> Result<(CookieJar, Json<Value>), (StatusCode, Json<Value>)> {
    let ip = "unknown";
    if state.rate_limiter().check(ip) {
        warn!(ip = ip, "Login rate limited");
        return Err((StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many login attempts. Try again later."}))));
    }

    let email = body.email.to_lowercase();
    if email.is_empty() || body.password.is_empty() || body.password.len() > 128 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid email or password format."}))));
    }

    let user = sqlx::query_as::<_, UserRow>(
        r#"SELECT id, email, handle, "displayName", "passwordHash", role, status,
                  "totpSecret", "totpEnabled"
           FROM "User" WHERE email = $1"#
    )
    .bind(&email)
    .fetch_optional(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "DB error during login");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to sign in."})))
    })?
    .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid credentials."}))))?;

    let hash = user.password_hash
        .as_deref()
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid credentials."}))))?;

    let hash_owned = hash.to_string();
    let pass_owned = body.password.clone();
    let valid = tokio::task::spawn_blocking(move || {
        password::verify_password(&pass_owned, &hash_owned)
    })
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to sign in."}))))?;

    let valid = valid.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to sign in."}))))?;

    if !valid || user.status != "active" {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid credentials."}))));
    }

    // TOTP challenge
    if user.totp_enabled && user.totp_secret.is_some() {
        let totp_token = jwt::sign_totp_challenge(&user.id, state.auth_secret())
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to sign in."}))))?;

        info!(handle = %user.handle, "TOTP challenge issued");

        return Ok((jar, Json(json!({
            "ok": true,
            "requiresTotp": true,
            "totpToken": totp_token,
        }))));
    }

    let membership = sqlx::query_as::<_, OrgMembershipRow>(
        r#"SELECT o.id as org_id, o.tag as org_tag
           FROM "OrgMember" m JOIN "Organization" o ON m."orgId" = o.id
           WHERE m."userId" = $1 ORDER BY m."joinedAt" ASC LIMIT 1"#
    )
    .bind(&user.id)
    .fetch_optional(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "DB error fetching membership");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to sign in."})))
    })?;

    let claims = jwt::new_session_claims(
        &user.id, &user.email, &user.handle, &user.role,
        user.display_name.as_deref(), &user.status,
        membership.as_ref().map(|m| m.org_id.as_str()),
        membership.as_ref().map(|m| m.org_tag.as_str()),
    );

    let token = jwt::sign_session(&claims, state.auth_secret())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to sign in."}))))?;

    audit_log(state.pool(), &user.id, membership.as_ref().map(|m| m.org_id.as_str()), "login", "session", None, Some(json!({"handle": user.handle}))).await;

    info!(handle = %user.handle, "Login successful");

    let jar = jar.add(session_cookie(token));

    Ok((jar, Json(json!({
        "ok": true,
        "redirectTo": "/command",
        "user": {
            "handle": user.handle,
            "role": user.role,
            "displayName": user.display_name,
        }
    }))))
}

async fn logout(jar: CookieJar) -> (CookieJar, Json<Value>) {
    let jar = jar.remove(axum_extra::extract::cookie::Cookie::build("guardian_session").path("/"));
    (jar, Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct TotpCodeRequest {
    code: String,
}

async fn totp_setup(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user = sqlx::query_as::<_, TotpUserRow>(
        r#"SELECT id, email, "totpEnabled" FROM "User" WHERE id = $1"#
    ).bind(&session.user_id).fetch_one(state.pool()).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "User not found."}))))?;

    if user.totp_enabled {
        return Err((StatusCode::CONFLICT, Json(json!({"error": "TOTP is already enabled. Disable it first to reconfigure."}))));
    }

    let secret = totp::generate_secret();
    let uri = totp::totp_uri(&secret, &user.email, "Guardian");

    sqlx::query(r#"UPDATE "User" SET "totpSecret" = $1, "totpEnabled" = false WHERE id = $2"#)
        .bind(&secret).bind(&session.user_id)
        .execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save TOTP secret."}))))?;

    audit_log(state.pool(), &session.user_id, session.org_id.as_deref(), "totp_setup_started", "user", Some(&session.user_id), None).await;

    Ok(Json(json!({"ok": true, "secret": secret, "uri": uri})))
}

async fn totp_verify(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<TotpCodeRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.code.len() != 6 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid code format."}))));
    }

    let user = sqlx::query_as::<_, TotpSecretRow>(
        r#"SELECT "totpSecret", "totpEnabled" FROM "User" WHERE id = $1"#
    ).bind(&session.user_id).fetch_one(state.pool()).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "User not found."}))))?;

    let secret = user.totp_secret
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "TOTP setup not started."}))))?;

    if user.totp_enabled {
        return Err((StatusCode::CONFLICT, Json(json!({"error": "TOTP is already enabled."}))));
    }

    if !totp::verify_totp(&secret, &body.code) {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid TOTP code."}))));
    }

    sqlx::query(r#"UPDATE "User" SET "totpEnabled" = true WHERE id = $1"#)
        .bind(&session.user_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to enable TOTP."}))))?;

    audit_log(state.pool(), &session.user_id, session.org_id.as_deref(), "totp_enabled", "user", Some(&session.user_id), None).await;

    Ok(Json(json!({"ok": true, "message": "TOTP enabled successfully."})))
}

#[derive(Deserialize)]
struct TotpValidateRequest {
    #[serde(rename = "totpToken")]
    totp_token: String,
    code: String,
}

async fn totp_validate(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(body): Json<TotpValidateRequest>,
) -> Result<(CookieJar, Json<Value>), (StatusCode, Json<Value>)> {
    if body.code.len() != 6 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid request."}))));
    }

    let challenge = jwt::verify_totp_challenge(&body.totp_token, state.auth_secret())
        .map_err(|_| (StatusCode::UNAUTHORIZED, Json(json!({"error": "TOTP token expired or invalid."}))))?;

    let user = sqlx::query_as::<_, UserRow>(
        r#"SELECT id, email, handle, "displayName", "passwordHash", role, status,
                  "totpSecret", "totpEnabled"
           FROM "User" WHERE id = $1"#
    ).bind(&challenge.sub).fetch_one(state.pool()).await
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(json!({"error": "User not found."}))))?;

    let secret = user.totp_secret
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "TOTP not configured."}))))?;

    if !user.totp_enabled {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "TOTP not configured."}))));
    }

    if !totp::verify_totp(&secret, &body.code) {
        warn!(handle = %user.handle, "TOTP validation failed");
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid TOTP code."}))));
    }

    let membership = sqlx::query_as::<_, OrgMembershipRow>(
        r#"SELECT o.id as org_id, o.tag as org_tag
           FROM "OrgMember" m JOIN "Organization" o ON m."orgId" = o.id
           WHERE m."userId" = $1 ORDER BY m."joinedAt" ASC LIMIT 1"#
    ).bind(&user.id).fetch_optional(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to sign in."}))))?;

    let claims = jwt::new_session_claims(
        &user.id, &user.email, &user.handle, &user.role,
        user.display_name.as_deref(), &user.status,
        membership.as_ref().map(|m| m.org_id.as_str()),
        membership.as_ref().map(|m| m.org_tag.as_str()),
    );

    let token = jwt::sign_session(&claims, state.auth_secret())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to sign in."}))))?;

    audit_log(state.pool(), &user.id, membership.as_ref().map(|m| m.org_id.as_str()), "login_totp", "session", None, Some(json!({"handle": user.handle}))).await;

    info!(handle = %user.handle, "TOTP login completed");

    let jar = jar.add(session_cookie(token));

    Ok((jar, Json(json!({
        "ok": true,
        "redirectTo": "/command",
        "user": {
            "handle": user.handle,
            "role": user.role,
            "displayName": user.display_name,
        }
    }))))
}

#[derive(Deserialize)]
struct TotpDisableRequest {
    password: String,
}

async fn totp_disable(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<TotpDisableRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user = sqlx::query_as::<_, PasswordRow>(
        r#"SELECT "passwordHash", "totpEnabled" FROM "User" WHERE id = $1"#
    ).bind(&session.user_id).fetch_one(state.pool()).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "User not found."}))))?;

    if !user.totp_enabled {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "TOTP is not enabled."}))));
    }

    let hash = user.password_hash
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "User not found."}))))?;

    let pass = body.password.clone();
    let valid = tokio::task::spawn_blocking(move || password::verify_password(&pass, &hash))
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Verification failed."}))))?;

    let valid = valid.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Verification failed."}))))?;

    if !valid {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid password."}))));
    }

    sqlx::query(r#"UPDATE "User" SET "totpSecret" = NULL, "totpEnabled" = false WHERE id = $1"#)
        .bind(&session.user_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to disable TOTP."}))))?;

    audit_log(state.pool(), &session.user_id, session.org_id.as_deref(), "totp_disabled", "user", Some(&session.user_id), None).await;

    Ok(Json(json!({"ok": true, "message": "TOTP disabled."})))
}

// --- Helper types ---

#[derive(sqlx::FromRow)]
struct UserRow {
    id: String,
    email: String,
    handle: String,
    #[sqlx(rename = "displayName")]
    display_name: Option<String>,
    #[sqlx(rename = "passwordHash")]
    password_hash: Option<String>,
    role: String,
    status: String,
    #[sqlx(rename = "totpSecret")]
    totp_secret: Option<String>,
    #[sqlx(rename = "totpEnabled")]
    totp_enabled: bool,
}

#[derive(sqlx::FromRow)]
struct OrgMembershipRow {
    org_id: String,
    org_tag: String,
}

#[derive(sqlx::FromRow)]
struct TotpUserRow {
    id: String,
    email: String,
    #[sqlx(rename = "totpEnabled")]
    totp_enabled: bool,
}

#[derive(sqlx::FromRow)]
struct TotpSecretRow {
    #[sqlx(rename = "totpSecret")]
    totp_secret: Option<String>,
    #[sqlx(rename = "totpEnabled")]
    totp_enabled: bool,
}

#[derive(sqlx::FromRow)]
struct PasswordRow {
    #[sqlx(rename = "passwordHash")]
    password_hash: Option<String>,
    #[sqlx(rename = "totpEnabled")]
    totp_enabled: bool,
}

fn session_cookie(token: String) -> axum_extra::extract::cookie::Cookie<'static> {
    axum_extra::extract::cookie::Cookie::build(("guardian_session", token))
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/")
        .max_age(time::Duration::days(7))
        .build()
}
