use sqlx::postgres::{PgPool, PgPoolOptions};
use tracing::info;

pub async fn connect(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;

    // Verify connectivity
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await?;

    info!("database pool established");
    Ok(pool)
}
