//! Federation TLS — self-signed cert generation, fingerprint pinning, rustls configs.
//!
//! Security model:
//! - Each instance generates a self-signed TLS cert on first boot
//! - Cert + key stored on disk, reused across restarts
//! - SHA-256 fingerprint of the cert DER is the identity token
//! - Peers authenticate by fingerprint pinning (configured or trust-on-first-use)
//! - All federation traffic encrypted with TLS 1.2+ (rustls, no OpenSSL)

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::io::BufReader;

use anyhow::{Context, Result};
use rcgen::{CertificateParams, KeyPair};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::{ClientConfig, DigitallySignedStruct, Error as RustlsError, ServerConfig, SignatureScheme};
use sha2::{Sha256, Digest};
use tokio_rustls::{TlsAcceptor, TlsConnector};
use tracing::{info, warn};

/// Identity material for this instance.
pub struct Identity {
    pub cert_der: Vec<u8>,
    pub key_der: Vec<u8>,
    pub fingerprint: String,
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
}

/// Compute SHA-256 fingerprint of a DER-encoded certificate.
pub fn fingerprint(cert_der: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(cert_der);
    let result = hasher.finalize();
    hex::encode(result)
}

/// Load existing cert/key from disk, or generate a new self-signed pair.
pub fn ensure_identity(cert_dir: &Path, instance_name: &str) -> Result<Identity> {
    let cert_path = cert_dir.join("federation.crt");
    let key_path = cert_dir.join("federation.key");

    // Try loading existing
    if cert_path.exists() && key_path.exists() {
        info!(path = %cert_dir.display(), "loading existing federation certificate");
        let cert_pem = std::fs::read_to_string(&cert_path)
            .context("reading federation cert")?;
        let key_pem = std::fs::read_to_string(&key_path)
            .context("reading federation key")?;

        let cert_der = load_cert_der(&cert_pem)?;
        let key_der = load_key_der(&key_pem)?;
        let fp = fingerprint(&cert_der);

        info!(fingerprint = %fp, "federation certificate loaded");
        return Ok(Identity {
            cert_der,
            key_der,
            fingerprint: fp,
            cert_path,
            key_path,
        });
    }

    // Generate new self-signed cert
    info!(path = %cert_dir.display(), "generating new federation certificate");
    std::fs::create_dir_all(cert_dir)
        .context("creating cert directory")?;

    let mut params = CertificateParams::new(vec![
        instance_name.to_string(),
        "guardian-federation".to_string(),
    ])?;
    params.distinguished_name.push(
        rcgen::DnType::CommonName,
        rcgen::DnValue::Utf8String(format!("Guardian Federation - {}", instance_name)),
    );
    params.distinguished_name.push(
        rcgen::DnType::OrganizationName,
        rcgen::DnValue::Utf8String("Guardian".to_string()),
    );

    let key_pair = KeyPair::generate()?;
    let cert = params.self_signed(&key_pair)?;

    let cert_pem = cert.pem();
    let key_pem = key_pair.serialize_pem();

    // Write to disk with restricted permissions
    std::fs::write(&cert_path, &cert_pem)
        .context("writing federation cert")?;
    std::fs::write(&key_path, &key_pem)
        .context("writing federation key")?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600));
    }

    let cert_der = load_cert_der(&cert_pem)?;
    let key_der = load_key_der(&key_pem)?;
    let fp = fingerprint(&cert_der);

    info!(fingerprint = %fp, "federation certificate generated");
    Ok(Identity {
        cert_der,
        key_der,
        fingerprint: fp,
        cert_path,
        key_path,
    })
}

/// Build a rustls ServerConfig for the federation TLS listener.
pub fn build_server_config(identity: &Identity) -> Result<Arc<ServerConfig>> {
    let cert = CertificateDer::from(identity.cert_der.clone());
    let key = PrivateKeyDer::from(PrivatePkcs8KeyDer::from(identity.key_der.clone()));

    let config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(vec![cert], key)
        .context("building TLS server config")?;

    Ok(Arc::new(config))
}

/// Build a TlsAcceptor for inbound federation connections.
pub fn build_acceptor(identity: &Identity) -> Result<TlsAcceptor> {
    let config = build_server_config(identity)?;
    Ok(TlsAcceptor::from(config))
}

/// Build a rustls ClientConfig for outbound federation connections.
/// If trusted_fingerprints is non-empty, only those certs are accepted.
/// If empty, any cert is accepted (trust-on-first-use mode, fingerprint logged).
pub fn build_client_config(trusted_fingerprints: &[String]) -> Arc<ClientConfig> {
    let verifier = Arc::new(FingerprintVerifier {
        trusted: trusted_fingerprints.to_vec(),
    });

    let config = ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_no_client_auth();

    Arc::new(config)
}

/// Build a TlsConnector for outbound federation connections.
pub fn build_connector(trusted_fingerprints: &[String]) -> TlsConnector {
    let config = build_client_config(trusted_fingerprints);
    TlsConnector::from(config)
}

// --- Internal helpers ---

fn load_cert_der(pem: &str) -> Result<Vec<u8>> {
    let mut reader = BufReader::new(pem.as_bytes());
    let certs: Vec<CertificateDer<'static>> = rustls_pemfile::certs(&mut reader)
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("parsing PEM certificate")?;

    certs.into_iter().next()
        .map(|c| c.to_vec())
        .context("no certificate found in PEM")
}

fn load_key_der(pem: &str) -> Result<Vec<u8>> {
    let mut reader = BufReader::new(pem.as_bytes());
    let key = rustls_pemfile::private_key(&mut reader)
        .context("parsing PEM private key")?
        .context("no private key found in PEM")?;
    Ok(key.secret_der().to_vec())
}

/// Custom certificate verifier that checks SHA-256 fingerprints.
#[derive(Debug)]
struct FingerprintVerifier {
    trusted: Vec<String>,
}

impl ServerCertVerifier for FingerprintVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> std::result::Result<ServerCertVerified, RustlsError> {
        let fp = fingerprint(end_entity.as_ref());

        if self.trusted.is_empty() {
            // Trust-on-first-use mode: accept any cert, log fingerprint
            warn!(
                fingerprint = %fp,
                "accepting unverified peer certificate (no trusted fingerprints configured)"
            );
            return Ok(ServerCertVerified::assertion());
        }

        if self.trusted.iter().any(|t| t.eq_ignore_ascii_case(&fp)) {
            info!(fingerprint = %fp, "peer certificate fingerprint verified");
            Ok(ServerCertVerified::assertion())
        } else {
            warn!(
                fingerprint = %fp,
                "rejecting peer certificate: fingerprint not in trusted list"
            );
            Err(RustlsError::General(format!(
                "peer certificate fingerprint {} not trusted",
                fp
            )))
        }
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> std::result::Result<HandshakeSignatureValid, RustlsError> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> std::result::Result<HandshakeSignatureValid, RustlsError> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::RSA_PKCS1_SHA384,
            SignatureScheme::RSA_PKCS1_SHA512,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ECDSA_NISTP521_SHA512,
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::RSA_PSS_SHA384,
            SignatureScheme::RSA_PSS_SHA512,
            SignatureScheme::ED25519,
            SignatureScheme::ED448,
        ]
    }
}
