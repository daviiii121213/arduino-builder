//! Calendário: expansão de recorrências e agregação de itens com data (compromissos,
//! tarefas, contas, aniversários, eventos, consultas e provas).

use crate::core::Ctx;
use crate::entities::{def, query_rows, scope_filter};
use crate::error::{ApiError, ApiResult};
use crate::util;
use chrono::{Duration, NaiveDate, NaiveDateTime};
use rusqlite::types::Value as SqlValue;
use serde_json::{json, Value};

/// Datas de ocorrência de um compromisso dentro de [from, to].
pub fn occurrences(start: NaiveDateTime, recurrence: &str, until: Option<NaiveDate>, from: NaiveDate, to: NaiveDate) -> Vec<NaiveDateTime> {
    let mut out = Vec::new();
    let end = match until {
        Some(u) if u < to => u,
        _ => to,
    };
    if start.date() > end {
        return out;
    }
    match recurrence {
        "diaria" | "semanal" => {
            let step = if recurrence == "diaria" { 1 } else { 7 };
            let mut k = 0i64;
            if from > start.date() {
                let diff = (from - start.date()).num_days();
                k = diff / step;
            }
            loop {
                let d = start + Duration::days(k * step);
                if d.date() > end {
                    break;
                }
                if d.date() >= from {
                    out.push(d);
                }
                k += 1;
                if out.len() > 400 {
                    break;
                }
            }
        }
        "mensal" | "anual" => {
            let step = if recurrence == "mensal" { 1 } else { 12 };
            for k in 0..2400 {
                let d = util::add_months(start.date(), k * step).and_time(start.time());
                if d.date() > end {
                    break;
                }
                if d.date() >= from {
                    out.push(d);
                }
            }
        }
        _ => {
            if start.date() >= from && start.date() <= end {
                out.push(start);
            }
        }
    }
    out
}

fn expand_events(rows: Vec<serde_json::Map<String, Value>>, from: NaiveDate, to: NaiveDate) -> Vec<Value> {
    let mut out = Vec::new();
    for r in rows {
        let Some(start) = r.get("start_at").and_then(|v| v.as_str()).and_then(util::parse_datetime) else { continue };
        let end = r.get("end_at").and_then(|v| v.as_str()).and_then(util::parse_datetime);
        let dur = end.map(|e| e - start).unwrap_or(Duration::zero());
        let rec = r.get("recurrence").and_then(|v| v.as_str()).unwrap_or("nenhuma");
        let until = r.get("recurrence_until").and_then(|v| v.as_str()).and_then(util::parse_date);
        // ocorrências que começaram antes do intervalo mas ainda estão em curso
        let look_from = from - Duration::days(dur.num_days().max(0));
        for o in occurrences(start, rec, until, look_from, to) {
            let mut item = r.clone();
            item.insert("start_at".into(), json!(o.format("%Y-%m-%dT%H:%M").to_string()));
            item.insert("end_at".into(), if end.is_some() { json!((o + dur).format("%Y-%m-%dT%H:%M").to_string()) } else { Value::Null });
            item.insert("occurrence_of".into(), r.get("id").cloned().unwrap_or(Value::Null));
            out.push(Value::Object(item));
        }
    }
    out
}

/// Ocorrências de compromissos pessoais e familiares visíveis ao usuário.
pub fn event_occurrences(conn: &rusqlite::Connection, ctx: &Ctx, from: &str, to: &str) -> ApiResult<Vec<Value>> {
    let (Some(f), Some(t)) = (util::parse_date(from), util::parse_date(to)) else { return Err(ApiError::bad_request("Período inválido.")) };
    let d = def("events")?;
    let mut out = Vec::new();
    let mut scopes = vec!["personal"];
    if ctx.family.is_some() && ctx.can("agenda.view") {
        scopes.push("family");
    }
    for sc in scopes {
        let mut p: Vec<SqlValue> = Vec::new();
        let filt = scope_filter(ctx, d, sc, "t", &mut p)?;
        p.push(SqlValue::Text(to.to_string()));
        let rows = query_rows(conn, d, &format!("SELECT t.* FROM events t WHERE {filt} AND t.deleted_at IS NULL AND substr(t.start_at,1,10) <= ?"), &p)?;
        // evita duplicar registros pessoais compartilhados
        let rows = if sc == "family" { rows.into_iter().filter(|r| r.get("owner_id").and_then(|v| v.as_str()) != Some(ctx.uid.as_str()) || r.get("scope").and_then(|v| v.as_str()) == Some("family")).collect() } else { rows };
        out.extend(expand_events(rows, f, t));
    }
    Ok(out)
}

/// Itens do calendário de um ambiente em um período.
pub fn range(conn: &rusqlite::Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let scope = args.get("scope").and_then(|v| v.as_str()).unwrap_or("personal");
    let from = util::arg_str(args, "from")?;
    let to = util::arg_str(args, "to")?;
    let (Some(f), Some(t)) = (util::parse_date(from), util::parse_date(to)) else { return Err(ApiError::bad_request("Período inválido.")) };
    if (t - f).num_days() > 400 {
        return Err(ApiError::bad_request("Período muito longo."));
    }
    let mut items: Vec<Value> = Vec::new();
    let can = |area: &str| scope == "personal" || ctx.can(&format!("{area}.view"));

    let add = |entity: &str, kind: &str, date_col: &str, extra_where: &str, items: &mut Vec<Value>| -> ApiResult<()> {
        let d = def(entity)?;
        let mut p: Vec<SqlValue> = Vec::new();
        let filt = scope_filter(ctx, d, scope, "t", &mut p)?;
        p.push(SqlValue::Text(from.to_string()));
        p.push(SqlValue::Text(to.to_string()));
        let rows = query_rows(conn, d, &format!(
            "SELECT t.* FROM {} t WHERE {filt} AND t.deleted_at IS NULL AND t.{date_col} IS NOT NULL AND t.{date_col} != '' AND substr(t.{date_col},1,10) >= ? AND substr(t.{date_col},1,10) <= ? {extra_where} LIMIT 2000",
            d.table), &p)?;
        for mut r in rows {
            let ds = r.get(date_col).cloned().unwrap_or(Value::Null);
            r.insert("kind".into(), json!(kind));
            r.insert("start_at".into(), ds);
            items.push(Value::Object(r));
        }
        Ok(())
    };

    if can("agenda") {
        let d = def("events")?;
        let mut p: Vec<SqlValue> = Vec::new();
        let filt = scope_filter(ctx, d, scope, "t", &mut p)?;
        p.push(SqlValue::Text(to.to_string()));
        let rows = query_rows(conn, d, &format!("SELECT t.* FROM events t WHERE {filt} AND t.deleted_at IS NULL AND substr(t.start_at,1,10) <= ?"), &p)?;
        for mut e in expand_events(rows, f, t) {
            e["kind"] = json!("compromisso");
            items.push(e);
        }
    }
    if can("tasks") {
        add("tasks", "tarefa", "due_date", "", &mut items)?;
    }
    if can("finance") {
        add("bills", "conta", "due_date", "", &mut items)?;
    }
    if scope == "personal" {
        add("health_appointment", "saude", "date_start", "", &mut items)?;
        add("study_item", "estudo", "date_start", "AND t.category IN ('prova','entrega','tarefa')", &mut items)?;
    } else {
        if can("memories") {
            add("family_event", "evento", "date_start", "", &mut items)?;
            // aniversários: projeta a data no ano exibido
            let d = def("birthday")?;
            let mut p: Vec<SqlValue> = Vec::new();
            let filt = scope_filter(ctx, d, scope, "t", &mut p)?;
            let rows = query_rows(conn, d, &format!("SELECT t.* FROM family_records t WHERE {filt} AND t.deleted_at IS NULL AND t.date_start IS NOT NULL"), &p)?;
            for mut r in rows {
                let Some(bd) = r.get("date_start").and_then(|v| v.as_str()).and_then(util::parse_date) else { continue };
                let n = crate::notify::next_anniversary(bd, f);
                if n <= t {
                    r.insert("kind".into(), json!("aniversario"));
                    r.insert("start_at".into(), json!(n.format("%Y-%m-%d").to_string()));
                    items.push(Value::Object(r));
                }
            }
        }
        if can("home") {
            add("menu", "cardapio", "date_start", "", &mut items)?;
            add("maintenance", "manutencao", "date_end", "", &mut items)?;
        }
        if can("goals") {
            add("trip", "viagem", "date_start", "", &mut items)?;
        }
    }
    if let Some(kinds) = args.get("kinds").and_then(|v| v.as_array()) {
        let ks: Vec<&str> = kinds.iter().filter_map(|k| k.as_str()).collect();
        items.retain(|i| ks.contains(&i["kind"].as_str().unwrap_or("")));
    }
    if let Some(cat) = util::arg_opt_str(args, "category") {
        items.retain(|i| i["category"].as_str() == Some(cat));
    }
    items.sort_by(|a, b| a["start_at"].as_str().cmp(&b["start_at"].as_str()));
    Ok(json!({ "items": items }))
}
