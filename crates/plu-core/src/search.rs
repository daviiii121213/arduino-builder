//! Pesquisa global: percorre os módulos visíveis ao usuário respeitando permissões.
//! Não pesquisa conteúdo de arquivos anexados (apenas os nomes cadastrados).

use crate::core::Ctx;
use crate::entities::{query_rows, scope_filter, allows_scope, ENTITIES};
use crate::error::{ApiError, ApiResult};
use crate::util::{self, now};
use rusqlite::types::Value as SqlValue;
use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn query(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let q = args.get("q").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let from = util::arg_opt_str(args, "from");
    let to = util::arg_opt_str(args, "to");
    let category = util::arg_opt_str(args, "category").map(util::normalize);
    if q.chars().count() < 2 && from.is_none() && to.is_none() && category.is_none() {
        return Err(ApiError::validation("q", "Digite pelo menos 2 caracteres ou use um filtro."));
    }
    let only: Option<Vec<String>> = args.get("entities").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect());
    let ws_filter = args.get("workspace").and_then(|v| v.as_str());
    let qn = format!("%{}%", util::normalize(&q).replace(['%', '_'], ""));
    let mut groups = Vec::new();
    let mut total = 0usize;
    let mut workspaces = vec!["personal"];
    if ctx.family.is_some() {
        workspaces.push("family");
    }
    for ws in workspaces {
        if ws_filter.map(|w| w != ws).unwrap_or(false) {
            continue;
        }
        for d in ENTITIES.iter() {
            if !allows_scope(d, ws) {
                continue;
            }
            if let Some(o) = &only {
                if !o.iter().any(|x| x == d.name) {
                    continue;
                }
            }
            let mut p: Vec<SqlValue> = Vec::new();
            let Ok(filt) = scope_filter(ctx, d, ws, "t", &mut p) else { continue };
            let mut wh = vec![filt, "t.deleted_at IS NULL".to_string()];
            if q.chars().count() >= 2 {
                let parts: Vec<String> = d.search_cols.iter().map(|c| format!("plu_norm(t.{c}) LIKE ?")).collect();
                for _ in d.search_cols {
                    p.push(SqlValue::Text(qn.clone()));
                }
                wh.push(format!("({})", parts.join(" OR ")));
            }
            if let Some(c) = &category {
                if !d.fields.iter().any(|f| f.col == "category") {
                    continue;
                }
                wh.push("plu_norm(t.category) = ?".into());
                p.push(SqlValue::Text(c.clone()));
            }
            if from.is_some() || to.is_some() {
                let Some(dc) = d.date_col else { continue };
                if let Some(f) = from {
                    wh.push(format!("substr(t.{dc},1,10) >= ?"));
                    p.push(SqlValue::Text(f.to_string()));
                }
                if let Some(t) = to {
                    wh.push(format!("substr(t.{dc},1,10) <= ?"));
                    p.push(SqlValue::Text(t.to_string()));
                }
            }
            // evita repetir no ambiente FAMÍLIA os registros pessoais do próprio usuário
            if ws == "family" {
                wh.push("NOT (t.scope = 'personal' AND t.owner_id = ?)".into());
                p.push(SqlValue::Text(ctx.uid.clone()));
            }
            let title_col = if d.fields.iter().any(|f| f.col == "title") { "t.title" } else { "t.category" };
            let date_sel = d.date_col.map(|c| format!("t.{c}")).unwrap_or_else(|| "NULL".into());
            let parent_sel = d.parent.map(|(_, c)| format!("t.{c}")).unwrap_or_else(|| "NULL".into());
            let snippet_col = d.search_cols.iter().find(|c| **c != "title" && **c != "category").map(|c| format!("t.{c}")).unwrap_or_else(|| "NULL".into());
            let sql = format!(
                "SELECT t.id, {title_col} AS title, {snippet_col} AS snippet, {date_sel} AS date, {parent_sel} AS parent_id, t.scope, t.updated_at FROM {} t WHERE {} ORDER BY t.updated_at DESC LIMIT 8",
                d.table, wh.join(" AND "));
            let rows = query_rows(conn, d, &sql, &p)?;
            if rows.is_empty() {
                continue;
            }
            total += rows.len();
            let items: Vec<Value> = rows.into_iter().map(|mut r| {
                if let Some(Value::String(s)) = r.get("snippet") {
                    let short: String = s.chars().take(160).collect();
                    r.insert("snippet".into(), json!(short));
                }
                Value::Object(r)
            }).collect();
            groups.push(json!({"entity": d.name, "label": d.label, "workspace": ws, "parent_entity": d.parent.map(|p| p.0), "items": items}));
        }
    }
    let save = crate::settings::get_one(conn, &ctx.uid, "search_history")?.as_bool().unwrap_or(true);
    if save && q.chars().count() >= 2 {
        conn.execute("DELETE FROM search_history WHERE user_id = ?1 AND query = ?2", params![ctx.uid, q])?;
        conn.execute("INSERT INTO search_history (id, user_id, query, created_at) VALUES (?1, ?2, ?3, ?4)", params![util::new_id(), ctx.uid, q, now()])?;
        conn.execute("DELETE FROM search_history WHERE user_id = ?1 AND id NOT IN (SELECT id FROM search_history WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 20)", params![ctx.uid])?;
    }
    Ok(json!({ "groups": groups, "total": total, "query": q }))
}

pub fn history(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    let mut st = conn.prepare("SELECT query FROM search_history WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 20")?;
    let items: Vec<String> = st.query_map(params![ctx.uid], |r| r.get(0))?.collect::<Result<_, _>>()?;
    Ok(json!({ "items": items }))
}

pub fn clear_history(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    conn.execute("DELETE FROM search_history WHERE user_id = ?1", params![ctx.uid])?;
    Ok(json!({ "items": [] }))
}
