//! Error observability (Sentry) for the guardian engine.
//!
//! Posture: Guardian handles no PHI, so backend reporting can be always-on. The
//! gate is the presence of `SENTRY_DSN`: any instance that sets it reports;
//! instances that do not (e.g. if you want a dark prod) stay silent.
//! `SENTRY_ENVIRONMENT` tags the environment (default "production").
//!
//! Crypto: we do NOT use the `sentry` crate's bundled HTTP transport (it would
//! pull a second TLS/crypto stack). Instead a custom transport reuses a
//! `reqwest` client built like the rest of the service (rustls-tls / ring) — no
//! new crypto surface.

use std::sync::Arc;

use sentry::types::Dsn;
use sentry::{ClientInitGuard, ClientOptions, Envelope, Transport, TransportFactory};

struct ReqwestTransport {
    client: reqwest::Client,
    dsn: Dsn,
    rt: tokio::runtime::Handle,
    user_agent: String,
}

impl Transport for ReqwestTransport {
    fn send_envelope(&self, envelope: Envelope) {
        let mut body: Vec<u8> = Vec::new();
        if envelope.to_writer(&mut body).is_err() {
            return;
        }
        let url = self.dsn.envelope_api_url().to_string();
        let auth = self.dsn.to_auth(Some(&self.user_agent)).to_string();
        let client = self.client.clone();
        self.rt.spawn(async move {
            let _ = client
                .post(url)
                .header("X-Sentry-Auth", auth)
                .header("Content-Type", "application/x-sentry-envelope")
                .body(body)
                .send()
                .await;
        });
    }
}

struct ReqwestTransportFactory {
    rt: tokio::runtime::Handle,
    user_agent: String,
}

impl TransportFactory for ReqwestTransportFactory {
    fn create_transport(&self, options: &ClientOptions) -> Arc<dyn Transport> {
        let dsn = options.dsn.clone().expect("sentry initialized without a DSN");
        Arc::new(ReqwestTransport {
            client: reqwest::Client::new(),
            dsn,
            rt: self.rt.clone(),
            user_agent: self.user_agent.clone(),
        })
    }
}

/// Initialize Sentry. Returns `None` (no-op) unless `SENTRY_DSN` is set. Hold the
/// guard for the process lifetime. Must be called from within the tokio runtime.
pub fn init_sentry() -> Option<ClientInitGuard> {
    let dsn: Dsn = std::env::var("SENTRY_DSN").ok()?.parse().ok()?;

    let environment = std::env::var("SENTRY_ENVIRONMENT").unwrap_or_else(|_| "production".into());
    let user_agent = concat!("guardian-engine/", env!("CARGO_PKG_VERSION")).to_string();
    let factory = ReqwestTransportFactory {
        rt: tokio::runtime::Handle::current(),
        user_agent,
    };

    let guard = sentry::init(ClientOptions {
        dsn: Some(dsn),
        environment: Some(environment.into()),
        send_default_pii: false,
        transport: Some(Arc::new(factory)),
        ..Default::default()
    });
    tracing::info!("Sentry error reporting enabled");
    Some(guard)
}
