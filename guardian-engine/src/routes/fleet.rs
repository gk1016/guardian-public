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

// ── Fleetyards sync types ───────────────────────────────────────────────────

#[derive(Deserialize, serde::Serialize)]
#[allow(dead_code)]
struct FleetyardsModel {
    slug: Option<String>,
    name: Option<String>,
    #[serde(rename = "scIdentifier")]
    sc_identifier: Option<String>,
    manufacturer: Option<FleetyardsManufacturer>,
    classification: Option<String>,
    focus: Option<String>,
    size: Option<String>,
    #[serde(rename = "minCrew")]
    min_crew: Option<i32>,
    #[serde(rename = "maxCrew")]
    max_crew: Option<i32>,
    cargo: Option<i32>,
    #[serde(rename = "storeImageMedium")]
    store_image_medium: Option<String>,
    #[serde(rename = "productionStatus")]
    production_status: Option<String>,
}

#[derive(Deserialize, serde::Serialize)]
#[allow(dead_code)]
struct FleetyardsManufacturer {
    name: Option<String>,
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

    let resp = state.http_client()
        .get("https://api.fleetyards.net/v1/models?per_page=240")
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "fleetyards API request failed");
            (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to fetch from fleetyards.net."})))
        })?;

    if !resp.status().is_success() {
        return Err((StatusCode::BAD_GATEWAY, Json(json!({"error": format!("Fleetyards API returned {}", resp.status())}))));
    }

    let models: Vec<FleetyardsModel> = resp.json().await.map_err(|e| {
        tracing::error!(error = %e, "failed to parse fleetyards response");
        (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to parse fleetyards data."})))
    })?;

    let mut synced = 0u64;

    for model in &models {
        let slug = match &model.slug {
            Some(s) if !s.is_empty() => s.clone(),
            _ => continue,
        };
        let name = model.name.clone().unwrap_or_default();
        let manufacturer = model.manufacturer.as_ref().and_then(|m| m.name.clone()).unwrap_or_else(|| "Unknown".into());
        let classification = model.classification.clone().unwrap_or_else(|| "unknown".into());
        let raw_data = serde_json::to_value(model).unwrap_or(json!(null));
        let new_id = cuid2::create_id();

        let result = sqlx::query(
            r#"INSERT INTO "ShipSpec" (id, "fleetyardsSlug", "scIdentifier", name, manufacturer, classification, focus, "sizeCategory", "crewMin", "crewMax", cargo, "imageUrl", "inGame", "rawData", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
            ON CONFLICT ("fleetyardsSlug") DO UPDATE SET
                "scIdentifier" = EXCLUDED."scIdentifier", name = EXCLUDED.name, manufacturer = EXCLUDED.manufacturer,
                classification = EXCLUDED.classification, focus = EXCLUDED.focus, "sizeCategory" = EXCLUDED."sizeCategory",
                "crewMin" = EXCLUDED."crewMin", "crewMax" = EXCLUDED."crewMax", cargo = EXCLUDED.cargo,
                "imageUrl" = EXCLUDED."imageUrl", "inGame" = EXCLUDED."inGame", "rawData" = EXCLUDED."rawData",
                "updatedAt" = NOW()"#,
        )
        .bind(&new_id).bind(&slug).bind(&model.sc_identifier)
        .bind(&name).bind(&manufacturer).bind(&classification)
        .bind(&model.focus).bind(&model.size)
        .bind(model.min_crew.unwrap_or(1)).bind(model.max_crew.unwrap_or(1))
        .bind(model.cargo.unwrap_or(0)).bind(&model.store_image_medium)
        .bind(model.production_status.as_ref().map(|s| s.to_lowercase() == "flight-ready").unwrap_or(false))
        .bind(&raw_data)
        .execute(state.pool())
        .await;

        match result {
            Ok(_) => synced += 1,
            Err(e) => tracing::warn!(slug = %slug, error = %e, "failed to upsert spec"),
        }
    }

    Ok(Json(json!({"ok": true, "synced": synced, "source": "fleetyards.net"})))
}
