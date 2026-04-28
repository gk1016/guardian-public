//! AES-256-GCM encryption at rest for channel messages.
//!
//! Per-channel symmetric key stored in ChatChannelKey table.
//! Keys are generated on encrypted channel creation, messages encrypted
//! server-side before Postgres write, decrypted on read.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::{rngs::OsRng, RngCore};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("encryption failed")]
    EncryptionFailed,
    #[error("decryption failed")]
    DecryptionFailed,
    #[error("invalid key length")]
    InvalidKeyLength,
    #[error("invalid ciphertext format")]
    InvalidFormat,
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("key not found for channel {0}")]
    KeyNotFound(String),
}

/// Generate a new 256-bit AES key, returned as hex string for DB storage.
pub fn generate_key() -> String {
    let mut key_bytes = [0u8; 32];
    OsRng.fill_bytes(&mut key_bytes);
    hex::encode(key_bytes)
}

/// Encrypt plaintext content. Returns hex-encoded (nonce || ciphertext).
pub fn encrypt(key_hex: &str, plaintext: &str) -> Result<String, CryptoError> {
    let key_bytes = hex::decode(key_hex).map_err(|_| CryptoError::InvalidKeyLength)?;
    if key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKeyLength);
    }

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|_| CryptoError::InvalidKeyLength)?;

    // 96-bit random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Prepend nonce to ciphertext: nonce(12) || ciphertext(n)
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(hex::encode(combined))
}

/// Decrypt hex-encoded (nonce || ciphertext) back to plaintext.
pub fn decrypt(key_hex: &str, combined_hex: &str) -> Result<String, CryptoError> {
    let key_bytes = hex::decode(key_hex).map_err(|_| CryptoError::InvalidKeyLength)?;
    if key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKeyLength);
    }

    let combined = hex::decode(combined_hex).map_err(|_| CryptoError::InvalidFormat)?;
    if combined.len() < 13 {
        // Minimum: 12 nonce + 1 byte ciphertext (with tag)
        return Err(CryptoError::InvalidFormat);
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|_| CryptoError::InvalidKeyLength)?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    String::from_utf8(plaintext).map_err(|_| CryptoError::DecryptionFailed)
}

/// Store a new encryption key for a channel.
pub async fn store_channel_key(
    pool: &sqlx::PgPool,
    channel_id: &str,
) -> Result<String, CryptoError> {
    let key_id = cuid2::create_id();
    let key_hex = generate_key();

    sqlx::query(
        r#"INSERT INTO "ChatChannelKey" (id, "channelId", "keyHex", "createdAt")
           VALUES ($1, $2, $3, NOW())"#,
    )
    .bind(&key_id)
    .bind(channel_id)
    .bind(&key_hex)
    .execute(pool)
    .await?;

    Ok(key_hex)
}

/// Retrieve the active encryption key for a channel.
pub async fn get_channel_key(
    pool: &sqlx::PgPool,
    channel_id: &str,
) -> Result<String, CryptoError> {
    let key: Option<String> = sqlx::query_scalar(
        r#"SELECT "keyHex" FROM "ChatChannelKey"
           WHERE "channelId" = $1 AND "revokedAt" IS NULL
           ORDER BY "createdAt" DESC LIMIT 1"#,
    )
    .bind(channel_id)
    .fetch_optional(pool)
    .await?;

    key.ok_or_else(|| CryptoError::KeyNotFound(channel_id.to_string()))
}

// We need hex for key encoding
mod hex {
    pub fn encode(data: impl AsRef<[u8]>) -> String {
        data.as_ref().iter().map(|b| format!("{:02x}", b)).collect()
    }

    pub fn decode(s: &str) -> Result<Vec<u8>, ()> {
        if s.len() % 2 != 0 {
            return Err(());
        }
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| ()))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_encrypt_decrypt() {
        let key = generate_key();
        let plaintext = "CSAR survivor at Hurston, grid Alpha-7. Hostile contact, 2 ships.";
        let ciphertext = encrypt(&key, plaintext).unwrap();
        assert_ne!(ciphertext, plaintext);
        let decrypted = decrypt(&key, &ciphertext).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn wrong_key_fails() {
        let key1 = generate_key();
        let key2 = generate_key();
        let ciphertext = encrypt(&key1, "secret message").unwrap();
        assert!(decrypt(&key2, &ciphertext).is_err());
    }
}
