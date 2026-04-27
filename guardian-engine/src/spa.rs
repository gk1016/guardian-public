//! Static SPA file server with client-side routing fallback.
//!
//! Serves pre-built Vite assets from a directory on disk. Any request
//! that doesn't match a real file gets index.html so React Router can
//! handle the route client-side.

use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use std::path::{Path, PathBuf};
use tokio::fs;

/// Base directory where the SPA dist is mounted in the container.
const SPA_DIR: &str = "/app/spa";

/// Axum fallback handler — serves static SPA files or index.html.
pub async fn fallback(req: Request<Body>) -> Response {
    let path = req.uri().path();

    // Security: reject path traversal attempts
    if path.contains("..") {
        return StatusCode::BAD_REQUEST.into_response();
    }

    // Strip leading slash and try to serve the file
    let relative = path.trim_start_matches('/');
    let file_path = PathBuf::from(SPA_DIR).join(relative);

    // If it's a real file on disk, serve it
    if let Ok(meta) = fs::metadata(&file_path).await {
        if meta.is_file() {
            return serve_file(&file_path).await;
        }
    }

    // For assets/ paths that don't exist, return 404 (not index.html)
    if relative.starts_with("assets/") {
        return StatusCode::NOT_FOUND.into_response();
    }

    // SPA fallback: serve index.html for all other paths
    let index = PathBuf::from(SPA_DIR).join("index.html");
    serve_file(&index).await
}

async fn serve_file(path: &Path) -> Response {
    match fs::read(path).await {
        Ok(bytes) => {
            let mime = mime_from_extension(path);
            let mut response = Response::new(Body::from(bytes));
            response.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static(mime),
            );

            // Cache hashed assets aggressively, everything else short-lived
            let cache = if path.to_string_lossy().contains("/assets/") {
                "public, max-age=31536000, immutable"
            } else {
                "public, max-age=60"
            };
            if let Ok(v) = HeaderValue::from_str(cache) {
                response.headers_mut().insert(header::CACHE_CONTROL, v);
            }

            response
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

fn mime_from_extension(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "application/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        Some("webp") => "image/webp",
        Some("webm") => "video/webm",
        Some("mp4") => "video/mp4",
        Some("txt") => "text/plain; charset=utf-8",
        Some("xml") => "application/xml",
        Some("map") => "application/json",
        _ => "application/octet-stream",
    }
}
