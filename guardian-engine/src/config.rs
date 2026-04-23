use std::net::SocketAddr;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    /// Address to bind the HTTP/WS server
    pub listen_addr: SocketAddr,

    /// PostgreSQL connection string (same DB as Next.js app)
    pub database_url: String,

    /// Unique instance identifier for federation
    pub instance_id: String,

    /// Display name for this Guardian instance in the federation mesh
    pub instance_name: String,

    /// Port for federation peer connections (separate from API port)
    pub federation_port: u16,

    /// Comma-separated list of seed peer addresses (host:port)
    pub federation_seeds: Vec<String>,

    /// Shared secret for federation auth (pre-shared key, supplementary to TLS)
    pub federation_psk: Option<String>,

    /// Directory for TLS certificate storage
    pub cert_dir: PathBuf,

    /// Trusted peer certificate fingerprints (SHA-256 hex).
    /// If empty, trust-on-first-use mode is used (fingerprints logged).
    pub federation_trusted_fingerprints: Vec<String>,

    /// Secret key for JWT signing/verification (shared with Next.js AUTH_SECRET)
    pub auth_secret: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let listen_port: u16 = std::env::var("ENGINE_PORT")
            .unwrap_or_else(|_| "3420".into())
            .parse()?;

        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| {
                "postgresql://guardian:guardian_dev@localhost:5432/guardian".into()
            });

        let instance_id = std::env::var("GUARDIAN_INSTANCE_ID")
            .unwrap_or_else(|_| uuid::Uuid::new_v4().to_string());

        let instance_name = std::env::var("GUARDIAN_INSTANCE_NAME")
            .unwrap_or_else(|_| "guardian-default".into());

        let federation_port: u16 = std::env::var("FEDERATION_PORT")
            .unwrap_or_else(|_| "3421".into())
            .parse()?;

        let federation_seeds: Vec<String> = std::env::var("FEDERATION_SEEDS")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let federation_psk = std::env::var("FEDERATION_PSK").ok();

        let cert_dir = PathBuf::from(
            std::env::var("GUARDIAN_CERT_DIR")
                .unwrap_or_else(|_| "/data/guardian/certs".into())
        );

        let federation_trusted_fingerprints: Vec<String> =
            std::env::var("FEDERATION_TRUSTED_FINGERPRINTS")
                .unwrap_or_default()
                .split(',')
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty())
                .collect();

        let auth_secret = std::env::var("AUTH_SECRET")
            .unwrap_or_else(|_| "guardian-dev-secret-change-me".into());

        Ok(Self {
            listen_addr: SocketAddr::from(([0, 0, 0, 0], listen_port)),
            database_url,
            instance_id,
            instance_name,
            federation_port,
            federation_seeds,
            federation_psk,
            cert_dir,
            federation_trusted_fingerprints,
            auth_secret,
        })
    }
}
