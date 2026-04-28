//! Security headers middleware — replaces Caddy's header block.
//!
//! Applied to all responses from the external (TLS) listener.

use axum::{
    body::Body,
    http::{header::HeaderName, HeaderValue, Request, Response},
    middleware::Next,
};

/// Middleware that injects security headers on every response.
pub async fn headers(req: Request<Body>, next: Next) -> Response<Body> {
    let mut response = next.run(req).await;
    let h = response.headers_mut();

    // Content Security Policy
    h.insert(
        HeaderName::from_static("content-security-policy"),
        HeaderValue::from_static(
            "default-src 'self'; \
             script-src 'self' 'unsafe-inline'; \
             style-src 'self' 'unsafe-inline'; \
             img-src 'self' data: blob:; \
             font-src 'self'; \
             connect-src 'self' wss: ws:; \
             frame-ancestors 'none'; \
             base-uri 'self'; \
             form-action 'self'"
        ),
    );

    // Clickjacking protection
    h.insert(
        HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("DENY"),
    );

    // MIME sniffing protection
    h.insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );

    // Referrer policy
    h.insert(
        HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    // Feature / permissions policy
    h.insert(
        HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static("camera=(), microphone=(), geolocation=(), payment=()"),
    );

    // HSTS
    h.insert(
        HeaderName::from_static("strict-transport-security"),
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );

    // Remove server identification
    h.remove(HeaderName::from_static("server"));

    response
}
