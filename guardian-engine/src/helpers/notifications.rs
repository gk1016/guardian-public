use sqlx::PgPool;

/// Fire-and-forget notification creator.
pub async fn create_notification(
    pool: &PgPool,
    org_id: &str,
    created_by_id: Option<&str>,
    category: &str,
    severity: &str,
    title: &str,
    body: &str,
    href: Option<&str>,
) {
    let id = cuid2::create_id();
    let _ = sqlx::query(
        r#"INSERT INTO "Notification" (id, "orgId", "createdById", category, severity, title, body, href, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unread', NOW(), NOW())"#
    )
    .bind(&id)
    .bind(org_id)
    .bind(created_by_id)
    .bind(category)
    .bind(severity)
    .bind(title)
    .bind(body)
    .bind(href)
    .execute(pool)
    .await;
}
