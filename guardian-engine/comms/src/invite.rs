//! Invite token system for external participant access.
//!
//! CSAR survivors, QRF clients, and limited-access federation contacts
//! authenticate via one-time or time-limited tokens that grant access
//! to a specific channel at a specific clearance level.

use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;

use crate::types::Clearance;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteToken {
    pub id: String,
    #[sqlx(rename = "channelId")]
    pub channel_id: String,
    pub token: String,
    pub clearance: String,
    pub handle: Option<String>,
    #[sqlx(rename = "maxUses")]
    pub max_uses: i32,
    #[sqlx(rename = "useCount")]
    pub use_count: i32,
    #[sqlx(rename = "expiresAt")]
    pub expires_at: DateTime<Utc>,
    #[sqlx(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

fn generate_token() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 24];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Create a new invite token for a channel.
pub async fn create_invite(
    pool: &PgPool,
    channel_id: &str,
    clearance: Clearance,
    handle: Option<&str>,
    ttl_hours: i64,
    max_uses: i32,
) -> Result<InviteToken, sqlx::Error> {
    let id = cuid2::create_id();
    let token = generate_token();
    let clearance_str = serde_json::to_value(&clearance)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();
    let expires_at = Utc::now() + Duration::hours(ttl_hours);

    let row = sqlx::query_as::<_, InviteToken>(
        r#"INSERT INTO "ChatInviteToken" (id, "channelId", token, clearance, handle, "maxUses", "useCount", "expiresAt", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, 0, $7, NOW())
           RETURNING *"#,
    )
    .bind(&id)
    .bind(channel_id)
    .bind(&token)
    .bind(&clearance_str)
    .bind(handle)
    .bind(max_uses)
    .bind(expires_at)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

/// Validate and consume an invite token. Returns the token record if valid.
pub async fn redeem_invite(
    pool: &PgPool,
    token: &str,
) -> Result<Option<InviteToken>, sqlx::Error> {
    let row = sqlx::query_as::<_, InviteToken>(
        r#"UPDATE "ChatInviteToken"
           SET "useCount" = "useCount" + 1
           WHERE token = $1
             AND "expiresAt" > NOW()
             AND "useCount" < "maxUses"
           RETURNING *"#,
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

/// List active invite tokens for a channel.
pub async fn list_invites(
    pool: &PgPool,
    channel_id: &str,
) -> Result<Vec<InviteToken>, sqlx::Error> {
    sqlx::query_as::<_, InviteToken>(
        r#"SELECT * FROM "ChatInviteToken"
           WHERE "channelId" = $1 AND "expiresAt" > NOW()
           ORDER BY "createdAt" DESC"#,
    )
    .bind(channel_id)
    .fetch_all(pool)
    .await
}

/// Revoke an invite token (set expiry to now).
pub async fn revoke_invite(pool: &PgPool, token_id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"UPDATE "ChatInviteToken" SET "expiresAt" = NOW() WHERE id = $1"#,
    )
    .bind(token_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}
