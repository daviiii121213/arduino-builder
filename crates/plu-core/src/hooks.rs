//! Efeitos após gravações: datas de conclusão, recorrências, progresso e automações.

use crate::automation;
use crate::core::Ctx;
use crate::entities::{def, EntityDef};
use crate::error::ApiResult;
use crate::util::{self, now};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

fn next_date(date: &str, recurrence: &str) -> Option<String> {
    let d = util::parse_date(date)?;
    let nd = match recurrence {
        "diaria" => d + chrono::Duration::days(1),
        "semanal" => d + chrono::Duration::days(7),
        "mensal" => util::add_months(d, 1),
        "anual" => util::add_months(d, 12),
        _ => return None,
    };
    let rest = if date.len() > 10 { &date[10..] } else { "" };
    Some(format!("{}{}", nd.format("%Y-%m-%d"), rest))
}

pub fn after_write(conn: &Connection, ctx: &Ctx, d: &EntityDef, id: &str, before: Option<&Value>) -> ApiResult<()> {
    let was = |k: &str| before.and_then(|b| b.get(k)).cloned().unwrap_or(Value::Null);
    match d.name {
        "tasks" => {
            let (status, recurrence, due, project): (String, String, Option<String>, Option<String>) = conn.query_row(
                "SELECT status, recurrence, due_date, project_id FROM tasks WHERE id = ?1", params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?;
            let was_done = was("status").as_str() == Some("concluida");
            if status == "concluida" && !was_done {
                conn.execute("UPDATE tasks SET completed_at = ?1, overdue = 0 WHERE id = ?2", params![now(), id])?;
                if recurrence != "nenhuma" {
                    if let Some(nd) = due.as_deref().and_then(|x| next_date(x, &recurrence)) {
                        let nid = util::new_id();
                        conn.execute(
                            "INSERT INTO tasks (id, scope, owner_id, family_id, shared, restricted_to, data, created_by, updated_by, created_at, updated_at,
                               title, notes, status, priority, due_date, category, project_id, assignee_id, recurrence, reminder_minutes)
                             SELECT ?1, scope, owner_id, family_id, shared, restricted_to, data, ?2, ?2, ?3, ?3,
                               title, notes, 'pendente', priority, ?4, category, project_id, assignee_id, recurrence, reminder_minutes
                             FROM tasks WHERE id = ?5",
                            params![nid, ctx.uid, now(), nd, id],
                        )?;
                    }
                }
            } else if status != "concluida" && was_done {
                conn.execute("UPDATE tasks SET completed_at = NULL WHERE id = ?1", params![id])?;
            }
            if let Some(dd) = &due {
                if dd[..dd.len().min(10)] >= *util::today() {
                    conn.execute("UPDATE tasks SET overdue = 0 WHERE id = ?1", params![id])?;
                }
            }
            if let Some(p) = project {
                update_project_progress(conn, ctx, &p)?;
            }
            if let Some(p) = was("project_id").as_str() {
                update_project_progress(conn, ctx, p)?;
            }
        }
        "project_steps" => {
            let p: String = conn.query_row("SELECT project_id FROM project_steps WHERE id = ?1", params![id], |r| r.get(0))?;
            update_project_progress(conn, ctx, &p)?;
        }
        "goals" => {
            let cv: f64 = conn.query_row("SELECT current_value FROM goals WHERE id = ?1", params![id], |r| r.get(0))?;
            if before.is_none() || was("current_value").as_f64() != Some(cv) {
                conn.execute(
                    "INSERT INTO record_logs (id, entity, record_id, user_id, log_date, kind, value, created_at) VALUES (?1, 'goals', ?2, ?3, ?4, 'progresso', ?5, ?6)",
                    params![util::new_id(), id, ctx.uid, util::today(), cv, now()],
                )?;
            }
            update_goal_progress(conn, ctx, id)?;
        }
        "goal_milestones" => {
            let g: String = conn.query_row("SELECT goal_id FROM goal_milestones WHERE id = ?1", params![id], |r| r.get(0))?;
            update_goal_progress(conn, ctx, &g)?;
        }
        "shopping_items" => {
            let (bought, list): (i64, String) = conn.query_row("SELECT bought, list_id FROM shopping_items WHERE id = ?1", params![id], |r| Ok((r.get(0)?, r.get(1)?)))?;
            if bought == 1 && was("bought").as_bool() != Some(true) {
                conn.execute("UPDATE shopping_items SET bought_at = ?1 WHERE id = ?2", params![now(), id])?;
            } else if bought == 0 {
                conn.execute("UPDATE shopping_items SET bought_at = NULL WHERE id = ?1", params![id])?;
            }
            check_shopping_complete(conn, ctx, &list)?;
        }
        "transactions" => {
            let (kind, scope, fid, cat, date): (String, String, Option<String>, Option<String>, String) = conn.query_row(
                "SELECT kind, scope, family_id, category, date FROM transactions WHERE id = ?1", params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))?;
            if kind == "despesa" {
                automation::check_budgets(conn, ctx, &scope, fid.as_deref(), cat.as_deref(), &date)?;
            }
        }
        "bills" => {
            let (paid, title, amount, paid_amount, due, rec, scope, fid, cat): (i64, String, f64, Option<f64>, String, String, String, Option<String>, Option<String>) =
                conn.query_row("SELECT paid, title, amount, paid_amount, due_date, recurrence, scope, family_id, category FROM bills WHERE id = ?1", params![id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?)))?;
            let was_paid = was("paid").as_bool() == Some(true);
            if paid == 1 && !was_paid {
                let ts = now();
                let value = paid_amount.unwrap_or(amount);
                conn.execute("UPDATE bills SET paid_at = ?1, paid_amount = ?2 WHERE id = ?3", params![ts, value, id])?;
                // Registra o pagamento como despesa (uma única vez por conta).
                let exists: Option<String> = conn.query_row("SELECT id FROM transactions WHERE bill_id = ?1 AND deleted_at IS NULL", params![id], |r| r.get(0)).optional()?;
                if exists.is_none() {
                    conn.execute(
                        "INSERT INTO transactions (id, scope, owner_id, family_id, created_by, updated_by, created_at, updated_at, kind, title, amount, category, date, bill_id, notes)
                         VALUES (?1, ?2, ?3, ?4, ?3, ?3, ?5, ?5, 'despesa', ?6, ?7, ?8, ?9, ?10, 'Pagamento de conta registrado automaticamente')",
                        params![util::new_id(), scope, ctx.uid, fid, ts, format!("Pagamento: {title}"), value, cat.clone().unwrap_or_else(|| "Contas".into()), util::today(), id],
                    )?;
                    automation::check_budgets(conn, ctx, &scope, fid.as_deref(), cat.as_deref().or(Some("Contas")), &util::today())?;
                }
                if let Some(nd) = next_date(&due, &rec) {
                    conn.execute(
                        "INSERT INTO bills (id, scope, owner_id, family_id, shared, data, created_by, updated_by, created_at, updated_at,
                           title, amount, due_date, category, recurrence, paid, reminder_days, assignee_id, notes)
                         SELECT ?1, scope, owner_id, family_id, shared, data, ?2, ?2, ?3, ?3, title, amount, ?4, category, recurrence, 0, reminder_days, assignee_id, notes
                         FROM bills WHERE id = ?5",
                        params![util::new_id(), ctx.uid, now(), nd, id],
                    )?;
                }
            } else if paid == 0 && was_paid {
                conn.execute("UPDATE bills SET paid_at = NULL WHERE id = ?1", params![id])?;
            }
        }
        "book" => {
            let p: Option<f64> = conn.query_row("SELECT progress FROM personal_records WHERE id = ?1", params![id], |r| r.get(0))?;
            if let Some(p) = p {
                if was("progress").as_f64() != Some(p) {
                    conn.execute(
                        "INSERT INTO record_logs (id, entity, record_id, user_id, log_date, kind, value, created_at) VALUES (?1, 'book', ?2, ?3, ?4, 'progresso', ?5, ?6)",
                        params![util::new_id(), id, ctx.uid, util::today(), p, now()],
                    )?;
                }
            }
        }
        "course_lesson" => {
            let parent: Option<String> = conn.query_row("SELECT parent_id FROM personal_records WHERE id = ?1", params![id], |r| r.get(0))?;
            if let Some(c) = parent {
                update_course_progress(conn, &c)?;
            }
        }
        _ => {}
    }
    Ok(())
}

/// Chamado após excluir/restaurar um registro filho, para recalcular o pai.
pub fn after_child_change(conn: &Connection, ctx: &Ctx, d: &EntityDef, id: &str) -> ApiResult<()> {
    let Some((pent, pcol)) = d.parent else { return Ok(()) };
    let pid: Option<String> = conn.query_row(&format!("SELECT {pcol} FROM {} WHERE id = ?1", d.table), params![id], |r| r.get(0))?;
    let Some(pid) = pid else { return Ok(()) };
    match pent {
        "projects" => update_project_progress(conn, ctx, &pid),
        "goals" => update_goal_progress(conn, ctx, &pid),
        "shopping_lists" => check_shopping_complete(conn, ctx, &pid),
        "course" => update_course_progress(conn, &pid),
        _ => {
            let _ = def(pent)?;
            Ok(())
        }
    }
}

pub fn update_project_progress(conn: &Connection, ctx: &Ctx, pid: &str) -> ApiResult<()> {
    let Some((rid, _)) = automation::enabled(conn, &ctx.uid, "project_progress")? else { return Ok(()) };
    let (st, sd): (f64, f64) = conn.query_row("SELECT COUNT(*), COALESCE(SUM(done),0) FROM project_steps WHERE project_id = ?1 AND deleted_at IS NULL", params![pid], |r| Ok((r.get(0)?, r.get(1)?)))?;
    let (tt, td): (f64, f64) = conn.query_row("SELECT COUNT(*), COALESCE(SUM(status = 'concluida'),0) FROM tasks WHERE project_id = ?1 AND deleted_at IS NULL", params![pid], |r| Ok((r.get(0)?, r.get(1)?)))?;
    let progress = if st + tt > 0.0 { ((sd + td) / (st + tt) * 1000.0).round() / 10.0 } else { 0.0 };
    let (old, title): (f64, String) = conn.query_row("SELECT progress, title FROM projects WHERE id = ?1", params![pid], |r| Ok((r.get(0)?, r.get(1)?)))?;
    if (old - progress).abs() > 0.001 {
        conn.execute("UPDATE projects SET progress = ?1 WHERE id = ?2", params![progress, pid])?;
        automation::log(conn, &rid, &ctx.uid, &format!("Progresso do projeto \"{title}\" atualizado para {progress}%."), Some("projects"), Some(pid))?;
    }
    Ok(())
}

pub fn update_goal_progress(conn: &Connection, ctx: &Ctx, gid: &str) -> ApiResult<()> {
    let Some((rid, _)) = automation::enabled(conn, &ctx.uid, "goal_progress")? else { return Ok(()) };
    let (target, current, old, title): (Option<f64>, f64, f64, String) = conn.query_row(
        "SELECT target_value, current_value, progress, title FROM goals WHERE id = ?1", params![gid],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?;
    let progress = match target {
        Some(t) if t > 0.0 => (current / t * 1000.0).round() / 10.0,
        _ => {
            let (mt, md): (f64, f64) = conn.query_row("SELECT COUNT(*), COALESCE(SUM(done),0) FROM goal_milestones WHERE goal_id = ?1 AND deleted_at IS NULL", params![gid], |r| Ok((r.get(0)?, r.get(1)?)))?;
            if mt > 0.0 { (md / mt * 1000.0).round() / 10.0 } else { old }
        }
    }
    .clamp(0.0, 100.0);
    if (old - progress).abs() > 0.001 {
        conn.execute("UPDATE goals SET progress = ?1 WHERE id = ?2", params![progress, gid])?;
        automation::log(conn, &rid, &ctx.uid, &format!("Progresso da meta \"{title}\" atualizado para {progress}%."), Some("goals"), Some(gid))?;
    }
    Ok(())
}

fn update_course_progress(conn: &Connection, cid: &str) -> ApiResult<()> {
    let (t, d): (f64, f64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(status = 'concluida'),0) FROM personal_records WHERE module = 'course_lesson' AND parent_id = ?1 AND deleted_at IS NULL",
        params![cid], |r| Ok((r.get(0)?, r.get(1)?)))?;
    if t > 0.0 {
        conn.execute("UPDATE personal_records SET progress = ?1 WHERE id = ?2", params![(d / t * 1000.0).round() / 10.0, cid])?;
    }
    Ok(())
}

pub fn check_shopping_complete(conn: &Connection, ctx: &Ctx, list_id: &str) -> ApiResult<()> {
    let Some((rid, _)) = automation::enabled(conn, &ctx.uid, "shopping_complete")? else { return Ok(()) };
    let (total, bought): (i64, i64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(bought),0) FROM shopping_items WHERE list_id = ?1 AND deleted_at IS NULL", params![list_id],
        |r| Ok((r.get(0)?, r.get(1)?)))?;
    let (status, title): (String, String) = conn.query_row("SELECT status, title FROM shopping_lists WHERE id = ?1", params![list_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    if total > 0 && total == bought && status != "concluida" {
        conn.execute("UPDATE shopping_lists SET status = 'concluida', completed_at = ?1 WHERE id = ?2", params![now(), list_id])?;
        automation::log(conn, &rid, &ctx.uid, &format!("Lista \"{title}\" concluída: todos os itens foram comprados."), Some("shopping_lists"), Some(list_id))?;
    } else if bought < total && status == "concluida" {
        conn.execute("UPDATE shopping_lists SET status = 'aberta', completed_at = NULL WHERE id = ?1", params![list_id])?;
    }
    Ok(())
}
