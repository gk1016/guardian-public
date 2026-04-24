use std::sync::Arc;
use anyhow::{anyhow, Context as AnyhowContext};
use serenity::all::{
    Client, Context, CreateCommand, CreateCommandOption, CommandOptionType,
    EventHandler, GatewayIntents, GuildId, Interaction, Ready,
};
use tracing::{info, error, warn};

use crate::state::AppState;
use super::commands;
use super::bridge;

/// Channel configuration resolved from DB
#[derive(Debug, Clone)]
pub struct ChannelConfig {
    pub main: u64,
    pub alerts: Option<u64>,
    pub intel: Option<u64>,
    pub missions: Option<u64>,
}

/// Serenity event handler with access to AppState
struct Handler {
    state: AppState,
    guild_id: GuildId,
    channels: ChannelConfig,
}

#[serenity::async_trait]
impl EventHandler for Handler {
    async fn ready(&self, ctx: Context, ready: Ready) {
        info!("Discord bot connected as {}", ready.user.name);

        let cmds = vec![
            CreateCommand::new("status")
                .description("Guardian org status overview"),
            CreateCommand::new("intel")
                .description("Recent intel reports")
                .add_option(
                    CreateCommandOption::new(
                        CommandOptionType::Integer,
                        "count",
                        "Number of reports (1-10)",
                    )
                    .min_int_value(1)
                    .max_int_value(10)
                    .required(false),
                ),
            CreateCommand::new("missions")
                .description("Active missions"),
            CreateCommand::new("qrf")
                .description("QRF readiness board"),
            CreateCommand::new("sitrep")
                .description("AI-generated situation report"),
        ];

        if let Err(e) = self.guild_id.set_commands(&ctx.http, cmds).await {
            error!("Failed to register slash commands: {e}");
        } else {
            info!("Registered 5 slash commands to guild {}", self.guild_id);
        }

        // Start event bridge
        let bridge_state = self.state.clone();
        let bridge_channels = self.channels.clone();
        let http = Arc::new(ctx.http.clone());
        tokio::spawn(async move {
            bridge::run(bridge_state, bridge_channels, http).await;
        });
    }

    async fn interaction_create(&self, ctx: Context, interaction: Interaction) {
        if let Interaction::Command(cmd) = interaction {
            let result = match cmd.data.name.as_str() {
                "status" => commands::handle_status(&ctx, &cmd, &self.state).await,
                "intel" => commands::handle_intel(&ctx, &cmd, &self.state).await,
                "missions" => commands::handle_missions(&ctx, &cmd, &self.state).await,
                "qrf" => commands::handle_qrf(&ctx, &cmd, &self.state).await,
                "sitrep" => commands::handle_sitrep(&ctx, &cmd, &self.state).await,
                name => {
                    warn!("Unknown slash command: {name}");
                    Ok(())
                }
            };
            if let Err(e) = result {
                error!("Slash command /{} error: {e}", cmd.data.name);
            }
        }
    }
}

/// Read Discord config from DB. Returns None if not configured or disabled.
pub async fn read_config(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Option<(String, u64, ChannelConfig)>> {
    let row = sqlx::query_as::<_, (
        Option<String>,
        Option<String>,
        bool,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )>(
        r#"SELECT "botToken", "guildId", "enabled",
           "mainChannelId", "alertChannelId", "intelChannelId", "missionChannelId"
           FROM "DiscordConfig" LIMIT 1"#,
    )
    .fetch_optional(pool)
    .await?;

    let Some((Some(token), Some(guild_str), enabled, main_ch, alert_ch, intel_ch, mission_ch)) =
        row
    else {
        return Ok(None);
    };

    if !enabled {
        return Ok(None);
    }

    let guild_id: u64 = guild_str
        .parse()
        .context("Invalid guild ID in DiscordConfig")?;

    let main = main_ch
        .as_deref()
        .and_then(|s| s.parse::<u64>().ok())
        .ok_or_else(|| anyhow!("mainChannelId is required when Discord is enabled"))?;

    let channels = ChannelConfig {
        main,
        alerts: alert_ch.as_deref().and_then(|s| s.parse().ok()),
        intel: intel_ch.as_deref().and_then(|s| s.parse().ok()),
        missions: mission_ch.as_deref().and_then(|s| s.parse().ok()),
    };

    Ok(Some((token, guild_id, channels)))
}

/// Start or restart the Discord bot based on current DB config.
pub async fn start_or_restart(state: &AppState) -> anyhow::Result<()> {
    // Stop existing bot if running
    stop(state).await;

    let config = read_config(state.pool()).await?;
    let Some((token, guild_id, channels)) = config else {
        info!("Discord bot not configured or disabled \u{2014} skipping start");
        return Ok(());
    };

    info!("Starting Discord bot for guild {guild_id}");

    let handler = Handler {
        state: state.clone(),
        guild_id: GuildId::new(guild_id),
        channels,
    };

    let intents = GatewayIntents::GUILD_MESSAGES
        | GatewayIntents::MESSAGE_CONTENT
        | GatewayIntents::GUILDS;

    let state_clone = state.clone();
    let handle = tokio::spawn(async move {
        let client_result = Client::builder(&token, intents)
            .event_handler(handler)
            .await;

        match client_result {
            Ok(mut client) => {
                if let Err(e) = client.start().await {
                    error!("Discord client error: {e}");
                }
            }
            Err(e) => {
                error!("Failed to build Discord client: {e}");
            }
        }

        // Clear handle on exit
        let mut lock = state_clone.discord_handle().lock().await;
        *lock = None;
    });

    let mut lock = state.discord_handle().lock().await;
    *lock = Some(handle);

    Ok(())
}

/// Stop the running Discord bot if any.
pub async fn stop(state: &AppState) {
    let mut lock = state.discord_handle().lock().await;
    if let Some(handle) = lock.take() {
        info!("Stopping Discord bot");
        handle.abort();
    }
}
