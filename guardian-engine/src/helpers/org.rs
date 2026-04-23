use sqlx::PgPool;

#[derive(Debug, Clone)]
pub struct OrgInfo {
    pub id: String,
    pub name: String,
    pub tag: String,
}

/// Get the user's primary organization (first joined).
pub async fn get_org_for_user(pool: &PgPool, user_id: &str) -> Option<OrgInfo> {
    #[derive(sqlx::FromRow)]
    struct Row {
        id: String,
        name: String,
        tag: String,
    }

    sqlx::query_as::<_, Row>(
        r#"SELECT o.id, o.name, o.tag
           FROM "OrgMember" m JOIN "Organization" o ON m."orgId" = o.id
           WHERE m."userId" = $1 ORDER BY m."joinedAt" ASC LIMIT 1"#
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|r| OrgInfo { id: r.id, name: r.name, tag: r.tag })
}
