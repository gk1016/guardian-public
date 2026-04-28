//! Guardian Comms — tactical communications library.
//!
//! A self-contained comms module implementing Link 16-style layered
//! channels with role-based access control. Designed to be embedded
//! in the Guardian engine as a workspace crate.
//!
//! # Channel hierarchy
//!
//! - **Net** — org-wide or federation-wide ("all stations this net")
//! - **Group** — mission/CSAR/QRF scoped (auto-created with operational context)
//! - **Team** — sub-unit within a group (flight lead + wingman)
//! - **Direct** — 1:1 private channel
//!
//! # Clearance tiers
//!
//! - **Full** — sees all messages, all participants
//! - **Tactical** — sees messages up to Restricted, filtered participant list
//! - **Customer** — CSAR survivor / QRF client, single channel, minimal visibility
//!
//! # Message classification
//!
//! - **Unclass** — visible to all clearance levels
//! - **Restricted** — Tactical and Full only
//! - **Internal** — Full only

pub mod access;
pub mod channel;
pub mod crypto;
pub mod federation;
pub mod invite;
pub mod message;
pub mod participant;
pub mod routes;
pub mod types;
pub mod ws;

use sqlx::PgPool;
use ws::RoomRegistry;

/// The comms engine — holds shared state and provides the public API.
#[derive(Clone)]
pub struct CommsEngine {
    pool: PgPool,
    registry: RoomRegistry,
}

impl CommsEngine {
    /// Create a new CommsEngine.
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            registry: RoomRegistry::new(),
        }
    }

    /// Get a reference to the database pool.
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Get the WebSocket room registry.
    pub fn registry(&self) -> &RoomRegistry {
        &self.registry
    }

    /// Build the axum router for comms REST endpoints.
    /// Mount this in the engine: `.merge(comms.router())`
    pub fn router(&self) -> axum::Router<()> {
        routes::build_router(self.clone())
    }
}
