//! Network scanner for discovering local Ollama instances.
//!
//! POST /api/admin/scan-ollama
//! Probes a subnet for Ollama API servers, returns discovered
//! instances with their available and running (warm) models.

use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;
use tracing::info;

use crate::auth::middleware::AuthSession;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/admin/scan-ollama", post(scan_ollama))
}

#[derive(Deserialize)]
struct ScanRequest {
    subnet: Option<String>,
    port: Option<u16>,
}

async fn scan_ollama(
    State(_state): State<AppState>,
    AuthSession(session): AuthSession,
    Json(body): Json<ScanRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !session.can_manage_administration() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Admin authority required."})),
        ));
    }

    let port = body.port.unwrap_or(11434);
    let subnets: Vec<String> = if let Some(ref s) = body.subnet {
        s.split(',')
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect()
    } else {
        auto_detect_subnets().await
    };

    info!(subnets = ?subnets, port = port, user = %session.handle, "Ollama network scan started");

    let timeout_dur = Duration::from_millis(1500);

    // Phase 1: parallel TCP probe across all subnets
    let mut probe_handles = Vec::new();
    for subnet in &subnets {
        for i in 1..=254u8 {
            let ip = format!("{}.{}", subnet, i);
            probe_handles.push(tokio::spawn(async move {
                let addr = format!("{}:{}", ip, port);
                match tokio::time::timeout(timeout_dur, tokio::net::TcpStream::connect(&addr))
                    .await
                {
                    Ok(Ok(_)) => Some(ip),
                    _ => None,
                }
            }));
        }
    }

    let mut found_ips = Vec::new();
    for handle in probe_handles {
        if let Ok(Some(ip)) = handle.await {
            found_ips.push(ip);
        }
    }
    found_ips.sort();

    info!(found = found_ips.len(), "Ollama scan probe complete");

    // Phase 2: fetch model data from discovered instances
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .no_proxy()
        .build()
        .unwrap_or_default();

    let mut instances = Vec::new();
    for ip in &found_ips {
        let base = format!("http://{}:{}", ip, port);

        // Available models
        let models_val = match client.get(format!("{}/api/tags", base)).send().await {
            Ok(res) if res.status().is_success() => res
                .json::<Value>()
                .await
                .unwrap_or(json!({"models": []})),
            _ => continue,
        };

        let models: Vec<Value> = models_val["models"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .map(|m| {
                        json!({
                            "name": m["name"],
                            "size": m["size"],
                            "parameterSize": m.get("details").and_then(|d| d.get("parameter_size")),
                            "quantization": m.get("details").and_then(|d| d.get("quantization_level")),
                            "family": m.get("details").and_then(|d| d.get("family")),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Running (warm) models
        let running_val = match client.get(format!("{}/api/ps", base)).send().await {
            Ok(res) if res.status().is_success() => res
                .json::<Value>()
                .await
                .unwrap_or(json!({"models": []})),
            _ => json!({"models": []}),
        };

        let running: Vec<Value> = running_val["models"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .map(|m| {
                        json!({
                            "name": m["name"],
                            "sizeVram": m["size_vram"],
                            "contextLength": m["context_length"],
                            "expiresAt": m["expires_at"],
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        instances.push(json!({
            "ip": ip,
            "port": port,
            "url": base,
            "modelCount": models.len(),
            "models": models,
            "running": running,
        }));
    }

    info!(instances = instances.len(), user = %session.handle, "Ollama scan complete");

    Ok(Json(json!({
        "ok": true,
        "subnetsScanned": subnets,
        "instancesFound": instances.len(),
        "instances": instances,
    })))
}

/// Try to auto-detect the LAN subnet from the routing table.
/// Falls back to common home/office subnets if detection fails.
async fn auto_detect_subnets() -> Vec<String> {
    if let Ok(content) = tokio::fs::read_to_string("/proc/net/route").await {
        for line in content.lines().skip(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() >= 3 && fields[1] == "00000000" {
                if let Ok(gw) = u32::from_str_radix(fields[2], 16) {
                    let a = (gw & 0xFF) as u8;
                    let b = ((gw >> 8) & 0xFF) as u8;
                    let c = ((gw >> 16) & 0xFF) as u8;
                    if a == 192 || a == 10 {
                        return vec![format!("{}.{}.{}", a, b, c)];
                    }
                }
            }
        }
    }
    // Common home/office subnets
    vec![
        "192.168.1".into(),
        "192.168.0".into(),
        "192.168.68".into(),
        "10.0.0".into(),
    ]
}
