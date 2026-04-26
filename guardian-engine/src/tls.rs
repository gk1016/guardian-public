//! Edge TLS — self-signed certificate generation, manual cert loading,
//! and ACME (Let's Encrypt) automatic certificate provisioning.

use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result};
use rcgen::{CertificateParams, DnType, DnValue, KeyPair, SanType};
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::ServerConfig;
use tokio_rustls::TlsAcceptor;
use tracing::info;

use crate::config::TlsMode;

/// Build a rustls TlsAcceptor for the edge HTTPS listener (self-signed or manual modes).
pub fn build_acceptor(mode: &TlsMode, cert_dir: &Path, domain: &str) -> Result<TlsAcceptor> {
    let config = build_server_config(mode, cert_dir, domain)?;
    Ok(TlsAcceptor::from(Arc::new(config)))
}

/// Build ACME state and return a TlsAcceptor that auto-renews certificates.
///
/// The returned `AcmeState` must be polled (it implements `Stream`) to drive
/// certificate acquisition and renewal. The `TlsAcceptor` uses a dynamic
/// cert resolver that automatically picks up renewed certs.
pub fn build_acme(
    domain: &str,
    contact_email: &str,
    cache_dir: &Path,
    production: bool,
) -> Result<(
    TlsAcceptor,
    rustls_acme::AcmeState<std::io::Error, std::io::Error>,
)> {
    use rustls_acme::{AcmeConfig, AcmeState, caches::DirCache};

    let bare_domain = domain.split(':').next().unwrap_or(domain);
    let acme_cache_dir = cache_dir.join("acme");
    std::fs::create_dir_all(&acme_cache_dir)
        .context("creating ACME cache directory")?;

    let directory_url = if production {
        "https://acme-v02.api.letsencrypt.org/directory"
    } else {
        "https://acme-staging-v02.api.letsencrypt.org/directory"
    };

    info!(
        domain = %bare_domain,
        directory = %directory_url,
        "configuring ACME certificate provisioning"
    );

    let config = AcmeConfig::new([bare_domain.to_string()])
        .contact_push(format!("mailto:{}", contact_email))
        .cache(DirCache::new(acme_cache_dir))
        .directory(directory_url.to_string());

    let state = AcmeState::new(config);

    // Get a ServerConfig with a dynamic cert resolver that auto-updates
    let server_config = state.default_rustls_config();
    let acceptor = TlsAcceptor::from(server_config);

    Ok((acceptor, state))
}

/// Build a rustls ServerConfig for the edge HTTPS listener.
fn build_server_config(mode: &TlsMode, cert_dir: &Path, domain: &str) -> Result<ServerConfig> {
    match mode {
        TlsMode::SelfSigned => {
            let cert_path = cert_dir.join("edge-cert.pem");
            let key_path = cert_dir.join("edge-key.pem");

            if cert_path.exists() && key_path.exists() {
                info!("loading existing edge TLS certificate");
                return load_from_pem_files(&cert_path, &key_path);
            }

            info!(domain = %domain, "generating self-signed edge TLS certificate");
            generate_self_signed(cert_dir, domain, &cert_path, &key_path)
        }
        TlsMode::Manual => {
            let cert_path = cert_dir.join("cert.pem");
            let key_path = cert_dir.join("key.pem");
            info!("loading manual TLS certificate");
            load_from_pem_files(&cert_path, &key_path)
        }
        TlsMode::Acme { .. } => {
            unreachable!("ACME mode uses build_acme(), not build_server_config()")
        }
        TlsMode::None => {
            unreachable!("build_acceptor should not be called with TlsMode::None")
        }
    }
}

fn generate_self_signed(
    cert_dir: &Path,
    domain: &str,
    cert_path: &Path,
    key_path: &Path,
) -> Result<ServerConfig> {
    std::fs::create_dir_all(cert_dir)
        .context("creating edge cert directory")?;

    // Strip port from domain if present (e.g. "guardian.tacops.io:3411" -> "guardian.tacops.io")
    let bare_domain = domain.split(':').next().unwrap_or(domain);

    let mut params = CertificateParams::new(vec![bare_domain.to_string()])
        .context("invalid certificate params")?;

    params.distinguished_name.push(
        DnType::CommonName,
        DnValue::Utf8String(bare_domain.to_string()),
    );
    params.distinguished_name.push(
        DnType::OrganizationName,
        DnValue::Utf8String("Guardian Flight".to_string()),
    );

    // Add localhost and loopback as SANs for local access
    if bare_domain != "localhost" {
        params.subject_alt_names.push(
            SanType::DnsName("localhost".try_into().context("localhost SAN")?),
        );
    }
    params.subject_alt_names.push(
        SanType::IpAddress(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST)),
    );
    params.subject_alt_names.push(
        SanType::IpAddress(std::net::IpAddr::V6(std::net::Ipv6Addr::LOCALHOST)),
    );

    let key_pair = KeyPair::generate().context("generating key pair")?;
    let cert = params.self_signed(&key_pair).context("self-signing certificate")?;

    let cert_pem = cert.pem();
    let key_pem = key_pair.serialize_pem();

    std::fs::write(cert_path, &cert_pem)
        .context("writing edge cert PEM")?;
    std::fs::write(key_path, &key_pem)
        .context("writing edge key PEM")?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(key_path, std::fs::Permissions::from_mode(0o600));
    }

    info!(cert = %cert_path.display(), "edge TLS certificate generated");
    load_from_pem_files(cert_path, key_path)
}

fn load_from_pem_files(cert_path: &Path, key_path: &Path) -> Result<ServerConfig> {
    let cert_pem = std::fs::read(cert_path)
        .with_context(|| format!("reading cert: {}", cert_path.display()))?;
    let key_pem = std::fs::read(key_path)
        .with_context(|| format!("reading key: {}", key_path.display()))?;

    let certs: Vec<CertificateDer<'static>> =
        rustls_pemfile::certs(&mut BufReader::new(&cert_pem[..]))
            .collect::<Result<_, _>>()
            .context("parsing certificate PEM")?;

    let key: PrivateKeyDer<'static> =
        rustls_pemfile::private_key(&mut BufReader::new(&key_pem[..]))
            .context("parsing private key PEM")?
            .context("no private key found in PEM file")?;

    let config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)
        .context("building edge TLS server config")?;

    Ok(config)
}
