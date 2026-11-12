//! Registros cronológicos: hábitos, etapas de rotina, votos e históricos de progresso.

use crate::core::Ctx;
use crate::entities::{check_access, def, load_meta, Action};
use crate::error::{ApiError, ApiResult};
use crate::util::{self, now};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

pub fn habit_toggle(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "habit_id")?;
    let date = util::arg_opt_str(args, "date").map(String::from).unwrap_or_else(util::today);
    let d = util::parse_date(&date).ok_or_else(|| ApiError::validation("date", "Data inválida."))?;
    if d > util::now_naive().date() {
        return Err(ApiError::validation("date", "Não é possível registrar hábitos em datas futuras."));
    }
    let meta = load_meta(conn, def("habits")?, id)?;
    check_access(ctx, def("habits")?, &meta, Action::Update, false)?;
    let ds = d.format("%Y-%m-%d").to_string();
    let existing: Option<String> = conn.query_row("SELECT id FROM habit_logs WHERE habit_id = ?1 AND log_date = ?2", params![id, ds], |r| r.get(0)).optional()?;
    let done = match existing {
        Some(lid) => {
            conn.execute("DELETE FROM habit_logs WHERE id = ?1", params![lid])?;
            false
        }
        None => {
            conn.execute("INSERT INTO habit_logs (id, habit_id, user_id, log_date, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![util::new_id(), id, ctx.uid, ds, util::arg_opt_str(args, "note"), now()])?;
            true
        }
    };
    Ok(json!({ "done": done, "date": ds }))
}

/// Alterna a conclusão de uma etapa de rotina no dia informado.
pub fn routine_step_toggle(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "step_id")?;
    let d = def("routine_step")?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::Update, false)?;
    let ds = util::arg_opt_str(args, "date").map(String::from).unwrap_or_else(util::today);
    let existing: Option<String> = conn.query_row("SELECT id FROM record_logs WHERE entity = 'routine_step' AND record_id = ?1 AND log_date = ?2", params![id, ds], |r| r.get(0)).optional()?;
    let done = match existing {
        Some(l) => { conn.execute("DELETE FROM record_logs WHERE id = ?1", params![l])?; false }
        None => {
            conn.execute("INSERT INTO record_logs (id, entity, record_id, user_id, log_date, kind, created_at) VALUES (?1, 'routine_step', ?2, ?3, ?4, 'concluido', ?5)",
                params![util::new_id(), id, ctx.uid, ds, now()])?;
            true
        }
    };
    Ok(json!({ "done": done }))
}

/// Registra o voto do usuário (substitui votos anteriores na mesma votação).
pub fn poll_vote(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "poll_id")?;
    let d = def("poll")?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::View, false)?;
    if !ctx.can("social.create") {
        return Err(ApiError::forbidden("Você não tem permissão para votar."));
    }
    let (status, date_end, data): (Option<String>, Option<String>, String) = conn.query_row(
        "SELECT status, date_end, data FROM family_records WHERE id = ?1", params![id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
    if status.as_deref() == Some("encerrada") || date_end.map(|e| !e.is_empty() && e < now()).unwrap_or(false) {
        return Err(ApiError::bad_request("Esta votação está encerrada."));
    }
    let data: Value = serde_json::from_str(&data).unwrap_or(json!({}));
    let nopts = data["options"].as_array().map(|a| a.len()).unwrap_or(0) as i64;
    let multiple = data["multiple"].as_bool().unwrap_or(false);
    let choices: Vec<i64> = args.get("options").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_i64()).collect()).unwrap_or_default();
    if choices.is_empty() || choices.iter().any(|c| *c < 0 || *c >= nopts) {
        return Err(ApiError::validation("options", "Escolha uma opção válida."));
    }
    if !multiple && choices.len() > 1 {
        return Err(ApiError::validation("options", "Esta votação permite apenas uma opção."));
    }
    crate::db::tx(conn, |conn| {
        conn.execute("DELETE FROM record_logs WHERE entity = 'poll' AND kind = 'voto' AND record_id = ?1 AND user_id = ?2", params![id, ctx.uid])?;
        for c in &choices {
            conn.execute("INSERT INTO record_logs (id, entity, record_id, user_id, log_date, kind, value, created_at) VALUES (?1, 'poll', ?2, ?3, ?4, 'voto', ?5, ?6)",
                params![util::new_id(), id, ctx.uid, util::today(), *c as f64, now()])?;
        }
        crate::core::audit(conn, Some(&ctx.uid), ctx.family_id(), "votar", Some("poll"), Some(id), None);
        Ok(())
    })?;
    crate::entities::get(conn, ctx, "poll", id)
}

/// Histórico genérico (ex.: evolução de metas e leitura, revisões de vocabulário).
pub fn list(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let entity = util::arg_str(args, "entity")?;
    let id = util::arg_str(args, "record_id")?;
    let d = def(entity)?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::View, false)?;
    let mut st = conn.prepare("SELECT l.id, l.log_date, l.kind, l.value, l.note, l.created_at, u.full_name FROM record_logs l LEFT JOIN users u ON u.id = l.user_id
        WHERE l.entity = ?1 AND l.record_id = ?2 AND l.kind != 'voto' ORDER BY l.created_at DESC LIMIT 500")?;
    let items: Vec<Value> = st.query_map(params![entity, id], |r| Ok(json!({"id": r.get::<_, String>(0)?, "log_date": r.get::<_, String>(1)?, "kind": r.get::<_, String>(2)?,
        "value": r.get::<_, Option<f64>>(3)?, "note": r.get::<_, Option<String>>(4)?, "created_at": r.get::<_, String>(5)?, "user_name": r.get::<_, Option<String>>(6)?})))?
        .collect::<Result<_, _>>()?;
    Ok(json!({ "items": items }))
}

pub fn add(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let entity = util::arg_str(args, "entity")?;
    let id = util::arg_str(args, "record_id")?;
    let d = def(entity)?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::Update, false)?;
    let kind = util::arg_opt_str(args, "kind").unwrap_or("registro");
    if !matches!(kind, "registro" | "anotacao" | "revisao" | "progresso" | "leitura") {
        return Err(ApiError::validation("kind", "Tipo de registro inválido."));
    }
    let date = util::arg_opt_str(args, "log_date").map(String::from).unwrap_or_else(util::today);
    if util::parse_date(&date).is_none() {
        return Err(ApiError::validation("log_date", "Data inválida."));
    }
    let note = util::arg_opt_str(args, "note");
    if note.map(|n| n.len() > 20_000).unwrap_or(false) {
        return Err(ApiError::validation("note", "Anotação muito longa."));
    }
    let value = args.get("value").and_then(|v| v.as_f64());
    conn.execute("INSERT INTO record_logs (id, entity, record_id, user_id, log_date, kind, value, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![util::new_id(), entity, id, ctx.uid, date, kind, value, note, now()])?;
    list(conn, ctx, args)
}

pub fn delete(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let lid = util::arg_str(args, "id")?;
    let (entity, rid, uid): (String, String, String) = conn.query_row("SELECT entity, record_id, user_id FROM record_logs WHERE id = ?1", params![lid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .optional()?.ok_or_else(|| ApiError::not_found("Registro não encontrado."))?;
    let d = def(&entity)?;
    let meta = load_meta(conn, d, &rid)?;
    check_access(ctx, d, &meta, Action::Update, false)?;
    if uid != ctx.uid && meta.owner_id != ctx.uid {
        return Err(ApiError::forbidden("Você só pode remover seus próprios registros."));
    }
    conn.execute("DELETE FROM record_logs WHERE id = ?1", params![lid])?;
    Ok(json!({ "ok": true }))
}

/// Gera a lista de ingredientes do cardápio de um período e, opcionalmente, adiciona a uma lista de compras.
pub fn menu_ingredients(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let from = util::arg_str(args, "from")?;
    let to = util::arg_str(args, "to")?;
    let menus = crate::entities::list(conn, ctx, &json!({"entity": "menu", "scope": "family", "from": from, "to": to, "page_size": 500}))?;
    let mut agg: std::collections::BTreeMap<(String, String), (String, f64)> = Default::default();
    let mut missing = Vec::new();
    for m in menus["items"].as_array().cloned().unwrap_or_default() {
        let Some(rid) = m["ref_id"].as_str() else { continue };
        let Ok(r) = crate::entities::get(conn, ctx, "recipes", rid) else { missing.push(m["title"].clone()); continue };
        let servings = r["servings"].as_f64().filter(|s| *s > 0.0).unwrap_or(1.0);
        let want = m["data"]["servings"].as_f64().unwrap_or(servings);
        for ing in r["data"]["ingredients"].as_array().cloned().unwrap_or_default() {
            let name = ing["name"].as_str().unwrap_or("").trim().to_string();
            if name.is_empty() { continue; }
            let unit = ing["unit"].as_str().unwrap_or("").trim().to_string();
            let qty = ing["quantity"].as_f64().or_else(|| ing["quantity"].as_str().and_then(|s| s.replace(',', ".").parse().ok())).unwrap_or(1.0);
            let e = agg.entry((util::normalize(&name), unit.to_lowercase())).or_insert((name.clone(), 0.0));
            e.1 += qty * want / servings;
        }
    }
    let items: Vec<Value> = agg.into_iter().map(|((_, u), (n, q))| json!({"name": n, "unit": u, "quantity": (q * 100.0).round() / 100.0})).collect();
    if let Some(list_id) = util::arg_opt_str(args, "add_to_list") {
        for it in &items {
            crate::entities::create(conn, ctx, &json!({"entity": "shopping_items", "values": {"list_id": list_id, "title": it["name"], "quantity": it["quantity"], "unit": it["unit"], "category": "Cardápio"}}))?;
        }
    }
    Ok(json!({ "items": items, "menus_without_recipe": missing }))
}
