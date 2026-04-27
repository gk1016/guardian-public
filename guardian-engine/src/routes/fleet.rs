use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;
use std::collections::{HashMap, HashSet};

use crate::auth::middleware::AuthSession;
use crate::helpers::audit::audit_log;
use crate::helpers::org::get_org_for_user;
use crate::state::AppState;

// ── Row types ───────────────────────────────────────────────────────────────

#[derive(FromRow)]
struct FleetShipRow {
    id: String,
    #[sqlx(rename = "userId")]
    user_id: String,
    #[sqlx(rename = "shipSpecId")]
    ship_spec_id: String,
    #[sqlx(rename = "shipName")]
    ship_name: Option<String>,
    notes: Option<String>,
    status: String,
    #[sqlx(rename = "createdAt")]
    created_at: chrono::NaiveDateTime,
    // joined from ShipSpec
    spec_id: String,
    spec_name: String,
    manufacturer: String,
    classification: String,
    focus: Option<String>,
    #[sqlx(rename = "crewMin")]
    crew_min: i32,
    #[sqlx(rename = "crewMax")]
    crew_max: i32,
    cargo: i32,
    #[sqlx(rename = "imageUrl")]
    image_url: Option<String>,
    // joined from User
    handle: String,
    #[sqlx(rename = "displayName")]
    display_name: Option<String>,
}

#[derive(FromRow, serde::Serialize)]
struct ShipSpecRow {
    id: String,
    name: String,
    manufacturer: String,
    classification: String,
    focus: Option<String>,
    #[sqlx(rename = "crewMin")]
    #[serde(rename = "crewMin")]
    crew_min: i32,
    #[sqlx(rename = "crewMax")]
    #[serde(rename = "crewMax")]
    crew_max: i32,
    cargo: i32,
    #[sqlx(rename = "imageUrl")]
    #[serde(rename = "imageUrl")]
    image_url: Option<String>,
    #[sqlx(rename = "inGame")]
    #[serde(rename = "inGame")]
    in_game: bool,
}

// ── Request / query types ───────────────────────────────────────────────────

#[derive(Deserialize)]
struct AddShipBody {
    #[serde(rename = "shipSpecId")]
    ship_spec_id: String,
    #[serde(rename = "shipName")]
    ship_name: Option<String>,
    notes: Option<String>,
}

#[derive(Deserialize)]
struct SpecsQuery {
    q: Option<String>,
    classification: Option<String>,
}

// ── UEX Corp API sync types ──────────────────────────────────────────────────

#[derive(Deserialize)]
struct UexResponse {
    data: Vec<UexVehicle>,
}

#[derive(Deserialize, serde::Serialize)]
#[allow(dead_code)]
struct UexVehicle {
    name: Option<String>,
    name_full: Option<String>,
    slug: Option<String>,
    scu: Option<i32>,
    crew: Option<i32>,
    is_bomber: Option<i32>,
    is_cargo: Option<i32>,
    is_concept: Option<i32>,
    is_construction: Option<i32>,
    is_datarunner: Option<i32>,
    is_emp: Option<i32>,
    is_exploration: Option<i32>,
    is_ground_vehicle: Option<i32>,
    is_industrial: Option<i32>,
    is_interdiction: Option<i32>,
    is_medical: Option<i32>,
    is_military: Option<i32>,
    is_mining: Option<i32>,
    is_passenger: Option<i32>,
    is_racing: Option<i32>,
    is_refinery: Option<i32>,
    is_refuel: Option<i32>,
    is_repair: Option<i32>,
    is_salvage: Option<i32>,
    is_scanning: Option<i32>,
    is_science: Option<i32>,
    is_spaceship: Option<i32>,
    is_stealth: Option<i32>,
    url_photo: Option<String>,
    pad_type: Option<String>,
    company_name: Option<String>,
}

fn uex_flag(v: Option<i32>) -> bool {
    v.unwrap_or(0) != 0
}

/// Derive (classification, focus) from UEX vehicle flags.
fn classify_uex(v: &UexVehicle) -> (String, Option<String>) {
    let mut cats: Vec<&str> = Vec::new();
    let mut focus: Option<&str> = None;

    if uex_flag(v.is_ground_vehicle) && !uex_flag(v.is_spaceship) {
        cats.push("ground");
    }
    if uex_flag(v.is_racing) {
        cats.push("competition");
        focus = Some("Racing");
    }
    if uex_flag(v.is_mining) || uex_flag(v.is_salvage) || uex_flag(v.is_refinery)
        || uex_flag(v.is_construction) || uex_flag(v.is_industrial)
    {
        cats.push("industrial");
        if uex_flag(v.is_mining) {
            focus = Some("Mining");
        } else if uex_flag(v.is_salvage) {
            focus = Some("Salvage");
        } else if uex_flag(v.is_refinery) {
            focus = Some("Refinery");
        } else {
            focus = Some("Industrial");
        }
    }
    if uex_flag(v.is_medical) || uex_flag(v.is_refuel) || uex_flag(v.is_repair)
        || uex_flag(v.is_datarunner) || uex_flag(v.is_scanning) || uex_flag(v.is_science)
    {
        cats.push("support");
        if uex_flag(v.is_medical) {
            focus = Some("Medical");
        } else if uex_flag(v.is_refuel) {
            focus = Some("Refueling");
        } else if uex_flag(v.is_repair) {
            focus = Some("Repair");
        } else if uex_flag(v.is_datarunner) {
            focus = Some("Data Running");
        } else if uex_flag(v.is_scanning) {
            focus = Some("Scanning");
        } else {
            focus = Some("Science");
        }
    }
    if uex_flag(v.is_exploration) {
        cats.push("exploration");
        if focus.is_none() {
            focus = Some("Exploration");
        }
    }
    if uex_flag(v.is_cargo) || uex_flag(v.is_passenger) {
        cats.push("transport");
        if focus.is_none() {
            focus = if uex_flag(v.is_passenger) { Some("Touring") } else { Some("Freight") };
        }
    }
    if uex_flag(v.is_military) || uex_flag(v.is_bomber) || uex_flag(v.is_emp)
        || uex_flag(v.is_interdiction) || uex_flag(v.is_stealth)
    {
        cats.push("combat");
        if focus.is_none() {
            focus = if uex_flag(v.is_bomber) {
                Some("Bombing")
            } else if uex_flag(v.is_emp) {
                Some("EMP")
            } else if uex_flag(v.is_interdiction) {
                Some("Interdiction")
            } else if uex_flag(v.is_stealth) {
                Some("Stealth")
            } else {
                Some("Combat")
            };
        }
    }

    cats.dedup();
    let classification = if cats.is_empty() {
        "unknown".to_string()
    } else if cats.len() == 1 {
        cats[0].to_string()
    } else {
        "multi".to_string()
    };

    (classification, focus.map(String::from))
}

// ── Routes ──────────────────────────────────────────────────────────────────

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/fleet/ships", get(list_ships).post(add_ship))
        .route("/api/fleet/ships/{shipId}", delete(remove_ship))
        .route("/api/fleet/specs", get(search_specs))
        .route("/api/fleet/readiness", get(readiness))
        .route("/api/admin/fleet/sync-specs", post(sync_specs))
}

// ── GET /api/fleet/ships ────────────────────────────────────────────────────

async fn list_ships(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))?;

    let ships = sqlx::query_as::<_, FleetShipRow>(
        r#"SELECT
            fs.id, fs."userId", fs."shipSpecId", fs."shipName",
            fs.notes, fs.status, fs."createdAt",
            ss.id as spec_id, ss.name as spec_name, ss.manufacturer,
            ss.classification, ss.focus, ss."crewMin", ss."crewMax",
            ss.cargo, ss."imageUrl",
            u.handle, u."displayName"
        FROM "FleetShip" fs
        JOIN "ShipSpec" ss ON fs."shipSpecId" = ss.id
        JOIN "User" u ON fs."userId" = u.id
        WHERE fs."orgId" = $1 AND fs.status = 'active'
        ORDER BY fs."createdAt" DESC"#,
    )
    .bind(&org.id)
    .fetch_all(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "failed to fetch fleet ships");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch fleet."})))
    })?;

    let ships_json: Vec<Value> = ships.iter().map(|s| json!({
        "id": s.id,
        "userId": s.user_id,
        "shipSpecId": s.ship_spec_id,
        "shipName": s.ship_name,
        "notes": s.notes,
        "status": s.status,
        "createdAt": s.created_at.and_utc().to_rfc3339(),
        "shipSpec": {
            "id": s.spec_id,
            "name": s.spec_name,
            "manufacturer": s.manufacturer,
            "classification": s.classification,
            "focus": s.focus,
            "crewMin": s.crew_min,
            "crewMax": s.crew_max,
            "cargo": s.cargo,
            "imageUrl": s.image_url,
        },
        "user": {
            "handle": s.handle,
            "displayName": s.display_name,
        },
    })).collect();

    Ok(Json(json!({ "ships": ships_json })))
}

// ── POST /api/fleet/ships ───────────────────────────────────────────────────

async fn add_ship(
    State(state): State<AppState>,
    session: AuthSession,
    Json(body): Json<AddShipBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))?;

    #[derive(FromRow)]
    struct SpecCheck { id: String, name: String }
    let spec = sqlx::query_as::<_, SpecCheck>(r#"SELECT id, name FROM "ShipSpec" WHERE id = $1"#)
        .bind(&body.ship_spec_id)
        .fetch_optional(state.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Ship spec not found."}))))?;

    let ship_id = cuid2::create_id();
    sqlx::query(
        r#"INSERT INTO "FleetShip" (id, "userId", "orgId", "shipSpecId", "shipName", notes, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())"#,
    )
    .bind(&ship_id).bind(&session.user_id).bind(&org.id).bind(&body.ship_spec_id)
    .bind(&body.ship_name).bind(&body.notes)
    .execute(state.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to add ship."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "add_fleet_ship", "fleet_ship", Some(&ship_id),
        Some(json!({"shipSpec": spec.name, "shipName": body.ship_name}))).await;

    Ok(Json(json!({"ok": true, "ship": {"id": ship_id, "shipSpecId": body.ship_spec_id, "specName": spec.name}})))
}

// ── DELETE /api/fleet/ships/{shipId} ────────────────────────────────────────

async fn remove_ship(
    State(state): State<AppState>,
    session: AuthSession,
    Path(ship_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))?;

    #[derive(FromRow)]
    struct ShipOwner {
        #[sqlx(rename = "userId")] user_id: String,
        #[sqlx(rename = "orgId")] org_id: String,
    }
    let ship = sqlx::query_as::<_, ShipOwner>(
        r#"SELECT "userId", "orgId" FROM "FleetShip" WHERE id = $1"#,
    )
    .bind(&ship_id)
    .fetch_optional(state.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error."}))))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Ship not found."}))))?;

    if ship.org_id != org.id {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Ship not found."}))));
    }
    if ship.user_id != session.user_id && !session.can_manage_administration() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "You can only remove your own ships."}))));
    }

    sqlx::query(r#"DELETE FROM "FleetShip" WHERE id = $1"#)
        .bind(&ship_id).execute(state.pool()).await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Delete failed."}))))?;

    audit_log(state.pool(), &session.user_id, Some(&org.id), "remove_fleet_ship", "fleet_ship", Some(&ship_id), None).await;

    Ok(Json(json!({"ok": true})))
}

// ── GET /api/fleet/specs ────────────────────────────────────────────────────

async fn search_specs(
    State(state): State<AppState>,
    _session: AuthSession,
    Query(params): Query<SpecsQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Build dynamic query
    let has_q = params.q.as_ref().map(|q| !q.is_empty()).unwrap_or(false);
    let has_cls = params.classification.as_ref().map(|c| !c.is_empty()).unwrap_or(false);

    let sql = match (has_q, has_cls) {
        (true, true) => r#"SELECT id, name, manufacturer, classification, focus, "crewMin", "crewMax", cargo, "imageUrl", "inGame" FROM "ShipSpec" WHERE (name ILIKE $1 OR manufacturer ILIKE $1 OR focus ILIKE $1) AND classification = $2 ORDER BY name ASC LIMIT 50"#,
        (true, false) => r#"SELECT id, name, manufacturer, classification, focus, "crewMin", "crewMax", cargo, "imageUrl", "inGame" FROM "ShipSpec" WHERE (name ILIKE $1 OR manufacturer ILIKE $1 OR focus ILIKE $1) ORDER BY name ASC LIMIT 50"#,
        (false, true) => r#"SELECT id, name, manufacturer, classification, focus, "crewMin", "crewMax", cargo, "imageUrl", "inGame" FROM "ShipSpec" WHERE classification = $1 ORDER BY name ASC LIMIT 50"#,
        (false, false) => r#"SELECT id, name, manufacturer, classification, focus, "crewMin", "crewMax", cargo, "imageUrl", "inGame" FROM "ShipSpec" ORDER BY name ASC LIMIT 50"#,
    };

    let specs: Vec<ShipSpecRow> = match (has_q, has_cls) {
        (true, true) => {
            let pattern = format!("%{}%", params.q.as_deref().unwrap_or(""));
            sqlx::query_as(sql).bind(&pattern).bind(params.classification.as_deref().unwrap_or("")).fetch_all(state.pool()).await
        }
        (true, false) => {
            let pattern = format!("%{}%", params.q.as_deref().unwrap_or(""));
            sqlx::query_as(sql).bind(&pattern).fetch_all(state.pool()).await
        }
        (false, true) => {
            sqlx::query_as(sql).bind(params.classification.as_deref().unwrap_or("")).fetch_all(state.pool()).await
        }
        (false, false) => {
            sqlx::query_as(sql).fetch_all(state.pool()).await
        }
    }.map_err(|e| {
        tracing::error!(error = %e, "failed to search specs");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to search specs."})))
    })?;

    Ok(Json(json!({ "specs": specs })))
}

// ── GET /api/fleet/readiness ────────────────────────────────────────────────

async fn readiness(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let org = get_org_for_user(state.pool(), &session.user_id)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "No organization found."}))))?;

    let ships = sqlx::query_as::<_, FleetShipRow>(
        r#"SELECT
            fs.id, fs."userId", fs."shipSpecId", fs."shipName",
            fs.notes, fs.status, fs."createdAt",
            ss.id as spec_id, ss.name as spec_name, ss.manufacturer,
            ss.classification, ss.focus, ss."crewMin", ss."crewMax",
            ss.cargo, ss."imageUrl",
            u.handle, u."displayName"
        FROM "FleetShip" fs
        JOIN "ShipSpec" ss ON fs."shipSpecId" = ss.id
        JOIN "User" u ON fs."userId" = u.id
        WHERE fs."orgId" = $1 AND fs.status = 'active'
        ORDER BY fs."createdAt" DESC"#,
    )
    .bind(&org.id)
    .fetch_all(state.pool())
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "failed to fetch fleet for readiness");
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch fleet data."})))
    })?;

    let member_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM "OrgMember" m JOIN "User" u ON m."userId" = u.id WHERE m."orgId" = $1 AND u.status = 'active'"#,
    )
    .bind(&org.id)
    .fetch_one(state.pool())
    .await
    .unwrap_or(0);

    let mut by_class: HashMap<String, Value> = HashMap::new();
    let mut unique_owners: HashSet<String> = HashSet::new();
    let mut unique_types: HashSet<String> = HashSet::new();
    let mut total_crew_max: i64 = 0;
    let mut total_crew_min: i64 = 0;
    let mut total_cargo: i64 = 0;

    for ship in &ships {
        unique_owners.insert(ship.user_id.clone());
        unique_types.insert(ship.spec_name.clone());
        total_crew_max += ship.crew_max as i64;
        total_crew_min += ship.crew_min as i64;
        total_cargo += ship.cargo as i64;

        let entry = by_class.entry(ship.classification.clone()).or_insert_with(|| {
            json!({"count": 0, "crewRequired": 0, "crewMinimum": 0, "ships": []})
        });
        if let Some(obj) = entry.as_object_mut() {
            *obj.get_mut("count").unwrap() = json!(obj["count"].as_i64().unwrap_or(0) + 1);
            *obj.get_mut("crewRequired").unwrap() = json!(obj["crewRequired"].as_i64().unwrap_or(0) + ship.crew_max as i64);
            *obj.get_mut("crewMinimum").unwrap() = json!(obj["crewMinimum"].as_i64().unwrap_or(0) + ship.crew_min as i64);
            if let Some(arr) = obj.get_mut("ships").and_then(|v| v.as_array_mut()) {
                arr.push(json!({"name": ship.spec_name, "owner": ship.handle, "crewMax": ship.crew_max, "shipName": ship.ship_name}));
            }
        }
    }

    let crew_sufficiency = if member_count >= total_crew_max {
        "full"
    } else if member_count >= total_crew_min {
        "minimum"
    } else {
        "undermanned"
    };

    Ok(Json(json!({
        "readiness": {
            "totalShips": ships.len(),
            "uniqueTypes": unique_types.len(),
            "uniqueOwners": unique_owners.len(),
            "memberCount": member_count,
            "crewCapacity": { "min": total_crew_min, "max": total_crew_max },
            "totalCargo": total_cargo,
            "crewSufficiency": crew_sufficiency,
            "byClassification": by_class,
        }
    })))
}

// ── POST /api/admin/fleet/sync-specs ────────────────────────────────────────

async fn sync_specs(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !session.can_manage_administration() {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Admin authority required."}))));
    }

    // Fetch all vehicles from UEX Corp API
    let resp = state.http_client()
        .get("https://uexcorp.space/api/2.0/vehicles")
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "UEX Corp API request failed");
            (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to fetch from UEX Corp API."})))
        })?;

    if !resp.status().is_success() {
        return Err((StatusCode::BAD_GATEWAY, Json(json!({"error": format!("UEX API returned {}", resp.status())}))));
    }

    let uex_resp: UexResponse = resp.json().await.map_err(|e| {
        tracing::error!(error = %e, "failed to parse UEX response");
        (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to parse UEX data."})))
    })?;

    let mut synced = 0u64;
    let mut migrated = 0u64;

    for vehicle in &uex_resp.data {
        let slug = match &vehicle.slug {
            Some(s) if !s.is_empty() => s.clone(),
            _ => continue,
        };
        let name = vehicle.name.clone().unwrap_or_default();
        if name.is_empty() { continue; }

        let manufacturer = vehicle.company_name.clone().unwrap_or_else(|| "Unknown".into());
        let (classification, focus) = classify_uex(vehicle);
        let size_category = vehicle.pad_type.clone();
        let crew = vehicle.crew.unwrap_or(1).max(1);
        let cargo = vehicle.scu.unwrap_or(0);
        let image_url = vehicle.url_photo.clone();
        let in_game = !uex_flag(vehicle.is_concept);
        let raw_data = serde_json::to_value(vehicle).unwrap_or(json!(null));
        let new_id = cuid2::create_id();

        // Pre-migration: if a record exists with matching name but different slug,
        // update its slug to the UEX slug so the ON CONFLICT upsert finds it.
        // This preserves FleetShip foreign keys during the fleetyards->UEX transition.
        let mig = sqlx::query(
            r#"UPDATE "ShipSpec" SET "fleetyardsSlug" = $1, "updatedAt" = NOW()
               WHERE name = $2 AND "fleetyardsSlug" != $1"#,
        )
        .bind(&slug)
        .bind(&name)
        .execute(state.pool())
        .await;

        if let Ok(r) = &mig {
            migrated += r.rows_affected();
        }

        // Upsert by slug
        let result = sqlx::query(
            r#"INSERT INTO "ShipSpec" (id, "fleetyardsSlug", "scIdentifier", name, manufacturer,
                classification, focus, "sizeCategory", "crewMin", "crewMax", cargo,
                "imageUrl", "inGame", "rawData", "createdAt", "updatedAt")
            VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            ON CONFLICT ("fleetyardsSlug") DO UPDATE SET
                name = EXCLUDED.name, manufacturer = EXCLUDED.manufacturer,
                classification = EXCLUDED.classification, focus = EXCLUDED.focus,
                "sizeCategory" = EXCLUDED."sizeCategory",
                "crewMin" = EXCLUDED."crewMin", "crewMax" = EXCLUDED."crewMax",
                cargo = EXCLUDED.cargo, "imageUrl" = EXCLUDED."imageUrl",
                "inGame" = EXCLUDED."inGame", "rawData" = EXCLUDED."rawData",
                "updatedAt" = NOW()"#,
        )
        .bind(&new_id)
        .bind(&slug)
        .bind(&name)
        .bind(&manufacturer)
        .bind(&classification)
        .bind(&focus)
        .bind(&size_category)
        .bind(crew)  // crewMin
        .bind(crew)  // crewMax (UEX provides single crew field)
        .bind(cargo)
        .bind(&image_url)
        .bind(in_game)
        .bind(&raw_data)
        .execute(state.pool())
        .await;

        match result {
            Ok(_) => synced += 1,
            Err(e) => tracing::warn!(slug = %slug, error = %e, "failed to upsert spec"),
        }
    }

    // Post-sync: re-point FleetShip records whose specs still have stale image URLs
    // to a matching UEX spec (handles name changes like "Ares Inferno" -> "Ares Inferno Starfighter")
    let relinked = sqlx::query(
        r#"UPDATE "FleetShip" SET "shipSpecId" = new_spec.id, "updatedAt" = NOW()
           FROM "ShipSpec" old_spec, "ShipSpec" new_spec
           WHERE "FleetShip"."shipSpecId" = old_spec.id
           AND new_spec.name LIKE old_spec.name || ' %'
           AND new_spec."imageUrl" LIKE 'https://%uexcorp.space%'
           AND (old_spec."imageUrl" IS NULL OR old_spec."imageUrl" NOT LIKE 'https://%uexcorp.space%')
           AND new_spec.id != old_spec.id"#,
    )
    .execute(state.pool())
    .await
    .map(|r| r.rows_affected())
    .unwrap_or(0);

    if relinked > 0 {
        tracing::info!(relinked, "re-linked FleetShip records to updated specs");
    }

    tracing::info!(synced, migrated, relinked, "UEX Corp spec sync complete");
    Ok(Json(json!({"ok": true, "synced": synced, "migrated": migrated, "relinked": relinked, "source": "uexcorp.space"})))
}
