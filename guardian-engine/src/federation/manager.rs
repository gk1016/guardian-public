//! Federation Manager — orchestrates peer connections and message routing.
//!
//! All federation connections are TLS-encrypted:
//! - Inbound: TcpListener → TlsAcceptor → WebSocket handshake
//! - Outbound: TLS connector with fingerprint pinning → WebSocket
//! - Cert fingerprints used for peer identity verification

use std::net::SocketAddr;

use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio_rustls::TlsAcceptor;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{info, warn, error};
use chrono::Utc;
use rustls::pki_types::ServerName;

use crate::state::AppState;
use crate::federation::peer::PeerInfo;
use crate::federation::protocol;
use crate::federation::tls::{self, Identity};
use crate::federation::types::{FederationEvent, FederationPayload};

/// Start the federation manager as a background task. Returns a JoinHandle.
pub fn start(state: AppState, identity: Identity) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let registry = state.peers().clone();
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
                                let a = acceptor.clone();
                                tokio::spawn(handle_inbound(stream, remote, s, a));
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
            let connector = tls_connector.clone();
            tokio::spawn(async move {
                connect_to_peer(&seed, state_out, connector).await;
            });
        }

        // Heartbeat loop — check peer liveness every 30s
        let hb_registry = registry.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
            loop {
                interval.tick().await;
                let peers = hb_registry.list().await;
                let now = Utc::now();
                for peer in &peers {
                    let age = now - peer.last_heartbeat;
                    if age.num_seconds() > 90 {
                        warn!(
                            instance = %peer.instance_id,
                            name = %peer.instance_name,
                            "peer heartbeat stale, removing"
                        );
                        hb_registry.remove(&peer.instance_id).await;
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
    tls_acceptor: TlsAcceptor,
) {
    let registry = state.peers().clone();

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
            let text_str: &str = text.as_ref();
            if let Ok(fed_msg) = protocol::decode(text_str) {
                match fed_msg.payload {
                    FederationPayload::Hello(hello) => {
                        // Validate PSK if configured
                        if let Some(ref expected_psk) = state.config().federation_psk {
                            match &hello.auth_token {
                                Some(token) if token == expected_psk => {}
                                _ => {
                                    warn!(peer = %remote, "federation PSK mismatch, rejecting");
                                    return;
                                }
                            }
                        }

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
                            state.config().federation_psk.clone(),
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

    // Set up writer task with mpsc channel
    let (sender_tx, mut sender_rx) = mpsc::unbounded_channel::<String>();
    registry.register_sender(&peer_id, sender_tx).await;

    // Writer task: reads from channel, sends to WebSocket
    let writer_peer_id = peer_id.clone();
    let writer_handle = tokio::spawn(async move {
        while let Some(msg) = sender_rx.recv().await {
            if tx.send(Message::Text(msg.into())).await.is_err() {
                warn!(peer = %writer_peer_id, "failed to send to peer websocket");
                break;
            }
        }
    });

    // Reader loop: process incoming messages
    while let Some(Ok(msg)) = rx.next().await {
        if let Message::Text(text) = msg {
            let text_str: &str = text.as_ref();
            if let Ok(fed_msg) = protocol::decode(text_str) {
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
                            // Send pong via the sender channel
                            let _ = registry.send_to(&peer_id, &encoded).await;
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

    // Peer disconnected — clean up
    writer_handle.abort();
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
    tls_connector: tokio_rustls::TlsConnector,
) {
    let registry = state.peers().clone();
    info!(peer = %address, "connecting to federation peer (TLS)");

    // Parse address
    let addr: SocketAddr = match address.parse() {
        Ok(a) => a,
        Err(_) => {
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
        state.config().federation_psk.clone(),
    );
    if let Ok(encoded) = protocol::encode(&hello) {
        if tx.send(Message::Text(encoded.into())).await.is_err() {
            return;
        }
    }

    // Wait for Hello reply and register peer
    let mut peer_id: Option<String> = None;
    while let Some(Ok(msg)) = rx.next().await {
        if let Message::Text(text) = msg {
            let text_str: &str = text.as_ref();
            if let Ok(fed_msg) = protocol::decode(text_str) {
                if let FederationPayload::Hello(hello) = fed_msg.payload {
                    // Validate PSK if configured
                    if let Some(ref expected_psk) = state.config().federation_psk {
                        match &hello.auth_token {
                            Some(token) if token == expected_psk => {}
                            _ => {
                                warn!(peer = %address, "outbound peer PSK mismatch, rejecting");
                                return;
                            }
                        }
                    }

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
                    peer_id = Some(info.instance_id.clone());
                    registry.register(info).await;
                    break;
                }
            }
        }
    }

    let peer_id = match peer_id {
        Some(id) => id,
        None => return,
    };

    // Set up writer task with mpsc channel
    let (sender_tx, mut sender_rx) = mpsc::unbounded_channel::<String>();
    registry.register_sender(&peer_id, sender_tx).await;

    // Writer task
    let writer_peer_id = peer_id.clone();
    let writer_handle = tokio::spawn(async move {
        while let Some(msg) = sender_rx.recv().await {
            if tx.send(Message::Text(msg.into())).await.is_err() {
                warn!(peer = %writer_peer_id, "failed to send to outbound peer websocket");
                break;
            }
        }
    });

    // Reader loop
    while let Some(Ok(msg)) = rx.next().await {
        if let Message::Text(text) = msg {
            let text_str: &str = text.as_ref();
            if let Ok(fed_msg) = protocol::decode(text_str) {
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
                            let _ = registry.send_to(&peer_id, &encoded).await;
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
    writer_handle.abort();
    info!(instance = %peer_id, "outbound peer disconnected");
    registry.remove(&peer_id).await;
    let _ = state.federation_tx().send(
        FederationEvent::PeerDisconnected { instance_id: peer_id }
    );
}
