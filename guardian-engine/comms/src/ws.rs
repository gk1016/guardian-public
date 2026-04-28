//! WebSocket room registry — per-channel broadcast with clearance-based filtering.

use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use sqlx::PgPool;
use tokio::sync::broadcast;
use tracing::{info, warn};

use crate::access;
use crate::types::{Classification, WsEvent};

#[derive(Debug, Clone)]
struct RoomMember {
    pub user_id: String,
    pub handle: String,
    pub clearance: String,
}

/// A tagged event that includes classification for per-recipient filtering.
#[derive(Debug, Clone)]
pub struct TaggedEvent {
    pub classification: Classification,
    pub payload: String,
}

/// Room registry — manages per-channel broadcast channels.
#[derive(Clone)]
pub struct RoomRegistry {
    rooms: Arc<DashMap<String, broadcast::Sender<TaggedEvent>>>,
    presence: Arc<DashMap<String, Vec<RoomMember>>>,
}

impl RoomRegistry {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(DashMap::new()),
            presence: Arc::new(DashMap::new()),
        }
    }

    pub fn get_or_create_room(&self, channel_id: &str) -> broadcast::Sender<TaggedEvent> {
        self.rooms
            .entry(channel_id.to_string())
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(256);
                tx
            })
            .clone()
    }

    pub fn broadcast(&self, channel_id: &str, event: TaggedEvent) {
        if let Some(tx) = self.rooms.get(channel_id) {
            let _ = tx.send(event);
        }
    }

    pub fn add_presence(&self, channel_id: &str, user_id: &str, handle: &str, clearance: &str) {
        self.presence
            .entry(channel_id.to_string())
            .or_default()
            .push(RoomMember {
                user_id: user_id.to_string(),
                handle: handle.to_string(),
                clearance: clearance.to_string(),
            });
    }

    pub fn remove_presence(&self, channel_id: &str, user_id: &str) {
        if let Some(mut members) = self.presence.get_mut(channel_id) {
            members.retain(|m| m.user_id != user_id);
            if members.is_empty() {
                drop(members);
                self.presence.remove(channel_id);
                self.rooms.remove(channel_id);
            }
        }
    }

    pub fn get_online(&self, channel_id: &str) -> Vec<(String, String)> {
        self.presence
            .get(channel_id)
            .map(|members| {
                members
                    .iter()
                    .map(|m| (m.user_id.clone(), m.handle.clone()))
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ClientCommand {
    #[serde(rename = "chat:join")]
    Join { channel_id: String },
    #[serde(rename = "chat:leave")]
    Leave { channel_id: String },
    #[serde(rename = "chat:typing")]
    Typing { channel_id: String, active: bool },
    #[serde(rename = "chat:read")]
    Read { channel_id: String },
}

/// Handle an authenticated WebSocket connection for comms.
pub async fn handle_comms_ws(
    socket: WebSocket,
    pool: PgPool,
    registry: RoomRegistry,
    user_id: String,
    handle: String,
) {
    let (mut ws_tx, mut ws_rx) = socket.split();

    let subscribed: Arc<DashMap<String, (broadcast::Receiver<TaggedEvent>, String)>> =
        Arc::new(DashMap::new());

    info!(user_id = %user_id, handle = %handle, "comms ws connected");

    let sub_clone = subscribed.clone();
    let forward_task = tokio::spawn(async move {
        loop {
            let entries: Vec<_> = sub_clone.iter().map(|e| e.key().clone()).collect();
            let mut has_rooms = false;

            for channel_id in &entries {
                has_rooms = true;
                if let Some(mut entry) = sub_clone.get_mut(channel_id) {
                    let (ref mut rx, ref clearance) = *entry;
                    match rx.try_recv() {
                        Ok(tagged_event) => {
                            let viewer_clearance = access::parse_clearance(clearance);
                            let msg_classification = tagged_event.classification;
                            if access::can_see_message(viewer_clearance, msg_classification) {
                                if ws_tx
                                    .send(Message::Text(tagged_event.payload.into()))
                                    .await
                                    .is_err()
                                {
                                    return;
                                }
                            }
                        }
                        Err(broadcast::error::TryRecvError::Empty) => {}
                        Err(broadcast::error::TryRecvError::Closed) => {}
                        Err(broadcast::error::TryRecvError::Lagged(n)) => {
                            warn!(channel_id = %channel_id, lagged = n, "ws client lagged");
                        }
                    }
                }
            }

            if !has_rooms {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            } else {
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }
        }
    });

    while let Some(Ok(msg)) = ws_rx.next().await {
        match msg {
            Message::Text(text) => {
                let text_str: &str = &text;
                match serde_json::from_str::<ClientCommand>(text_str) {
                    Ok(ClientCommand::Join { channel_id }) => {
                        match crate::participant::get_participant(&pool, &channel_id, &user_id)
                            .await
                        {
                            Ok(Some(p)) => {
                                let tx = registry.get_or_create_room(&channel_id);
                                let rx = tx.subscribe();
                                subscribed.insert(channel_id.clone(), (rx, p.clearance.clone()));

                                registry.add_presence(
                                    &channel_id,
                                    &user_id,
                                    &handle,
                                    &p.clearance,
                                );

                                let event = WsEvent::Presence {
                                    channel_id: channel_id.clone(),
                                    user_id: user_id.clone(),
                                    handle: handle.clone(),
                                    online: true,
                                };
                                let payload = serde_json::to_string(&event).unwrap();
                                registry.broadcast(
                                    &channel_id,
                                    TaggedEvent {
                                        classification: Classification::Unclass,
                                        payload,
                                    },
                                );

                                info!(
                                    user_id = %user_id,
                                    channel_id = %channel_id,
                                    clearance = %p.clearance,
                                    "joined room"
                                );
                            }
                            _ => {
                                warn!(
                                    user_id = %user_id,
                                    channel_id = %channel_id,
                                    "join denied: not a participant"
                                );
                            }
                        }
                    }
                    Ok(ClientCommand::Leave { channel_id }) => {
                        subscribed.remove(&channel_id);
                        registry.remove_presence(&channel_id, &user_id);

                        let event = WsEvent::Presence {
                            channel_id: channel_id.clone(),
                            user_id: user_id.clone(),
                            handle: handle.clone(),
                            online: false,
                        };
                        let payload = serde_json::to_string(&event).unwrap();
                        registry.broadcast(
                            &channel_id,
                            TaggedEvent {
                                classification: Classification::Unclass,
                                payload,
                            },
                        );
                    }
                    Ok(ClientCommand::Typing {
                        channel_id,
                        active,
                    }) => {
                        let event = WsEvent::Typing {
                            channel_id: channel_id.clone(),
                            user_id: user_id.clone(),
                            handle: handle.clone(),
                            active,
                        };
                        let payload = serde_json::to_string(&event).unwrap();
                        registry.broadcast(
                            &channel_id,
                            TaggedEvent {
                                classification: Classification::Unclass,
                                payload,
                            },
                        );
                    }
                    Ok(ClientCommand::Read { channel_id }) => {
                        let _ =
                            crate::participant::mark_read(&pool, &channel_id, &user_id).await;
                    }
                    Err(e) => {
                        warn!(error = %e, "invalid ws command");
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    let entries: Vec<_> = subscribed.iter().map(|e| e.key().clone()).collect();
    for channel_id in entries {
        registry.remove_presence(&channel_id, &user_id);
        let event = WsEvent::Presence {
            channel_id: channel_id.clone(),
            user_id: user_id.clone(),
            handle: handle.clone(),
            online: false,
        };
        let payload = serde_json::to_string(&event).unwrap();
        registry.broadcast(
            &channel_id,
            TaggedEvent {
                classification: Classification::Unclass,
                payload,
            },
        );
    }

    forward_task.abort();
    info!(user_id = %user_id, "comms ws disconnected");
}
