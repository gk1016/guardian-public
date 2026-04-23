use bcrypt::{hash, verify, DEFAULT_COST};

const COST: u32 = 12;

pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    hash(password, COST)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, bcrypt::BcryptError> {
    verify(password, hash)
}

/// Validate password against policy:
/// - At least 10 characters
/// - At most 128 characters
/// - At least one uppercase, one lowercase, one digit, one special character
pub fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 10 {
        return Err("Password must be at least 10 characters.".into());
    }
    if password.len() > 128 {
        return Err("Password must be at most 128 characters.".into());
    }
    let mut missing = Vec::new();
    if !password.chars().any(|c| c.is_ascii_uppercase()) {
        missing.push("at least one uppercase letter");
    }
    if !password.chars().any(|c| c.is_ascii_lowercase()) {
        missing.push("at least one lowercase letter");
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        missing.push("at least one digit");
    }
    if !password.chars().any(|c| !c.is_alphanumeric()) {
        missing.push("at least one special character");
    }
    if !missing.is_empty() {
        return Err(format!("Password requires: {}.", missing.join(", ")));
    }
    Ok(())
}
