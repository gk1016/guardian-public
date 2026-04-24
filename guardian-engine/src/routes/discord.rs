use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error};

use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/discord/config", get(get_config).put(put_config))
        .route("/api/discord/test", post(test_connection))
}

#[derive(Serialize)]
struct ConfigResponse {
    config: Option<DiscordConfigDto>,
}

#[derive(Serialize)]
struct DiscordConfigDto {
    id: String,
    #[serde(rename = "hasBotToken")]
    has_bot_token: bool,
    #[serde(rename = "guildId")]
    guild_id: Option<String>,
    enabled: bool,
    #[serde(rename = "mainChannelId")]
    main_channel_id: Option<String>,
    #[serde(rename = "alertChannelId")]
    alert_channel_id: Option<String>,
    #[serde(rename = "intelChannelId")]
    intel_channel_id: Option<String>,
    #[serde(rename = "missionChannelId")]
    mission_channel_id: Option<String>,
}

async fn get_config(
    State(state): State<AppState>,
) -> Result<Json<ConfigResponse>, StatusCode> {
    let row = sqlx::query_as::<_, (
        String,
        Option<String>,
        Option<String>,
        bool,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )>(
        r#"SELECT "id", "botToken", "guildId", "enabled",
           "mainChannelId", "alertChannelId", "intelChannelId", "missionChannelId"
           FROM "DiscordConfig" LIMIT 1"#,
    )
    .fetch_optional(state.pool())
    .await
    .map_err(|e| {
        error!("Failed to fetch Discord config: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let config = row.map(
        |(id, bot_token, guild_id, enabled, main_ch, alert_ch, intel_ch, mission_ch)| {
            DiscordConfigDto {
                id,
                has_bot_token: bot_token.is_some(),
                guild_id,
                enabled,
                main_channel_id: main_ch,
                alert_channel_id: alert_ch,
                intel_channel_id: intel_ch,
                mission_channel_id: mission_ch,
            }
        },
    );

    Ok(Json(ConfigResponse { config }))
}

#[derive(Deserialize)]
struct UpdateConfigRequest {
    bot_token: Option<String>,
    guild_id: Option<String>,
    enabled: Option<bool>,
    main_channel_id: Option<String>,
    alert_channel_id: Option<String>,
    intel_channel_id: Option<String>,
    mission_channel_id: Option<String>,
}

#[derive(Serialize)]
struct UpdateResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bot_restarted: Option<bool>,
}

async fn put_config(
    State(state): State<AppState>,
    Json(body): Json<UpdateConfigRequest>,
) -> Result<Json<UpdateResponse>, StatusCode> {
    // Check if config row exists
    let existing: Option<(String,)> = sqlx::query_as(
        r#"SELECT "id" FROM "DiscordConfig" LIMIT 1"#,
    )
    .fetch_optional(state.pool())
    .await
    .map_err(|e| {
        error!("DB error: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some((id,)) = existing {
        // Update existing
        let mut set_clauses = vec![r#""updatedAt" = NOW()"#.to_string()];
        let mut param_idx = 1u32;
        let mut params: Vec<Option<String>> = Vec::new();

        if let Some(ref token) = body.bot_token {
            if !token.is_empty() {
                param_idx += 1;
                set_clauses.push(format!(r#""botToken" = ${param_idx}"#));
                params.push(Some(token.clone()));
            }
        }
        if let Some(ref gid) = body.guild_id {
            param_idx += 1;
            set_clauses.push(format!(r#""guildId" = ${param_idx}"#));
            params.push(Some(gid.clone()));
        }
        if let Some(ref ch) = body.main_channel_id {
            param_idx += 1;
            set_clauses.push(format!(r#""mainChannelId" = ${param_idx}"#));
            params.push(Some(ch.clone()));
        }
        if let Some(ref ch) = body.alert_channel_id {
            param_idx += 1;
            set_clauses.push(format!(r#""alertChannelId" = ${param_idx}"#));
            params.push(Some(ch.clone()));
        }
        if let Some(ref ch) = body.intel_channel_id {
            param_idx += 1;
            set_clauses.push(format!(r#""intelChannelId" = ${param_idx}"#));
            params.push(Some(ch.clone()));
        }
        if let Some(ref ch) = body.mission_channel_id {
            param_idx += 1;
            set_clauses.push(format!(r#""missionChannelId" = ${param_idx}"#));
            params.push(Some(ch.clone()));
        }

        // Build dynamic query with enabled as a boolean literal
        let enabled_clause = if let Some(en) = body.enabled {
            format!(r#", "enabled" = {en}"#)
        } else {
            String::new()
        };

        let sql = format!(
            r#"UPDATE "DiscordConfig" SET {} {} WHERE "id" = $1"#,
            set_clauses.join(", "),
            enabled_clause,
        );

        let mut query = sqlx::query(&sql).bind(&id);
        for p in &params {
            query = query.bind(p);
        }

        query.execute(state.pool()).await.map_err(|e| {
            error!("Failed to update Discord config: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    } else {
        // Insert new row \u{2014} need orgId
        let org: Option<(String,)> = sqlx::query_as(
            r#"SELECT "id" FROM "Organization" LIMIT 1"#,
        )
        .fetch_optional(state.pool())
        .await
        .map_err(|e| {
            error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        let Some((org_id,)) = org else {
            return Ok(Json(UpdateResponse {
                ok: false,
                error: Some("No organization found".into()),
                bot_restarted: None,
            }));
        };

        sqlx::query(
            r#"INSERT INTO "DiscordConfig" ("id", "orgId", "botToken", "guildId", "enabled",
               "mainChannelId", "alertChannelId", "intelChannelId", "missionChannelId", "updatedAt")
               VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW())"#,
        )
        .bind(&org_id)
        .bind(&body.bot_token)
        .bind(&body.guild_id)
        .bind(body.enabled.unwrap_or(false))
        .bind(&body.main_channel_id)
        .bind(&body.alert_channel_id)
        .bind(&body.intel_channel_id)
        .bind(&body.mission_channel_id)
        .execute(state.pool())
        .await
        .map_err(|e| {
            error!("Failed to insert Discord config: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    // Restart bot with new config
    info!("Discord config updated, restarting bot");
    let bot_restarted = match crate::discord::start_or_restart(&state).await {
        Ok(()) => true,
        Err(e) => {
            error!("Failed to restart Discord bot: {e}");
            false
        }
    };

    Ok(Json(UpdateResponse {
        ok: true,
        error: None,
        bot_restarted: Some(bot_restarted),
    }))
}

#[derive(Serialize)]
struct TestResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    guild_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

async fn test_connection(
    State(state): State<AppState>,
) -> Result<Json<TestResponse>, StatusCode> {
    let row = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        r#"SELECT "botToken", "guildId" FROM "DiscordConfig" LIMIT 1"#,
    )
    .fetch_optional(state.pool())
    .await
    .map_err(|e| {
        error!("DB error: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let Some((Some(token), Some(guild_id_str))) = row else {
        return Ok(Json(TestResponse {
            ok: false,
            username: None,
            guild_name: None,
            error: Some("Bot token or guild ID not configured".into()),
        }));
    };

    let client = reqwest::Client::new();

    // Test 1: validate token by fetching bot user
    let user_res = client
        .get("https://discord.com/api/v10/users/@me")
        .header("Authorization", format!("Bot {token}"))
        .send()
        .await;

    let username = match user_res {
        Ok(res) if res.status().is_success() => {
            let body: serde_json::Value = res.json().await.unwrap_or_default();
            body.get("username")
                .and_then(|v| v.as_str())
                .map(String::from)
        }
        Ok(res) => {
            return Ok(Json(TestResponse {
                ok: false,
                username: None,
                guild_name: None,
                error: Some(format!("Discord API returned {}", res.status())),
            }));
        }
        Err(e) => {
            return Ok(Json(TestResponse {
                ok: false,
                username: None,
                guild_name: None,
                error: Some(format!("Failed to reach Discord API: {e}")),
            }));
        }
    };

    // Test 2: verify guild access
    let guild_res = client
        .get(format!(
            "https://discord.com/api/v10/guilds/{guild_id_str}"
        ))
        .header("Authorization", format!("Bot {token}"))
        .send()
        .await;

    let guild_name = match guild_res {
        Ok(res) if res.status().is_success() => {
            let body: serde_json::Value = res.json().await.unwrap_or_default();
            body.get("name")
                .and_then(|v| v.as_str())
                .map(String::from)
        }
        _ => None,
    };

    Ok(Json(TestResponse {
        ok: true,
        username,
        guild_name,
        error: None,
    }))
}
