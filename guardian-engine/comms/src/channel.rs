//! Channel lifecycle — create, query, hierarchy.

use sqlx::PgPool;
use tracing::info;

use crate::crypto;
use crate::types::{ChannelRow, CreateChannelRequest};

/// Create a new chat channel. If `encrypted` is true, generates and stores an AES key.
pub async fn create_channel(
    pool: &PgPool,
    req: &CreateChannelRequest,
) -> Result<ChannelRow, sqlx::Error> {
    let id = cuid2::create_id();

    let channel_type = serde_json::to_value(&req.channel_type)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();
    let scope = serde_json::to_value(&req.scope)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();
    let ref_type = req.ref_type.map(|r| {
        serde_json::to_value(&r)
            .unwrap()
            .as_str()
            .unwrap()
            .to_string()
    });

    let row = sqlx::query_as::<_, ChannelRow>(
        r#"INSERT INTO "ChatChannel" (id, "orgId", "channelType", scope, "refType", "refId", name, encrypted, "parentChannelId", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           RETURNING *"#,
    )
    .bind(&id)
    .bind(&req.org_id)
    .bind(&channel_type)
    .bind(&scope)
    .bind(&ref_type)
    .bind(&req.ref_id)
    .bind(&req.name)
    .bind(req.encrypted)
    .bind(&req.parent_channel_id)
    .fetch_one(pool)
    .await?;

    // Generate encryption key if channel is encrypted
    if req.encrypted {
        if let Err(e) = crypto::store_channel_key(pool, &id).await {
            tracing::error!(channel_id = %id, error = %e, "failed to store encryption key");
        }
    }

    info!(
        channel_id = %id,
        channel_type = %channel_type,
        scope = %scope,
        name = %req.name,
        encrypted = req.encrypted,
        "channel created"
    );

    Ok(row)
}

/// Get a channel by ID.
pub async fn get_channel(pool: &PgPool, channel_id: &str) -> Result<Option<ChannelRow>, sqlx::Error> {
    sqlx::query_as::<_, ChannelRow>(
        r#"SELECT * FROM "ChatChannel" WHERE id = $1"#,
    )
    .bind(channel_id)
    .fetch_optional(pool)
    .await
}

/// Get channel by reference (e.g., find the CSAR channel for rescue request X).
pub async fn get_channel_by_ref(
    pool: &PgPool,
    org_id: &str,
    ref_type: &str,
    ref_id: &str,
) -> Result<Option<ChannelRow>, sqlx::Error> {
    sqlx::query_as::<_, ChannelRow>(
        r#"SELECT * FROM "ChatChannel"
           WHERE "orgId" = $1 AND "refType" = $2 AND "refId" = $3
           ORDER BY "createdAt" DESC LIMIT 1"#,
    )
    .bind(org_id)
    .bind(ref_type)
    .bind(ref_id)
    .fetch_optional(pool)
    .await
}

/// List channels a user participates in.
pub async fn list_user_channels(
    pool: &PgPool,
    user_id: &str,
    org_id: &str,
) -> Result<Vec<ChannelRow>, sqlx::Error> {
    sqlx::query_as::<_, ChannelRow>(
        r#"SELECT c.* FROM "ChatChannel" c
           INNER JOIN "ChatParticipant" p ON p."channelId" = c.id
           WHERE p."userId" = $1 AND c."orgId" = $2
           ORDER BY c."createdAt" DESC"#,
    )
    .bind(user_id)
    .bind(org_id)
    .fetch_all(pool)
    .await
}

/// List child channels (teams within a group).
pub async fn list_children(
    pool: &PgPool,
    parent_channel_id: &str,
) -> Result<Vec<ChannelRow>, sqlx::Error> {
    sqlx::query_as::<_, ChannelRow>(
        r#"SELECT * FROM "ChatChannel"
           WHERE "parentChannelId" = $1
           ORDER BY "createdAt" ASC"#,
    )
    .bind(parent_channel_id)
    .fetch_all(pool)
    .await
}

/// Delete a channel and all its messages/participants (cascade handled by FK).
pub async fn delete_channel(pool: &PgPool, channel_id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(r#"DELETE FROM "ChatChannel" WHERE id = $1"#)
        .bind(channel_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
