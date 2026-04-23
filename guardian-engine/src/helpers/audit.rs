use serde_json::Value;
use sqlx::PgPool;

/// Fire-and-forget audit log writer. Never panics.
pub async fn audit_log(
    pool: &PgPool,
    user_id: &str,
    org_id: Option<&str>,
    action: &str,
    target_type: &str,
    target_id: Option<&str>,
    metadata: Option<Value>,
) {
    let id = cuid2::create_id();
    let _ = sqlx::query(
        r#"INSERT INTO "AuditLog" (id, "userId", "orgId", action, "targetType", "targetId", metadata, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())"#
    )
    .bind(&id)
    .bind(user_id)
    .bind(org_id)
    .bind(action)
    .bind(target_type)
    .bind(target_id)
    .bind(metadata)
    .execute(pool)
    .await;
}
