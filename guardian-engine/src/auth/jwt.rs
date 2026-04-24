use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionClaims {
    pub sub: String,       // userId
    pub email: String,
    pub handle: String,
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none", alias = "displayName")]
    pub display_name: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", alias = "orgId")]
    pub org_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", alias = "orgTag")]
    pub org_tag: Option<String>,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TotpChallengeClaims {
    pub sub: String,
    pub purpose: String,
    pub exp: i64,
    pub iat: i64,
}

pub fn sign_session(claims: &SessionClaims, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let key = EncodingKey::from_secret(secret.as_bytes());
    encode(&Header::default(), claims, &key)
}

pub fn verify_session(token: &str, secret: &str) -> Result<SessionClaims, jsonwebtoken::errors::Error> {
    let key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::default();
    validation.set_required_spec_claims(&["exp", "sub"]);
    let data = decode::<SessionClaims>(token, &key, &validation)?;
    Ok(data.claims)
}

pub fn sign_totp_challenge(user_id: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = TotpChallengeClaims {
        sub: user_id.to_string(),
        purpose: "totp-challenge".to_string(),
        iat: now.timestamp(),
        exp: (now + Duration::minutes(5)).timestamp(),
    };
    let key = EncodingKey::from_secret(secret.as_bytes());
    encode(&Header::default(), &claims, &key)
}

pub fn verify_totp_challenge(token: &str, secret: &str) -> Result<TotpChallengeClaims, jsonwebtoken::errors::Error> {
    let key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::default();
    validation.set_required_spec_claims(&["exp", "sub"]);
    let data = decode::<TotpChallengeClaims>(token, &key, &validation)?;
    if data.claims.purpose != "totp-challenge" {
        return Err(jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidToken));
    }
    Ok(data.claims)
}

pub fn new_session_claims(
    user_id: &str,
    email: &str,
    handle: &str,
    role: &str,
    display_name: Option<&str>,
    status: &str,
    org_id: Option<&str>,
    org_tag: Option<&str>,
) -> SessionClaims {
    let now = Utc::now();
    SessionClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        handle: handle.to_string(),
        role: role.to_string(),
        display_name: display_name.map(|s| s.to_string()),
        status: status.to_string(),
        org_id: org_id.map(|s| s.to_string()),
        org_tag: org_tag.map(|s| s.to_string()),
        iat: now.timestamp(),
        exp: (now + Duration::days(7)).timestamp(),
    }
}
