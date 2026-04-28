//! Read-only view endpoints for SPA page data.
//!
//! Replaces Next.js server-component data fetching (guardian-data.ts).
//! All handlers require AuthSession and scope data to the user's org.

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use axum::http::StatusCode;
use serde::Serialize;
use serde_json::{json, Value};

use crate::auth::middleware::AuthSession;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/views/command", get(command_overview))
        .route("/api/views/missions", get(missions_list))
        .route("/api/views/missions/{id}", get(mission_detail))
        .route("/api/views/doctrine", get(doctrine_list))
        .route("/api/views/roster", get(roster_list))
        .route("/api/views/intel", get(intel_list))
        .route("/api/views/rescues", get(rescues_list))
        .route("/api/views/settings", get(settings_profile))
        .route("/api/views/qrf", get(qrf_list))
}

// ── Error helper ────────────────────────────────────────────────────────────

fn internal(msg: &str) -> (StatusCode, Json<Value>) {
    tracing::error!(msg, "view query failed");
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": msg})))
}

// ── Package summary (port of summarizePackageStatus) ────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageSummary {
    total: i32,
    open: i32,
    staffed_total: i32,
    assigned: i32,
    ready: i32,
    launched: i32,
    rtb: i32,
    ready_or_launched: i32,
    readiness_label: String,
}

fn summarize_package(participants: &[ParticipantRow]) -> PackageSummary {
    let mut open = 0i32;
    let mut assigned = 0i32;
    let mut ready = 0i32;
    let mut launched = 0i32;
    let mut rtb = 0i32;

    for p in participants {
        match p.status.as_str() {
            "open" => open += 1,
            "assigned" => assigned += 1,
            "ready" => ready += 1,
            "launched" => launched += 1,
            "rtb" => rtb += 1,
            _ => {}
        }
    }

    let total = participants.len() as i32;
    let staffed_total = total - open;
    let ready_or_launched = ready + launched;

    let readiness_label = if total == 0 {
        "unassigned"
    } else if staffed_total == 0 {
        "skeleton"
    } else if ready_or_launched == staffed_total && open == 0 {
        "green"
    } else if ready_or_launched > 0 {
        "partial"
    } else {
        "cold"
    }
    .to_string();

    PackageSummary {
        total,
        open,
        staffed_total,
        assigned,
        ready,
        launched,
        rtb,
        ready_or_launched,
        readiness_label,
    }
}

// ── Package discipline evaluation (port of evaluatePackageDiscipline) ────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageRoleCheck {
    key: String,
    label: String,
    required_count: i32,
    matched_count: i32,
    matched_handles: Vec<String>,
    open_count: i32,
    open_handles: Vec<String>,
    shortfall: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageDiscipline {
    profile_code: String,
    profile_label: String,
    coverage_label: String,
    shortfall_count: i32,
    warnings: Vec<String>,
    role_checks: Vec<PackageRoleCheck>,
}

struct RoleDef {
    key: &'static str,
    label: &'static str,
    required: i32,
    matchers: &'static [&'static str],
    allow_lead: bool,
}

struct Profile {
    code: &'static str,
    label: &'static str,
    type_matchers: &'static [&'static str],
    roles: &'static [RoleDef],
}

static PROFILES: &[Profile] = &[
    Profile {
        code: "escort_cap",
        label: "Escort / CAP package",
        type_matchers: &["escort", "counter-piracy", "patrol", "cap"],
        roles: &[
            RoleDef { key: "package_lead", label: "Package lead", required: 1, matchers: &["lead", "commander"], allow_lead: true },
            RoleDef { key: "escort_wing", label: "Escort wing", required: 1, matchers: &["escort", "wing", "cap", "interceptor"], allow_lead: false },
            RoleDef { key: "reserve_element", label: "Reserve element", required: 1, matchers: &["reserve", "qrf", "strike", "interceptor"], allow_lead: false },
        ],
    },
    Profile {
        code: "qrf",
        label: "QRF package",
        type_matchers: &["qrf", "response", "interdict"],
        roles: &[
            RoleDef { key: "qrf_lead", label: "QRF lead", required: 1, matchers: &["lead", "commander"], allow_lead: true },
            RoleDef { key: "response_wing", label: "Response wing", required: 1, matchers: &["wing", "cap", "reserve", "escort"], allow_lead: false },
        ],
    },
    Profile {
        code: "csar",
        label: "CSAR package",
        type_matchers: &["csar", "rescue", "medevac"],
        roles: &[
            RoleDef { key: "rescue_lead", label: "Rescue lead", required: 1, matchers: &["lead", "coordinator"], allow_lead: true },
            RoleDef { key: "rescue_bird", label: "Rescue bird", required: 1, matchers: &["rescue", "medevac", "cutlass red", "medical"], allow_lead: false },
            RoleDef { key: "escort_element", label: "Escort element", required: 1, matchers: &["escort", "wing", "cap", "security"], allow_lead: false },
        ],
    },
    Profile {
        code: "recon",
        label: "Recon package",
        type_matchers: &["recon", "intel", "surveillance"],
        roles: &[
            RoleDef { key: "recon_lead", label: "Recon lead", required: 1, matchers: &["lead", "recon", "observer"], allow_lead: true },
            RoleDef { key: "overwatch", label: "Overwatch", required: 1, matchers: &["overwatch", "wing", "escort", "cover"], allow_lead: false },
        ],
    },
];

fn normalize(s: &str) -> String {
    s.trim().to_lowercase()
}

fn normalize_handle(s: &str) -> String {
    s.replace(' ', "").trim().to_uppercase()
}

fn select_profile(mission_type: &str) -> &'static Profile {
    let mt = normalize(mission_type);
    PROFILES
        .iter()
        .find(|p| p.type_matchers.iter().any(|m| mt.contains(m)))
        .unwrap_or(&PROFILES[0])
}

fn evaluate_package_discipline(
    mission_type: &str,
    participants: &[ParticipantRow],
    lead_display: &str,
    readiness_label: &str,
    ready_or_launched: i32,
    total: i32,
    open_count: i32,
    staffed_total: i32,
) -> PackageDiscipline {
    let profile = select_profile(mission_type);
    let lead_assigned = normalize(lead_display) != "unassigned";

    let mut staffed_indexes: Vec<usize> = participants
        .iter()
        .enumerate()
        .filter(|(_, p)| p.status != "open")
        .map(|(i, _)| i)
        .collect();
    let mut open_indexes: Vec<usize> = participants
        .iter()
        .enumerate()
        .filter(|(_, p)| p.status == "open")
        .map(|(i, _)| i)
        .collect();

    let mut role_checks = Vec::new();

    for role in profile.roles {
        let mut matched_handles: Vec<String> = Vec::new();
        let mut matched_count = 0i32;

        if role.allow_lead && lead_assigned && matched_count < role.required {
            matched_handles.push(lead_display.to_string());
            matched_count += 1;
        }

        let mut to_remove = Vec::new();
        for (si, &idx) in staffed_indexes.iter().enumerate() {
            if matched_count >= role.required {
                break;
            }
            let p = &participants[idx];
            let target = format!("{} {}", normalize(&p.role), normalize(&p.status));
            if role.matchers.iter().any(|m| target.contains(m)) {
                matched_handles.push(p.handle.clone());
                matched_count += 1;
                to_remove.push(si);
            }
        }
        for &i in to_remove.iter().rev() {
            staffed_indexes.remove(i);
        }

        let mut open_handles: Vec<String> = Vec::new();
        let mut open_to_remove = Vec::new();
        for (oi, &idx) in open_indexes.iter().enumerate() {
            if matched_count + open_handles.len() as i32 >= role.required {
                break;
            }
            let p = &participants[idx];
            let target = format!("{} {}", normalize(&p.role), normalize(&p.status));
            if role.matchers.iter().any(|m| target.contains(m)) {
                open_handles.push(p.handle.clone());
                open_to_remove.push(oi);
            }
        }
        for &i in open_to_remove.iter().rev() {
            open_indexes.remove(i);
        }

        let open_role_count = open_handles
            .len()
            .min((role.required - matched_count).max(0) as usize) as i32;
        let shortfall = (role.required - matched_count - open_role_count).max(0);

        role_checks.push(PackageRoleCheck {
            key: role.key.to_string(),
            label: role.label.to_string(),
            required_count: role.required,
            matched_count,
            matched_handles,
            open_count: open_role_count,
            open_handles: open_handles[..open_role_count as usize].to_vec(),
            shortfall,
        });
    }

    let structural_warnings: Vec<String> = role_checks
        .iter()
        .flat_map(|rc| {
            let mut w = Vec::new();
            if rc.open_count > 0 {
                let s = if rc.open_count > 1 { "s" } else { "" };
                w.push(format!(
                    "Open {} {} slot{}.",
                    rc.open_count,
                    rc.label.to_lowercase(),
                    s
                ));
            }
            if rc.shortfall > 0 {
                let s = if rc.shortfall > 1 { "s" } else { "" };
                w.push(format!(
                    "Missing {} {} slot{}.",
                    rc.shortfall,
                    rc.label.to_lowercase(),
                    s
                ));
            }
            w
        })
        .collect();

    let mut warnings = structural_warnings.clone();

    // Readiness warnings
    if total == 0 {
        warnings.push("No package assigned to this mission.".to_string());
    } else if staffed_total == 0 && open_count > 0 {
        warnings.push("Template package seeded, but no slot is filled yet.".to_string());
    } else if readiness_label == "cold" {
        warnings.push(
            "Package has staffed elements, but none are ready or launched.".to_string(),
        );
    } else if readiness_label == "partial" {
        warnings.push(format!(
            "Only {}/{} staffed elements are ready or launched.",
            ready_or_launched, staffed_total
        ));
    }

    let issue_count = structural_warnings.len() as i32;
    let coverage_label = if issue_count == 0 {
        "structured"
    } else if issue_count == 1 {
        "degraded"
    } else {
        "insufficient"
    }
    .to_string();

    PackageDiscipline {
        profile_code: profile.code.to_string(),
        profile_label: profile.label.to_string(),
        coverage_label,
        shortfall_count: issue_count,
        warnings,
        role_checks,
    }
}

// ── Crew candidate builder (port of buildCrewCandidates) ────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Commitment {
    mission_id: String,
    callsign: String,
    mission_status: String,
    assignment_status: String,
    role: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CrewCandidate {
    handle: String,
    display_name: Option<String>,
    org_role: String,
    membership_title: Option<String>,
    qrf_status: Option<String>,
    suggested_platform: Option<String>,
    source_label: String,
    notes: Option<String>,
    commitments: Vec<Commitment>,
    availability_label: String,
}

fn build_crew_candidates(
    members: &[OrgMemberRow],
    qrf_entries: &[QrfRow],
    active_missions: &[ActiveMissionRow],
    active_participants: &[ActiveParticipantRow],
    current_mission_id: &str,
) -> Vec<CrewCandidate> {
    use std::collections::HashMap;

    // Build commitment map
    let mut commitments_by_handle: HashMap<String, Vec<Commitment>> = HashMap::new();

    for mission in active_missions {
        if mission.id == current_mission_id {
            continue;
        }
        // Check mission lead
        if let Some(ref lead_handle) = mission.lead_handle {
            let nh = normalize_handle(lead_handle);
            commitments_by_handle.entry(nh).or_default().push(Commitment {
                mission_id: mission.id.clone(),
                callsign: mission.callsign.clone(),
                mission_status: mission.status.clone(),
                assignment_status: "lead".to_string(),
                role: "mission lead".to_string(),
            });
        }
    }

    for ap in active_participants {
        // Skip if this mission is current or participant is open
        if ap.mission_id == current_mission_id || ap.status == "open" {
            continue;
        }
        let nh = normalize_handle(&ap.handle);
        commitments_by_handle.entry(nh).or_default().push(Commitment {
            mission_id: ap.mission_id.clone(),
            callsign: ap.callsign.clone(),
            mission_status: ap.mission_status.clone(),
            assignment_status: ap.status.clone(),
            role: ap.role.clone(),
        });
    }

    // QRF lookup
    let qrf_by_handle: HashMap<String, &QrfRow> = qrf_entries
        .iter()
        .map(|q| (normalize_handle(&q.callsign), q))
        .collect();

    let mut candidates: Vec<CrewCandidate> = Vec::new();
    let mut seen_handles: std::collections::HashSet<String> = std::collections::HashSet::new();

    for member in members {
        let nh = normalize_handle(&member.handle);
        seen_handles.insert(nh.clone());
        let qrf = qrf_by_handle.get(&nh);
        let commits = commitments_by_handle.get(&nh).cloned().unwrap_or_default();
        let engaged = commits.iter().any(|c| {
            matches!(c.assignment_status.as_str(), "ready" | "launched" | "lead")
        });

        candidates.push(CrewCandidate {
            handle: member.handle.clone(),
            display_name: member.display_name.clone(),
            org_role: member.role.clone(),
            membership_title: member.title.clone(),
            qrf_status: qrf.map(|q| q.status.clone()),
            suggested_platform: qrf.and_then(|q| q.platform.clone()),
            source_label: if qrf.is_some() { "QRF + Org" } else { "Org roster" }.to_string(),
            notes: qrf
                .and_then(|q| q.notes.clone())
                .or_else(|| member.title.clone()),
            commitments: commits.clone(),
            availability_label: if engaged {
                "engaged"
            } else if !commits.is_empty() {
                "tasked"
            } else {
                "available"
            }
            .to_string(),
        });
    }

    // Add QRF-only entries
    for qrf in qrf_entries {
        let nh = normalize_handle(&qrf.callsign);
        if seen_handles.contains(&nh) {
            continue;
        }
        let commits = commitments_by_handle.get(&nh).cloned().unwrap_or_default();
        let engaged = commits.iter().any(|c| {
            matches!(c.assignment_status.as_str(), "ready" | "launched" | "lead")
        });

        candidates.push(CrewCandidate {
            handle: qrf.callsign.replace(' ', "").to_uppercase(),
            display_name: Some(qrf.callsign.clone()),
            org_role: "watchfloor".to_string(),
            membership_title: None,
            qrf_status: Some(qrf.status.clone()),
            suggested_platform: qrf.platform.clone(),
            source_label: "QRF board".to_string(),
            notes: qrf.location_name.clone(),
            commitments: commits.clone(),
            availability_label: if engaged {
                "engaged"
            } else if !commits.is_empty() {
                "tasked"
            } else {
                "available"
            }
            .to_string(),
        });
    }

    // Sort: QRF first, then alpha
    candidates.sort_by(|a, b| {
        let aq = if a.qrf_status.is_some() { 0 } else { 1 };
        let bq = if b.qrf_status.is_some() { 0 } else { 1 };
        aq.cmp(&bq).then_with(|| a.handle.cmp(&b.handle))
    });

    candidates
}

// ── Time helpers ────────────────────────────────────────────────────────────

fn format_relative_time(dt: &chrono::NaiveDateTime) -> String {
    let now = chrono::Utc::now().naive_utc();
    let diff = now - *dt;
    let mins = diff.num_minutes();
    if mins < 1 {
        return "just now".to_string();
    }
    if mins < 60 {
        return format!("{}m ago", mins);
    }
    let hours = diff.num_hours();
    if hours < 24 {
        return format!("{}h ago", hours);
    }
    let days = diff.num_days();
    if days < 30 {
        return format!("{}d ago", days);
    }
    format!("{}mo ago", days / 30)
}

fn format_datetime(dt: &chrono::NaiveDateTime) -> String {
    dt.format("%b %-d, %I:%M %p").to_string()
}

fn activity_tier(score: i32) -> &'static str {
    if score >= 60 {
        "active"
    } else if score >= 30 {
        "moderate"
    } else if score >= 10 {
        "dormant"
    } else {
        "dark"
    }
}

// ── SQL row types ───────────────────────────────────────────────────────────

#[derive(Clone, sqlx::FromRow)]
struct ParticipantRow {
    id: String,
    handle: String,
    role: String,
    platform: Option<String>,
    status: String,
    notes: Option<String>,
}

#[derive(sqlx::FromRow)]
struct MissionRow {
    id: String,
    callsign: String,
    title: String,
    #[sqlx(rename = "missionType")]
    mission_type: String,
    status: String,
    priority: String,
    #[sqlx(rename = "revisionNumber")]
    revision_number: i32,
    #[sqlx(rename = "areaOfOperation")]
    area_of_operation: Option<String>,
    #[sqlx(rename = "missionBrief")]
    mission_brief: Option<String>,
    #[sqlx(rename = "updatedAt")]
    updated_at: chrono::NaiveDateTime,
    #[sqlx(rename = "leadHandle")]
    lead_handle: Option<String>,
    #[sqlx(rename = "leadDisplayName")]
    lead_display_name: Option<String>,
}

#[derive(sqlx::FromRow)]
struct MissionDetailRow {
    id: String,
    callsign: String,
    title: String,
    #[sqlx(rename = "missionType")]
    mission_type: String,
    status: String,
    priority: String,
    #[sqlx(rename = "revisionNumber")]
    revision_number: i32,
    #[sqlx(rename = "areaOfOperation")]
    area_of_operation: Option<String>,
    #[sqlx(rename = "missionBrief")]
    mission_brief: Option<String>,
    #[sqlx(rename = "closeoutSummary")]
    closeout_summary: Option<String>,
    #[sqlx(rename = "aarSummary")]
    aar_summary: Option<String>,
    #[sqlx(rename = "roeCode")]
    roe_code: Option<String>,
    #[sqlx(rename = "completedAt")]
    completed_at: Option<chrono::NaiveDateTime>,
    #[sqlx(rename = "updatedAt")]
    updated_at: chrono::NaiveDateTime,
    #[sqlx(rename = "leadHandle")]
    lead_handle: Option<String>,
    #[sqlx(rename = "leadDisplayName")]
    lead_display_name: Option<String>,
}

#[derive(sqlx::FromRow)]
struct RescueRow {
    id: String,
    #[sqlx(rename = "survivorHandle")]
    survivor_handle: String,
    #[sqlx(rename = "locationName")]
    location_name: Option<String>,
    status: String,
    urgency: String,
    #[sqlx(rename = "threatSummary")]
    threat_summary: Option<String>,
    #[sqlx(rename = "rescueNotes")]
    rescue_notes: Option<String>,
    #[sqlx(rename = "survivorCondition")]
    survivor_condition: Option<String>,
    #[sqlx(rename = "outcomeSummary")]
    outcome_summary: Option<String>,
    #[sqlx(rename = "escortRequired")]
    escort_required: bool,
    #[sqlx(rename = "medicalRequired")]
    medical_required: bool,
    #[sqlx(rename = "offeredPayment")]
    offered_payment: Option<i32>,
    #[sqlx(rename = "requesterHandle")]
    requester_handle: Option<String>,
    #[sqlx(rename = "requesterDisplay")]
    requester_display: Option<String>,
    #[sqlx(rename = "operatorId")]
    operator_id: Option<String>,
    #[sqlx(rename = "operatorHandle")]
    operator_handle: Option<String>,
    #[sqlx(rename = "operatorDisplay")]
    operator_display: Option<String>,
}

#[derive(sqlx::FromRow)]
struct IntelRow {
    id: String,
    title: String,
    description: Option<String>,
    severity: i32,
    #[sqlx(rename = "reportType")]
    report_type: String,
    #[sqlx(rename = "locationName")]
    location_name: Option<String>,
    #[sqlx(rename = "hostileGroup")]
    hostile_group: Option<String>,
    confidence: String,
    tags: Vec<String>,
}

#[derive(sqlx::FromRow)]
struct IntelLinkRow {
    id: String,
    #[sqlx(rename = "intelId")]
    intel_id: String,
    title: String,
    severity: i32,
    #[sqlx(rename = "reportType")]
    report_type: String,
    #[sqlx(rename = "locationName")]
    location_name: Option<String>,
    #[sqlx(rename = "hostileGroup")]
    hostile_group: Option<String>,
}

#[derive(sqlx::FromRow)]
struct IntelMissionLinkRow {
    #[sqlx(rename = "intelId")]
    intel_id: String,
    #[sqlx(rename = "missionId")]
    mission_id: String,
    callsign: String,
    #[sqlx(rename = "missionStatus")]
    mission_status: String,
}

#[derive(sqlx::FromRow)]
struct QrfRow {
    id: String,
    callsign: String,
    status: String,
    platform: Option<String>,
    #[sqlx(rename = "locationName")]
    location_name: Option<String>,
    #[sqlx(rename = "availableCrew")]
    available_crew: i32,
    notes: Option<String>,
}

#[derive(sqlx::FromRow)]
struct NotificationRow {
    id: String,
    severity: String,
    title: String,
    href: Option<String>,
}

#[derive(sqlx::FromRow)]
struct DoctrineRow {
    id: String,
    code: String,
    title: String,
    category: String,
    summary: String,
    body: String,
    escalation: Option<String>,
    #[sqlx(rename = "isDefault")]
    is_default: bool,
    #[sqlx(rename = "missionCount")]
    mission_count: i64,
}

#[derive(sqlx::FromRow)]
struct DoctrineTemplateShort {
    id: String,
    code: String,
    title: String,
    category: String,
    summary: String,
}

#[derive(sqlx::FromRow)]
struct DoctrineForMission {
    id: String,
    code: String,
    title: String,
    category: String,
    summary: String,
    body: String,
    escalation: Option<String>,
}

#[derive(sqlx::FromRow)]
struct AvailableIntelRow {
    id: String,
    title: String,
    severity: i32,
}

#[derive(sqlx::FromRow)]
struct LogRow {
    id: String,
    #[sqlx(rename = "entryType")]
    entry_type: String,
    message: String,
    #[sqlx(rename = "createdAt")]
    created_at: chrono::NaiveDateTime,
    #[sqlx(rename = "authorHandle")]
    author_handle: Option<String>,
    #[sqlx(rename = "authorDisplayName")]
    author_display_name: Option<String>,
}

#[derive(sqlx::FromRow)]
struct OrgMemberRow {
    handle: String,
    #[sqlx(rename = "displayName")]
    display_name: Option<String>,
    role: String,
    title: Option<String>,
}

#[derive(sqlx::FromRow)]
struct RosterMemberRow {
    #[sqlx(rename = "userId")]
    user_id: String,
    email: String,
    handle: String,
    #[sqlx(rename = "displayName")]
    display_name: Option<String>,
    role: String,
    #[sqlx(rename = "userStatus")]
    user_status: String,
    title: Option<String>,
    rank: String,
}

#[derive(sqlx::FromRow)]
struct ActiveMissionRow {
    id: String,
    callsign: String,
    status: String,
    #[sqlx(rename = "leadHandle")]
    lead_handle: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ActiveParticipantRow {
    #[sqlx(rename = "missionId")]
    mission_id: String,
    callsign: String,
    #[sqlx(rename = "missionStatus")]
    mission_status: String,
    handle: String,
    role: String,
    status: String,
}

#[derive(sqlx::FromRow)]
struct ActivityRow {
    handle: String,
    count: i64,
    #[sqlx(rename = "lastActive")]
    last_active: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
struct LogActivityRow {
    #[sqlx(rename = "authorId")]
    author_id: String,
    count: i64,
    #[sqlx(rename = "lastActive")]
    last_active: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
struct SettingsProfileRow {
    handle: String,
    email: String,
    #[sqlx(rename = "displayName")]
    display_name: Option<String>,
    role: String,
    status: String,
    #[sqlx(rename = "totpEnabled")]
    totp_enabled: bool,
    #[sqlx(rename = "createdAt")]
    created_at: chrono::NaiveDateTime,
}

// ── Handler: GET /api/views/command ─────────────────────────────────────────

async fn command_overview(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| internal("No organization found"))?;

    let (
        missions,
        rescues,
        intel,
        qrf,
        notifications,
        active_count,
        rescue_count,
        intel_count,
        qrf_count,
        notif_count,
    ) = tokio::try_join!(
        // Top 4 missions
        sqlx::query_as::<_, MissionRow>(
            r#"SELECT m.id, m.callsign, m.title, m."missionType", m.status,
                      m.priority, m."revisionNumber", m."areaOfOperation",
                      m."missionBrief", m."updatedAt",
                      u.handle as "leadHandle", u."displayName" as "leadDisplayName"
               FROM "Mission" m
               LEFT JOIN "User" u ON m."leadId" = u.id
               WHERE m."orgId" = $1
               ORDER BY m.status ASC, m."updatedAt" DESC
               LIMIT 4"#
        )
        .bind(&org.id)
        .fetch_all(state.pool()),
        // Top 3 rescues
        sqlx::query_as::<_, RescueRow>(
            r#"SELECT r.id, r."survivorHandle", r."locationName", r.status, r.urgency,
                      r."threatSummary", r."rescueNotes", r."survivorCondition",
                      r."outcomeSummary", r."escortRequired", r."medicalRequired",
                      r."offeredPayment", r."operatorId",
                      req.handle AS "requesterHandle",
                      req."displayName" AS "requesterDisplay",
                      op.handle AS "operatorHandle",
                      op."displayName" AS "operatorDisplay"
               FROM "RescueRequest" r
               LEFT JOIN "User" req ON r."requesterId" = req.id
               LEFT JOIN "User" op ON r."operatorId" = op.id
               WHERE r."orgId" = $1
               ORDER BY r.urgency ASC, r."updatedAt" DESC
               LIMIT 3"#
        )
        .bind(&org.id)
        .fetch_all(state.pool()),
        // Top 4 intel
        sqlx::query_as::<_, IntelRow>(
            r#"SELECT id, title, description, severity, "reportType",
                      "locationName", "hostileGroup", confidence, tags
               FROM "IntelReport"
               WHERE "orgId" = $1 AND "isActive" = true
               ORDER BY severity DESC, "createdAt" DESC
               LIMIT 4"#
        )
        .bind(&org.id)
        .fetch_all(state.pool()),
        // Top 4 QRF
        sqlx::query_as::<_, QrfRow>(
            r#"SELECT id, callsign, status, platform, "locationName",
                      "availableCrew", notes
               FROM "QrfReadiness"
               WHERE "orgId" = $1
               ORDER BY status ASC, "updatedAt" DESC
               LIMIT 4"#
        )
        .bind(&org.id)
        .fetch_all(state.pool()),
        // Top 4 notifications
        sqlx::query_as::<_, NotificationRow>(
            r#"SELECT id, severity, title, href
               FROM "Notification"
               WHERE "orgId" = $1
               ORDER BY status ASC, "createdAt" DESC
               LIMIT 4"#
        )
        .bind(&org.id)
        .fetch_all(state.pool()),
        // Counts
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "Mission" WHERE "orgId" = $1 AND status IN ('planning','ready','active')"#
        )
        .bind(&org.id)
        .fetch_one(state.pool()),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "RescueRequest" WHERE "orgId" = $1 AND status IN ('open','accepted','en_route')"#
        )
        .bind(&org.id)
        .fetch_one(state.pool()),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "IntelReport" WHERE "orgId" = $1 AND "isActive" = true"#
        )
        .bind(&org.id)
        .fetch_one(state.pool()),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "QrfReadiness" WHERE "orgId" = $1 AND status IN ('redcon1','redcon2')"#
        )
        .bind(&org.id)
        .fetch_one(state.pool()),
        sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM "Notification" WHERE "orgId" = $1 AND status = 'unread'"#
        )
        .bind(&org.id)
        .fetch_one(state.pool()),
    )
    .map_err(|e| {
        tracing::error!(error = %e, "command overview query failed");
        internal("Failed to load overview")
    })?;

    // Fetch participants for each mission
    let mission_ids: Vec<&str> = missions.iter().map(|m| m.id.as_str()).collect();
    let all_participants = if !mission_ids.is_empty() {
        sqlx::query_as::<_, ParticipantWithMission>(
            r#"SELECT "missionId", id, handle, role, platform, status, notes
               FROM "MissionParticipant"
               WHERE "missionId" = ANY($1)"#
        )
        .bind(&mission_ids)
        .fetch_all(state.pool())
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    // Group participants by mission
    let mut participants_map: std::collections::HashMap<String, Vec<ParticipantRow>> =
        std::collections::HashMap::new();
    for p in all_participants {
        participants_map
            .entry(p.mission_id.clone())
            .or_default()
            .push(ParticipantRow {
                id: p.id,
                handle: p.handle,
                role: p.role,
                platform: p.platform,
                status: p.status,
                notes: p.notes,
            });
    }

    let missions_json: Vec<Value> = missions
        .iter()
        .map(|m| {
            let parts = participants_map.get(&m.id).cloned().unwrap_or_default();
            let pkg = summarize_package(&parts);
            let lead = m
                .lead_display_name
                .as_deref()
                .or(m.lead_handle.as_deref())
                .unwrap_or("Unassigned");
            let disc = evaluate_package_discipline(
                &m.mission_type,
                &parts,
                lead,
                &pkg.readiness_label,
                pkg.ready_or_launched,
                pkg.total,
                pkg.open,
                pkg.staffed_total,
            );
            json!({
                "id": m.id,
                "callsign": m.callsign,
                "title": m.title,
                "missionType": m.mission_type,
                "status": m.status,
                "priority": m.priority,
                "revisionNumber": m.revision_number,
                "areaOfOperation": m.area_of_operation,
                "participantCount": parts.len(),
                "packageSummary": pkg,
                "packageDiscipline": disc,
            })
        })
        .collect();

    Ok(Json(json!({
        "orgName": org.name,
        "activeMissionCount": active_count,
        "openRescueCount": rescue_count,
        "activeIntelCount": intel_count,
        "qrfReadyCount": qrf_count,
        "unreadNotificationCount": notif_count,
        "missions": missions_json,
        "rescues": rescues.iter().map(|r| json!({
            "id": r.id,
            "survivorHandle": r.survivor_handle,
            "locationName": r.location_name,
            "urgency": r.urgency,
            "status": r.status,
            "escortRequired": r.escort_required,
        })).collect::<Vec<_>>(),
        "intel": intel.iter().map(|i| json!({
            "id": i.id,
            "title": i.title,
            "severity": i.severity,
            "hostileGroup": i.hostile_group,
            "locationName": i.location_name,
            "confidence": i.confidence,
        })).collect::<Vec<_>>(),
        "qrf": qrf.iter().map(|q| json!({
            "id": q.id,
            "callsign": q.callsign,
            "status": q.status,
            "platform": q.platform,
            "locationName": q.location_name,
            "availableCrew": q.available_crew,
        })).collect::<Vec<_>>(),
        "notifications": notifications.iter().map(|n| json!({
            "id": n.id,
            "severity": n.severity,
            "title": n.title,
            "href": n.href,
        })).collect::<Vec<_>>(),
    })))
}

#[derive(sqlx::FromRow)]
struct ParticipantWithMission {
    #[sqlx(rename = "missionId")]
    mission_id: String,
    id: String,
    handle: String,
    role: String,
    platform: Option<String>,
    status: String,
    notes: Option<String>,
}

// ── Handler: GET /api/views/missions ────────────────────────────────────────

async fn missions_list(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| internal("No organization found"))?;

    let missions = sqlx::query_as::<_, MissionRow>(
        r#"SELECT m.id, m.callsign, m.title, m."missionType", m.status,
                  m.priority, m."revisionNumber", m."areaOfOperation",
                  m."missionBrief", m."updatedAt",
                  u.handle as "leadHandle", u."displayName" as "leadDisplayName"
           FROM "Mission" m
           LEFT JOIN "User" u ON m."leadId" = u.id
           WHERE m."orgId" = $1
           ORDER BY m.status ASC, m."updatedAt" DESC"#
    )
    .bind(&org.id)
    .fetch_all(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "missions list query failed");
        internal("Failed to load missions")
    })?;

    let mission_ids: Vec<&str> = missions.iter().map(|m| m.id.as_str()).collect();
    let all_participants = if !mission_ids.is_empty() {
        sqlx::query_as::<_, ParticipantWithMission>(
            r#"SELECT "missionId", id, handle, role, platform, status, notes
               FROM "MissionParticipant"
               WHERE "missionId" = ANY($1)"#
        )
        .bind(&mission_ids)
        .fetch_all(state.pool())
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    let mut participants_map: std::collections::HashMap<String, Vec<ParticipantRow>> =
        std::collections::HashMap::new();
    for p in all_participants {
        participants_map
            .entry(p.mission_id.clone())
            .or_default()
            .push(ParticipantRow {
                id: p.id,
                handle: p.handle,
                role: p.role,
                platform: p.platform,
                status: p.status,
                notes: p.notes,
            });
    }

    let items: Vec<Value> = missions
        .iter()
        .map(|m| {
            let parts = participants_map.get(&m.id).cloned().unwrap_or_default();
            let pkg = summarize_package(&parts);
            let lead = m
                .lead_display_name
                .as_deref()
                .or(m.lead_handle.as_deref())
                .unwrap_or("Unassigned");
            let disc = evaluate_package_discipline(
                &m.mission_type,
                &parts,
                lead,
                &pkg.readiness_label,
                pkg.ready_or_launched,
                pkg.total,
                pkg.open,
                pkg.staffed_total,
            );
            json!({
                "id": m.id,
                "callsign": m.callsign,
                "title": m.title,
                "missionType": m.mission_type,
                "status": m.status,
                "priority": m.priority,
                "revisionNumber": m.revision_number,
                "areaOfOperation": m.area_of_operation,
                "missionBrief": m.mission_brief,
                "participantCount": parts.len(),
                "packageSummary": pkg,
                "packageDiscipline": disc,
            })
        })
        .collect();

    Ok(Json(json!({
        "orgName": org.name,
        "items": items,
    })))
}

// ── Handler: GET /api/views/missions/{id} ────────────────────────────────────

async fn mission_detail(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
    Path(mission_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| internal("No organization found"))?;

    let pool = state.pool();

    // Main mission
    let mission = sqlx::query_as::<_, MissionDetailRow>(
        r#"SELECT m.id, m.callsign, m.title, m."missionType", m.status,
                  m.priority, m."revisionNumber", m."areaOfOperation",
                  m."missionBrief", m."closeoutSummary", m."aarSummary",
                  m."roeCode", m."completedAt", m."updatedAt",
                  u.handle as "leadHandle", u."displayName" as "leadDisplayName"
           FROM "Mission" m
           LEFT JOIN "User" u ON m."leadId" = u.id
           WHERE m.id = $1 AND m."orgId" = $2"#
    )
    .bind(&mission_id)
    .bind(&org.id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "mission detail query failed");
        internal("Failed to load mission")
    })?;

    let mission = match mission {
        Some(m) => m,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Mission not found."})),
            ))
        }
    };

    // Parallel sub-queries
    let (
        participants,
        logs,
        intel_links,
        doctrine_template,
        available_doctrine,
        available_intel,
        org_members,
        qrf_entries,
        active_missions,
        active_participants,
    ) = tokio::try_join!(
        sqlx::query_as::<_, ParticipantRow>(
            r#"SELECT id, handle, role, platform, status, notes
               FROM "MissionParticipant"
               WHERE "missionId" = $1
               ORDER BY status ASC, "createdAt" ASC"#
        )
        .bind(&mission.id)
        .fetch_all(pool),
        sqlx::query_as::<_, LogRow>(
            r#"SELECT ml.id, ml."entryType", ml.message, ml."createdAt",
                      u.handle as "authorHandle", u."displayName" as "authorDisplayName"
               FROM "MissionLog" ml
               LEFT JOIN "User" u ON ml."authorId" = u.id
               WHERE ml."missionId" = $1
               ORDER BY ml."createdAt" DESC"#
        )
        .bind(&mission.id)
        .fetch_all(pool),
        sqlx::query_as::<_, IntelLinkRow>(
            r#"SELECT mil.id, ir.id as "intelId", ir.title, ir.severity,
                      ir."reportType", ir."locationName", ir."hostileGroup"
               FROM "MissionIntelLink" mil
               JOIN "IntelReport" ir ON mil."intelId" = ir.id
               WHERE mil."missionId" = $1
               ORDER BY mil."createdAt" DESC"#
        )
        .bind(&mission.id)
        .fetch_all(pool),
        // Doctrine template for this mission
        sqlx::query_as::<_, DoctrineForMission>(
            r#"SELECT dt.id, dt.code, dt.title, dt.category, dt.summary, dt.body, dt.escalation
               FROM "Mission" m
               JOIN "DoctrineTemplate" dt ON m."doctrineTemplateId" = dt.id
               WHERE m.id = $1"#
        )
        .bind(&mission.id)
        .fetch_optional(pool),
        // All available doctrine templates for org
        sqlx::query_as::<_, DoctrineTemplateShort>(
            r#"SELECT id, code, title, category, summary
               FROM "DoctrineTemplate"
               WHERE "orgId" = $1
               ORDER BY "isDefault" DESC, category ASC, code ASC"#
        )
        .bind(&org.id)
        .fetch_all(pool),
        // Available intel (not already linked)
        sqlx::query_as::<_, AvailableIntelRow>(
            r#"SELECT id, title, severity
               FROM "IntelReport"
               WHERE "orgId" = $1 AND "isActive" = true
               AND id NOT IN (
                   SELECT "intelId" FROM "MissionIntelLink" WHERE "missionId" = $2
               )
               ORDER BY severity DESC, "createdAt" DESC"#
        )
        .bind(&org.id)
        .bind(&mission.id)
        .fetch_all(pool),
        // Org members for crew candidates
        sqlx::query_as::<_, OrgMemberRow>(
            r#"SELECT u.handle, u."displayName", u.role, om.title
               FROM "OrgMember" om
               JOIN "User" u ON om."userId" = u.id
               WHERE om."orgId" = $1
               ORDER BY om.rank ASC, om."joinedAt" ASC"#
        )
        .bind(&org.id)
        .fetch_all(pool),
        // QRF entries
        sqlx::query_as::<_, QrfRow>(
            r#"SELECT id, callsign, status, platform, "locationName",
                      "availableCrew", notes
               FROM "QrfReadiness"
               WHERE "orgId" = $1
               ORDER BY status ASC, "updatedAt" DESC"#
        )
        .bind(&org.id)
        .fetch_all(pool),
        // Active missions for commitment tracking
        sqlx::query_as::<_, ActiveMissionRow>(
            r#"SELECT m.id, m.callsign, m.status, u.handle as "leadHandle"
               FROM "Mission" m
               LEFT JOIN "User" u ON m."leadId" = u.id
               WHERE m."orgId" = $1 AND m.status IN ('planning','ready','active')"#
        )
        .bind(&org.id)
        .fetch_all(pool),
        // Active mission participants
        sqlx::query_as::<_, ActiveParticipantRow>(
            r#"SELECT mp."missionId", m.callsign, m.status as "missionStatus",
                      mp.handle, mp.role, mp.status
               FROM "MissionParticipant" mp
               JOIN "Mission" m ON mp."missionId" = m.id
               WHERE m."orgId" = $1 AND m.status IN ('planning','ready','active')"#
        )
        .bind(&org.id)
        .fetch_all(pool),
    )
    .map_err(|e| {
        tracing::error!(error = %e, "mission detail sub-queries failed");
        internal("Failed to load mission details")
    })?;

    let pkg = summarize_package(&participants);
    let lead = mission
        .lead_display_name
        .as_deref()
        .or(mission.lead_handle.as_deref())
        .unwrap_or("Unassigned");
    let disc = evaluate_package_discipline(
        &mission.mission_type,
        &participants,
        lead,
        &pkg.readiness_label,
        pkg.ready_or_launched,
        pkg.total,
        pkg.open,
        pkg.staffed_total,
    );

    let crew = build_crew_candidates(
        &org_members,
        &qrf_entries,
        &active_missions,
        &active_participants,
        &mission.id,
    );

    Ok(Json(json!({
        "orgName": org.name,
        "mission": {
            "id": mission.id,
            "callsign": mission.callsign,
            "title": mission.title,
            "missionType": mission.mission_type,
            "status": mission.status,
            "priority": mission.priority,
            "revisionNumber": mission.revision_number,
            "areaOfOperation": mission.area_of_operation,
            "missionBrief": mission.mission_brief,
            "closeoutSummary": mission.closeout_summary,
            "aarSummary": mission.aar_summary,
            "roeCode": mission.roe_code,
            "completedAtLabel": mission.completed_at.map(|dt| format_datetime(&dt)),
            "leadDisplay": lead,
            "updatedAtLabel": format_datetime(&mission.updated_at),
            "packageSummary": pkg,
            "packageDiscipline": disc,
            "doctrineTemplate": doctrine_template.map(|dt| json!({
                "id": dt.id,
                "code": dt.code,
                "title": dt.title,
                "category": dt.category,
                "summary": dt.summary,
                "body": dt.body,
                "escalation": dt.escalation,
            })),
            "availableDoctrineTemplates": available_doctrine.iter().map(|dt| json!({
                "id": dt.id,
                "code": dt.code,
                "title": dt.title,
                "category": dt.category,
                "summary": dt.summary,
            })).collect::<Vec<_>>(),
            "linkedIntel": intel_links.iter().map(|il| json!({
                "id": il.id,
                "intelId": il.intel_id,
                "title": il.title,
                "severity": il.severity,
                "reportType": il.report_type,
                "locationName": il.location_name,
                "hostileGroup": il.hostile_group,
            })).collect::<Vec<_>>(),
            "availableIntel": available_intel.iter().map(|ai| json!({
                "id": ai.id,
                "title": ai.title,
                "severity": ai.severity,
            })).collect::<Vec<_>>(),
            "logs": logs.iter().map(|l| json!({
                "id": l.id,
                "entryType": l.entry_type,
                "message": l.message,
                "createdAtLabel": format_datetime(&l.created_at),
                "authorDisplay": l.author_display_name.as_deref()
                    .or(l.author_handle.as_deref())
                    .unwrap_or("Guardian"),
            })).collect::<Vec<_>>(),
            "participants": participants.iter().map(|p| json!({
                "id": p.id,
                "handle": p.handle,
                "role": p.role,
                "platform": p.platform,
                "status": p.status,
                "notes": p.notes,
            })).collect::<Vec<_>>(),
            "availableCrew": crew,
        },
    })))
}

// ── Handler: GET /api/views/doctrine ────────────────────────────────────────

async fn doctrine_list(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| internal("No organization found"))?;

    let templates = sqlx::query_as::<_, DoctrineRow>(
        r#"SELECT dt.id, dt.code, dt.title, dt.category, dt.summary, dt.body,
                  dt.escalation, dt."isDefault",
                  COUNT(m.id) as "missionCount"
           FROM "DoctrineTemplate" dt
           LEFT JOIN "Mission" m ON m."doctrineTemplateId" = dt.id
           WHERE dt."orgId" = $1
           GROUP BY dt.id
           ORDER BY dt."isDefault" DESC, dt.category ASC, dt.code ASC"#
    )
    .bind(&org.id)
    .fetch_all(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "doctrine list query failed");
        internal("Failed to load doctrine")
    })?;

    Ok(Json(json!({
        "orgName": org.name,
        "items": templates.iter().map(|t| json!({
            "id": t.id,
            "code": t.code,
            "title": t.title,
            "category": t.category,
            "summary": t.summary,
            "body": t.body,
            "escalation": t.escalation,
            "isDefault": t.is_default,
            "missionCount": t.mission_count,
        })).collect::<Vec<_>>(),
    })))
}

// ── Handler: GET /api/views/roster ──────────────────────────────────────────

async fn roster_list(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| internal("No organization found"))?;

    let pool = state.pool();

    let thirty_days_ago = chrono::Utc::now().naive_utc() - chrono::Duration::days(30);

    let (members, qrf_entries, active_missions, active_participants, part_activity, log_activity) =
        tokio::try_join!(
            sqlx::query_as::<_, RosterMemberRow>(
                r#"SELECT u.id as "userId", u.email, u.handle, u."displayName",
                          u.role, u.status as "userStatus", om.title, om.rank
                   FROM "OrgMember" om
                   JOIN "User" u ON om."userId" = u.id
                   WHERE om."orgId" = $1
                   ORDER BY om.rank ASC, om."joinedAt" ASC"#
            )
            .bind(&org.id)
            .fetch_all(pool),
            sqlx::query_as::<_, QrfRow>(
                r#"SELECT id, callsign, status, platform, "locationName",
                          "availableCrew", notes
                   FROM "QrfReadiness"
                   WHERE "orgId" = $1
                   ORDER BY status ASC, "updatedAt" DESC"#
            )
            .bind(&org.id)
            .fetch_all(pool),
            sqlx::query_as::<_, ActiveMissionRow>(
                r#"SELECT m.id, m.callsign, m.status, u.handle as "leadHandle"
                   FROM "Mission" m
                   LEFT JOIN "User" u ON m."leadId" = u.id
                   WHERE m."orgId" = $1 AND m.status IN ('planning','ready','active')"#
            )
            .bind(&org.id)
            .fetch_all(pool),
            sqlx::query_as::<_, ActiveParticipantRow>(
                r#"SELECT mp."missionId", m.callsign, m.status as "missionStatus",
                          mp.handle, mp.role, mp.status
                   FROM "MissionParticipant" mp
                   JOIN "Mission" m ON mp."missionId" = m.id
                   WHERE m."orgId" = $1 AND m.status IN ('planning','ready','active')"#
            )
            .bind(&org.id)
            .fetch_all(pool),
            sqlx::query_as::<_, ActivityRow>(
                r#"SELECT mp.handle, COUNT(*)::bigint as count,
                          MAX(mp."createdAt") as "lastActive"
                   FROM "MissionParticipant" mp
                   JOIN "Mission" m ON mp."missionId" = m.id
                   WHERE m."orgId" = $1 AND mp."createdAt" >= $2
                   GROUP BY mp.handle"#
            )
            .bind(&org.id)
            .bind(&thirty_days_ago)
            .fetch_all(pool),
            sqlx::query_as::<_, LogActivityRow>(
                r#"SELECT ml."authorId", COUNT(*)::bigint as count,
                          MAX(ml."createdAt") as "lastActive"
                   FROM "MissionLog" ml
                   JOIN "Mission" m ON ml."missionId" = m.id
                   WHERE m."orgId" = $1 AND ml."authorId" IS NOT NULL
                   AND ml."createdAt" >= $2
                   GROUP BY ml."authorId""#
            )
            .bind(&org.id)
            .bind(&thirty_days_ago)
            .fetch_all(pool),
        )
        .map_err(|e| {
            tracing::error!(error = %e, "roster query failed");
            internal("Failed to load roster")
        })?;

    // Build lookups
    let part_map: std::collections::HashMap<String, &ActivityRow> = part_activity
        .iter()
        .map(|a| (normalize_handle(&a.handle), a))
        .collect();
    let log_map: std::collections::HashMap<String, &LogActivityRow> = log_activity
        .iter()
        .map(|a| (a.author_id.clone(), a))
        .collect();
    let uid_by_handle: std::collections::HashMap<String, &str> = members
        .iter()
        .map(|m| (normalize_handle(&m.handle), m.user_id.as_str()))
        .collect();

    // Convert to OrgMemberRow for crew candidate builder
    let member_rows: Vec<OrgMemberRow> = members
        .iter()
        .map(|m| OrgMemberRow {
            handle: m.handle.clone(),
            display_name: m.display_name.clone(),
            role: m.role.clone(),
            title: m.title.clone(),
        })
        .collect();

    let candidates = build_crew_candidates(
        &member_rows,
        &qrf_entries,
        &active_missions,
        &active_participants,
        "",
    );

    // Enrich with activity scoring
    let items: Vec<Value> = candidates
        .iter()
        .map(|crew| {
            let nh = normalize_handle(&crew.handle);
            let p_act = part_map.get(&nh);
            let uid = uid_by_handle.get(&nh).copied();
            let l_act = uid.and_then(|u| log_map.get(u));

            let mission_count = p_act.map(|a| a.count).unwrap_or(0);
            let log_count = l_act.map(|a| a.count).unwrap_or(0);
            let has_commits = !crew.commitments.is_empty();
            let has_qrf = crew.qrf_status.is_some();

            let part_score = ((mission_count as f64 / 3.0).min(1.0) * 40.0) as i32;
            let log_score = ((log_count as f64 / 10.0).min(1.0) * 30.0) as i32;
            let commit_score = if has_commits { 20 } else { 0 };
            let qrf_score = if has_qrf { 10 } else { 0 };
            let score = part_score + log_score + commit_score + qrf_score;

            let last_active = [
                p_act.map(|a| a.last_active),
                l_act.map(|a| a.last_active),
            ]
            .iter()
            .filter_map(|d| *d)
            .max();

            let member_rec = members.iter().find(|m| m.handle == crew.handle);

            json!({
                "handle": crew.handle,
                "displayName": crew.display_name,
                "orgRole": crew.org_role,
                "membershipTitle": crew.membership_title,
                "qrfStatus": crew.qrf_status,
                "suggestedPlatform": crew.suggested_platform,
                "sourceLabel": crew.source_label,
                "notes": crew.notes,
                "commitments": crew.commitments,
                "availabilityLabel": crew.availability_label,
                "userId": member_rec.map(|m| m.user_id.as_str()).unwrap_or(""),
                "email": member_rec.map(|m| m.email.as_str()).unwrap_or(""),
                "rank": member_rec.map(|m| m.rank.as_str()).unwrap_or("member"),
                "status": member_rec.map(|m| m.user_status.as_str()).unwrap_or("active"),
                "activityScore": score,
                "activityTier": activity_tier(score),
                "lastActiveLabel": last_active.map(|dt| format_relative_time(&dt)),
                "missionCount": mission_count,
                "logCount": log_count,
            })
        })
        .collect();

    Ok(Json(json!({
        "orgName": org.name,
        "items": items,
    })))
}

// ── Handler: GET /api/views/intel ───────────────────────────────────────────

async fn intel_list(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| internal("No organization found"))?;

    let pool = state.pool();

    let reports = sqlx::query_as::<_, IntelRow>(
        r#"SELECT id, title, description, severity, "reportType",
                  "locationName", "hostileGroup", confidence, tags
           FROM "IntelReport"
           WHERE "orgId" = $1
           ORDER BY severity DESC, "createdAt" DESC"#
    )
    .bind(&org.id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "intel list query failed");
        internal("Failed to load intel")
    })?;

    // Fetch mission links for all intel
    let intel_ids: Vec<&str> = reports.iter().map(|r| r.id.as_str()).collect();
    let mission_links = if !intel_ids.is_empty() {
        sqlx::query_as::<_, IntelMissionLinkRow>(
            r#"SELECT mil."intelId", m.id as "missionId", m.callsign, m.status as "missionStatus"
               FROM "MissionIntelLink" mil
               JOIN "Mission" m ON mil."missionId" = m.id
               WHERE mil."intelId" = ANY($1)
               ORDER BY mil."createdAt" DESC"#
        )
        .bind(&intel_ids)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    let mut links_map: std::collections::HashMap<String, Vec<&IntelMissionLinkRow>> =
        std::collections::HashMap::new();
    for link in &mission_links {
        links_map.entry(link.intel_id.clone()).or_default().push(link);
    }

    let items: Vec<Value> = reports
        .iter()
        .map(|r| {
            let linked = links_map.get(&r.id).map(|links| {
                links
                    .iter()
                    .map(|l| {
                        json!({
                            "missionId": l.mission_id,
                            "callsign": l.callsign,
                            "missionStatus": l.mission_status,
                        })
                    })
                    .collect::<Vec<_>>()
            }).unwrap_or_default();

            json!({
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "severity": r.severity,
                "reportType": r.report_type,
                "locationName": r.location_name,
                "hostileGroup": r.hostile_group,
                "confidence": r.confidence,
                "tags": r.tags,
                "linkedMissions": linked,
            })
        })
        .collect();

    Ok(Json(json!({
        "orgName": org.name,
        "items": items,
    })))
}

// ── Handler: GET /api/views/rescues ─────────────────────────────────────────

async fn rescues_list(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| internal("No organization found"))?;

    // Fetch rescues with requester + operator JOINs
    let rescues = sqlx::query_as::<_, RescueRow>(
        r#"SELECT r.id, r."survivorHandle", r."locationName", r.status, r.urgency,
                  r."threatSummary", r."rescueNotes", r."survivorCondition",
                  r."outcomeSummary", r."escortRequired", r."medicalRequired",
                  r."offeredPayment", r."operatorId",
                  req.handle AS "requesterHandle",
                  req."displayName" AS "requesterDisplay",
                  op.handle AS "operatorHandle",
                  op."displayName" AS "operatorDisplay"
           FROM "RescueRequest" r
           LEFT JOIN "User" req ON r."requesterId" = req.id
           LEFT JOIN "User" op ON r."operatorId" = op.id
           WHERE r."orgId" = $1
           ORDER BY r.urgency ASC, r."updatedAt" DESC"#
    )
    .bind(&org.id)
    .fetch_all(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "rescues list query failed");
        internal("Failed to load rescues")
    })?;

    let rescue_ids: Vec<&str> = rescues.iter().map(|r| r.id.as_str()).collect();

    // Fetch dispatches for all rescues (via QrfDispatch.rescueId) with QRF join
    let dispatches = if rescue_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, RescueDispatchRow>(
            r#"SELECT d.id, d."rescueId", d.status, d.notes,
                      d."dispatchedAt",
                      q.callsign AS "qrfCallsign",
                      q.platform
               FROM "QrfDispatch" d
               LEFT JOIN "QrfReadiness" q ON d."qrfId" = q.id
               WHERE d."rescueId" = ANY($1)
               ORDER BY d."dispatchedAt" DESC"#
        )
        .bind(&rescue_ids)
        .fetch_all(state.pool())
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "rescue dispatches query failed");
            internal("Failed to load rescue dispatches")
        })?
    };

    // Fetch operator options (org members)
    let operators = sqlx::query_as::<_, RescueOperatorRow>(
        r#"SELECT u.id, u.handle, u."displayName", u.role
           FROM "OrgMember" m
           JOIN "User" u ON m."userId" = u.id
           WHERE m."orgId" = $1
           ORDER BY m.rank ASC, m."joinedAt" ASC"#
    )
    .bind(&org.id)
    .fetch_all(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "rescue operators query failed");
        internal("Failed to load operator options")
    })?;

    // Fetch comms channel IDs for rescue refs
    let channels = sqlx::query_as::<_, RescueChannelRow>(
        r#"SELECT id, "refId" FROM "ChatChannel" WHERE "refType" = 'rescue' AND "refId" = ANY($1)"#
    )
    .bind(&rescue_ids)
    .fetch_all(state.pool())
    .await
    .unwrap_or_default();

    use std::collections::HashMap;
    let channel_map: HashMap<&str, &str> = channels.iter()
        .map(|c| (c.ref_id.as_str(), c.id.as_str()))
        .collect();

    fn fmt_dt(dt: &chrono::NaiveDateTime) -> String {
        dt.format("%b %-d, %-I:%M %p").to_string()
    }

    Ok(Json(json!({
        "orgName": org.name,
        "operatorOptions": operators.iter().map(|o| json!({
            "id": o.id,
            "label": o.display_name.as_deref().unwrap_or(&o.handle),
            "detail": format!("{} / {}", o.handle, o.role),
        })).collect::<Vec<_>>(),
        "items": rescues.iter().map(|r| {
            let r_dispatches: Vec<_> = dispatches.iter()
                .filter(|d| d.rescue_id.as_deref() == Some(r.id.as_str()))
                .map(|d| json!({
                    "id": d.id,
                    "qrfCallsign": d.qrf_callsign.as_deref().unwrap_or("Unknown"),
                    "status": d.status,
                    "platform": d.platform,
                    "dispatchedAtLabel": fmt_dt(&d.dispatched_at),
                    "notes": d.notes,
                }))
                .collect();
            json!({
                "id": r.id,
                "survivorHandle": r.survivor_handle,
                "locationName": r.location_name,
                "status": r.status,
                "urgency": r.urgency,
                "threatSummary": r.threat_summary,
                "rescueNotes": r.rescue_notes,
                "survivorCondition": r.survivor_condition,
                "outcomeSummary": r.outcome_summary,
                "escortRequired": r.escort_required,
                "medicalRequired": r.medical_required,
                "offeredPayment": r.offered_payment,
                "requesterDisplay": r.requester_display.as_deref()
                    .or(r.requester_handle.as_deref())
                    .unwrap_or("Unknown"),
                "operatorId": r.operator_id.as_deref().unwrap_or(""),
                "operatorDisplay": r.operator_display.as_deref()
                    .or(r.operator_handle.as_deref())
                    .unwrap_or("Unassigned"),
                "channelId": channel_map.get(r.id.as_str()),
                "dispatches": r_dispatches,
            })
        }).collect::<Vec<_>>(),
    })))
}

// ── Handler: GET /api/views/settings ────────────────────────────────────────

async fn settings_profile(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row = sqlx::query_as::<_, SettingsProfileRow>(
        r#"SELECT handle, email, "displayName", role, status, "totpEnabled", "createdAt"
           FROM "User"
           WHERE id = $1"#
    )
    .bind(&session.user_id)
    .fetch_optional(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "settings profile query failed");
        internal("Failed to load profile")
    })?
    .ok_or_else(|| internal("User not found"))?;

    let member_since = row.created_at.format("%B %-d, %Y").to_string();

    Ok(Json(json!({
        "handle": row.handle,
        "email": row.email,
        "displayName": row.display_name,
        "role": row.role,
        "status": row.status,
        "totpEnabled": row.totp_enabled,
        "memberSince": member_since,
    })))
}

// ── SQL row types for QRF view ─────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct QrfDispatchViewRow {
    id: String,
    #[sqlx(rename = "qrfId")]
    qrf_id: String,
    status: String,
    notes: Option<String>,
    #[sqlx(rename = "dispatchedAt")]
    dispatched_at: chrono::NaiveDateTime,
    #[sqlx(rename = "arrivedAt")]
    arrived_at: Option<chrono::NaiveDateTime>,
    #[sqlx(rename = "rtbAt")]
    rtb_at: Option<chrono::NaiveDateTime>,
    #[sqlx(rename = "missionId")]
    mission_id: Option<String>,
    #[sqlx(rename = "missionCallsign")]
    mission_callsign: Option<String>,
    #[sqlx(rename = "missionStatus")]
    mission_status: Option<String>,
    #[sqlx(rename = "rescueId")]
    rescue_id: Option<String>,
    #[sqlx(rename = "survivorHandle")]
    survivor_handle: Option<String>,
    #[sqlx(rename = "rescueStatus")]
    rescue_status: Option<String>,
}

#[derive(sqlx::FromRow)]
struct MissionOptionRow {
    id: String,
    callsign: String,
    title: String,
    status: String,
}

#[derive(sqlx::FromRow)]
struct RescueOptionRow {
    id: String,
    #[sqlx(rename = "survivorHandle")]
    survivor_handle: String,
    #[sqlx(rename = "locationName")]
    location_name: Option<String>,
    status: String,
}

#[derive(sqlx::FromRow)]
struct QrfChannelRow {
    #[sqlx(rename = "refId")]
    ref_id: String,
    id: String,
}

// ── Handler: GET /api/views/qrf ────────────────────────────────────────────

async fn qrf_list(
    State(state): State<AppState>,
    AuthSession(session): AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| internal("No organization found"))?;

    let pool = state.pool();

    let (qrf_items, mission_opts, rescue_opts) = tokio::try_join!(
        sqlx::query_as::<_, QrfRow>(
            r#"SELECT id, callsign, status, platform, "locationName",
                      "availableCrew", notes
               FROM "QrfReadiness"
               WHERE "orgId" = $1
               ORDER BY status ASC, "updatedAt" DESC"#
        )
        .bind(&org.id)
        .fetch_all(pool),
        sqlx::query_as::<_, MissionOptionRow>(
            r#"SELECT id, callsign, title, status
               FROM "Mission"
               WHERE "orgId" = $1 AND status IN ('planning', 'ready', 'active')
               ORDER BY priority DESC, "updatedAt" DESC"#
        )
        .bind(&org.id)
        .fetch_all(pool),
        sqlx::query_as::<_, RescueOptionRow>(
            r#"SELECT id, "survivorHandle", "locationName", status
               FROM "RescueRequest"
               WHERE "orgId" = $1 AND status IN ('open', 'dispatching', 'en_route', 'on_scene')
               ORDER BY urgency ASC, "updatedAt" DESC"#
        )
        .bind(&org.id)
        .fetch_all(pool),
    )
    .map_err(|e| {
        tracing::error!(error = %e, "qrf view query failed");
        internal("Failed to load QRF data")
    })?;

    // Fetch dispatches for all QRF items
    let qrf_ids: Vec<&str> = qrf_items.iter().map(|q| q.id.as_str()).collect();
    let dispatches = if !qrf_ids.is_empty() {
        sqlx::query_as::<_, QrfDispatchViewRow>(
            r#"SELECT d.id, d."qrfId", d.status, d.notes,
                      d."dispatchedAt", d."arrivedAt", d."rtbAt",
                      m.id as "missionId", m.callsign as "missionCallsign",
                      m.status as "missionStatus",
                      r.id as "rescueId", r."survivorHandle",
                      r.status as "rescueStatus"
               FROM "QrfDispatch" d
               LEFT JOIN "Mission" m ON d."missionId" = m.id
               LEFT JOIN "RescueRequest" r ON d."rescueId" = r.id
               WHERE d."qrfId" = ANY($1)
               ORDER BY d."dispatchedAt" DESC"#
        )
        .bind(&qrf_ids)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    // Fetch comms channel IDs linked to QRF items
    let channel_map: std::collections::HashMap<String, String> = if !qrf_ids.is_empty() {
        sqlx::query_as::<_, QrfChannelRow>(
            r#"SELECT "refId", id FROM "ChatChannel"
               WHERE "refType" = 'qrf' AND "refId" = ANY($1)"#
        )
        .bind(&qrf_ids)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|r| (r.ref_id, r.id))
        .collect()
    } else {
        std::collections::HashMap::new()
    };

    // Group dispatches by qrfId
    let mut dispatches_map: std::collections::HashMap<String, Vec<&QrfDispatchViewRow>> =
        std::collections::HashMap::new();
    for d in &dispatches {
        dispatches_map.entry(d.qrf_id.clone()).or_default().push(d);
    }

    let items: Vec<Value> = qrf_items
        .iter()
        .map(|q| {
            let qrf_dispatches = dispatches_map.get(&q.id).map(|ds| {
                ds.iter().take(6).map(|d| {
                    let target_label = if let Some(ref cs) = d.mission_callsign {
                        format!("{} / {}", cs, d.mission_status.as_deref().unwrap_or("unknown"))
                    } else if let Some(ref sh) = d.survivor_handle {
                        format!("{} / {}", sh, d.rescue_status.as_deref().unwrap_or("unknown"))
                    } else {
                        "Unlinked target".to_string()
                    };

                    let target_href = if let Some(ref mid) = d.mission_id {
                        Some(format!("/missions/{}", mid))
                    } else if let Some(ref rid) = d.rescue_id {
                        Some(format!("/rescues#{}", rid))
                    } else {
                        None
                    };

                    json!({
                        "id": d.id,
                        "status": d.status,
                        "notes": d.notes,
                        "targetLabel": target_label,
                        "targetHref": target_href,
                        "dispatchedAtLabel": format_datetime(&d.dispatched_at),
                        "arrivedAtLabel": d.arrived_at.as_ref().map(format_datetime),
                        "rtbAtLabel": d.rtb_at.as_ref().map(format_datetime),
                    })
                }).collect::<Vec<_>>()
            }).unwrap_or_default();

            json!({
                "id": q.id,
                "callsign": q.callsign,
                "status": q.status,
                "platform": q.platform,
                "locationName": q.location_name,
                "availableCrew": q.available_crew,
                "notes": q.notes,
                "dispatches": qrf_dispatches,
                "channelId": channel_map.get(&q.id),
            })
        })
        .collect();

    Ok(Json(json!({
        "orgName": org.name,
        "items": items,
        "missionOptions": mission_opts.iter().map(|m| json!({
            "id": m.id,
            "label": format!("{} / {}", m.callsign, m.title),
            "detail": m.status,
        })).collect::<Vec<_>>(),
        "rescueOptions": rescue_opts.iter().map(|r| json!({
            "id": r.id,
            "label": r.survivor_handle,
            "detail": format!("{} / {}", r.status, r.location_name.as_deref().unwrap_or("location pending")),
        })).collect::<Vec<_>>(),
    })))
}

// ── SQL row types for Rescue view ──────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct RescueDispatchRow {
    id: String,
    #[sqlx(rename = "rescueId")]
    rescue_id: Option<String>,
    status: String,
    notes: Option<String>,
    #[sqlx(rename = "dispatchedAt")]
    dispatched_at: chrono::NaiveDateTime,
    #[sqlx(rename = "qrfCallsign")]
    qrf_callsign: Option<String>,
    platform: Option<String>,
}

#[derive(sqlx::FromRow)]
struct RescueOperatorRow {
    id: String,
    handle: String,
    #[sqlx(rename = "displayName")]
    display_name: Option<String>,
    role: String,
}

#[derive(sqlx::FromRow)]
struct RescueChannelRow {
    id: String,
    #[sqlx(rename = "refId")]
    ref_id: String,
}
