use axum::{
    extract::FromRequestParts,
    http::request::Parts,
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::extract::CookieJar;
use serde_json::json;

use crate::state::AppState;
use super::jwt;
use super::session::Session;

const COOKIE_NAME: &str = "guardian_session";

/// Axum extractor that validates the session cookie and provides a Session.
/// Returns 401 JSON if the cookie is missing or invalid.
pub struct AuthSession(pub Session);

impl std::ops::Deref for AuthSession {
    type Target = Session;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<S> FromRequestParts<S> for AuthSession
where
    S: Send + Sync + AsRef<AppState>,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state: &AppState = state.as_ref();
        let jar = CookieJar::from_headers(&parts.headers);

        let token = jar
            .get(COOKIE_NAME)
            .map(|c| c.value().to_string())
            .ok_or_else(|| {
                (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Authentication required."}))).into_response()
            })?;

        let claims = jwt::verify_session(&token, app_state.auth_secret())
            .map_err(|_| {
                (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid or expired session."}))).into_response()
            })?;

        // Check session invalidation
        let invalidated_at: Option<chrono::NaiveDateTime> = sqlx::query_scalar(
            r#"SELECT "sessionsInvalidatedAt" FROM "User" WHERE id = $1"#
        )
        .bind(&claims.sub)
        .fetch_optional(app_state.pool())
        .await
        .map_err(|_| {
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Session check failed."}))).into_response()
        })?
        .flatten();

        if let Some(inv) = invalidated_at {
            if claims.iat <= inv.and_utc().timestamp() {
                return Err(
                    (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Session has been revoked."}))).into_response()
                );
            }
        }

        Ok(AuthSession(Session {
            user_id: claims.sub,
            email: claims.email,
            handle: claims.handle,
            role: claims.role,
            display_name: claims.display_name,
            status: claims.status,
            org_id: claims.org_id,
            org_tag: claims.org_tag,
            iat: claims.iat,
        }))
    }
}

// ── Mobile auth (Bearer token) ─────────────────────────────────────────────

/// Axum extractor for mobile API authentication.
/// Reads JWT from `Authorization: Bearer <token>` header instead of cookies.
/// Additionally verifies that the user account is still active.
pub struct MobileAuthSession(pub Session);

impl std::ops::Deref for MobileAuthSession {
    type Target = Session;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<S> FromRequestParts<S> for MobileAuthSession
where
    S: Send + Sync + AsRef<AppState>,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state: &AppState = state.as_ref();

        let token = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .map(|t| t.to_string())
            .ok_or_else(|| {
                (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Authentication required."}))).into_response()
            })?;

        let claims = jwt::verify_session(&token, app_state.auth_secret())
            .map_err(|_| {
                (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid or expired session."}))).into_response()
            })?;

        // Live DB check — verify user is still active and session not revoked
        let user: Option<MobileUserCheck> = sqlx::query_as(
            r#"SELECT status, "sessionsInvalidatedAt" FROM "User" WHERE id = $1"#,
        )
        .bind(&claims.sub)
        .fetch_optional(app_state.pool())
        .await
        .map_err(|_| {
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Session check failed."}))).into_response()
        })?;

        let user = user.ok_or_else(|| {
            (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Authentication required."}))).into_response()
        })?;

        if user.status != "active" {
            return Err(
                (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Account is not active."}))).into_response()
            );
        }

        if let Some(inv) = user.sessions_invalidated_at {
            if claims.iat <= inv.and_utc().timestamp() {
                return Err(
                    (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Session has been revoked."}))).into_response()
                );
            }
        }

        Ok(MobileAuthSession(Session {
            user_id: claims.sub,
            email: claims.email,
            handle: claims.handle,
            role: claims.role,
            display_name: claims.display_name,
            status: claims.status,
            org_id: claims.org_id,
            org_tag: claims.org_tag,
            iat: claims.iat,
        }))
    }
}

#[derive(sqlx::FromRow)]
struct MobileUserCheck {
    status: String,
    #[sqlx(rename = "sessionsInvalidatedAt")]
    sessions_invalidated_at: Option<chrono::NaiveDateTime>,
}
