//! Progresso do manual inicial (8 etapas), salvo por USER ID.

use crate::core::Ctx;
use crate::error::{ApiError, ApiResult};
use crate::util::now;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

pub const STEPS: i64 = 8;

pub fn get(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    let row: Option<(i64, i64, i64, String, String, String)> = conn
        .query_row("SELECT current_step, completed, skipped, visited, checklist, updated_at FROM onboarding_progress WHERE user_id = ?1", params![ctx.uid],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)))
        .optional()?;
    let (step, completed, skipped, visited, checklist, updated) = match row {
        Some(r) => r,
        None => {
            conn.execute("INSERT INTO onboarding_progress (user_id, updated_at) VALUES (?1, ?2)", params![ctx.uid, now()])?;
            (1, 0, 0, "[]".into(), "{}".into(), now())
        }
    };
    Ok(json!({
        "current_step": step, "completed": completed != 0, "skipped": skipped != 0, "total_steps": STEPS,
        "visited": serde_json::from_str::<Value>(&visited).unwrap_or(json!([])),
        "checklist": serde_json::from_str::<Value>(&checklist).unwrap_or(json!({})),
        "updated_at": updated,
        "should_show": completed == 0 && skipped == 0,
    }))
}

pub fn save(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let cur = get(conn, ctx)?;
    let step = args.get("current_step").and_then(|v| v.as_i64()).unwrap_or(cur["current_step"].as_i64().unwrap_or(1));
    if !(1..=STEPS).contains(&step) {
        return Err(ApiError::validation("current_step", "Etapa inválida."));
    }
    let completed = args.get("completed").and_then(|v| v.as_bool()).unwrap_or(cur["completed"].as_bool().unwrap_or(false));
    let skipped = args.get("skipped").and_then(|v| v.as_bool()).unwrap_or(cur["skipped"].as_bool().unwrap_or(false));
    let mut visited: Vec<i64> = cur["visited"].as_array().map(|a| a.iter().filter_map(|x| x.as_i64()).collect()).unwrap_or_default();
    if !visited.contains(&step) {
        visited.push(step);
        visited.sort();
    }
    let checklist = match args.get("checklist") {
        Some(c) if c.is_object() => {
            let mut base = cur["checklist"].as_object().cloned().unwrap_or_default();
            for (k, v) in c.as_object().unwrap() {
                if k.len() <= 40 && v.is_boolean() {
                    base.insert(k.clone(), v.clone());
                }
            }
            Value::Object(base)
        }
        _ => cur["checklist"].clone(),
    };
    conn.execute(
        "UPDATE onboarding_progress SET current_step = ?1, completed = ?2, skipped = ?3, visited = ?4, checklist = ?5, updated_at = ?6 WHERE user_id = ?7",
        params![step, completed as i64, skipped as i64, json!(visited).to_string(), checklist.to_string(), now(), ctx.uid],
    )?;
    get(conn, ctx)
}

/// Reabre o manual a partir da Central de Ajuda.
pub fn restart(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    conn.execute("UPDATE onboarding_progress SET current_step = 1, completed = 0, skipped = 0, updated_at = ?1 WHERE user_id = ?2", params![now(), ctx.uid])?;
    get(conn, ctx)
}
