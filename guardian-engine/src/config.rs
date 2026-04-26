use std::net::SocketAddr;
use std::path::PathBuf;

/// TLS mode for the edge HTTPS listener.
#[derive(Debug, Clone)]
pub enum TlsMode {
    /// Generate a self-signed certificate (default)
    SelfSigned,
    /// Load cert.pem and key.pem from cert_dir
    Manual,
    /// Automatic certificate via ACME (Let's Encrypt)
    Acme {
        contact_email: String,
        production: bool,
    },
    /// No TLS — plain HTTP only (development)
    None,
}

#[derive(Debug, Clone)]
pub struct Config {
    /// Address to bind the internal HTTP server (health checks, inter-container)
    pub listen_addr: SocketAddr,

    /// Address to bind the HTTPS edge listener
    pub https_listen_addr: SocketAddr,

    /// Address to bind the HTTP redirect listener
    pub http_listen_addr: SocketAddr,

    /// TLS mode
    pub tls_mode: TlsMode,

    /// Domain name for TLS certificate generation and CORS.
    /// May include port (e.g. "guardian.tacops.io:3411").
    pub site_domain: String,

    /// Upstream frontend address (e.g. "guardian:3000").
    /// None = no proxy, engine serves everything (Phase 5+).
    pub upstream_frontend: Option<String>,

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

    /// Directory for TLS certificate storage (federation + edge certs)
    pub cert_dir: PathBuf,

    /// Trusted peer certificate fingerprints (SHA-256 hex).
    /// If empty, trust-on-first-use mode is used.
    pub federation_trusted_fingerprints: Vec<String>,

    /// Secret key for JWT signing/verification (shared with Next.js AUTH_SECRET)
    pub auth_secret: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let listen_port: u16 = std::env::var("ENGINE_PORT")
            .unwrap_or_else(|_| "3420".into())
            .parse()?;

        let https_port: u16 = std::env::var("HTTPS_PORT")
            .unwrap_or_else(|_| "443".into())
            .parse()?;

        let http_port: u16 = std::env::var("HTTP_PORT")
            .unwrap_or_else(|_| "80".into())
            .parse()?;

        let tls_mode = match std::env::var("TLS_MODE")
            .unwrap_or_else(|_| "self-signed".into())
            .to_lowercase()
            .as_str()
        {
            "manual" | "custom" => TlsMode::Manual,
            "acme" | "letsencrypt" | "le" => {
                let contact_email = std::env::var("ACME_EMAIL")
                    .unwrap_or_else(|_| "admin@example.com".into());
                let production = std::env::var("ACME_PRODUCTION")
                    .unwrap_or_else(|_| "false".into())
                    .parse::<bool>()
                    .unwrap_or(false);
                TlsMode::Acme { contact_email, production }
            }
            "none" | "off" | "disabled" => TlsMode::None,
            _ => TlsMode::SelfSigned,
        };

        let site_domain = std::env::var("SITE_DOMAIN")
            .or_else(|_| std::env::var("SITE_ADDRESS"))
            .unwrap_or_else(|_| "localhost".into());

        let upstream_frontend = std::env::var("UPSTREAM_FRONTEND").ok()
            .filter(|s| !s.is_empty());

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
            https_listen_addr: SocketAddr::from(([0, 0, 0, 0], https_port)),
            http_listen_addr: SocketAddr::from(([0, 0, 0, 0], http_port)),
            tls_mode,
            site_domain,
            upstream_frontend,
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
