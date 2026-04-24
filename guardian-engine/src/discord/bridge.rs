use std::sync::Arc;
use serenity::all::{ChannelId, CreateEmbed, CreateMessage, Http, Colour};
use tracing::{error, warn, debug};

use crate::state::AppState;
use super::bot::ChannelConfig;

/// Subscribe to engine events and forward relevant ones to Discord channels.
pub async fn run(state: AppState, channels: ChannelConfig, http: Arc<Http>) {
    let mut rx = state.event_tx().subscribe();

    loop {
        match rx.recv().await {
            Ok(event_json) => {
                if let Err(e) = handle_event(&event_json, &channels, &http).await {
                    error!("Discord bridge error: {e}");
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                warn!("Discord bridge lagged, missed {n} events");
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                warn!("Discord bridge: event channel closed, shutting down");
                break;
            }
        }
    }
}

async fn handle_event(
    event_json: &str,
    channels: &ChannelConfig,
    http: &Http,
) -> anyhow::Result<()> {
    let event: serde_json::Value = serde_json::from_str(event_json)?;
    let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match event_type {
        // Threat / intel events -> intel channel (or main)
        "intel_created" | "intel_updated" => {
            let channel_id = channels.intel.unwrap_or(channels.main);
            let title = event
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Intel Report");
            let severity = event
                .get("severity")
                .and_then(|v| v.as_i64())
                .unwrap_or(3);
            let description = event
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let sev_label = match severity {
                1 => "CRITICAL",
                2 => "HIGH",
                3 => "MEDIUM",
                4 => "LOW",
                _ => "INFO",
            };

            let color = match severity {
                1 => Colour::RED,
                2 => Colour::ORANGE,
                3 => Colour::GOLD,
                _ => Colour::from_rgb(100, 200, 100),
            };

            let embed = CreateEmbed::new()
                .title(format!("[{sev_label}] {title}"))
                .description(truncate_str(description, 2000))
                .color(color);

            send_embed(http, channel_id, embed).await?;
        }

        // Mission status changes -> mission channel (or main)
        "mission_created" | "mission_updated" => {
            let channel_id = channels.missions.unwrap_or(channels.main);
            let callsign = event
                .get("callsign")
                .and_then(|v| v.as_str())
                .unwrap_or("UNKNOWN");
            let title = event
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let status = event
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            let embed = CreateEmbed::new()
                .title(format!("Mission {callsign} -- {}", status.to_uppercase()))
                .description(title)
                .color(Colour::from_rgb(6, 182, 212));

            send_embed(http, channel_id, embed).await?;
        }

        // QRF dispatch / status -> alerts channel (or main)
        "qrf_dispatched" | "qrf_status_changed" => {
            let channel_id = channels.alerts.unwrap_or(channels.main);
            let callsign = event
                .get("callsign")
                .and_then(|v| v.as_str())
                .unwrap_or("QRF");
            let status = event
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let embed = CreateEmbed::new()
                .title(format!("QRF {callsign} -- {}", status.to_uppercase()))
                .color(Colour::from_rgb(245, 158, 11));

            send_embed(http, channel_id, embed).await?;
        }

        // Rescue events -> alerts channel (or main)
        "rescue_created" | "rescue_updated" => {
            let channel_id = channels.alerts.unwrap_or(channels.main);
            let survivor = event
                .get("survivorHandle")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown");
            let status = event
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let urgency = event
                .get("urgency")
                .and_then(|v| v.as_str())
                .unwrap_or("routine");

            let color = match urgency {
                "emergency" => Colour::RED,
                "urgent" => Colour::ORANGE,
                _ => Colour::GOLD,
            };

            let embed = CreateEmbed::new()
                .title(format!(
                    "CSAR -- {} [{}]",
                    survivor,
                    status.to_uppercase()
                ))
                .description(format!("Urgency: {urgency}"))
                .color(color);

            send_embed(http, channel_id, embed).await?;
        }

        // Alert rule triggers -> alerts channel (or main)
        "alert_triggered" => {
            let channel_id = channels.alerts.unwrap_or(channels.main);
            let name = event
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Alert");
            let severity = event
                .get("severity")
                .and_then(|v| v.as_str())
                .unwrap_or("warning");

            let color = match severity {
                "critical" => Colour::RED,
                "warning" => Colour::ORANGE,
                _ => Colour::GOLD,
            };

            let embed = CreateEmbed::new()
                .title(format!("ALERT: {name}"))
                .color(color);

            send_embed(http, channel_id, embed).await?;
        }

        // Federation events -> main channel
        "federation_chat" | "federation_peer_connected" | "federation_peer_disconnected" => {
            let embed = CreateEmbed::new()
                .title("Federation")
                .description(truncate_str(event_json, 2000))
                .color(Colour::from_rgb(168, 85, 247));

            send_embed(http, channels.main, embed).await?;
        }

        // Everything else \u{2014} skip
        _ => {
            debug!("Discord bridge: ignoring event type '{event_type}'");
        }
    }

    Ok(())
}

async fn send_embed(http: &Http, channel_id: u64, embed: CreateEmbed) -> anyhow::Result<()> {
    let channel = ChannelId::new(channel_id);
    channel
        .send_message(http, CreateMessage::new().embed(embed))
        .await?;
    Ok(())
}

fn truncate_str(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        let boundary = s.floor_char_boundary(max.saturating_sub(3));
        format!("{}...", &s[..boundary])
    }
}
