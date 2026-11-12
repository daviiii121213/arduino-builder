//! Painéis personalizáveis por usuário e ambiente (PESSOAL e FAMÍLIA).

use crate::core::Ctx;
use crate::entities;
use crate::error::{ApiError, ApiResult};
use crate::util::{self, now};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

pub struct WidgetType {
    pub key: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub personal: bool,
    pub family: bool,
}

pub const WIDGETS: &[WidgetType] = &[
    WidgetType { key: "shortcuts", label: "Atalhos", description: "Acesso rápido aos módulos.", personal: true, family: true },
    WidgetType { key: "tasks_summary", label: "Resumo de tarefas", description: "Pendentes, atrasadas e para hoje.", personal: true, family: true },
    WidgetType { key: "upcoming_events", label: "Próximos compromissos", description: "Agenda dos próximos 7 dias.", personal: true, family: true },
    WidgetType { key: "goals_progress", label: "Metas em andamento", description: "Progresso das metas ativas.", personal: true, family: true },
    WidgetType { key: "finance_summary", label: "Resumo financeiro", description: "Receitas, despesas e saldo do mês.", personal: true, family: true },
    WidgetType { key: "recent_activity", label: "Atividades recentes", description: "Últimas alterações registradas.", personal: true, family: true },
    WidgetType { key: "mini_calendar", label: "Calendário compacto", description: "Mês atual com dias marcados.", personal: true, family: true },
    WidgetType { key: "habits_today", label: "Hábitos de hoje", description: "Registre seus hábitos do dia.", personal: true, family: false },
    WidgetType { key: "bills_due", label: "Contas a vencer", description: "Contas não pagas dos próximos 15 dias.", personal: true, family: true },
    WidgetType { key: "notes_pinned", label: "Notas fixadas", description: "Suas notas fixadas.", personal: true, family: false },
    WidgetType { key: "shopping_lists", label: "Listas de compras", description: "Listas abertas e itens pendentes.", personal: true, family: true },
    WidgetType { key: "pantry_expiring", label: "Despensa: vencimentos", description: "Produtos que vencem em até 7 dias.", personal: false, family: true },
    WidgetType { key: "board_posts", label: "Mural familiar", description: "Comunicados recentes.", personal: false, family: true },
    WidgetType { key: "birthdays", label: "Aniversários", description: "Próximos 30 dias.", personal: false, family: true },
    WidgetType { key: "members", label: "Integrantes", description: "Pessoas da família.", personal: false, family: true },
];

fn defaults(ws: &str) -> Vec<(&'static str, &'static str)> {
    if ws == "personal" {
        vec![("shortcuts", "l"), ("tasks_summary", "m"), ("upcoming_events", "m"), ("habits_today", "m"), ("goals_progress", "m"),
             ("finance_summary", "m"), ("mini_calendar", "s"), ("recent_activity", "m")]
    } else {
        vec![("members", "l"), ("tasks_summary", "m"), ("upcoming_events", "m"), ("board_posts", "m"), ("shopping_lists", "m"),
             ("bills_due", "m"), ("pantry_expiring", "s"), ("birthdays", "s")]
    }
}

pub fn ensure_default(conn: &Connection, uid: &str, ws: &str) -> ApiResult<String> {
    let id: Option<String> = conn.query_row("SELECT id FROM dashboard_layouts WHERE user_id = ?1 AND workspace = ?2", params![uid, ws], |r| r.get(0)).optional()?;
    if let Some(id) = id {
        return Ok(id);
    }
    let id = util::new_id();
    conn.execute("INSERT INTO dashboard_layouts (id, user_id, workspace, updated_at) VALUES (?1, ?2, ?3, ?4)", params![id, uid, ws, now()])?;
    for (i, (w, s)) in defaults(ws).iter().enumerate() {
        conn.execute("INSERT INTO dashboard_widgets (id, layout_id, widget_type, size, position) VALUES (?1, ?2, ?3, ?4, ?5)", params![util::new_id(), id, w, s, i as i64])?;
    }
    Ok(id)
}

fn ws_arg(args: &Value) -> ApiResult<&str> {
    match args.get("workspace").and_then(|v| v.as_str()) {
        Some(w @ ("personal" | "family")) => Ok(w),
        _ => Err(ApiError::bad_request("Ambiente inválido.")),
    }
}

pub fn get(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let ws = ws_arg(args)?;
    let lid = ensure_default(conn, &ctx.uid, ws)?;
    let mut st = conn.prepare("SELECT id, widget_type, size, position, config FROM dashboard_widgets WHERE layout_id = ?1 ORDER BY position")?;
    let widgets: Vec<Value> = st
        .query_map(params![lid], |r| Ok(json!({"id": r.get::<_, String>(0)?, "widget_type": r.get::<_, String>(1)?, "size": r.get::<_, String>(2)?,
            "position": r.get::<_, i64>(3)?, "config": serde_json::from_str::<Value>(&r.get::<_, String>(4)?).unwrap_or(json!({}))})))?
        .collect::<Result<_, _>>()?;
    let catalog: Vec<Value> = WIDGETS
        .iter()
        .filter(|w| if ws == "personal" { w.personal } else { w.family })
        .map(|w| json!({"key": w.key, "label": w.label, "description": w.description}))
        .collect();
    Ok(json!({ "widgets": widgets, "catalog": catalog }))
}

pub fn save(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let ws = ws_arg(args)?;
    let list = args.get("widgets").and_then(|v| v.as_array()).ok_or_else(|| ApiError::bad_request("Lista de widgets inválida."))?;
    if list.len() > 30 {
        return Err(ApiError::bad_request("Limite de 30 widgets por painel."));
    }
    let lid = ensure_default(conn, &ctx.uid, ws)?;
    crate::db::tx(conn, |conn| {
        conn.execute("DELETE FROM dashboard_widgets WHERE layout_id = ?1", params![lid])?;
        for (i, w) in list.iter().enumerate() {
            let t = w.get("widget_type").and_then(|v| v.as_str()).unwrap_or("");
            let ok = WIDGETS.iter().any(|x| x.key == t && if ws == "personal" { x.personal } else { x.family });
            if !ok {
                return Err(ApiError::bad_request(format!("Widget indisponível: {t}")));
            }
            let size = match w.get("size").and_then(|v| v.as_str()) { Some(s @ ("s" | "m" | "l")) => s, _ => "m" };
            let cfg = w.get("config").cloned().unwrap_or(json!({}));
            conn.execute("INSERT INTO dashboard_widgets (id, layout_id, widget_type, size, position, config) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![util::new_id(), lid, t, size, i as i64, cfg.to_string()])?;
        }
        conn.execute("UPDATE dashboard_layouts SET updated_at = ?1 WHERE id = ?2", params![now(), lid])?;
        Ok(())
    })?;
    get(conn, ctx, args)
}

pub fn reset(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let ws = ws_arg(args)?;
    conn.execute("DELETE FROM dashboard_layouts WHERE user_id = ?1 AND workspace = ?2", params![ctx.uid, ws])?;
    get(conn, ctx, args)
}

fn safe(v: ApiResult<Value>) -> Value {
    match v {
        Ok(v) => v,
        Err(e) if e.code == "forbidden" => json!({"forbidden": true, "message": e.message}),
        Err(e) => json!({"error": e.message}),
    }
}

fn items(conn: &Connection, ctx: &Ctx, args: Value) -> ApiResult<Value> {
    Ok(entities::list(conn, ctx, &args)?["items"].clone())
}

/// Dados de todos os widgets do painel em uma única chamada.
pub fn data(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let ws = ws_arg(args)?;
    if ws == "family" && ctx.family.is_none() {
        return Ok(json!({ "no_family": true }));
    }
    let today = util::today();
    let in7 = (util::now_naive().date() + chrono::Duration::days(7)).format("%Y-%m-%d").to_string();
    let in15 = (util::now_naive().date() + chrono::Duration::days(15)).format("%Y-%m-%d").to_string();
    let month = &today[..7];
    let mut out = serde_json::Map::new();

    out.insert("tasks_summary".into(), safe((|| {
        let all = items(conn, ctx, json!({"entity": "tasks", "scope": ws, "filters": {"status": ["pendente", "em_andamento"]}, "page_size": 500}))?;
        let arr = all.as_array().cloned().unwrap_or_default();
        let late = arr.iter().filter(|t| t["is_late"].as_bool() == Some(true)).count();
        let today_list: Vec<&Value> = arr.iter().filter(|t| t["due_date"].as_str().map(|d| d.starts_with(&today)).unwrap_or(false)).collect();
        let mut p: Vec<rusqlite::types::Value> = Vec::new();
        let filt = entities::scope_filter(ctx, entities::def("tasks")?, ws, "t", &mut p)?;
        p.push(rusqlite::types::Value::Text(today.clone()));
        let done_today: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM tasks t WHERE {filt} AND t.deleted_at IS NULL AND substr(t.completed_at,1,10) = ?"),
            rusqlite::params_from_iter(p.iter()), |r| r.get(0))?;
        let next: Vec<&Value> = arr.iter().take(6).collect();
        Ok(json!({"pending": arr.len(), "late": late, "today": today_list.len(), "done_today": done_today, "next": next}))
    })()));

    out.insert("upcoming_events".into(), safe((|| {
        let r = crate::calendar::range(conn, ctx, &json!({"scope": ws, "from": today, "to": in7, "kinds": ["compromisso", "evento", "saude", "estudo", "aniversario", "viagem"]}))?;
        let list: Vec<Value> = r["items"].as_array().cloned().unwrap_or_default().into_iter().take(8).collect();
        Ok(json!({"items": list}))
    })()));

    out.insert("goals_progress".into(), safe(items(conn, ctx, json!({"entity": "goals", "scope": ws, "filters": {"status": "em_andamento"}, "page_size": 6})).map(|v| json!({"items": v}))));

    out.insert("finance_summary".into(), safe(crate::finance::summary(conn, ctx, &json!({"scope": ws, "month": month}))));

    out.insert("bills_due".into(), safe(items(conn, ctx, json!({"entity": "bills", "scope": ws, "filters": {"paid": false}, "to": in15, "page_size": 8})).map(|v| json!({"items": v}))));

    out.insert("shopping_lists".into(), safe(items(conn, ctx, json!({"entity": "shopping_lists", "scope": ws, "filters": {"status": "aberta"}, "page_size": 6})).map(|v| json!({"items": v}))));

    out.insert("mini_calendar".into(), safe((|| {
        let first = format!("{month}-01");
        let last = util::add_months(util::parse_date(&first).unwrap(), 1) - chrono::Duration::days(1);
        let r = crate::calendar::range(conn, ctx, &json!({"scope": ws, "from": first, "to": last.format("%Y-%m-%d").to_string()}))?;
        let mut days: std::collections::BTreeMap<String, i64> = Default::default();
        for i in r["items"].as_array().cloned().unwrap_or_default() {
            if let Some(d) = i["start_at"].as_str() {
                *days.entry(d[..10.min(d.len())].to_string()).or_default() += 1;
            }
        }
        Ok(json!({"month": month, "days": days}))
    })()));

    out.insert("recent_activity".into(), safe((|| {
        let rows = if ws == "personal" {
            let mut st = conn.prepare("SELECT action, entity, record_id, created_at FROM audit_logs WHERE user_id = ?1 AND entity IS NOT NULL AND (family_id IS NULL) ORDER BY created_at DESC LIMIT 10")?;
            let v: Vec<Value> = st.query_map(params![ctx.uid], |r| Ok(json!({"action": r.get::<_, String>(0)?, "entity": r.get::<_, Option<String>>(1)?, "record_id": r.get::<_, Option<String>>(2)?, "created_at": r.get::<_, String>(3)?})))?.collect::<Result<_, _>>()?;
            v
        } else {
            let mut st = conn.prepare("SELECT a.action, a.entity, a.record_id, a.created_at, COALESCE(u.full_name,'—') FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE a.family_id = ?1 AND a.entity IS NOT NULL ORDER BY a.created_at DESC LIMIT 40")?;
            let v: Vec<Value> = st.query_map(params![ctx.family_id().unwrap()], |r| Ok(json!({"action": r.get::<_, String>(0)?, "entity": r.get::<_, Option<String>>(1)?, "record_id": r.get::<_, Option<String>>(2)?, "created_at": r.get::<_, String>(3)?, "user_name": r.get::<_, String>(4)?})))?.collect::<Result<_, _>>()?;
            // mostra apenas atividades de áreas que o usuário pode visualizar
            v.into_iter().filter(|a| {
                a["entity"].as_str().and_then(|e| entities::def(e).ok()).map(|d| d.area == "personal" || ctx.can(&format!("{}.view", d.area))).unwrap_or(false)
            }).take(10).collect()
        };
        let labeled: Vec<Value> = rows.into_iter().map(|mut a| {
            if let Some(d) = a["entity"].as_str().and_then(|e| entities::def(e).ok()) { a["label"] = json!(d.label); }
            a
        }).collect();
        Ok(json!({"items": labeled}))
    })()));

    if ws == "personal" {
        out.insert("habits_today".into(), safe(items(conn, ctx, json!({"entity": "habits", "scope": "personal", "filters": {"active": true}, "page_size": 12})).map(|v| json!({"items": v}))));
        out.insert("notes_pinned".into(), safe(items(conn, ctx, json!({"entity": "notes", "scope": "personal", "filters": {"pinned": true}, "page_size": 6})).map(|v| json!({"items": v}))));
    } else {
        out.insert("pantry_expiring".into(), safe(items(conn, ctx, json!({"entity": "pantry", "scope": "family", "to": in7, "sort": "date_end ASC", "page_size": 8}))
            .map(|v| json!({"items": v.as_array().cloned().unwrap_or_default().into_iter().filter(|i| i["date_end"].as_str().map(|s| !s.is_empty()).unwrap_or(false)).collect::<Vec<_>>()}))));
        out.insert("board_posts".into(), safe(items(conn, ctx, json!({"entity": "board_post", "scope": "family", "sort": "created_at DESC", "page_size": 4})).map(|v| json!({"items": v}))));
        out.insert("birthdays".into(), safe((|| {
            let all = items(conn, ctx, json!({"entity": "birthday", "scope": "family", "page_size": 500}))?;
            let t = util::now_naive().date();
            let mut list: Vec<Value> = all.as_array().cloned().unwrap_or_default().into_iter().filter_map(|mut b| {
                let bd = b["date_start"].as_str().and_then(util::parse_date)?;
                let n = crate::notify::next_anniversary(bd, t);
                let diff = (n - t).num_days();
                if diff <= 30 { b["next_date"] = json!(n.format("%Y-%m-%d").to_string()); b["days_left"] = json!(diff); Some(b) } else { None }
            }).collect();
            list.sort_by_key(|b| b["days_left"].as_i64());
            Ok(json!({"items": list}))
        })()));
        out.insert("members".into(), safe(crate::family::members_basic(conn, ctx).map(|v| json!({"items": v}))));
    }
    Ok(Value::Object(out))
}
