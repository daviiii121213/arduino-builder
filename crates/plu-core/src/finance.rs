//! Resumos financeiros (organizador de registros, sem recomendações).

use crate::core::Ctx;
use crate::entities::{def, scope_filter};
use crate::error::ApiResult;
use crate::util;
use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection};
use serde_json::{json, Value};

pub fn summary(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let scope = args.get("scope").and_then(|v| v.as_str()).unwrap_or("personal");
    let month = args.get("month").and_then(|v| v.as_str()).map(String::from).unwrap_or_else(|| util::today()[..7].to_string());
    let d = def("transactions")?;
    let mut p: Vec<SqlValue> = Vec::new();
    let filt = scope_filter(ctx, d, scope, "t", &mut p)?;
    let base = format!("FROM transactions t WHERE {filt} AND t.deleted_at IS NULL");

    let mut pm = p.clone();
    pm.push(SqlValue::Text(month.clone()));
    let (inc, exp): (f64, f64) = conn.query_row(
        &format!("SELECT COALESCE(SUM(CASE WHEN kind='receita' THEN amount END),0), COALESCE(SUM(CASE WHEN kind='despesa' THEN amount END),0) {base} AND substr(t.date,1,7) = ?"),
        params_from_iter(pm.iter()), |r| Ok((r.get(0)?, r.get(1)?)))?;

    let mut st = conn.prepare(&format!("SELECT COALESCE(t.category,'Sem categoria'), SUM(t.amount) {base} AND t.kind = 'despesa' AND substr(t.date,1,7) = ? GROUP BY 1 ORDER BY 2 DESC"))?;
    let by_cat: Vec<Value> = st.query_map(params_from_iter(pm.iter()), |r| Ok(json!({"category": r.get::<_, String>(0)?, "amount": r.get::<_, f64>(1)?})))?.collect::<Result<_, _>>()?;

    // últimos 6 meses
    let first = util::parse_date(&format!("{month}-01")).unwrap_or_else(|| util::now_naive().date());
    let start = util::add_months(first, -5).format("%Y-%m").to_string();
    let mut p6 = p.clone();
    p6.push(SqlValue::Text(start));
    p6.push(SqlValue::Text(month.clone()));
    let mut st = conn.prepare(&format!("SELECT substr(t.date,1,7), COALESCE(SUM(CASE WHEN kind='receita' THEN amount END),0), COALESCE(SUM(CASE WHEN kind='despesa' THEN amount END),0) {base} AND substr(t.date,1,7) >= ? AND substr(t.date,1,7) <= ? GROUP BY 1 ORDER BY 1"))?;
    let months: Vec<Value> = st.query_map(params_from_iter(p6.iter()), |r| Ok(json!({"month": r.get::<_, String>(0)?, "income": r.get::<_, f64>(1)?, "expense": r.get::<_, f64>(2)?})))?.collect::<Result<_, _>>()?;

    // orçamentos do mês com uso
    let bd = def("budgets")?;
    let mut pb: Vec<SqlValue> = Vec::new();
    let bf = scope_filter(ctx, bd, scope, "b", &mut pb)?;
    pb.push(SqlValue::Text(month.clone()));
    let mut st = conn.prepare(&format!("SELECT b.id, b.category, b.amount_limit, b.alert_percent, b.month FROM budgets b WHERE {bf} AND b.deleted_at IS NULL AND (b.month IS NULL OR b.month = ?) ORDER BY b.category"))?;
    let budgets_raw: Vec<(String, String, f64, i64, Option<String>)> = st.query_map(params_from_iter(pb.iter()), |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))?.collect::<Result<_, _>>()?;
    let mut budgets = Vec::new();
    for (id, cat, limit, alert, m) in budgets_raw {
        let spent = by_cat.iter().find(|c| c["category"].as_str() == Some(cat.as_str())).and_then(|c| c["amount"].as_f64()).unwrap_or(0.0);
        let pct = if limit > 0.0 { spent / limit * 100.0 } else { 0.0 };
        budgets.push(json!({"id": id, "category": cat, "limit": limit, "spent": spent, "percent": (pct * 10.0).round() / 10.0, "alert_percent": alert, "month": m,
            "status": if pct >= 100.0 { "excedido" } else if pct >= alert as f64 { "alerta" } else { "ok" }}));
    }
    // contas pendentes do mês
    let bl = def("bills")?;
    let mut pbl: Vec<SqlValue> = Vec::new();
    let blf = scope_filter(ctx, bl, scope, "t", &mut pbl)?;
    pbl.push(SqlValue::Text(month.clone()));
    let (bills_open, bills_amount): (i64, f64) = conn.query_row(
        &format!("SELECT COUNT(*), COALESCE(SUM(amount),0) FROM bills t WHERE {blf} AND t.deleted_at IS NULL AND t.paid = 0 AND substr(t.due_date,1,7) <= ?"),
        params_from_iter(pbl.iter()), |r| Ok((r.get(0)?, r.get(1)?)))?;
    let r2 = |x: f64| (x * 100.0).round() / 100.0;
    Ok(json!({
        "month": month, "income": r2(inc), "expense": r2(exp), "balance": r2(inc - exp),
        "by_category": by_cat, "months": months, "budgets": budgets,
        "bills_open": bills_open, "bills_open_amount": r2(bills_amount),
    }))
}
