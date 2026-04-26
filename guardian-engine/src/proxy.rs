//! Reverse proxy — forwards unmatched requests to the upstream frontend.
//!
//! During the migration (Phases 1–4), Next.js serves the frontend and
//! some API routes. The engine proxies all non-engine requests to it.
//! This module is removed in Phase 5 when the engine serves static assets.

use axum::{
    body::Body,
    extract::State,
    http::{HeaderValue, Request, Response, StatusCode},
};
use tracing::debug;

use crate::state::AppState;

/// Axum fallback handler — proxies the request to the upstream frontend.
pub async fn handler(
    State(state): State<AppState>,
    req: Request<Body>,
) -> Result<Response<Body>, StatusCode> {
    let upstream = state.config().upstream_frontend.as_deref()
        .ok_or_else(|| {
            tracing::error!("no upstream_frontend configured");
            StatusCode::SERVICE_UNAVAILABLE
        })?;

    let method = req.method().clone();
    let path_query = req.uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");
    let url = format!("http://{}{}", upstream, path_query);

    debug!(method = %method, url = %url, "proxying to upstream");

    // Build the upstream request, copying method and relevant headers
    let mut builder = state.http_client().request(method, &url);

    for (name, value) in req.headers().iter() {
        // Skip hop-by-hop headers and host (let reqwest set it)
        match name.as_str() {
            "host" | "connection" | "keep-alive" | "transfer-encoding"
            | "te" | "trailer" | "upgrade" | "proxy-authorization"
            | "proxy-connection" => continue,
            _ => {
                if let Ok(v) = reqwest::header::HeaderValue::from_bytes(value.as_bytes()) {
                    builder = builder.header(name.as_str(), v);
                }
            }
        }
    }

    // Forward request body
    let body_bytes = axum::body::to_bytes(req.into_body(), 50_000_000)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to read request body");
            StatusCode::BAD_REQUEST
        })?;

    if !body_bytes.is_empty() {
        builder = builder.body(body_bytes);
    }

    // Send to upstream
    let upstream_resp = builder.send().await.map_err(|e| {
        tracing::error!(error = %e, upstream = %url, "upstream request failed");
        StatusCode::BAD_GATEWAY
    })?;

    // Build the response with streaming body
    let status = upstream_resp.status();
    let resp_headers = upstream_resp.headers().clone();
    let stream = upstream_resp.bytes_stream();
    let body = Body::from_stream(stream);

    let mut response = Response::builder()
        .status(status)
        .body(body)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Copy response headers (skip hop-by-hop)
    for (name, value) in resp_headers.iter() {
        match name.as_str() {
            "connection" | "keep-alive" | "transfer-encoding" | "te" | "trailer" => continue,
            _ => {
                if let Ok(v) = HeaderValue::from_bytes(value.as_bytes()) {
                    response.headers_mut().insert(name.clone(), v);
                }
            }
        }
    }

    Ok(response)
}
