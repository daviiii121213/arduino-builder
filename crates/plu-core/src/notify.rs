//! Notificações locais: geração de lembretes, central de notificações e entrega ao sistema.

use crate::automation;
use crate::calendar;
use crate::core::Ctx;
use crate::error::ApiResult;
use crate::settings;
use crate::util::{self, now};
use chrono::{Datelike, Duration, NaiveDate, NaiveTime};
use rusqlite::{params, Connection};
use serde_json::{json, Value};

/// Cria uma notificação (idempotente pela chave `dedupe`). Retorna true se criou.
#[allow(clippy::too_many_arguments)]
pub fn push(conn: &Connection, uid: &str, kind: &str, title: &str, body: &str, entity: Option<&str>, record_id: Option<&str>,
    due_at: Option<&str>, dedupe: &str) -> ApiResult<bool> {
    let cats = settings::get_one(conn, uid, "notifications")?;
    if cats.get("enabled").and_then(|v| v.as_bool()) == Some(false) {
        return Ok(false);
    }
    if cats.get("categories").and_then(|c| c.get(kind)).and_then(|v| v.as_bool()) == Some(false) {
        return Ok(false);
    }
    let n = conn.execute(
        "INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, entity, record_id, due_at, dedupe_key, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![util::new_id(), uid, kind, title, body, entity, record_id, due_at, dedupe, now()],
    )?;
    Ok(n > 0)
}

fn fmt_dt(s: &str) -> String {
    match util::parse_datetime(s) {
        Some(d) if s.len() > 10 => d.format("%d/%m %H:%M").to_string(),
        Some(d) => d.format("%d/%m/%Y").to_string(),
        None => s.to_string(),
    }
}

/// Verifica lembretes do usuário com sessão ativa. Executada periodicamente.
pub fn scan(conn: &Connection, ctx: &Ctx) -> ApiResult<()> {
    automation::seed_for_user(conn, &ctx.uid)?;
    automation::run_task_overdue(conn, ctx)?;
    let nset = settings::get_one(conn, &ctx.uid, "notifications")?;
    let advance = nset.get("advance_minutes").and_then(|v| v.as_i64()).unwrap_or(30);
    let now_dt = util::now_naive();
    let today = now_dt.date();
    let fam = ctx.family_id().map(String::from);

    if let Some((rid, p)) = automation::enabled(conn, &ctx.uid, "date_reminder")? {
        let days = automation::param_i64(&p, "days_before", 1);
        // Compromissos (inclui recorrências) nas próximas 48h
        let from = today.format("%Y-%m-%d").to_string();
        let to = (today + Duration::days(2)).format("%Y-%m-%d").to_string();
        let occ = calendar::event_occurrences(conn, ctx, &from, &to)?;
        for o in occ {
            let start = o["start_at"].as_str().unwrap_or_default().to_string();
            let Some(sdt) = util::parse_datetime(&start) else { continue };
            let mins = o["reminder_minutes"].as_i64().unwrap_or(advance);
            if now_dt >= sdt - Duration::minutes(mins) && now_dt <= sdt + Duration::minutes(5) {
                let id = o["id"].as_str().unwrap_or_default();
                let title = o["title"].as_str().unwrap_or_default();
                if push(conn, &ctx.uid, "evento", "Compromisso próximo", &format!("{title} — {}", fmt_dt(&start)), Some("events"), Some(id), Some(&start), &format!("event:{id}:{start}"))? {
                    automation::log(conn, &rid, &ctx.uid, &format!("Lembrete de compromisso: {title}"), Some("events"), Some(id))?;
                }
            }
        }
        // Tarefas com prazo hoje
        let mut st = conn.prepare(
            "SELECT id, title, due_date, reminder_minutes FROM tasks WHERE deleted_at IS NULL AND status != 'concluida' AND due_date IS NOT NULL
             AND substr(due_date,1,10) <= ?2 AND substr(due_date,1,10) >= ?3
             AND ((scope = 'personal' AND owner_id = ?1) OR (scope = 'family' AND family_id = ?4 AND (assignee_id = ?1 OR (assignee_id IS NULL AND owner_id = ?1))))",
        )?;
        let rows: Vec<(String, String, String, Option<i64>)> = st
            .query_map(params![ctx.uid, today.format("%Y-%m-%d").to_string(), today.format("%Y-%m-%d").to_string(), fam], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
            .collect::<Result<_, _>>()?;
        for (id, title, due, rem) in rows {
            let due_dt = util::parse_datetime(&due).unwrap_or(now_dt);
            let has_time = due.len() > 10;
            let fire = if has_time { now_dt >= due_dt - Duration::minutes(rem.unwrap_or(advance)) } else { true };
            if fire && push(conn, &ctx.uid, "tarefa", "Tarefa para hoje", &format!("{title} — prazo {}", fmt_dt(&due)), Some("tasks"), Some(&id), Some(&due), &format!("task:{id}:{due}"))? {
                automation::log(conn, &rid, &ctx.uid, &format!("Lembrete de tarefa: {title}"), Some("tasks"), Some(&id))?;
            }
        }
        // Documentos com data importante
        let limit = (today + Duration::days(days.max(0))).format("%Y-%m-%d").to_string();
        let mut st = conn.prepare(
            "SELECT id, title, expiry_date, COALESCE(reminder_days, ?3) FROM documents WHERE deleted_at IS NULL AND expiry_date IS NOT NULL
             AND expiry_date >= ?2 AND ((scope = 'personal' AND owner_id = ?1) OR (scope = 'family' AND family_id = ?4))",
        )?;
        let rows: Vec<(String, String, String, i64)> = st
            .query_map(params![ctx.uid, today.format("%Y-%m-%d").to_string(), days, fam], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
            .collect::<Result<_, _>>()?;
        for (id, title, exp, rd) in rows {
            let Some(ed) = util::parse_date(&exp) else { continue };
            if (ed - today).num_days() <= rd {
                push(conn, &ctx.uid, "documento", "Data importante de documento", &format!("{title} — {}", fmt_dt(&exp)), Some("documents"), Some(&id), Some(&exp), &format!("doc:{id}:{exp}"))?;
            }
        }
        let _ = limit;
        // Consultas de saúde
        let mut st = conn.prepare(
            "SELECT id, title, date_start FROM personal_records WHERE module = 'health_appointment' AND deleted_at IS NULL AND owner_id = ?1
             AND date_start IS NOT NULL AND substr(date_start,1,10) >= ?2 AND substr(date_start,1,10) <= ?3",
        )?;
        let rows: Vec<(String, String, String)> = st
            .query_map(params![ctx.uid, today.format("%Y-%m-%d").to_string(), (today + Duration::days(days.max(0))).format("%Y-%m-%d").to_string()], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<Result<_, _>>()?;
        for (id, title, ds) in rows {
            push(conn, &ctx.uid, "saude", "Consulta ou exame próximo", &format!("{title} — {}", fmt_dt(&ds)), Some("health_appointment"), Some(&id), Some(&ds), &format!("health:{id}:{ds}"))?;
        }
        // Eventos familiares
        if let Some(fid) = &fam {
            if ctx.can("memories.view") {
                let mut st = conn.prepare(
                    "SELECT id, title, date_start FROM family_records WHERE module = 'family_event' AND deleted_at IS NULL AND family_id = ?1
                     AND date_start IS NOT NULL AND substr(date_start,1,10) >= ?2 AND substr(date_start,1,10) <= ?3",
                )?;
                let rows: Vec<(String, String, String)> = st
                    .query_map(params![fid, today.format("%Y-%m-%d").to_string(), (today + Duration::days(1)).format("%Y-%m-%d").to_string()], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
                    .collect::<Result<_, _>>()?;
                for (id, title, ds) in rows {
                    push(conn, &ctx.uid, "evento", "Evento da família", &format!("{title} — {}", fmt_dt(&ds)), Some("family_event"), Some(&id), Some(&ds), &format!("fevent:{id}:{ds}"))?;
                }
            }
        }
    }

    if let Some((rid, p)) = automation::enabled(conn, &ctx.uid, "bill_due")? {
        let days = automation::param_i64(&p, "days_before", 3);
        let limit = (today + Duration::days(days)).format("%Y-%m-%d").to_string();
        let can_fin = ctx.can("finance.view");
        let mut st = conn.prepare(
            "SELECT id, title, due_date, amount, COALESCE(reminder_days, ?4) FROM bills WHERE deleted_at IS NULL AND paid = 0 AND due_date <= ?2
             AND ((scope = 'personal' AND owner_id = ?1) OR (?5 = 1 AND scope = 'family' AND family_id = ?3))",
        )?;
        let rows: Vec<(String, String, String, f64, i64)> = st
            .query_map(params![ctx.uid, limit, fam, days, can_fin as i64], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))?
            .collect::<Result<_, _>>()?;
        for (id, title, due, amount, rd) in rows {
            let Some(dd) = util::parse_date(&due) else { continue };
            let diff = (dd - today).num_days();
            if diff > rd {
                continue;
            }
            let body = if diff < 0 { format!("{title} venceu em {} (R$ {:.2}).", fmt_dt(&due), amount) } else { format!("{title} vence em {} (R$ {:.2}).", fmt_dt(&due), amount) };
            if push(conn, &ctx.uid, "vencimento", if diff < 0 { "Conta vencida" } else { "Conta a vencer" }, &body, Some("bills"), Some(&id), Some(&due), &format!("bill:{id}:{due}:{}", diff < 0))? {
                automation::log(conn, &rid, &ctx.uid, &body, Some("bills"), Some(&id))?;
            }
        }
    }

    if let Some((rid, _)) = automation::enabled(conn, &ctx.uid, "habit_reminder")? {
        let mut st = conn.prepare(
            "SELECT h.id, h.title, h.reminder_time FROM habits h WHERE h.owner_id = ?1 AND h.deleted_at IS NULL AND h.active = 1 AND h.reminder_time IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM habit_logs l WHERE l.habit_id = h.id AND l.log_date = ?2)",
        )?;
        let ds = today.format("%Y-%m-%d").to_string();
        let rows: Vec<(String, String, String)> = st.query_map(params![ctx.uid, ds], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<Result<_, _>>()?;
        for (id, title, t) in rows {
            if let Ok(tt) = NaiveTime::parse_from_str(&t, "%H:%M") {
                if now_dt.time() >= tt && push(conn, &ctx.uid, "habito", "Lembrete de hábito", &format!("Registre \"{title}\" hoje."), Some("habits"), Some(&id), None, &format!("habit:{id}:{ds}"))? {
                    automation::log(conn, &rid, &ctx.uid, &format!("Lembrete do hábito {title}"), Some("habits"), Some(&id))?;
                }
            }
        }
    }

    if let Some(fid) = &fam {
        if ctx.can("home.view") {
            for (rule, module, kind, title_txt) in [
                ("pantry_expiry", "pantry", "despensa", "Produto perto do vencimento"),
                ("maintenance_due", "maintenance", "manutencao", "Manutenção prevista"),
            ] {
                if let Some((rid, p)) = automation::enabled(conn, &ctx.uid, rule)? {
                    let days = automation::param_i64(&p, "days_before", 5);
                    let limit = (today + Duration::days(days)).format("%Y-%m-%d").to_string();
                    let mut st = conn.prepare(
                        "SELECT id, title, date_end FROM family_records WHERE module = ?1 AND family_id = ?2 AND deleted_at IS NULL
                         AND date_end IS NOT NULL AND date_end != '' AND substr(date_end,1,10) <= ?3",
                    )?;
                    let rows: Vec<(String, String, String)> = st.query_map(params![module, fid, limit], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<Result<_, _>>()?;
                    for (id, title, de) in rows {
                        let body = format!("{title} — {}", fmt_dt(&de));
                        if push(conn, &ctx.uid, kind, title_txt, &body, Some(module), Some(&id), Some(&de), &format!("{module}:{id}:{de}"))? {
                            automation::log(conn, &rid, &ctx.uid, &body, Some(module), Some(&id))?;
                        }
                    }
                }
            }
        }
        if ctx.can("memories.view") {
            if let Some((rid, p)) = automation::enabled(conn, &ctx.uid, "birthday_reminder")? {
                let days = automation::param_i64(&p, "days_before", 3);
                let mut st = conn.prepare("SELECT id, title, date_start FROM family_records WHERE module = 'birthday' AND family_id = ?1 AND deleted_at IS NULL AND date_start IS NOT NULL")?;
                let rows: Vec<(String, String, String)> = st.query_map(params![fid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<Result<_, _>>()?;
                for (id, title, ds) in rows {
                    let Some(bd) = util::parse_date(&ds) else { continue };
                    let next = next_anniversary(bd, today);
                    let diff = (next - today).num_days();
                    if diff <= days {
                        let when = if diff == 0 { "hoje".to_string() } else { format!("em {} dia(s), {}", diff, next.format("%d/%m")) };
                        let body = format!("Aniversário de {title} {when}.");
                        if push(conn, &ctx.uid, "aniversario", "Aniversário", &body, Some("birthday"), Some(&id), None, &format!("bday:{id}:{}", next.year()))? {
                            automation::log(conn, &rid, &ctx.uid, &body, Some("birthday"), Some(&id))?;
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

pub fn next_anniversary(bd: NaiveDate, today: NaiveDate) -> NaiveDate {
    let mk = |y: i32| NaiveDate::from_ymd_opt(y, bd.month(), bd.day()).unwrap_or_else(|| NaiveDate::from_ymd_opt(y, 2, 28).unwrap());
    let this = mk(today.year());
    if this >= today { this } else { mk(today.year() + 1) }
}

fn in_quiet_hours(nset: &Value) -> bool {
    if nset.get("quiet_enabled").and_then(|v| v.as_bool()) != Some(true) {
        return false;
    }
    let parse = |k: &str| nset.get(k).and_then(|v| v.as_str()).and_then(|s| NaiveTime::parse_from_str(s, "%H:%M").ok());
    let (Some(a), Some(b)) = (parse("quiet_start"), parse("quiet_end")) else { return false };
    let t = util::now_naive().time();
    if a <= b { t >= a && t < b } else { t >= a || t < b }
}

/// Notificações ainda não entregues ao sistema operacional (respeitando horário silencioso).
pub fn take_for_os(conn: &Connection, uid: &str) -> ApiResult<Vec<Value>> {
    let nset = settings::get_one(conn, uid, "notifications")?;
    if nset.get("enabled").and_then(|v| v.as_bool()) == Some(false) || nset.get("os").and_then(|v| v.as_bool()) == Some(false) || in_quiet_hours(&nset) {
        return Ok(vec![]);
    }
    let mut st = conn.prepare("SELECT id, title, body FROM notifications WHERE user_id = ?1 AND delivered = 0 ORDER BY created_at LIMIT 5")?;
    let rows: Vec<(String, String, Option<String>)> = st.query_map(params![uid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<Result<_, _>>()?;
    conn.execute("UPDATE notifications SET delivered = 1 WHERE user_id = ?1 AND delivered = 0", params![uid])?;
    Ok(rows.into_iter().map(|(id, t, b)| json!({"id": id, "title": t, "body": b})).collect())
}

pub fn list(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let only_unread = util::arg_bool(args, "unread");
    let mut st = conn.prepare(&format!(
        "SELECT id, kind, title, body, entity, record_id, due_at, read, created_at FROM notifications WHERE user_id = ?1 {} ORDER BY created_at DESC LIMIT 100",
        if only_unread { "AND read = 0" } else { "" }
    ))?;
    let items: Vec<Value> = st
        .query_map(params![ctx.uid], |r| {
            Ok(json!({"id": r.get::<_, String>(0)?, "kind": r.get::<_, String>(1)?, "title": r.get::<_, String>(2)?, "body": r.get::<_, Option<String>>(3)?,
                "entity": r.get::<_, Option<String>>(4)?, "record_id": r.get::<_, Option<String>>(5)?, "due_at": r.get::<_, Option<String>>(6)?,
                "read": r.get::<_, i64>(7)? != 0, "created_at": r.get::<_, String>(8)?}))
        })?
        .collect::<Result<_, _>>()?;
    let unread: i64 = conn.query_row("SELECT COUNT(*) FROM notifications WHERE user_id = ?1 AND read = 0", params![ctx.uid], |r| r.get(0))?;
    Ok(json!({ "items": items, "unread": unread }))
}

pub fn mark_read(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    match util::arg_opt_str(args, "id") {
        Some(id) => conn.execute("UPDATE notifications SET read = 1 WHERE id = ?1 AND user_id = ?2", params![id, ctx.uid])?,
        None => conn.execute("UPDATE notifications SET read = 1 WHERE user_id = ?1", params![ctx.uid])?,
    };
    list(conn, ctx, &json!({}))
}

pub fn clear(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    conn.execute("DELETE FROM notifications WHERE user_id = ?1 AND read = 1", params![ctx.uid])?;
    list(conn, ctx, &json!({}))
}
