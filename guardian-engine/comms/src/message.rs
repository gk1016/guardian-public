//! Message persistence — send, retrieve, encrypt/decrypt at rest.

use sqlx::PgPool;
use tracing::info;

use crate::access;
use crate::crypto;
use crate::types::{MessageRow, SendMessageRequest};

/// Send a message to a channel. Encrypts content at rest if channel is encrypted.
pub async fn send_message(
    pool: &PgPool,
    channel_id: &str,
    channel_encrypted: bool,
    req: &SendMessageRequest,
) -> Result<MessageRow, sqlx::Error> {
    let id = cuid2::create_id();

    let sender_type_str = serde_json::to_value(&req.sender_type)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();
    let message_type_str = serde_json::to_value(&req.message_type)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();
    let classification_str = serde_json::to_value(&req.classification)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();

    let (stored_content, is_encrypted) = if channel_encrypted {
        match crypto::get_channel_key(pool, channel_id).await {
            Ok(key) => match crypto::encrypt(&key, &req.content) {
                Ok(ciphertext) => (ciphertext, true),
                Err(e) => {
                    tracing::warn!(error = %e, "encryption failed, storing plaintext");
                    (req.content.clone(), false)
                }
            },
            Err(e) => {
                tracing::warn!(error = %e, "no encryption key, storing plaintext");
                (req.content.clone(), false)
            }
        }
    } else {
        (req.content.clone(), false)
    };

    let row = sqlx::query_as::<_, MessageRow>(
        r#"INSERT INTO "ChatMessage" (id, "channelId", "senderId", "senderHandle", "senderType", content, "messageType", classification, encrypted, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           RETURNING *"#,
    )
    .bind(&id)
    .bind(channel_id)
    .bind(&req.sender_id)
    .bind(&req.sender_handle)
    .bind(&sender_type_str)
    .bind(&stored_content)
    .bind(&message_type_str)
    .bind(&classification_str)
    .bind(is_encrypted)
    .fetch_one(pool)
    .await?;

    info!(
        message_id = %id,
        channel_id = %channel_id,
        sender = %req.sender_handle,
        classification = %classification_str,
        encrypted = is_encrypted,
        "message sent"
    );

    Ok(row)
}

/// Retrieve message history with cursor-based pagination.
pub async fn get_history(
    pool: &PgPool,
    channel_id: &str,
    channel_encrypted: bool,
    viewer_clearance: &str,
    cursor: Option<&str>,
    limit: i64,
) -> Result<Vec<MessageRow>, sqlx::Error> {
    let clearance = access::parse_clearance(viewer_clearance);

    let class_filter = match clearance {
        crate::types::Clearance::Full => "1=1",
        crate::types::Clearance::Tactical => "classification IN ('unclass', 'restricted')",
        crate::types::Clearance::Customer => "classification = 'unclass'",
    };

    let rows = if let Some(cursor_id) = cursor {
        let sql = format!(
            r#"SELECT * FROM "ChatMessage"
               WHERE "channelId" = $1
                 AND "createdAt" < (SELECT "createdAt" FROM "ChatMessage" WHERE id = $2)
                 AND ({})
               ORDER BY "createdAt" DESC
               LIMIT $3"#,
            class_filter
        );
        sqlx::query_as::<_, MessageRow>(&sql)
            .bind(channel_id)
            .bind(cursor_id)
            .bind(limit)
            .fetch_all(pool)
            .await?
    } else {
        let sql = format!(
            r#"SELECT * FROM "ChatMessage"
               WHERE "channelId" = $1 AND ({})
               ORDER BY "createdAt" DESC
               LIMIT $2"#,
            class_filter
        );
        sqlx::query_as::<_, MessageRow>(&sql)
            .bind(channel_id)
            .bind(limit)
            .fetch_all(pool)
            .await?
    };

    if channel_encrypted {
        if let Ok(key) = crypto::get_channel_key(pool, channel_id).await {
            let mut decrypted_rows = rows;
            for row in &mut decrypted_rows {
                if row.encrypted {
                    if let Ok(plaintext) = crypto::decrypt(&key, &row.content) {
                        row.content = plaintext;
                    }
                }
            }
            return Ok(decrypted_rows);
        }
    }

    Ok(rows)
}

/// Send a system message (e.g., "Rescue operator assigned", "Channel created").
pub async fn send_system_message(
    pool: &PgPool,
    channel_id: &str,
    content: &str,
) -> Result<MessageRow, sqlx::Error> {
    send_message(
        pool,
        channel_id,
        false,
        &SendMessageRequest {
            sender_id: None,
            sender_handle: "SYSTEM".to_string(),
            sender_type: crate::types::SenderType::System,
            content: content.to_string(),
            message_type: crate::types::MessageType::System,
            classification: crate::types::Classification::Unclass,
        },
    )
    .await
}

/// Count unread messages for a user in a channel.
pub async fn unread_count(
    pool: &PgPool,
    channel_id: &str,
    user_id: &str,
) -> Result<i64, sqlx::Error> {
    let count: Option<i64> = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "ChatMessage" m
           INNER JOIN "ChatParticipant" p ON p."channelId" = m."channelId" AND p."userId" = $2
           WHERE m."channelId" = $1
             AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")"#,
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(count.unwrap_or(0))
}
