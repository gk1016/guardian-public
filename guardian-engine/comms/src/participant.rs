//! Participant management — join, leave, clearance control.

use sqlx::PgPool;
use tracing::info;

use crate::types::{Clearance, ParticipantRole, ParticipantRow};

/// Add a participant to a channel.
pub async fn add_participant(
    pool: &PgPool,
    channel_id: &str,
    user_id: Option<&str>,
    handle: &str,
    clearance: Clearance,
    role: ParticipantRole,
) -> Result<ParticipantRow, sqlx::Error> {
    let id = cuid2::create_id();
    let clearance_str = serde_json::to_value(&clearance)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();
    let role_str = serde_json::to_value(&role)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();

    let row = sqlx::query_as::<_, ParticipantRow>(
        r#"INSERT INTO "ChatParticipant" (id, "channelId", "userId", handle, clearance, role, "joinedAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT ("channelId", "userId") WHERE "userId" IS NOT NULL
           DO UPDATE SET clearance = EXCLUDED.clearance, role = EXCLUDED.role
           RETURNING *"#,
    )
    .bind(&id)
    .bind(channel_id)
    .bind(user_id)
    .bind(handle)
    .bind(&clearance_str)
    .bind(&role_str)
    .fetch_one(pool)
    .await?;

    info!(
        channel_id = %channel_id,
        handle = %handle,
        clearance = %clearance_str,
        "participant added"
    );

    Ok(row)
}

/// Remove a participant from a channel.
pub async fn remove_participant(
    pool: &PgPool,
    channel_id: &str,
    user_id: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"DELETE FROM "ChatParticipant" WHERE "channelId" = $1 AND "userId" = $2"#,
    )
    .bind(channel_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Get a specific participant's record (for clearance checks).
pub async fn get_participant(
    pool: &PgPool,
    channel_id: &str,
    user_id: &str,
) -> Result<Option<ParticipantRow>, sqlx::Error> {
    sqlx::query_as::<_, ParticipantRow>(
        r#"SELECT * FROM "ChatParticipant"
           WHERE "channelId" = $1 AND "userId" = $2"#,
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

/// List all participants in a channel, filtered by viewer's clearance.
pub async fn list_participants(
    pool: &PgPool,
    channel_id: &str,
    viewer_clearance: Clearance,
) -> Result<Vec<ParticipantRow>, sqlx::Error> {
    let filter = match viewer_clearance {
        Clearance::Full => "1=1",
        Clearance::Tactical => "clearance != 'customer'",
        Clearance::Customer => "clearance = 'full'",
    };

    let sql = format!(
        r#"SELECT * FROM "ChatParticipant"
           WHERE "channelId" = $1 AND ({})
           ORDER BY "joinedAt" ASC"#,
        filter
    );

    sqlx::query_as::<_, ParticipantRow>(&sql)
        .bind(channel_id)
        .fetch_all(pool)
        .await
}

/// Update a participant's clearance level.
pub async fn update_clearance(
    pool: &PgPool,
    channel_id: &str,
    user_id: &str,
    clearance: Clearance,
) -> Result<bool, sqlx::Error> {
    let clearance_str = serde_json::to_value(&clearance)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();

    let result = sqlx::query(
        r#"UPDATE "ChatParticipant" SET clearance = $1
           WHERE "channelId" = $2 AND "userId" = $3"#,
    )
    .bind(&clearance_str)
    .bind(channel_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Mark messages as read up to current time.
pub async fn mark_read(
    pool: &PgPool,
    channel_id: &str,
    user_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE "ChatParticipant" SET "lastReadAt" = NOW()
           WHERE "channelId" = $1 AND "userId" = $2"#,
    )
    .bind(channel_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}
