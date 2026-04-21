//! Federation Manager — orchestrates peer connections and message routing.
//!
//! All federation connections are TLS-encrypted:
//! - Inbound: TcpListener → TlsAcceptor → WebSocket handshake
//! - Outbound: TLS connector with fingerprint pinning → WebSocket
//! - Cert fingerprints used for peer identity verification

use std::net::SocketAddr;
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_rustls::TlsAcceptor;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{info, warn, error};
use chrono::Utc;
use rustls::pki_types::ServerName;

use crate::state::AppState;
use crate::federation::peer::{PeerInfo, PeerRegistry};
use crate::federation::protocol;
use crate::federation::tls::{self, Identity};
use crate::federation::types::{FederationEvent, FederationPayload};

/// Start the federation manager as a background task. Returns a JoinHandle.
pub fn start(state: AppState, identity: Identity) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let registry = PeerRegistry::new();
        let cfg = state.config().clone();

        // Build TLS acceptor for inbound connections
        let tls_acceptor = match tls::build_acceptor(&identity) {
            Ok(a) => a,
            Err(e) => {
                error!(error = %e, "failed to build TLS acceptor, federation disabled");
                return;
            }
        };

        // Build TLS connector for outbound connections
        let tls_connector = tls::build_connector(&cfg.federation_trusted_fingerprints);

        // Spawn listener for inbound peer connections
        let state_listen = state.clone();
        let registry_listen = registry.clone();
        let acceptor = tls_acceptor.clone();
        let listen_handle = tokio::spawn(async move {
            let addr = SocketAddr::from(([0, 0, 0, 0], cfg.federation_port));
            match TcpListener::bind(&addr).await {
                Ok(listener) => {
                    info!(addr = %addr, "federation TLS listener started");
                    loop {
                        match listener.accept().await {
                            Ok((stream, remote)) => {
                                info!(peer = %remote, "inbound federation connection (upgrading to TLS)");
                                let s = state_listen.clone();
                                let r = registry_listen.clone();
                                let a = acceptor.clone();
                                tokio::spawn(handle_inbound(stream, remote, s, r, a));
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

        // Connect to seed peers with TLS
        for seed in &state.config().federation_seeds {
            let seed = seed.clone();
            let state_out = state.clone();
            let registry_out = registry.clone();
            let connector = tls_connector.clone();
            tokio::spawn(async move {
                connect_to_peer(&seed, state_out, registry_out, connector).await;
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

/// Handle an inbound peer connection: TLS handshake, then WebSocket upgrade.
async fn handle_inbound(
    stream: TcpStream,
    remote: SocketAddr,
    state: AppState,
    registry: PeerRegistry,
    tls_acceptor: TlsAcceptor,
) {
    // TLS handshake
    let tls_stream = match tls_acceptor.accept(stream).await {
        Ok(s) => {
            info!(peer = %remote, "federation TLS handshake complete");
            s
        }
        Err(e) => {
            error!(peer = %remote, error = %e, "federation TLS handshake failed");
            return;
        }
    };

    // WebSocket upgrade over TLS
    let ws = match accept_async(tls_stream).await {
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
                            "peer authenticated (TLS + Hello)"
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
                            None,
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

/// Connect to a remote peer as an outbound TLS client.
async fn connect_to_peer(
    address: &str,
    state: AppState,
    registry: PeerRegistry,
    tls_connector: tokio_rustls::TlsConnector,
) {
    info!(peer = %address, "connecting to federation peer (TLS)");

    // Parse address
    let addr: SocketAddr = match address.parse() {
        Ok(a) => a,
        Err(_) => {
            // Try resolving as host:port
            match tokio::net::lookup_host(address).await {
                Ok(mut addrs) => match addrs.next() {
                    Some(a) => a,
                    None => {
                        warn!(peer = %address, "could not resolve peer address");
                        return;
                    }
                },
                Err(e) => {
                    warn!(peer = %address, error = %e, "DNS lookup failed for peer");
                    return;
                }
            }
        }
    };

    // TCP connect
    let tcp_stream = match TcpStream::connect(&addr).await {
        Ok(s) => s,
        Err(e) => {
            warn!(peer = %address, error = %e, "TCP connect failed to peer");
            return;
        }
    };

    // TLS handshake
    let server_name = ServerName::try_from("guardian-federation")
        .unwrap_or_else(|_| ServerName::try_from("localhost").unwrap());

    let tls_stream = match tls_connector.connect(server_name, tcp_stream).await {
        Ok(s) => {
            info!(peer = %address, "outbound TLS handshake complete");
            s
        }
        Err(e) => {
            warn!(peer = %address, error = %e, "outbound TLS handshake failed");
            return;
        }
    };

    // WebSocket upgrade over TLS
    let url = format!("wss://{}", address);
    let (ws, _) = match tokio_tungstenite::client_async(&url, tls_stream).await {
        Ok(pair) => pair,
        Err(e) => {
            warn!(peer = %address, error = %e, "websocket handshake failed over TLS");
            return;
        }
    };

    let (mut tx, mut rx) = ws.split();

    // Send Hello
    let hello = protocol::hello_message(
        &state.config().instance_id,
        &state.config().instance_name,
        None,
    );
    if let Ok(encoded) = protocol::encode(&hello) {
        if tx.send(Message::Text(encoded.into())).await.is_err() {
            return;
        }
    }

    // Message loop
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
                            "outbound peer connected (TLS)"
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
