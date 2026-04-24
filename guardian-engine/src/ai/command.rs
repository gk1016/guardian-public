//! AI Command Processor — natural language interface to Guardian.
//!
//! Uses the configured AiProvider (any provider) with structured tool-call
//! prompting. The LLM emits `<tool_call>{"name":"...","input":{...}}</tool_call>`
//! when it needs data; we parse, execute against the DB, and loop until done.

use std::sync::Arc;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use tracing::{info, warn};

use crate::ai::provider::{AiProvider, ChatMessage, CompletionOptions};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct CommandResponse {
    pub response: String,
    pub tools_used: Vec<String>,
}

// ---------------------------------------------------------------------------
// Tool definitions (included in system prompt)
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS: &str = r#"
You have access to the following tools to query and manage Guardian. When you need to use a tool, output EXACTLY this format (no markdown fencing):

<tool_call>{"name": "tool_name", "input": {"param": "value"}}</tool_call>

You may call multiple tools in sequence. After each tool call, you will receive the results in a <tool_result> block. Use those results to formulate your final answer.

Available tools:

1. search_users — Search users by name, email, handle, role, or status
   Input: { "query"?: string, "role"?: string, "status"?: string, "limit"?: number }

2. search_missions — Search missions by callsign, title, type, status, or priority
   Input: { "query"?: string, "status"?: string, "mission_type"?: string, "priority"?: string, "limit"?: number }

3. search_intel — Search intel reports by title, type, severity, star system, or hostile group
   Input: { "query"?: string, "report_type"?: string, "severity"?: number, "star_system"?: string, "is_active"?: boolean, "limit"?: number }

4. search_rescues — Search rescue requests by survivor, status, or urgency
   Input: { "query"?: string, "status"?: string, "urgency"?: string, "limit"?: number }

5. search_incidents — Search incidents by title, category, severity, or status
   Input: { "query"?: string, "category"?: string, "severity"?: number, "status"?: string, "limit"?: number }

6. search_manuals — Search manual entries by title, category, or content
   Input: { "query"?: string, "category"?: string, "limit"?: number }

7. search_doctrine — Search doctrine templates by code, title, or category
   Input: { "query"?: string, "category"?: string, "limit"?: number }

8. search_qrf — Search QRF readiness by callsign or status
   Input: { "query"?: string, "status"?: string, "limit"?: number }

9. search_notifications — Search notifications by category, severity, or status
   Input: { "category"?: string, "severity"?: string, "status"?: string, "limit"?: number }

10. search_audit_logs — Search audit logs by action, user, or target
    Input: { "action"?: string, "user_id"?: string, "target_type"?: string, "limit"?: number }

11. get_org_stats — Get organization-wide summary statistics
    Input: {}

12. create_user — Create a new user
    Input: { "email": string, "handle": string, "role"?: string, "display_name"?: string }
    Roles: pilot (default), rescue_coordinator, director, admin, commander

13. update_user — Update a user's role or status
    Input: { "user_id": string, "role"?: string, "status"?: string, "display_name"?: string }

14. force_logout_user — Force-logout a user by invalidating their sessions
    Input: { "user_id": string }

15. reset_user_totp — Reset a user's TOTP/MFA configuration
    Input: { "user_id": string }

16. create_mission — Create a new mission
    Input: { "callsign": string, "title": string, "mission_type": string, "priority"?: string, "area_of_operation"?: string, "mission_brief"?: string }
    Types: patrol, escort, mining_op, trade_run, combat, recon, rescue, training, event, other

17. update_mission — Update a mission's status or details
    Input: { "mission_id": string, "status"?: string, "priority"?: string, "closeout_summary"?: string }
    Statuses: planning, briefed, active, complete, scrubbed

18. create_intel — Create a new intel report
    Input: { "title": string, "report_type"?: string, "severity"?: number, "description"?: string, "star_system"?: string, "hostile_group"?: string, "tags"?: string[] }

19. create_notification — Send an organization-wide notification
    Input: { "title": string, "body": string, "category"?: string, "severity"?: string }
    Categories: ops, admin, intel, alert. Severities: info, warning, critical.

IMPORTANT RULES:
- Always search before creating to avoid duplicates.
- When searching, use broad terms first, then narrow down.
- For user management actions (create, update role, force logout, reset TOTP), confirm the action clearly in your response.
- Return concise, actionable answers. Use tables or lists when showing multiple results.
- If you don't find what the user is looking for, say so clearly.
- Never fabricate data — only return what the tools provide.
"#;

fn build_system_prompt(session_handle: &str, session_role: &str, org_name: &str) -> String {
    format!(
        r#"You are Guardian AI, the intelligent command assistant for Guardian — a military-style search and rescue organization management platform. You help commanders and admins manage their organization through natural language.

Current operator: {session_handle} (role: {session_role})
Organization: {org_name}

{TOOL_DEFINITIONS}

Be direct and military-professional in tone. No fluff. Report findings concisely."#
    )
}

// ---------------------------------------------------------------------------
// Command processor
// ---------------------------------------------------------------------------

const MAX_TOOL_ROUNDS: usize = 8;

pub async fn process_command(
    provider: Arc<dyn AiProvider>,
    pool: &PgPool,
    org_id: &str,
    session_handle: &str,
    session_role: &str,
    session_user_id: &str,
    message: &str,
    history: Vec<CommandMessage>,
) -> Result<CommandResponse> {
    // Get org name
    let org_name: String = sqlx::query_scalar(r#"SELECT name FROM "Organization" WHERE id = $1"#)
        .bind(org_id)
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| "Unknown".to_string());

    let system_prompt = build_system_prompt(session_handle, session_role, &org_name);

    // Build message list from history + new message
    let mut messages: Vec<ChatMessage> = Vec::new();
    messages.push(ChatMessage {
        role: "system".into(),
        content: system_prompt,
    });

    for msg in &history {
        messages.push(ChatMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    messages.push(ChatMessage {
        role: "user".into(),
        content: message.to_string(),
    });

    let opts = CompletionOptions {
        max_tokens: 4096,
        temperature: 0.2,
    };

    let mut tools_used: Vec<String> = Vec::new();

    // Multi-turn tool-use loop
    for round in 0..MAX_TOOL_ROUNDS {
        let response = provider.complete(messages.clone(), opts.clone()).await?;

        // Check if response contains tool calls
        if let Some(tool_calls) = extract_tool_calls(&response) {
            info!(round, tool_count = tool_calls.len(), "processing tool calls");

            // Add assistant response to messages
            messages.push(ChatMessage {
                role: "assistant".into(),
                content: response.clone(),
            });

            // Execute each tool call and collect results
            let mut results = String::new();
            for tc in &tool_calls {
                tools_used.push(tc.name.clone());
                let result = execute_tool(pool, org_id, session_user_id, session_role, &tc.name, &tc.input).await;
                results.push_str(&format!(
                    "<tool_result name=\"{}\">\n{}\n</tool_result>\n",
                    tc.name,
                    match &result {
                        Ok(r) => r.clone(),
                        Err(e) => format!("Error: {}", e),
                    }
                ));
            }

            // Add tool results as user message
            messages.push(ChatMessage {
                role: "user".into(),
                content: results,
            });
        } else {
            // No tool calls — this is the final response
            // Strip any residual XML tags that might be in the response
            let clean = clean_response(&response);
            return Ok(CommandResponse {
                response: clean,
                tools_used,
            });
        }
    }

    Err(anyhow!("Too many tool-use rounds (max {})", MAX_TOOL_ROUNDS))
}

// ---------------------------------------------------------------------------
// Tool call parsing
// ---------------------------------------------------------------------------

#[derive(Debug)]
struct ToolCall {
    name: String,
    input: serde_json::Value,
}

fn extract_tool_calls(text: &str) -> Option<Vec<ToolCall>> {
    let mut calls = Vec::new();
    let mut search_from = 0;

    while let Some(start) = text[search_from..].find("<tool_call>") {
        let abs_start = search_from + start + "<tool_call>".len();
        if let Some(end) = text[abs_start..].find("</tool_call>") {
            let abs_end = abs_start + end;
            let json_str = text[abs_start..abs_end].trim();
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                let name = parsed.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let input = parsed.get("input")
                    .cloned()
                    .unwrap_or(serde_json::json!({}));
                if !name.is_empty() {
                    calls.push(ToolCall { name, input });
                }
            }
            search_from = abs_end + "</tool_call>".len();
        } else {
            break;
        }
    }

    if calls.is_empty() {
        None
    } else {
        Some(calls)
    }
}

fn clean_response(text: &str) -> String {
    // Remove any stray tool_call/tool_result tags
    let mut result = text.to_string();
    // Simple cleanup — remove any XML-like tags we use internally
    while let Some(start) = result.find("<tool_call>") {
        if let Some(end) = result[start..].find("</tool_call>") {
            result = format!("{}{}", &result[..start], &result[start + end + "</tool_call>".len()..]);
        } else {
            break;
        }
    }
    result.trim().to_string()
}

// ---------------------------------------------------------------------------
// Tool executor — dispatches to individual tool functions
// ---------------------------------------------------------------------------

async fn execute_tool(
    pool: &PgPool,
    org_id: &str,
    user_id: &str,
    user_role: &str,
    tool_name: &str,
    input: &serde_json::Value,
) -> Result<String> {
    match tool_name {
        "search_users" => tool_search_users(pool, org_id, input).await,
        "search_missions" => tool_search_missions(pool, org_id, input).await,
        "search_intel" => tool_search_intel(pool, org_id, input).await,
        "search_rescues" => tool_search_rescues(pool, org_id, input).await,
        "search_incidents" => tool_search_incidents(pool, org_id, input).await,
        "search_manuals" => tool_search_manuals(pool, org_id, input).await,
        "search_doctrine" => tool_search_doctrine(pool, org_id, input).await,
        "search_qrf" => tool_search_qrf(pool, org_id, input).await,
        "search_notifications" => tool_search_notifications(pool, org_id, input).await,
        "search_audit_logs" => tool_search_audit_logs(pool, org_id, input).await,
        "get_org_stats" => tool_get_org_stats(pool, org_id).await,
        // Write tools — require admin/commander role
        "create_user" => {
            require_admin(user_role)?;
            tool_create_user(pool, org_id, user_id, input).await
        }
        "update_user" => {
            require_admin(user_role)?;
            tool_update_user(pool, user_id, input).await
        }
        "force_logout_user" => {
            require_admin(user_role)?;
            tool_force_logout_user(pool, user_id, input).await
        }
        "reset_user_totp" => {
            require_admin(user_role)?;
            tool_reset_user_totp(pool, user_id, input).await
        }
        "create_mission" => {
            require_ops(user_role)?;
            tool_create_mission(pool, org_id, user_id, input).await
        }
        "update_mission" => {
            require_ops(user_role)?;
            tool_update_mission(pool, user_id, input).await
        }
        "create_intel" => {
            require_ops(user_role)?;
            tool_create_intel(pool, org_id, input).await
        }
        "create_notification" => {
            require_ops(user_role)?;
            tool_create_notification(pool, org_id, user_id, input).await
        }
        other => Err(anyhow!("Unknown tool: {}", other)),
    }
}

fn require_admin(role: &str) -> Result<()> {
    if matches!(role, "admin" | "commander") {
        Ok(())
    } else {
        Err(anyhow!("Insufficient permissions. Admin or Commander role required."))
    }
}

fn require_ops(role: &str) -> Result<()> {
    if matches!(role, "admin" | "commander" | "director" | "rescue_coordinator") {
        Ok(())
    } else {
        Err(anyhow!("Insufficient permissions. Operations role required."))
    }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

fn get_str(input: &serde_json::Value, key: &str) -> Option<String> {
    input.get(key).and_then(|v| v.as_str()).map(String::from)
}

fn get_i64(input: &serde_json::Value, key: &str) -> Option<i64> {
    input.get(key).and_then(|v| v.as_i64())
}

fn get_bool(input: &serde_json::Value, key: &str) -> Option<bool> {
    input.get(key).and_then(|v| v.as_bool())
}

fn get_limit(input: &serde_json::Value) -> i64 {
    get_i64(input, "limit").unwrap_or(20).min(50)
}

// ---------------------------------------------------------------------------
// Search tools
// ---------------------------------------------------------------------------

async fn tool_search_users(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let query = get_str(input, "query");
    let role = get_str(input, "role");
    let status = get_str(input, "status");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT u.id, u.email, u.handle, u."displayName", u.role, u.status, u."totpEnabled", u."createdAt"
           FROM "User" u
           JOIN "OrgMember" om ON om."userId" = u.id
           WHERE om."orgId" = $1"#
    );
    let mut param_idx = 2;
    let mut binds: Vec<String> = vec![org_id.to_string()];

    if let Some(q) = &query {
        sql.push_str(&format!(
            r#" AND (u.email ILIKE ${p} OR u.handle ILIKE ${p} OR u."displayName" ILIKE ${p})"#,
            p = param_idx
        ));
        binds.push(format!("%{}%", q));
        param_idx += 1;
    }
    if let Some(r) = &role {
        sql.push_str(&format!(" AND u.role = ${}", param_idx));
        binds.push(r.clone());
        param_idx += 1;
    }
    if let Some(s) = &status {
        sql.push_str(&format!(" AND u.status = ${}", param_idx));
        binds.push(s.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(" ORDER BY u.handle LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let users: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "email": r.get::<String, _>("email"),
            "handle": r.get::<String, _>("handle"),
            "displayName": r.get::<Option<String>, _>("displayName"),
            "role": r.get::<String, _>("role"),
            "status": r.get::<String, _>("status"),
            "totpEnabled": r.get::<bool, _>("totpEnabled"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": users.len(),
        "users": users
    }))?)
}

async fn tool_search_missions(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let query = get_str(input, "query");
    let status = get_str(input, "status");
    let mission_type = get_str(input, "mission_type");
    let priority = get_str(input, "priority");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT m.id, m.callsign, m.title, m."missionType", m.status, m.priority,
                  m."areaOfOperation", m."missionBrief", m."createdAt",
                  u.handle as lead_handle
           FROM "Mission" m
           LEFT JOIN "User" u ON u.id = m."leadId"
           WHERE m."orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(q) = &query {
        sql.push_str(&format!(
            " AND (m.callsign ILIKE ${p} OR m.title ILIKE ${p})",
            p = param_idx
        ));
        binds.push(format!("%{}%", q));
        param_idx += 1;
    }
    if let Some(s) = &status {
        sql.push_str(&format!(" AND m.status = ${}", param_idx));
        binds.push(s.clone());
        param_idx += 1;
    }
    if let Some(t) = &mission_type {
        sql.push_str(&format!(" AND m.\"missionType\" = ${}", param_idx));
        binds.push(t.clone());
        param_idx += 1;
    }
    if let Some(p) = &priority {
        sql.push_str(&format!(" AND m.priority = ${}", param_idx));
        binds.push(p.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(" ORDER BY m.\"createdAt\" DESC LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let missions: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "callsign": r.get::<String, _>("callsign"),
            "title": r.get::<String, _>("title"),
            "missionType": r.get::<String, _>("missionType"),
            "status": r.get::<String, _>("status"),
            "priority": r.get::<String, _>("priority"),
            "areaOfOperation": r.get::<Option<String>, _>("areaOfOperation"),
            "missionBrief": r.get::<Option<String>, _>("missionBrief"),
            "leadHandle": r.get::<Option<String>, _>("lead_handle"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": missions.len(),
        "missions": missions
    }))?)
}

async fn tool_search_intel(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let query = get_str(input, "query");
    let report_type = get_str(input, "report_type");
    let severity = get_i64(input, "severity");
    let star_system = get_str(input, "star_system");
    let is_active = get_bool(input, "is_active");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT id, title, "reportType", severity, description, "starSystem",
                  "hostileGroup", confidence, "isActive", "isVerified", tags, "createdAt"
           FROM "IntelReport" WHERE "orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(q) = &query {
        sql.push_str(&format!(
            " AND (title ILIKE ${p} OR description ILIKE ${p} OR \"hostileGroup\" ILIKE ${p})",
            p = param_idx
        ));
        binds.push(format!("%{}%", q));
        param_idx += 1;
    }
    if let Some(rt) = &report_type {
        sql.push_str(&format!(" AND \"reportType\" = ${}", param_idx));
        binds.push(rt.clone());
        param_idx += 1;
    }
    if let Some(ss) = &star_system {
        sql.push_str(&format!(" AND \"starSystem\" ILIKE ${}", param_idx));
        binds.push(format!("%{}%", ss));
        param_idx += 1;
    }

    // severity and is_active use direct interpolation since they're not strings
    if let Some(sev) = severity {
        sql.push_str(&format!(" AND severity <= {}", sev.min(5).max(1)));
    }
    if let Some(active) = is_active {
        sql.push_str(&format!(" AND \"isActive\" = {}", active));
    }

    sql.push_str(&format!(" ORDER BY \"createdAt\" DESC LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let intel: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "title": r.get::<String, _>("title"),
            "reportType": r.get::<String, _>("reportType"),
            "severity": r.get::<i32, _>("severity"),
            "description": r.get::<Option<String>, _>("description"),
            "starSystem": r.get::<Option<String>, _>("starSystem"),
            "hostileGroup": r.get::<Option<String>, _>("hostileGroup"),
            "confidence": r.get::<String, _>("confidence"),
            "isActive": r.get::<bool, _>("isActive"),
            "isVerified": r.get::<bool, _>("isVerified"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": intel.len(),
        "intel": intel
    }))?)
}

async fn tool_search_rescues(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let query = get_str(input, "query");
    let status = get_str(input, "status");
    let urgency = get_str(input, "urgency");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT r.id, r."survivorHandle", r.status, r.urgency, r."locationName",
                  r."threatSummary", r."escortRequired", r."medicalRequired", r."createdAt",
                  req.handle as requester, op.handle as operator
           FROM "RescueRequest" r
           JOIN "User" req ON req.id = r."requesterId"
           LEFT JOIN "User" op ON op.id = r."operatorId"
           WHERE r."orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(q) = &query {
        sql.push_str(&format!(
            " AND (r.\"survivorHandle\" ILIKE ${p} OR r.\"locationName\" ILIKE ${p})",
            p = param_idx
        ));
        binds.push(format!("%{}%", q));
        param_idx += 1;
    }
    if let Some(s) = &status {
        sql.push_str(&format!(" AND r.status = ${}", param_idx));
        binds.push(s.clone());
        param_idx += 1;
    }
    if let Some(u) = &urgency {
        sql.push_str(&format!(" AND r.urgency = ${}", param_idx));
        binds.push(u.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(" ORDER BY r.\"createdAt\" DESC LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let rescues: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "survivorHandle": r.get::<String, _>("survivorHandle"),
            "status": r.get::<String, _>("status"),
            "urgency": r.get::<String, _>("urgency"),
            "locationName": r.get::<Option<String>, _>("locationName"),
            "threatSummary": r.get::<Option<String>, _>("threatSummary"),
            "escortRequired": r.get::<bool, _>("escortRequired"),
            "medicalRequired": r.get::<bool, _>("medicalRequired"),
            "requester": r.get::<String, _>("requester"),
            "operator": r.get::<Option<String>, _>("operator"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": rescues.len(),
        "rescues": rescues
    }))?)
}

async fn tool_search_incidents(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let query = get_str(input, "query");
    let category = get_str(input, "category");
    let severity = get_i64(input, "severity");
    let status = get_str(input, "status");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT i.id, i.title, i.category, i.severity, i.status, i.summary,
                  i."lessonsLearned", i."createdAt",
                  rep.handle as reporter, rev.handle as reviewer
           FROM "Incident" i
           JOIN "User" rep ON rep.id = i."reporterId"
           LEFT JOIN "User" rev ON rev.id = i."reviewerId"
           WHERE i."orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(q) = &query {
        sql.push_str(&format!(
            " AND (i.title ILIKE ${p} OR i.summary ILIKE ${p})",
            p = param_idx
        ));
        binds.push(format!("%{}%", q));
        param_idx += 1;
    }
    if let Some(c) = &category {
        sql.push_str(&format!(" AND i.category = ${}", param_idx));
        binds.push(c.clone());
        param_idx += 1;
    }
    if let Some(s) = &status {
        sql.push_str(&format!(" AND i.status = ${}", param_idx));
        binds.push(s.clone());
        param_idx += 1;
    }
    if let Some(sev) = severity {
        sql.push_str(&format!(" AND i.severity <= {}", sev.min(5).max(1)));
    }

    sql.push_str(&format!(" ORDER BY i.\"createdAt\" DESC LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let incidents: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "title": r.get::<String, _>("title"),
            "category": r.get::<String, _>("category"),
            "severity": r.get::<i32, _>("severity"),
            "status": r.get::<String, _>("status"),
            "summary": r.get::<String, _>("summary"),
            "lessonsLearned": r.get::<Option<String>, _>("lessonsLearned"),
            "reporter": r.get::<String, _>("reporter"),
            "reviewer": r.get::<Option<String>, _>("reviewer"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": incidents.len(),
        "incidents": incidents
    }))?)
}

async fn tool_search_manuals(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let query = get_str(input, "query");
    let category = get_str(input, "category");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT m.id, m.title, m.category, m."entryType",
                  substring(m.body from 1 for 500) as body_preview,
                  m."createdAt", u.handle as author
           FROM "ManualEntry" m
           JOIN "User" u ON u.id = m."authorId"
           WHERE m."orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(q) = &query {
        sql.push_str(&format!(
            " AND (m.title ILIKE ${p} OR m.body ILIKE ${p})",
            p = param_idx
        ));
        binds.push(format!("%{}%", q));
        param_idx += 1;
    }
    if let Some(c) = &category {
        sql.push_str(&format!(" AND m.category = ${}", param_idx));
        binds.push(c.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(" ORDER BY m.\"createdAt\" DESC LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let manuals: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "title": r.get::<String, _>("title"),
            "category": r.get::<String, _>("category"),
            "entryType": r.get::<String, _>("entryType"),
            "bodyPreview": r.get::<Option<String>, _>("body_preview"),
            "author": r.get::<String, _>("author"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": manuals.len(),
        "manuals": manuals
    }))?)
}

async fn tool_search_doctrine(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let query = get_str(input, "query");
    let category = get_str(input, "category");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT id, code, title, category, summary, "isDefault", "createdAt"
           FROM "DoctrineTemplate" WHERE "orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(q) = &query {
        sql.push_str(&format!(
            " AND (code ILIKE ${p} OR title ILIKE ${p} OR summary ILIKE ${p})",
            p = param_idx
        ));
        binds.push(format!("%{}%", q));
        param_idx += 1;
    }
    if let Some(c) = &category {
        sql.push_str(&format!(" AND category = ${}", param_idx));
        binds.push(c.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(" ORDER BY code LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let docs: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "code": r.get::<String, _>("code"),
            "title": r.get::<String, _>("title"),
            "category": r.get::<String, _>("category"),
            "summary": r.get::<String, _>("summary"),
            "isDefault": r.get::<bool, _>("isDefault"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": docs.len(),
        "doctrine": docs
    }))?)
}

async fn tool_search_qrf(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let query = get_str(input, "query");
    let status = get_str(input, "status");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT id, callsign, status, platform, "locationName", "availableCrew", notes, "updatedAt"
           FROM "QrfReadiness" WHERE "orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(q) = &query {
        sql.push_str(&format!(" AND callsign ILIKE ${}", param_idx));
        binds.push(format!("%{}%", q));
        param_idx += 1;
    }
    if let Some(s) = &status {
        sql.push_str(&format!(" AND status = ${}", param_idx));
        binds.push(s.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(" ORDER BY callsign LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let qrf: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "callsign": r.get::<String, _>("callsign"),
            "status": r.get::<String, _>("status"),
            "platform": r.get::<Option<String>, _>("platform"),
            "locationName": r.get::<Option<String>, _>("locationName"),
            "availableCrew": r.get::<i32, _>("availableCrew"),
            "notes": r.get::<Option<String>, _>("notes"),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": qrf.len(),
        "qrf": qrf
    }))?)
}

async fn tool_search_notifications(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let category = get_str(input, "category");
    let severity = get_str(input, "severity");
    let status = get_str(input, "status");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT id, category, severity, title, body, status, "createdAt"
           FROM "Notification" WHERE "orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(c) = &category {
        sql.push_str(&format!(" AND category = ${}", param_idx));
        binds.push(c.clone());
        param_idx += 1;
    }
    if let Some(sev) = &severity {
        sql.push_str(&format!(" AND severity = ${}", param_idx));
        binds.push(sev.clone());
        param_idx += 1;
    }
    if let Some(s) = &status {
        sql.push_str(&format!(" AND status = ${}", param_idx));
        binds.push(s.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(" ORDER BY \"createdAt\" DESC LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let notifs: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "category": r.get::<String, _>("category"),
            "severity": r.get::<String, _>("severity"),
            "title": r.get::<String, _>("title"),
            "body": r.get::<String, _>("body"),
            "status": r.get::<String, _>("status"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": notifs.len(),
        "notifications": notifs
    }))?)
}

async fn tool_search_audit_logs(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let action = get_str(input, "action");
    let user_id = get_str(input, "user_id");
    let target_type = get_str(input, "target_type");
    let limit = get_limit(input);

    let mut sql = String::from(
        r#"SELECT a.id, a.action, a."targetType", a."targetId", a.metadata, a."createdAt",
                  u.handle as actor
           FROM "AuditLog" a
           JOIN "User" u ON u.id = a."userId"
           WHERE a."orgId" = $1"#
    );
    let mut binds: Vec<String> = vec![org_id.to_string()];
    let mut param_idx = 2;

    if let Some(act) = &action {
        sql.push_str(&format!(" AND a.action ILIKE ${}", param_idx));
        binds.push(format!("%{}%", act));
        param_idx += 1;
    }
    if let Some(uid) = &user_id {
        sql.push_str(&format!(" AND a.\"userId\" = ${}", param_idx));
        binds.push(uid.clone());
        param_idx += 1;
    }
    if let Some(tt) = &target_type {
        sql.push_str(&format!(" AND a.\"targetType\" = ${}", param_idx));
        binds.push(tt.clone());
        param_idx += 1;
    }

    sql.push_str(&format!(" ORDER BY a.\"createdAt\" DESC LIMIT {}", limit));

    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(pool).await?;

    let logs: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.get::<String, _>("id"),
            "action": r.get::<String, _>("action"),
            "targetType": r.get::<String, _>("targetType"),
            "targetId": r.get::<Option<String>, _>("targetId"),
            "actor": r.get::<String, _>("actor"),
            "createdAt": r.get::<chrono::NaiveDateTime, _>("createdAt").to_string(),
        })
    }).collect();

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "count": logs.len(),
        "auditLogs": logs
    }))?)
}

async fn tool_get_org_stats(pool: &PgPool, org_id: &str) -> Result<String> {
    let users: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "OrgMember" WHERE "orgId" = $1"#
    ).bind(org_id).fetch_one(pool).await?;

    let active_missions: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "Mission" WHERE "orgId" = $1 AND status IN ('planning','briefed','active')"#
    ).bind(org_id).fetch_one(pool).await?;

    let total_missions: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "Mission" WHERE "orgId" = $1"#
    ).bind(org_id).fetch_one(pool).await?;

    let active_intel: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "IntelReport" WHERE "orgId" = $1 AND "isActive" = true"#
    ).bind(org_id).fetch_one(pool).await?;

    let open_rescues: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "RescueRequest" WHERE "orgId" = $1 AND status = 'open'"#
    ).bind(org_id).fetch_one(pool).await?;

    let open_incidents: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "Incident" WHERE "orgId" = $1 AND status = 'open'"#
    ).bind(org_id).fetch_one(pool).await?;

    let qrf_ready: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "QrfReadiness" WHERE "orgId" = $1 AND status IN ('redcon1','redcon2')"#
    ).bind(org_id).fetch_one(pool).await?;

    let unread_alerts: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "Notification" WHERE "orgId" = $1 AND status = 'unread'"#
    ).bind(org_id).fetch_one(pool).await?;

    let manual_entries: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "ManualEntry" WHERE "orgId" = $1"#
    ).bind(org_id).fetch_one(pool).await?;

    let doctrine_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "DoctrineTemplate" WHERE "orgId" = $1"#
    ).bind(org_id).fetch_one(pool).await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "members": users,
        "activeMissions": active_missions,
        "totalMissions": total_missions,
        "activeIntel": active_intel,
        "openRescues": open_rescues,
        "openIncidents": open_incidents,
        "qrfReady": qrf_ready,
        "unreadAlerts": unread_alerts,
        "manualEntries": manual_entries,
        "doctrineTemplates": doctrine_count,
    }))?)
}

// ---------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------

async fn tool_create_user(pool: &PgPool, org_id: &str, actor_id: &str, input: &serde_json::Value) -> Result<String> {
    let email = get_str(input, "email").ok_or_else(|| anyhow!("email is required"))?;
    let handle = get_str(input, "handle").ok_or_else(|| anyhow!("handle is required"))?;
    let role = get_str(input, "role").unwrap_or_else(|| "pilot".to_string());
    let display_name = get_str(input, "display_name");

    let user_id = cuid2::create_id();
    let now = chrono::Utc::now().naive_utc();

    // Create user (no password — they'll need to set one or use invite flow)
    sqlx::query(
        r#"INSERT INTO "User" (id, email, handle, "displayName", role, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)"#
    )
    .bind(&user_id)
    .bind(&email)
    .bind(&handle)
    .bind(&display_name)
    .bind(&role)
    .bind(now)
    .execute(pool)
    .await?;

    // Add to org
    let member_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "OrgMember" (id, "userId", "orgId", rank, "joinedAt")
           VALUES ($1, $2, $3, 'member', $4)"#
    )
    .bind(&member_id)
    .bind(&user_id)
    .bind(org_id)
    .bind(now)
    .execute(pool)
    .await?;

    // Audit log
    let log_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "AuditLog" (id, "userId", "orgId", action, "targetType", "targetId", metadata, "createdAt")
           VALUES ($1, $2, $3, 'create_user', 'User', $4, $5, $6)"#
    )
    .bind(&log_id)
    .bind(actor_id)
    .bind(org_id)
    .bind(&user_id)
    .bind(serde_json::json!({"email": email, "handle": handle, "role": role}))
    .bind(now)
    .execute(pool)
    .await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "ok": true,
        "userId": user_id,
        "message": format!("User '{}' ({}) created with role '{}'. No password set — user will need to be given credentials.", handle, email, role)
    }))?)
}

async fn tool_update_user(pool: &PgPool, actor_id: &str, input: &serde_json::Value) -> Result<String> {
    let target_id = get_str(input, "user_id").ok_or_else(|| anyhow!("user_id is required"))?;
    let role = get_str(input, "role");
    let status = get_str(input, "status");
    let display_name = get_str(input, "display_name");
    let now = chrono::Utc::now().naive_utc();

    let mut updates = Vec::new();
    let mut metadata = serde_json::Map::new();

    if let Some(r) = &role {
        sqlx::query(r#"UPDATE "User" SET role = $1, "updatedAt" = $2 WHERE id = $3"#)
            .bind(r).bind(now).bind(&target_id).execute(pool).await?;
        updates.push(format!("role -> {}", r));
        metadata.insert("role".into(), serde_json::json!(r));
    }
    if let Some(s) = &status {
        sqlx::query(r#"UPDATE "User" SET status = $1, "updatedAt" = $2 WHERE id = $3"#)
            .bind(s).bind(now).bind(&target_id).execute(pool).await?;
        updates.push(format!("status -> {}", s));
        metadata.insert("status".into(), serde_json::json!(s));
    }
    if let Some(dn) = &display_name {
        sqlx::query(r#"UPDATE "User" SET "displayName" = $1, "updatedAt" = $2 WHERE id = $3"#)
            .bind(dn).bind(now).bind(&target_id).execute(pool).await?;
        updates.push(format!("displayName -> {}", dn));
        metadata.insert("displayName".into(), serde_json::json!(dn));
    }

    if updates.is_empty() {
        return Ok(r#"{"ok": false, "message": "No fields to update"}"#.to_string());
    }

    // Audit
    let log_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "AuditLog" (id, "userId", "orgId", action, "targetType", "targetId", metadata, "createdAt")
           VALUES ($1, $2, (SELECT "orgId" FROM "OrgMember" WHERE "userId" = $2 LIMIT 1), 'update_user', 'User', $3, $4, $5)"#
    )
    .bind(&log_id).bind(actor_id).bind(&target_id)
    .bind(serde_json::Value::Object(metadata)).bind(now)
    .execute(pool).await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "ok": true,
        "message": format!("User updated: {}", updates.join(", "))
    }))?)
}

async fn tool_force_logout_user(pool: &PgPool, actor_id: &str, input: &serde_json::Value) -> Result<String> {
    let target_id = get_str(input, "user_id").ok_or_else(|| anyhow!("user_id is required"))?;
    let now = chrono::Utc::now().naive_utc();

    sqlx::query(r#"UPDATE "User" SET "sessionsInvalidatedAt" = $1, "updatedAt" = $1 WHERE id = $2"#)
        .bind(now).bind(&target_id).execute(pool).await?;

    let log_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "AuditLog" (id, "userId", "orgId", action, "targetType", "targetId", "createdAt")
           VALUES ($1, $2, (SELECT "orgId" FROM "OrgMember" WHERE "userId" = $2 LIMIT 1), 'force_logout', 'User', $3, $4)"#
    )
    .bind(&log_id).bind(actor_id).bind(&target_id).bind(now)
    .execute(pool).await?;

    // Get handle for confirmation
    let handle: Option<String> = sqlx::query_scalar(r#"SELECT handle FROM "User" WHERE id = $1"#)
        .bind(&target_id).fetch_optional(pool).await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "ok": true,
        "message": format!("Force-logged out user '{}'", handle.unwrap_or(target_id))
    }))?)
}

async fn tool_reset_user_totp(pool: &PgPool, actor_id: &str, input: &serde_json::Value) -> Result<String> {
    let target_id = get_str(input, "user_id").ok_or_else(|| anyhow!("user_id is required"))?;
    let now = chrono::Utc::now().naive_utc();

    sqlx::query(
        r#"UPDATE "User" SET "totpSecret" = NULL, "totpEnabled" = false, "updatedAt" = $1 WHERE id = $2"#
    )
    .bind(now).bind(&target_id).execute(pool).await?;

    let log_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "AuditLog" (id, "userId", "orgId", action, "targetType", "targetId", "createdAt")
           VALUES ($1, $2, (SELECT "orgId" FROM "OrgMember" WHERE "userId" = $2 LIMIT 1), 'reset_totp', 'User', $3, $4)"#
    )
    .bind(&log_id).bind(actor_id).bind(&target_id).bind(now)
    .execute(pool).await?;

    let handle: Option<String> = sqlx::query_scalar(r#"SELECT handle FROM "User" WHERE id = $1"#)
        .bind(&target_id).fetch_optional(pool).await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "ok": true,
        "message": format!("TOTP reset for user '{}'", handle.unwrap_or(target_id))
    }))?)
}

async fn tool_create_mission(pool: &PgPool, org_id: &str, actor_id: &str, input: &serde_json::Value) -> Result<String> {
    let callsign = get_str(input, "callsign").ok_or_else(|| anyhow!("callsign is required"))?;
    let title = get_str(input, "title").ok_or_else(|| anyhow!("title is required"))?;
    let mission_type = get_str(input, "mission_type").ok_or_else(|| anyhow!("mission_type is required"))?;
    let priority = get_str(input, "priority").unwrap_or_else(|| "routine".to_string());
    let area = get_str(input, "area_of_operation");
    let brief = get_str(input, "mission_brief");

    let mission_id = cuid2::create_id();
    let now = chrono::Utc::now().naive_utc();

    sqlx::query(
        r#"INSERT INTO "Mission" (id, "orgId", callsign, title, "missionType", status, priority,
                                   "areaOfOperation", "missionBrief", "leadId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'planning', $6, $7, $8, $9, $10, $10)"#
    )
    .bind(&mission_id).bind(org_id).bind(&callsign).bind(&title)
    .bind(&mission_type).bind(&priority).bind(&area).bind(&brief)
    .bind(actor_id).bind(now)
    .execute(pool).await?;

    let log_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "AuditLog" (id, "userId", "orgId", action, "targetType", "targetId", metadata, "createdAt")
           VALUES ($1, $2, $3, 'create_mission', 'Mission', $4, $5, $6)"#
    )
    .bind(&log_id).bind(actor_id).bind(org_id).bind(&mission_id)
    .bind(serde_json::json!({"callsign": callsign, "title": title, "type": mission_type}))
    .bind(now)
    .execute(pool).await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "ok": true,
        "missionId": mission_id,
        "message": format!("Mission '{}' ({}) created in planning status", callsign, title)
    }))?)
}

async fn tool_update_mission(pool: &PgPool, actor_id: &str, input: &serde_json::Value) -> Result<String> {
    let mission_id = get_str(input, "mission_id").ok_or_else(|| anyhow!("mission_id is required"))?;
    let status = get_str(input, "status");
    let priority = get_str(input, "priority");
    let closeout = get_str(input, "closeout_summary");
    let now = chrono::Utc::now().naive_utc();

    let mut updates = Vec::new();

    if let Some(s) = &status {
        sqlx::query(r#"UPDATE "Mission" SET status = $1, "updatedAt" = $2 WHERE id = $3"#)
            .bind(s).bind(now).bind(&mission_id).execute(pool).await?;
        updates.push(format!("status -> {}", s));
        if s == "complete" {
            sqlx::query(r#"UPDATE "Mission" SET "completedAt" = $1 WHERE id = $2"#)
                .bind(now).bind(&mission_id).execute(pool).await?;
        }
    }
    if let Some(p) = &priority {
        sqlx::query(r#"UPDATE "Mission" SET priority = $1, "updatedAt" = $2 WHERE id = $3"#)
            .bind(p).bind(now).bind(&mission_id).execute(pool).await?;
        updates.push(format!("priority -> {}", p));
    }
    if let Some(c) = &closeout {
        sqlx::query(r#"UPDATE "Mission" SET "closeoutSummary" = $1, "updatedAt" = $2 WHERE id = $3"#)
            .bind(c).bind(now).bind(&mission_id).execute(pool).await?;
        updates.push("closeout summary set".to_string());
    }

    if updates.is_empty() {
        return Ok(r#"{"ok": false, "message": "No fields to update"}"#.to_string());
    }

    let log_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "AuditLog" (id, "userId", "orgId", action, "targetType", "targetId", "createdAt")
           VALUES ($1, $2, (SELECT "orgId" FROM "Mission" WHERE id = $3), 'update_mission', 'Mission', $3, $4)"#
    )
    .bind(&log_id).bind(actor_id).bind(&mission_id).bind(now)
    .execute(pool).await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "ok": true,
        "message": format!("Mission updated: {}", updates.join(", "))
    }))?)
}

async fn tool_create_intel(pool: &PgPool, org_id: &str, input: &serde_json::Value) -> Result<String> {
    let title = get_str(input, "title").ok_or_else(|| anyhow!("title is required"))?;
    let report_type = get_str(input, "report_type").unwrap_or_else(|| "sighting".to_string());
    let severity = get_i64(input, "severity").unwrap_or(3) as i32;
    let description = get_str(input, "description");
    let star_system = get_str(input, "star_system");
    let hostile_group = get_str(input, "hostile_group");
    let tags: Vec<String> = input.get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let intel_id = cuid2::create_id();
    let now = chrono::Utc::now().naive_utc();

    sqlx::query(
        r#"INSERT INTO "IntelReport" (id, "orgId", title, "reportType", severity, description,
                                       "starSystem", "hostileGroup", tags, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)"#
    )
    .bind(&intel_id).bind(org_id).bind(&title).bind(&report_type)
    .bind(severity).bind(&description).bind(&star_system).bind(&hostile_group)
    .bind(&tags).bind(now)
    .execute(pool).await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "ok": true,
        "intelId": intel_id,
        "message": format!("Intel report '{}' created (severity {})", title, severity)
    }))?)
}

async fn tool_create_notification(pool: &PgPool, org_id: &str, actor_id: &str, input: &serde_json::Value) -> Result<String> {
    let title = get_str(input, "title").ok_or_else(|| anyhow!("title is required"))?;
    let body = get_str(input, "body").ok_or_else(|| anyhow!("body is required"))?;
    let category = get_str(input, "category").unwrap_or_else(|| "ops".to_string());
    let severity = get_str(input, "severity").unwrap_or_else(|| "info".to_string());

    let notif_id = cuid2::create_id();
    let now = chrono::Utc::now().naive_utc();

    sqlx::query(
        r#"INSERT INTO "Notification" (id, "orgId", "createdById", category, severity, title, body, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'unread', $8, $8)"#
    )
    .bind(&notif_id).bind(org_id).bind(actor_id)
    .bind(&category).bind(&severity).bind(&title).bind(&body).bind(now)
    .execute(pool).await?;

    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "ok": true,
        "notificationId": notif_id,
        "message": format!("Notification sent: '{}' ({})", title, severity)
    }))?)
}
