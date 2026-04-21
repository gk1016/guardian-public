//! Federation Manager — orchestrates peer connections and message routing.
//!
//! Responsibilities:
//! 1. Listen for inbound peer connections on the federation port
//! 2. Connect to seed peers on startup
//! 3. Route messages between peers and internal event bus
//! 4. Manage heartbeat / liveness checking

use std::net::SocketAddr;
use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, connect_async, tungstenite::Message};
use tracing::{info, warn, error};
use chrono::Utc;

use crate::state::AppState;
use crate::federation::peer::{PeerInfo, PeerRegistry};
use crate::federation::protocol;
use crate::federation::types::{FederationEvent, FederationPayload};

/// Start the federation manager as a background task. Returns a JoinHandle.
pub fn start(state: AppState) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let registry = PeerRegistry::new();
        let cfg = state.config().clone();

        // Spawn listener for inbound peer connections
        let state_listen = state.clone();
        let registry_listen = registry.clone();
        let listen_handle = tokio::spawn(async move {
            let addr = SocketAddr::from(([0, 0, 0, 0], cfg.federation_port));
            match TcpListener::bind(&addr).await {
                Ok(listener) => {
                    info!(addr = %addr, "federation listener started");
                    loop {
                        match listener.accept().await {
                            Ok((stream, remote)) => {
                                info!(peer = %remote, "inbound federation connection");
                                let s = state_listen.clone();
                                let r = registry_listen.clone();
                                tokio::spawn(handle_inbound(stream, remote, s, r));
                            }
                            Err(e) => {
                                error!(error = %e, "federation accept error");
                            }
                        }
                    }
                }
                Err(e) => {
                    error!(error = %e, "failed to bind federation listener");
                }
            }
        });

        // Connect to seed peers
        for seed in &state.config().federation_seeds {
            let seed = seed.clone();
            let state_out = state.clone();
            let registry_out = registry.clone();
            tokio::spawn(async move {
                connect_to_peer(&seed, state_out, registry_out).await;
            });
        }

        // Heartbeat loop — check peer liveness every 30s
        let registry_hb = registry.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
            loop {
                interval.tick().await;
                let peers = registry_hb.list().await;
                let now = Utc::now();
                for peer in &peers {
                    let age = now - peer.last_heartbeat;
                    if age.num_seconds() > 90 {
                        warn!(
                            instance = %peer.instance_id,
                            name = %peer.instance_name,
                            "peer heartbeat stale, removing"
                        );
                        registry_hb.remove(&peer.instance_id).await;
                    }
                }
            }
        });

        // Keep the manager alive
        let _ = listen_handle.await;
    })
}

/// Handle an inbound peer WebSocket connection.
async fn handle_inbound(
    stream: TcpStream,
    remote: SocketAddr,
    state: AppState,
    registry: PeerRegistry,
) {
    let ws = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            error!(peer = %remote, error = %e, "websocket handshake failed");
            return;
        }
    };

    let (mut tx, mut rx) = ws.split();
    let mut peer_id: Option<String> = None;

    // Wait for Hello message
    while let Some(Ok(msg)) = rx.next().await {
        if let Message::Text(text) = msg {
            if let Ok(fed_msg) = protocol::decode(&text) {
                match fed_msg.payload {
                    FederationPayload::Hello(hello) => {
                        // TODO: Validate PSK auth_token
                        let info = PeerInfo {
                            instance_id: hello.instance_id.clone(),
                            instance_name: hello.instance_name.clone(),
                            address: remote.to_string(),
                            version: hello.version,
                            connected_at: Utc::now(),
                            last_heartbeat: Utc::now(),
                        };
                        info!(
                            instance = %info.instance_id,
                            name = %info.instance_name,
                            "peer authenticated"
                        );
                        peer_id = Some(info.instance_id.clone());
                        let _ = state.federation_tx().send(
                            FederationEvent::PeerConnected {
                                instance_id: info.instance_id.clone(),
                                name: info.instance_name.clone(),
                            }
                        );
                        registry.register(info).await;

                        // Send our Hello back
                        let reply = protocol::hello_message(
                            &state.config().instance_id,
                            &state.config().instance_name,
                            None, // TODO: PSK
                        );
                        if let Ok(encoded) = protocol::encode(&reply) {
                            let _ = tx.send(Message::Text(encoded.into())).await;
                        }
                        break;
                    }
                    _ => {
                        warn!(peer = %remote, "expected Hello, got other message");
                    }
                }
            }
        }
    }

    let peer_id = match peer_id {
        Some(id) => id,
        None => return,
    };

    // Message loop
    while let Some(Ok(msg)) = rx.next().await {
        if let Message::Text(text) = msg {
            if let Ok(fed_msg) = protocol::decode(&text) {
                match &fed_msg.payload {
                    FederationPayload::Ping => {
                        registry.heartbeat(&peer_id).await;
                        let pong = protocol::envelope(
                            &state.config().instance_id,
                            &state.config().instance_name,
                            Some(peer_id.clone()),
                            FederationPayload::Pong,
                        );
                        if let Ok(encoded) = protocol::encode(&pong) {
                            let _ = tx.send(Message::Text(encoded.into())).await;
                        }
                    }
                    FederationPayload::Pong => {
                        registry.heartbeat(&peer_id).await;
                    }
                    _ => {
                        let _ = state.federation_tx().send(
                            FederationEvent::MessageReceived(fed_msg)
                        );
                    }
                }
            }
        }
    }

    // Peer disconnected
    info!(instance = %peer_id, "peer disconnected");
    registry.remove(&peer_id).await;
    let _ = state.federation_tx().send(
        FederationEvent::PeerDisconnected { instance_id: peer_id }
    );
}

/// Connect to a remote peer as an outbound client.
async fn connect_to_peer(
    address: &str,
    state: AppState,
    registry: PeerRegistry,
) {
    let url = format!("ws://{}", address);
    info!(peer = %address, "connecting to federation peer");

    match connect_async(&url).await {
        Ok((ws, _)) => {
            let (mut tx, mut rx) = ws.split();

            // Send Hello
            let hello = protocol::hello_message(
                &state.config().instance_id,
                &state.config().instance_name,
                None, // TODO: PSK
            );
            if let Ok(encoded) = protocol::encode(&hello) {
                if tx.send(Message::Text(encoded.into())).await.is_err() {
                    return;
                }
            }

            // Wait for Hello response and enter message loop
            // (mirrors inbound handler logic)
            while let Some(Ok(msg)) = rx.next().await {
                if let Message::Text(text) = msg {
                    if let Ok(fed_msg) = protocol::decode(&text) {
                        match &fed_msg.payload {
                            FederationPayload::Hello(hello) => {
                                let info = PeerInfo {
                                    instance_id: hello.instance_id.clone(),
                                    instance_name: hello.instance_name.clone(),
                                    address: address.to_string(),
                                    version: hello.version.clone(),
                                    connected_at: Utc::now(),
                                    last_heartbeat: Utc::now(),
                                };
                                info!(
                                    instance = %info.instance_id,
                                    name = %info.instance_name,
                                    "outbound peer connected"
                                );
                                let _ = state.federation_tx().send(
                                    FederationEvent::PeerConnected {
                                        instance_id: info.instance_id.clone(),
                                        name: info.instance_name.clone(),
                                    }
                                );
                                registry.register(info).await;
                            }
                            FederationPayload::Ping => {
                                // respond with pong
                            }
                            _ => {
                                let _ = state.federation_tx().send(
                                    FederationEvent::MessageReceived(fed_msg)
                                );
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            warn!(peer = %address, error = %e, "failed to connect to peer");
        }
    }
}
