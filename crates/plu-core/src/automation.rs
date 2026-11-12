//! Automações determinísticas configuradas pelo usuário (sem inteligência artificial).
//! Cada regra possui um tipo fixo, uma descrição do que faz e parâmetros editáveis.
//! Nenhuma regra executa ações destrutivas ou operações financeiras externas.

use crate::core::Ctx;
use crate::error::{ApiError, ApiResult};
use crate::util::{self, now};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

pub struct RuleType {
    pub key: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub default_params: &'static str,
    /// (parâmetro, rótulo, mínimo, máximo)
    pub param_spec: &'static [(&'static str, &'static str, i64, i64)],
}

pub const RULE_TYPES: &[RuleType] = &[
    RuleType { key: "task_overdue", name: "Marcar tarefas atrasadas",
        description: "Quando o prazo de uma tarefa passa sem conclusão, ela é marcada como atrasada e um aviso é criado.",
        default_params: "{}", param_spec: &[] },
    RuleType { key: "project_progress", name: "Atualizar progresso do projeto",
        description: "Ao concluir ou reabrir uma etapa ou tarefa vinculada, o progresso do projeto é recalculado automaticamente.",
        default_params: "{}", param_spec: &[] },
    RuleType { key: "goal_progress", name: "Atualizar progresso da meta",
        description: "Ao alterar o valor atual ou concluir marcos, o percentual da meta é recalculado automaticamente.",
        default_params: "{}", param_spec: &[] },
    RuleType { key: "date_reminder", name: "Lembretes por data",
        description: "Ao se aproximar a data de compromissos, tarefas, documentos e consultas, um lembrete é apresentado.",
        default_params: "{\"days_before\":1}", param_spec: &[("days_before", "Antecedência para documentos e consultas (dias)", 0, 60)] },
    RuleType { key: "shopping_complete", name: "Concluir lista de compras",
        description: "Ao marcar o último item como comprado, a lista é marcada como concluída e vai para o histórico.",
        default_params: "{}", param_spec: &[] },
    RuleType { key: "budget_alert", name: "Aviso de orçamento",
        description: "Ao atingir o percentual de alerta definido em um orçamento, um aviso é apresentado.",
        default_params: "{}", param_spec: &[] },
    RuleType { key: "bill_due", name: "Aviso de vencimento de contas",
        description: "Avisa sobre contas não pagas que vencem nos próximos dias.",
        default_params: "{\"days_before\":3}", param_spec: &[("days_before", "Antecedência (dias)", 0, 60)] },
    RuleType { key: "pantry_expiry", name: "Validade da despensa",
        description: "Avisa sobre produtos da despensa próximos do vencimento.",
        default_params: "{\"days_before\":5}", param_spec: &[("days_before", "Antecedência (dias)", 0, 60)] },
    RuleType { key: "habit_reminder", name: "Lembrete de hábitos",
        description: "No horário definido em cada hábito, lembra se ele ainda não foi registrado no dia.",
        default_params: "{}", param_spec: &[] },
    RuleType { key: "maintenance_due", name: "Aviso de manutenção",
        description: "Avisa sobre manutenções da casa previstas para os próximos dias.",
        default_params: "{\"days_before\":7}", param_spec: &[("days_before", "Antecedência (dias)", 0, 90)] },
    RuleType { key: "birthday_reminder", name: "Lembrete de aniversários",
        description: "Avisa sobre aniversários cadastrados que se aproximam.",
        default_params: "{\"days_before\":3}", param_spec: &[("days_before", "Antecedência (dias)", 0, 60)] },
];

pub fn seed_for_user(conn: &Connection, uid: &str) -> ApiResult<()> {
    for rt in RULE_TYPES {
        let exists: Option<String> = conn
            .query_row("SELECT id FROM automation_rules WHERE user_id = ?1 AND rule_type = ?2", params![uid, rt.key], |r| r.get(0))
            .optional()?;
        if exists.is_none() {
            let ts = now();
            conn.execute(
                "INSERT INTO automation_rules (id, user_id, rule_type, name, enabled, params, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?6)",
                params![util::new_id(), uid, rt.key, rt.name, rt.default_params, ts],
            )?;
        }
    }
    Ok(())
}

/// Retorna (id, parâmetros) se a regra estiver ativa para o usuário.
pub fn enabled(conn: &Connection, uid: &str, key: &str) -> ApiResult<Option<(String, Value)>> {
    let r: Option<(String, String)> = conn
        .query_row(
            "SELECT id, params FROM automation_rules WHERE user_id = ?1 AND rule_type = ?2 AND enabled = 1",
            params![uid, key],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    Ok(r.map(|(id, p)| (id, serde_json::from_str(&p).unwrap_or(json!({})))))
}

pub fn param_i64(p: &Value, key: &str, default: i64) -> i64 {
    p.get(key).and_then(|v| v.as_i64()).unwrap_or(default)
}

pub fn log(conn: &Connection, rule_id: &str, uid: &str, message: &str, entity: Option<&str>, record_id: Option<&str>) -> ApiResult<()> {
    conn.execute(
        "INSERT INTO automation_logs (id, rule_id, user_id, message, entity, record_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![util::new_id(), rule_id, uid, message, entity, record_id, now()],
    )?;
    conn.execute("UPDATE automation_rules SET last_run_at = ?1 WHERE id = ?2", params![now(), rule_id])?;
    Ok(())
}

pub fn list(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    seed_for_user(conn, &ctx.uid)?;
    let mut st = conn.prepare(
        "SELECT r.id, r.rule_type, r.name, r.enabled, r.params, r.last_run_at,
                (SELECT COUNT(*) FROM automation_logs l WHERE l.rule_id = r.id)
         FROM automation_rules r WHERE r.user_id = ?1 ORDER BY r.created_at",
    )?;
    let rows = st.query_map(params![ctx.uid], |r| {
        let key: String = r.get(1)?;
        let rt = RULE_TYPES.iter().find(|t| t.key == key);
        Ok(json!({
            "id": r.get::<_, String>(0)?,
            "rule_type": key,
            "name": r.get::<_, String>(2)?,
            "enabled": r.get::<_, i64>(3)? != 0,
            "params": serde_json::from_str::<Value>(&r.get::<_, String>(4)?).unwrap_or(json!({})),
            "last_run_at": r.get::<_, Option<String>>(5)?,
            "executions": r.get::<_, i64>(6)?,
            "description": rt.map(|t| t.description).unwrap_or(""),
            "param_spec": rt.map(|t| t.param_spec.iter().map(|(k, l, mn, mx)| json!({"key": k, "label": l, "min": mn, "max": mx})).collect::<Vec<_>>()).unwrap_or_default(),
        }))
    })?;
    let items: Vec<Value> = rows.collect::<Result<_, _>>()?;
    Ok(json!({ "items": items }))
}

pub fn update(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "id")?;
    let (rtype,): (String,) = conn
        .query_row("SELECT rule_type FROM automation_rules WHERE id = ?1 AND user_id = ?2", params![id, ctx.uid], |r| Ok((r.get(0)?,)))
        .optional()?
        .ok_or_else(|| ApiError::not_found("Regra não encontrada."))?;
    let rt = RULE_TYPES.iter().find(|t| t.key == rtype).ok_or_else(|| ApiError::internal("Tipo de regra desconhecido."))?;
    if let Some(en) = args.get("enabled").and_then(|v| v.as_bool()) {
        conn.execute("UPDATE automation_rules SET enabled = ?1, updated_at = ?2 WHERE id = ?3", params![en as i64, now(), id])?;
    }
    if let Some(p) = args.get("params").and_then(|v| v.as_object()) {
        let mut clean = serde_json::Map::new();
        for (k, label, mn, mx) in rt.param_spec {
            if let Some(v) = p.get(*k) {
                let n = v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                    .ok_or_else(|| ApiError::validation(k, format!("{label}: informe um número.")))?;
                if n < *mn || n > *mx {
                    return Err(ApiError::validation(k, format!("{label}: use um valor entre {mn} e {mx}.")));
                }
                clean.insert((*k).into(), json!(n));
            }
        }
        conn.execute("UPDATE automation_rules SET params = ?1, updated_at = ?2 WHERE id = ?3", params![Value::Object(clean).to_string(), now(), id])?;
    }
    list(conn, ctx)
}

pub fn logs(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    let mut st = conn.prepare(
        "SELECT l.message, l.created_at, r.name, l.entity, l.record_id FROM automation_logs l
         JOIN automation_rules r ON r.id = l.rule_id WHERE l.user_id = ?1 ORDER BY l.created_at DESC LIMIT 200",
    )?;
    let rows = st.query_map(params![ctx.uid], |r| {
        Ok(json!({"message": r.get::<_, String>(0)?, "created_at": r.get::<_, String>(1)?, "rule": r.get::<_, String>(2)?,
                  "entity": r.get::<_, Option<String>>(3)?, "record_id": r.get::<_, Option<String>>(4)?}))
    })?;
    let items: Vec<Value> = rows.collect::<Result<_, _>>()?;
    Ok(json!({ "items": items }))
}

/// Regra "Marcar tarefas atrasadas": executada periodicamente.
pub fn run_task_overdue(conn: &Connection, ctx: &Ctx) -> ApiResult<usize> {
    let Some((rid, _)) = enabled(conn, &ctx.uid, "task_overdue")? else { return Ok(0) };
    let today = util::today();
    let mut st = conn.prepare(
        "SELECT id, title, family_id, scope FROM tasks WHERE deleted_at IS NULL AND status != 'concluida' AND overdue = 0
         AND due_date IS NOT NULL AND substr(due_date, 1, 10) < ?1
         AND ((scope = 'personal' AND owner_id = ?2) OR (scope = 'family' AND (assignee_id = ?2 OR (assignee_id IS NULL AND owner_id = ?2))))",
    )?;
    let rows: Vec<(String, String, Option<String>, String)> =
        st.query_map(params![today, ctx.uid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?.collect::<Result<_, _>>()?;
    for (id, title, _, _) in &rows {
        conn.execute("UPDATE tasks SET overdue = 1 WHERE id = ?1", params![id])?;
        log(conn, &rid, &ctx.uid, &format!("Tarefa \"{title}\" marcada como atrasada."), Some("tasks"), Some(id))?;
        crate::notify::push(conn, &ctx.uid, "atraso", "Tarefa atrasada", &format!("\"{title}\" passou do prazo."), Some("tasks"), Some(id), None, &format!("overdue:{id}"))?;
    }
    Ok(rows.len())
}

/// Regra "Aviso de orçamento": verifica os orçamentos do mês após um lançamento de despesa.
pub fn check_budgets(conn: &Connection, ctx: &Ctx, scope: &str, family_id: Option<&str>, category: Option<&str>, date: &str) -> ApiResult<()> {
    let Some((rid, _)) = enabled(conn, &ctx.uid, "budget_alert")? else { return Ok(()) };
    let Some(cat) = category else { return Ok(()) };
    let month = &date[..date.len().min(7)];
    let owner_clause = if scope == "personal" { "scope = 'personal' AND owner_id = ?1" } else { "scope = 'family' AND family_id = ?1" };
    let key = if scope == "personal" { ctx.uid.clone() } else { family_id.unwrap_or_default().to_string() };
    let budget: Option<(String, f64, i64)> = conn
        .query_row(
            &format!("SELECT id, amount_limit, alert_percent FROM budgets WHERE {owner_clause} AND deleted_at IS NULL AND category = ?2
                      AND (month IS NULL OR month = ?3) ORDER BY month IS NULL LIMIT 1"),
            params![key, cat, month],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let Some((bid, limit, pct)) = budget else { return Ok(()) };
    if limit <= 0.0 {
        return Ok(());
    }
    let spent: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE {owner_clause} AND deleted_at IS NULL AND kind = 'despesa'
                  AND category = ?2 AND substr(date, 1, 7) = ?3"),
        params![key, cat, month],
        |r| r.get(0),
    )?;
    let used = spent / limit * 100.0;
    if used >= pct as f64 {
        let level = if used >= 100.0 { "100" } else { "alerta" };
        let msg = format!("Orçamento de \"{cat}\" em {month}: {:.0}% utilizado ({:.2} de {:.2}).", used, spent, limit);
        let created = crate::notify::push(conn, &ctx.uid, "orcamento", "Limite de orçamento", &msg, Some("budgets"), Some(&bid), None,
            &format!("budget:{bid}:{month}:{level}"))?;
        if created {
            log(conn, &rid, &ctx.uid, &msg, Some("budgets"), Some(&bid))?;
        }
    }
    Ok(())
}
