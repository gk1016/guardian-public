use axum::{
    Router,
    routing::get,
    extract::{State, WebSocketUpgrade, ws::{Message, WebSocket}},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use tracing::info;

use crate::state::AppState;

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: AppState) {
    let (mut tx, mut rx) = socket.split();
    let mut event_rx = state.event_tx().subscribe();

    info!("websocket client connected");

    // Forward broadcast events to this client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = event_rx.recv().await {
            if tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Read messages from client (commands, subscriptions, etc.)
    while let Some(Ok(msg)) = rx.next().await {
        match msg {
            Message::Text(text) => {
                // TODO: parse client commands (subscribe to specific org events, etc.)
                info!(msg = %text, "ws client message");
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    send_task.abort();
    info!("websocket client disconnected");
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/ws", get(ws_upgrade))
}
