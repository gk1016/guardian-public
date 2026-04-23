use data_encoding::BASE32;
use hmac::{Hmac, Mac};
use sha1::Sha1;
use rand::RngCore;

type HmacSha1 = Hmac<Sha1>;

const TOTP_PERIOD: u64 = 30;
const TOTP_DIGITS: u32 = 6;

/// Generate a random base32-encoded TOTP secret (20 bytes = 160 bits).
pub fn generate_secret() -> String {
    let mut bytes = [0u8; 20];
    rand::thread_rng().fill_bytes(&mut bytes);
    BASE32.encode(&bytes)
}

/// Generate the otpauth:// URI for QR code scanning.
pub fn totp_uri(secret: &str, account: &str, issuer: &str) -> String {
    format!(
        "otpauth://totp/{}:{}?secret={}&issuer={}&algorithm=SHA1&digits={}&period={}",
        urlencoded(issuer),
        urlencoded(account),
        secret,
        urlencoded(issuer),
        TOTP_DIGITS,
        TOTP_PERIOD,
    )
}

/// Verify a TOTP code, allowing +/- 1 window for clock skew.
pub fn verify_totp(secret: &str, code: &str) -> bool {
    if code.len() != TOTP_DIGITS as usize || !code.chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    let key = match BASE32.decode(secret.as_bytes()) {
        Ok(k) => k,
        Err(_) => return false,
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    for offset in -1i64..=1 {
        let counter = ((now as i64 + offset * TOTP_PERIOD as i64) / TOTP_PERIOD as i64) as u64;
        if generate_code(&key, counter) == code {
            return true;
        }
    }
    false
}

fn generate_code(key: &[u8], counter: u64) -> String {
    let mut mac = HmacSha1::new_from_slice(key).expect("HMAC key length");
    mac.update(&counter.to_be_bytes());
    let result = mac.finalize().into_bytes();

    let offset = (result[result.len() - 1] & 0x0f) as usize;
    let binary = ((result[offset] as u32 & 0x7f) << 24)
        | ((result[offset + 1] as u32) << 16)
        | ((result[offset + 2] as u32) << 8)
        | (result[offset + 3] as u32);

    let otp = binary % 10u32.pow(TOTP_DIGITS);
    format!("{:0>width$}", otp, width = TOTP_DIGITS as usize)
}

fn urlencoded(s: &str) -> String {
    s.replace('%', "%25")
        .replace(' ', "%20")
        .replace(':', "%3A")
        .replace('/', "%2F")
        .replace('?', "%3F")
        .replace('&', "%26")
        .replace('=', "%3D")
        .replace('#', "%23")
}
