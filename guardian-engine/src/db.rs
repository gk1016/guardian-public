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

/// Run embedded sqlx migrations.
/// On existing databases (Prisma-managed), the baseline migration is idempotent.
/// On fresh databases, it creates the full schema.
pub async fn run_migrations(pool: &PgPool) -> anyhow::Result<()> {
    info!("running database migrations");
    sqlx::migrate!("./migrations")
        .run(pool)
        .await?;
    info!("database migrations complete");
    Ok(())
}
