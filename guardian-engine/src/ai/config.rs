//! AI configuration — loaded from the AiConfig table (managed via admin UI).

use sqlx::{PgPool, Row};

#[derive(Debug, Clone)]
pub struct AiConfig {
    pub id: String,
    pub org_id: String,
    pub provider: String,      // anthropic, openai, google, ollama_cloud, ollama_local
    pub model: String,         // e.g. claude-sonnet-4-20250514, gpt-4o, gemini-2.0-flash, llama3.1:70b
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub max_tokens: i32,
    pub temperature: f64,
    pub enabled: bool,
    pub tick_interval_secs: i32,
}

/// Load the first (and typically only) AI config from the database.
/// Returns None if no config exists.
pub async fn load_from_db(pool: &PgPool) -> anyhow::Result<Option<AiConfig>> {
    let row = sqlx::query(
        r#"
        SELECT id, "orgId", provider, model, "apiKey", "baseUrl",
               "maxTokens", temperature, enabled, "tickIntervalSecs"
        FROM "AiConfig"
        LIMIT 1
        "#
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| AiConfig {
        id: r.get("id"),
        org_id: r.get("orgId"),
        provider: r.get("provider"),
        model: r.get("model"),
        api_key: r.get("apiKey"),
        base_url: r.get("baseUrl"),
        max_tokens: r.get("maxTokens"),
        temperature: r.get("temperature"),
        enabled: r.get("enabled"),
        tick_interval_secs: r.get("tickIntervalSecs"),
    }))
}

/// Save or update AI config via upsert.
pub async fn save_to_db(pool: &PgPool, cfg: &AiConfig) -> anyhow::Result<()> {
    let now = chrono::Utc::now().naive_utc();

    sqlx::query(
        r#"
        INSERT INTO "AiConfig" (id, "orgId", provider, model, "apiKey", "baseUrl",
                                "maxTokens", temperature, enabled, "tickIntervalSecs",
                                "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        ON CONFLICT (id) DO UPDATE SET
            provider = EXCLUDED.provider,
            model = EXCLUDED.model,
            "apiKey" = EXCLUDED."apiKey",
            "baseUrl" = EXCLUDED."baseUrl",
            "maxTokens" = EXCLUDED."maxTokens",
            temperature = EXCLUDED.temperature,
            enabled = EXCLUDED.enabled,
            "tickIntervalSecs" = EXCLUDED."tickIntervalSecs",
            "updatedAt" = EXCLUDED."updatedAt"
        "#
    )
    .bind(&cfg.id)
    .bind(&cfg.org_id)
    .bind(&cfg.provider)
    .bind(&cfg.model)
    .bind(&cfg.api_key)
    .bind(&cfg.base_url)
    .bind(cfg.max_tokens)
    .bind(cfg.temperature)
    .bind(cfg.enabled)
    .bind(cfg.tick_interval_secs)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(())
}
