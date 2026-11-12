//! Campos calculados adicionados às listagens (contagens, progresso, nomes etc.).

use crate::core::Ctx;
use crate::entities::EntityDef;
use crate::error::ApiResult;
use crate::util;
use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

type Row = Map<String, Value>;

fn ids(rows: &[Row]) -> Vec<String> {
    rows.iter().filter_map(|r| r.get("id").and_then(|v| v.as_str()).map(String::from)).collect()
}

fn in_clause(n: usize) -> String {
    vec!["?"; n].join(",")
}

/// Executa uma consulta agregada que retorna (chave, valores...) e indexa pela chave.
fn grouped(conn: &Connection, sql: &str, keys: &[String]) -> ApiResult<HashMap<String, Vec<Value>>> {
    let mut out = HashMap::new();
    if keys.is_empty() {
        return Ok(out);
    }
    let sql = sql.replace("{IN}", &in_clause(keys.len()));
    let mut st = conn.prepare(&sql)?;
    let ncols = st.column_count();
    let p: Vec<SqlValue> = keys.iter().map(|k| SqlValue::Text(k.clone())).collect();
    let rows = st.query_map(params_from_iter(p.iter()), |r| {
        let k: String = r.get(0)?;
        let mut vals = Vec::new();
        for i in 1..ncols {
            let v = match r.get_ref(i)? {
                rusqlite::types::ValueRef::Null => Value::Null,
                rusqlite::types::ValueRef::Integer(n) => json!(n),
                rusqlite::types::ValueRef::Real(x) => json!(x),
                rusqlite::types::ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).to_string()),
                _ => Value::Null,
            };
            vals.push(v);
        }
        Ok((k, vals))
    })?;
    for r in rows {
        let (k, v) = r?;
        out.insert(k, v);
    }
    Ok(out)
}

fn num(v: Option<&Vec<Value>>, i: usize) -> f64 {
    v.and_then(|x| x.get(i)).and_then(|x| x.as_f64()).unwrap_or(0.0)
}

pub fn decorate(conn: &Connection, ctx: &Ctx, d: &EntityDef, rows: &mut [Row]) -> ApiResult<()> {
    if rows.is_empty() {
        return Ok(());
    }
    let keys = ids(rows);
    let today = util::today();

    // nomes de autor e responsável
    let mut users: HashMap<String, (String, Option<String>)> = HashMap::new();
    {
        let mut st = conn.prepare("SELECT id, full_name, color FROM users")?;
        let it = st.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, Option<String>>(2)?)))?;
        for u in it {
            let (id, n, c) = u?;
            users.insert(id, (n, c));
        }
    }
    // anexos
    let att = grouped(conn, &format!("SELECT record_id, COUNT(*) FROM attachments WHERE entity = '{}' AND record_id IN ({{IN}}) GROUP BY record_id", d.name), &keys)?;

    for r in rows.iter_mut() {
        let id = r["id"].as_str().unwrap_or_default().to_string();
        if let Some(o) = r.get("owner_id").and_then(|v| v.as_str()).and_then(|o| users.get(o)) {
            r.insert("owner_name".into(), json!(o.0));
            r.insert("owner_color".into(), json!(o.1));
        }
        if let Some(a) = r.get("assignee_id").and_then(|v| v.as_str()).and_then(|o| users.get(o)) {
            r.insert("assignee_name".into(), json!(a.0));
        }
        r.insert("attachments".into(), json!(num(att.get(&id), 0) as i64));
        r.remove("module");
        // não expõe a lista de restrição para quem não é dono/admin
        let owner = r.get("owner_id").and_then(|v| v.as_str()) == Some(ctx.uid.as_str());
        if !owner && !ctx.is_family_admin() {
            r.remove("restricted_to");
        }
    }

    match d.name {
        "tasks" => {
            let sub = grouped(conn, "SELECT task_id, COUNT(*), SUM(done) FROM subtasks WHERE deleted_at IS NULL AND task_id IN ({IN}) GROUP BY task_id", &keys)?;
            let pids: Vec<String> = rows.iter().filter_map(|r| r.get("project_id").and_then(|v| v.as_str()).map(String::from)).collect();
            let projs = grouped(conn, "SELECT id, title FROM projects WHERE id IN ({IN})", &pids)?;
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                r.insert("subtasks_total".into(), json!(num(sub.get(&id), 0) as i64));
                r.insert("subtasks_done".into(), json!(num(sub.get(&id), 1) as i64));
                let done = r.get("status").and_then(|v| v.as_str()) == Some("concluida");
                let due = r.get("due_date").and_then(|v| v.as_str()).map(|s| s[..s.len().min(10)].to_string());
                let late = !done && due.map(|d| d < today).unwrap_or(false);
                r.insert("is_late".into(), json!(late));
                if let Some(p) = r.get("project_id").and_then(|v| v.as_str()).and_then(|p| projs.get(p)) {
                    r.insert("project_title".into(), p[0].clone());
                }
            }
        }
        "projects" => {
            let steps = grouped(conn, "SELECT project_id, COUNT(*), SUM(done) FROM project_steps WHERE deleted_at IS NULL AND project_id IN ({IN}) GROUP BY project_id", &keys)?;
            let tasks = grouped(conn, "SELECT project_id, COUNT(*), SUM(status = 'concluida') FROM tasks WHERE deleted_at IS NULL AND project_id IN ({IN}) GROUP BY project_id", &keys)?;
            let time = grouped(conn, "SELECT ref_id, SUM(amount) FROM personal_records WHERE module = 'time_session' AND deleted_at IS NULL AND ref_id IN ({IN}) GROUP BY ref_id", &keys)?;
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                let (st, sd) = (num(steps.get(&id), 0), num(steps.get(&id), 1));
                let (tt, td) = (num(tasks.get(&id), 0), num(tasks.get(&id), 1));
                r.insert("steps_total".into(), json!(st as i64));
                r.insert("steps_done".into(), json!(sd as i64));
                r.insert("tasks_total".into(), json!(tt as i64));
                r.insert("tasks_done".into(), json!(td as i64));
                r.insert("minutes_spent".into(), json!(num(time.get(&id), 0)));
                let auto = if st + tt > 0.0 { ((sd + td) / (st + tt) * 1000.0).round() / 10.0 } else { 0.0 };
                r.insert("progress_auto".into(), json!(auto));
            }
        }
        "goals" => {
            let ms = grouped(conn, "SELECT goal_id, COUNT(*), SUM(done) FROM goal_milestones WHERE deleted_at IS NULL AND goal_id IN ({IN}) GROUP BY goal_id", &keys)?;
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                r.insert("milestones_total".into(), json!(num(ms.get(&id), 0) as i64));
                r.insert("milestones_done".into(), json!(num(ms.get(&id), 1) as i64));
            }
        }
        "shopping_lists" => {
            let it = grouped(conn, "SELECT list_id, COUNT(*), SUM(bought), SUM(COALESCE(est_price,0) * COALESCE(quantity,1)) FROM shopping_items WHERE deleted_at IS NULL AND list_id IN ({IN}) GROUP BY list_id", &keys)?;
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                r.insert("items_total".into(), json!(num(it.get(&id), 0) as i64));
                r.insert("items_bought".into(), json!(num(it.get(&id), 1) as i64));
                r.insert("est_total".into(), json!((num(it.get(&id), 2) * 100.0).round() / 100.0));
            }
        }
        "habits" => {
            let since = (util::now_naive().date() - chrono::Duration::days(90)).format("%Y-%m-%d").to_string();
            let mut logs: HashMap<String, Vec<String>> = HashMap::new();
            let sql = format!("SELECT habit_id, log_date FROM habit_logs WHERE log_date >= ? AND habit_id IN ({}) ORDER BY log_date", in_clause(keys.len()));
            let mut p: Vec<SqlValue> = vec![SqlValue::Text(since)];
            p.extend(keys.iter().map(|k| SqlValue::Text(k.clone())));
            let mut st = conn.prepare(&sql)?;
            let it = st.query_map(params_from_iter(p.iter()), |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
            for x in it {
                let (h, dt) = x?;
                logs.entry(h).or_default().push(dt);
            }
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                let l = logs.remove(&id).unwrap_or_default();
                let done_today = l.iter().any(|x| x == &today);
                // sequência de dias consecutivos até hoje (ou ontem)
                let mut streak = 0;
                let mut day = util::now_naive().date();
                if !done_today {
                    day -= chrono::Duration::days(1);
                }
                loop {
                    let ds = day.format("%Y-%m-%d").to_string();
                    if l.contains(&ds) {
                        streak += 1;
                        day -= chrono::Duration::days(1);
                    } else {
                        break;
                    }
                }
                let last30 = (util::now_naive().date() - chrono::Duration::days(29)).format("%Y-%m-%d").to_string();
                let c30 = l.iter().filter(|x| **x >= last30).count();
                r.insert("done_today".into(), json!(done_today));
                r.insert("streak".into(), json!(streak));
                r.insert("count_30".into(), json!(c30));
                r.insert("logs".into(), json!(l));
            }
        }
        "routine" => {
            let steps = grouped(conn, "SELECT parent_id, COUNT(*) FROM personal_records WHERE module = 'routine_step' AND deleted_at IS NULL AND parent_id IN ({IN}) GROUP BY parent_id", &keys)?;
            let done = grouped(conn, &format!("SELECT r.parent_id, COUNT(DISTINCT l.record_id) FROM record_logs l JOIN personal_records r ON r.id = l.record_id WHERE l.entity = 'routine_step' AND l.log_date = '{today}' AND r.deleted_at IS NULL AND r.parent_id IN ({{IN}}) GROUP BY r.parent_id"), &keys)?;
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                r.insert("steps_total".into(), json!(num(steps.get(&id), 0) as i64));
                r.insert("steps_done_today".into(), json!(num(done.get(&id), 0) as i64));
            }
        }
        "routine_step" => {
            let done = grouped(conn, &format!("SELECT record_id, COUNT(*) FROM record_logs WHERE entity = 'routine_step' AND log_date = '{today}' AND record_id IN ({{IN}}) GROUP BY record_id"), &keys)?;
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                r.insert("done_today".into(), json!(done.contains_key(&id)));
            }
        }
        "course" | "language" | "album" | "maintenance" | "conversation" | "family_event" | "study_subject" => {
            let (child, col_done) = match d.name {
                "course" => ("course_lesson", "SUM(status = 'concluida')"),
                "language" => ("vocab", "SUM(status = 'dominado')"),
                "album" => ("photo", "0"),
                "maintenance" => ("maintenance_log", "SUM(COALESCE(amount,0))"),
                "conversation" => ("message", "MAX(created_at)"),
                "family_event" => ("event_task", "SUM(status = 'concluido')"),
                _ => ("study_item", "SUM(status = 'concluido')"),
            };
            let (table, pcol) = if d.table == "family_records" { ("family_records", "parent_id") } else { ("personal_records", "parent_id") };
            let sql = if d.name == "study_subject" {
                "SELECT ref_id, COUNT(*), SUM(status = 'concluido') FROM personal_records WHERE module = 'study_item' AND deleted_at IS NULL AND ref_id IN ({IN}) GROUP BY ref_id".to_string()
            } else {
                format!("SELECT {pcol}, COUNT(*), {col_done} FROM {table} WHERE module = '{child}' AND deleted_at IS NULL AND {pcol} IN ({{IN}}) GROUP BY {pcol}")
            };
            let g = grouped(conn, &sql, &keys)?;
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                let v = g.get(&id);
                r.insert("children_total".into(), json!(num(v, 0) as i64));
                r.insert("children_extra".into(), v.and_then(|x| x.get(1)).cloned().unwrap_or(Value::Null));
            }
        }
        "poll" => {
            let sql = format!("SELECT record_id, user_id, value FROM record_logs WHERE entity = 'poll' AND kind = 'voto' AND record_id IN ({})", in_clause(keys.len()));
            let p: Vec<SqlValue> = keys.iter().map(|k| SqlValue::Text(k.clone())).collect();
            let mut st = conn.prepare(&sql)?;
            let it = st.query_map(params_from_iter(p.iter()), |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, f64>(2)?)))?;
            let mut tally: HashMap<String, (HashMap<i64, i64>, Vec<i64>, std::collections::HashSet<String>)> = HashMap::new();
            for x in it {
                let (rid, uid, val) = x?;
                let e = tally.entry(rid).or_default();
                *e.0.entry(val as i64).or_default() += 1;
                if uid == ctx.uid {
                    e.1.push(val as i64);
                }
                e.2.insert(uid);
            }
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                let t = tally.remove(&id).unwrap_or_default();
                let counts: Map<String, Value> = t.0.iter().map(|(k, v)| (k.to_string(), json!(v))).collect();
                r.insert("votes".into(), Value::Object(counts));
                r.insert("my_votes".into(), json!(t.1));
                r.insert("voters".into(), json!(t.2.len()));
                let closed = r.get("status").and_then(|v| v.as_str()) == Some("encerrada")
                    || r.get("date_end").and_then(|v| v.as_str()).map(|e| !e.is_empty() && e < util::now().as_str()).unwrap_or(false);
                r.insert("closed".into(), json!(closed));
            }
        }
        _ => {}
    }
    Ok(())
}
