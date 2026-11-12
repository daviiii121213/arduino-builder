//! Relatórios com filtros por período e seleção de colunas; exportação em PDF, CSV e XLSX.

use crate::core::Ctx;
use crate::entities::{def, query_rows, scope_filter};
use crate::error::{ApiError, ApiResult};
use crate::util;
use rusqlite::types::Value as SqlValue;
use rusqlite::{params, Connection};
use serde_json::{json, Map, Value};

#[derive(Clone, Copy, PartialEq)]
enum Ty {
    Text,
    Date,
    DateTime,
    Money,
    Number,
    Bool,
    Percent,
}

struct Col {
    key: &'static str,
    label: &'static str,
    ty: Ty,
}
const fn c(key: &'static str, label: &'static str, ty: Ty) -> Col {
    Col { key, label, ty }
}

struct ReportDef {
    key: &'static str,
    title: &'static str,
    scopes: &'static [&'static str],
    cols: &'static [Col],
}

const REPORTS: &[ReportDef] = &[
    ReportDef { key: "tarefas_concluidas", title: "Tarefas concluídas", scopes: &["personal", "family"], cols: &[
        c("title", "Tarefa", Ty::Text), c("category", "Categoria", Ty::Text), c("priority_label", "Prioridade", Ty::Text), c("due_date", "Prazo", Ty::Date),
        c("completed_at", "Concluída em", Ty::DateTime), c("assignee_name", "Responsável", Ty::Text), c("project_title", "Projeto", Ty::Text)] },
    ReportDef { key: "tarefas_pendentes", title: "Tarefas pendentes", scopes: &["personal", "family"], cols: &[
        c("title", "Tarefa", Ty::Text), c("status_label", "Situação", Ty::Text), c("priority_label", "Prioridade", Ty::Text), c("due_date", "Prazo", Ty::Date),
        c("is_late", "Atrasada", Ty::Bool), c("category", "Categoria", Ty::Text), c("assignee_name", "Responsável", Ty::Text)] },
    ReportDef { key: "projetos", title: "Projetos", scopes: &["personal"], cols: &[
        c("title", "Projeto", Ty::Text), c("status", "Situação", Ty::Text), c("start_date", "Início", Ty::Date), c("due_date", "Prazo", Ty::Date),
        c("progress_auto", "Progresso", Ty::Percent), c("steps", "Etapas", Ty::Text), c("tasks", "Tarefas", Ty::Text), c("hours", "Horas registradas", Ty::Number)] },
    ReportDef { key: "metas", title: "Metas", scopes: &["personal", "family"], cols: &[
        c("title", "Meta", Ty::Text), c("status", "Situação", Ty::Text), c("category", "Categoria", Ty::Text), c("due_date", "Prazo", Ty::Date),
        c("indicator", "Indicador", Ty::Text), c("current_value", "Atual", Ty::Number), c("target_value", "Alvo", Ty::Number), c("progress", "Progresso", Ty::Percent)] },
    ReportDef { key: "habitos", title: "Hábitos", scopes: &["personal"], cols: &[
        c("title", "Hábito", Ty::Text), c("frequency", "Frequência", Ty::Text), c("period_count", "Registros no período", Ty::Number),
        c("streak", "Sequência atual (dias)", Ty::Number), c("count_30", "Últimos 30 dias", Ty::Number)] },
    ReportDef { key: "financas", title: "Finanças", scopes: &["personal", "family"], cols: &[
        c("date", "Data", Ty::Date), c("kind", "Tipo", Ty::Text), c("title", "Descrição", Ty::Text), c("category", "Categoria", Ty::Text),
        c("account", "Conta/carteira", Ty::Text), c("payment_method", "Forma de pagamento", Ty::Text), c("amount", "Valor", Ty::Money), c("owner_name", "Registrado por", Ty::Text)] },
    ReportDef { key: "contas", title: "Contas", scopes: &["personal", "family"], cols: &[
        c("title", "Conta", Ty::Text), c("due_date", "Vencimento", Ty::Date), c("amount", "Valor", Ty::Money), c("paid", "Paga", Ty::Bool),
        c("paid_at", "Paga em", Ty::DateTime), c("category", "Categoria", Ty::Text), c("assignee_name", "Responsável", Ty::Text)] },
    ReportDef { key: "compras", title: "Compras", scopes: &["personal", "family"], cols: &[
        c("title", "Lista", Ty::Text), c("status", "Situação", Ty::Text), c("store", "Local", Ty::Text), c("items", "Itens comprados", Ty::Text),
        c("est_total", "Total estimado", Ty::Money), c("created_at", "Criada em", Ty::DateTime), c("completed_at", "Concluída em", Ty::DateTime)] },
    ReportDef { key: "estudos", title: "Estudos", scopes: &["personal"], cols: &[
        c("subject", "Matéria", Ty::Text), c("title", "Item", Ty::Text), c("category", "Tipo", Ty::Text), c("status", "Situação", Ty::Text),
        c("date_start", "Data", Ty::Date), c("amount", "Nota", Ty::Number)] },
    ReportDef { key: "atividades", title: "Atividades", scopes: &["personal", "family"], cols: &[
        c("created_at", "Data e hora", Ty::DateTime), c("user_name", "Perfil", Ty::Text), c("action", "Ação", Ty::Text), c("label", "Módulo", Ty::Text)] },
];

pub fn catalog() -> Value {
    json!({ "reports": REPORTS.iter().map(|r| json!({
        "key": r.key, "title": r.title, "scopes": r.scopes,
        "columns": r.cols.iter().map(|c| json!({"key": c.key, "label": c.label})).collect::<Vec<_>>()
    })).collect::<Vec<_>>() })
}

fn fetch(conn: &Connection, ctx: &Ctx, entity: &str, scope: &str, extra: &str, extra_p: Vec<SqlValue>) -> ApiResult<Vec<Map<String, Value>>> {
    let d = def(entity)?;
    let mut p: Vec<SqlValue> = Vec::new();
    let filt = scope_filter(ctx, d, scope, "t", &mut p)?;
    p.extend(extra_p);
    let mut rows = query_rows(conn, d, &format!("SELECT t.* FROM {} t WHERE {filt} AND t.deleted_at IS NULL {extra} LIMIT 20000", d.table), &p)?;
    crate::decorate::decorate(conn, ctx, d, &mut rows)?;
    Ok(rows)
}

fn prio(v: &Value) -> &'static str {
    match v.as_i64() { Some(0) => "Baixa", Some(2) => "Alta", Some(3) => "Urgente", _ => "Normal" }
}

fn status_label(s: &str) -> String {
    match s { "pendente" => "Pendente", "em_andamento" => "Em andamento", "concluida" => "Concluída", other => other }.to_string()
}

struct Built {
    title: String,
    rows: Vec<Map<String, Value>>,
    summary: Vec<(String, String)>,
    cols: Vec<&'static Col>,
    period: String,
}

fn money(v: f64) -> String {
    let neg = v < 0.0;
    let cents = (v.abs() * 100.0).round() as i64;
    let int = (cents / 100).to_string();
    let mut grouped = String::new();
    for (i, ch) in int.chars().enumerate() {
        if i > 0 && (int.len() - i) % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    format!("{}R$ {},{:02}", if neg { "-" } else { "" }, grouped, cents % 100)
}

fn fmt_date(s: &str) -> String {
    match util::parse_datetime(s) {
        Some(d) if s.len() > 10 => d.format("%d/%m/%Y %H:%M").to_string(),
        Some(d) => d.format("%d/%m/%Y").to_string(),
        None => s.to_string(),
    }
}

fn build(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Built> {
    let key = util::arg_str(args, "report")?;
    let r = REPORTS.iter().find(|r| r.key == key).ok_or_else(|| ApiError::bad_request("Relatório desconhecido."))?;
    let scope = args.get("scope").and_then(|v| v.as_str()).unwrap_or("personal");
    if !r.scopes.contains(&scope) {
        return Err(ApiError::bad_request("Este relatório não está disponível neste ambiente."));
    }
    if scope == "family" {
        ctx.require("reports.view")?;
    }
    let from = util::arg_opt_str(args, "from").map(String::from);
    let to = util::arg_opt_str(args, "to").map(String::from);
    for (k, v) in [("from", &from), ("to", &to)] {
        if let Some(x) = v {
            if util::parse_date(x).is_none() {
                return Err(ApiError::validation(k, "Data inválida."));
            }
        }
    }
    let range = |col: &str, p: &mut Vec<SqlValue>| -> String {
        let mut s = String::new();
        if let Some(f) = &from {
            s.push_str(&format!(" AND substr(t.{col},1,10) >= ?"));
            p.push(SqlValue::Text(f.clone()));
        }
        if let Some(t) = &to {
            s.push_str(&format!(" AND substr(t.{col},1,10) <= ?"));
            p.push(SqlValue::Text(t.clone()));
        }
        s
    };
    let mut summary: Vec<(String, String)> = Vec::new();
    let mut p = Vec::new();
    let rows: Vec<Map<String, Value>> = match key {
        "tarefas_concluidas" | "tarefas_pendentes" => {
            let done = key == "tarefas_concluidas";
            let extra = format!("AND t.status {} 'concluida' {}", if done { "=" } else { "!=" }, range(if done { "completed_at" } else { "due_date" }, &mut p));
            let mut rows = fetch(conn, ctx, "tasks", scope, &format!("{extra} ORDER BY {}", if done { "t.completed_at DESC" } else { "t.due_date IS NULL, t.due_date" }), p)?;
            for r in rows.iter_mut() {
                let pl = prio(&r["priority"]);
                r.insert("priority_label".into(), json!(pl));
                let sl = status_label(r["status"].as_str().unwrap_or(""));
                r.insert("status_label".into(), json!(sl));
            }
            summary.push(("Total:".into(), rows.len().to_string()));
            if !done {
                summary.push(("Atrasadas:".into(), rows.iter().filter(|r| r["is_late"].as_bool() == Some(true)).count().to_string()));
            }
            rows
        }
        "projetos" => {
            let extra = range("due_date", &mut p);
            let mut rows = fetch(conn, ctx, "projects", scope, &format!("{extra} ORDER BY t.title"), p)?;
            for r in rows.iter_mut() {
                let s = format!("{}/{}", r["steps_done"], r["steps_total"]);
                let tk = format!("{}/{}", r["tasks_done"], r["tasks_total"]);
                let h = (r["minutes_spent"].as_f64().unwrap_or(0.0) / 60.0 * 10.0).round() / 10.0;
                r.insert("steps".into(), json!(s));
                r.insert("tasks".into(), json!(tk));
                r.insert("hours".into(), json!(h));
            }
            summary.push(("Projetos:".into(), rows.len().to_string()));
            rows
        }
        "metas" => {
            let extra = range("due_date", &mut p);
            let rows = fetch(conn, ctx, "goals", scope, &format!("{extra} ORDER BY t.due_date"), p)?;
            summary.push(("Metas:".into(), rows.len().to_string()));
            summary.push(("Concluídas:".into(), rows.iter().filter(|r| r["status"] == "concluida").count().to_string()));
            rows
        }
        "habitos" => {
            let mut rows = fetch(conn, ctx, "habits", scope, "ORDER BY t.title", vec![])?;
            for r in rows.iter_mut() {
                let id = r["id"].as_str().unwrap_or_default().to_string();
                let f = from.clone().unwrap_or_else(|| "0000-01-01".into());
                let t = to.clone().unwrap_or_else(|| "9999-12-31".into());
                let n: i64 = conn.query_row("SELECT COUNT(*) FROM habit_logs WHERE habit_id = ?1 AND log_date >= ?2 AND log_date <= ?3", params![id, f, t], |x| x.get(0))?;
                r.insert("period_count".into(), json!(n));
            }
            rows
        }
        "financas" => {
            let extra = range("date", &mut p);
            let rows = fetch(conn, ctx, "transactions", scope, &format!("{extra} ORDER BY t.date"), p)?;
            let inc: f64 = rows.iter().filter(|r| r["kind"] == "receita").map(|r| r["amount"].as_f64().unwrap_or(0.0)).sum();
            let exp: f64 = rows.iter().filter(|r| r["kind"] == "despesa").map(|r| r["amount"].as_f64().unwrap_or(0.0)).sum();
            summary.push(("Receitas:".into(), money(inc)));
            summary.push(("Despesas:".into(), money(exp)));
            summary.push(("Saldo:".into(), money(inc - exp)));
            rows
        }
        "contas" => {
            let extra = range("due_date", &mut p);
            let rows = fetch(conn, ctx, "bills", scope, &format!("{extra} ORDER BY t.due_date"), p)?;
            let total: f64 = rows.iter().map(|r| r["amount"].as_f64().unwrap_or(0.0)).sum();
            let open: f64 = rows.iter().filter(|r| r["paid"].as_bool() != Some(true)).map(|r| r["amount"].as_f64().unwrap_or(0.0)).sum();
            summary.push(("Total no período:".into(), money(total)));
            summary.push(("Em aberto:".into(), money(open)));
            rows
        }
        "compras" => {
            let extra = range("created_at", &mut p);
            let mut rows = fetch(conn, ctx, "shopping_lists", scope, &format!("{extra} ORDER BY t.created_at DESC"), p)?;
            for r in rows.iter_mut() {
                let s = format!("{}/{}", r["items_bought"], r["items_total"]);
                r.insert("items".into(), json!(s));
            }
            let total: f64 = rows.iter().map(|r| r["est_total"].as_f64().unwrap_or(0.0)).sum();
            summary.push(("Total estimado:".into(), money(total)));
            rows
        }
        "estudos" => {
            let extra = range("date_start", &mut p);
            let subjects = fetch(conn, ctx, "study_subject", scope, "", vec![])?;
            let mut rows = fetch(conn, ctx, "study_item", scope, &format!("{extra} ORDER BY t.date_start"), p)?;
            for r in rows.iter_mut() {
                let name = subjects.iter().find(|s| s["id"] == r["ref_id"]).and_then(|s| s["title"].as_str()).unwrap_or("—").to_string();
                r.insert("subject".into(), json!(name));
            }
            let mut p2 = Vec::new();
            let extra2 = range("date_start", &mut p2);
            let sessions = fetch(conn, ctx, "study_session", scope, &extra2, p2)?;
            let mins: f64 = sessions.iter().map(|s| s["amount"].as_f64().unwrap_or(0.0)).sum();
            summary.push(("Itens:".into(), rows.len().to_string()));
            summary.push(("Tempo de estudo registrado:".into(), format!("{:.1} h", mins / 60.0)));
            rows
        }
        "atividades" => {
            let (cond, keyv) = if scope == "family" { ("a.family_id = ?", ctx.family_id().unwrap_or_default().to_string()) } else { ("a.user_id = ?", ctx.uid.clone()) };
            let mut sql = format!("SELECT a.created_at, COALESCE(u.full_name,'—'), a.action, a.entity FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE {cond}");
            let mut pp = vec![SqlValue::Text(keyv)];
            if let Some(f) = &from { sql.push_str(" AND substr(a.created_at,1,10) >= ?"); pp.push(SqlValue::Text(f.clone())); }
            if let Some(t) = &to { sql.push_str(" AND substr(a.created_at,1,10) <= ?"); pp.push(SqlValue::Text(t.clone())); }
            sql.push_str(" ORDER BY a.created_at DESC LIMIT 5000");
            let mut st = conn.prepare(&sql)?;
            let rows: Vec<(String, String, String, Option<String>)> = st.query_map(rusqlite::params_from_iter(pp.iter()), |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?.collect::<Result<_, _>>()?;
            let rows: Vec<Map<String, Value>> = rows.into_iter().filter_map(|(at, u, a, e)| {
                let d = e.as_deref().and_then(|x| def(x).ok());
                if scope == "family" {
                    if let Some(d) = d { if d.area != "personal" && !ctx.can(&format!("{}.view", d.area)) { return None; } }
                }
                let mut m = Map::new();
                m.insert("created_at".into(), json!(at));
                m.insert("user_name".into(), json!(u));
                m.insert("action".into(), json!(a.replace('_', " ")));
                m.insert("label".into(), json!(d.map(|d| d.label).unwrap_or(e.as_deref().unwrap_or("—"))));
                Some(m)
            }).collect();
            summary.push(("Registros:".into(), rows.len().to_string()));
            rows
        }
        _ => unreachable!(),
    };
    let selected: Vec<String> = args.get("columns").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
    let cols: Vec<&Col> = r.cols.iter().filter(|c| selected.is_empty() || selected.iter().any(|s| s == c.key)).collect();
    if cols.is_empty() {
        return Err(ApiError::validation("columns", "Selecione ao menos uma coluna."));
    }
    let period = match (&from, &to) {
        (Some(f), Some(t)) => format!("Período: {} a {}", fmt_date(f), fmt_date(t)),
        (Some(f), None) => format!("A partir de {}", fmt_date(f)),
        (None, Some(t)) => format!("Até {}", fmt_date(t)),
        _ => "Período: todos os registros".into(),
    };
    let ws = if scope == "family" { "FAMÍLIA" } else { "PESSOAL" };
    Ok(Built { title: format!("{} — {ws}", r.title), rows, summary, cols, period })
}

fn cell_text(v: &Value, ty: Ty) -> String {
    match (ty, v) {
        (_, Value::Null) => String::new(),
        (Ty::Money, v) => money(v.as_f64().unwrap_or(0.0)),
        (Ty::Percent, v) => format!("{:.0}%", v.as_f64().unwrap_or(0.0)),
        (Ty::Bool, v) => if v.as_bool().unwrap_or(v.as_i64() == Some(1)) { "Sim".into() } else { "Não".into() },
        (Ty::Date | Ty::DateTime, Value::String(s)) => fmt_date(s),
        (Ty::Number, v) => v.as_f64().map(|n| if n.fract() == 0.0 { format!("{n:.0}") } else { format!("{n:.2}").replace('.', ",") }).unwrap_or_default(),
        (_, Value::String(s)) => s.clone(),
        (_, v) => v.to_string(),
    }
}

pub fn preview(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let b = build(conn, ctx, args)?;
    let total = b.rows.len();
    let rows: Vec<Vec<String>> = b.rows.iter().take(200).map(|r| b.cols.iter().map(|c| cell_text(r.get(c.key).unwrap_or(&Value::Null), c.ty)).collect()).collect();
    Ok(json!({
        "title": b.title, "period": b.period, "summary": b.summary,
        "columns": b.cols.iter().map(|c| json!({"key": c.key, "label": c.label, "numeric": matches!(c.ty, Ty::Money | Ty::Number | Ty::Percent)})).collect::<Vec<_>>(),
        "rows": rows, "total": total,
    }))
}

pub fn export(conn: &Connection, ctx: &Ctx, args: &Value, default_dir: &std::path::Path) -> ApiResult<Value> {
    let b = build(conn, ctx, args)?;
    let format = util::arg_str(args, "format")?;
    let path = match util::arg_opt_str(args, "path") {
        Some(p) => std::path::PathBuf::from(p),
        None => {
            std::fs::create_dir_all(default_dir)?;
            let stamp = util::now().replace([':', 'T'], "-");
            default_dir.join(format!("{}-{}.{}", util::arg_str(args, "report")?, stamp, format))
        }
    };
    let generated = format!("{} · gerado em {}", b.period, fmt_date(&util::now()));
    let bytes: Vec<u8> = match format {
        "csv" => {
            let mut s = String::from("\u{feff}");
            let esc = |x: &str| if x.contains([';', '"', '\n']) { format!("\"{}\"", x.replace('"', "\"\"")) } else { x.to_string() };
            s.push_str(&b.cols.iter().map(|c| esc(c.label)).collect::<Vec<_>>().join(";"));
            s.push_str("\r\n");
            for r in &b.rows {
                let line: Vec<String> = b.cols.iter().map(|c| {
                    let v = r.get(c.key).unwrap_or(&Value::Null);
                    let t = match c.ty {
                        Ty::Money | Ty::Number | Ty::Percent => v.as_f64().map(|n| format!("{n:.2}").replace('.', ",")).unwrap_or_default(),
                        _ => cell_text(v, c.ty),
                    };
                    esc(&t)
                }).collect();
                s.push_str(&line.join(";"));
                s.push_str("\r\n");
            }
            s.into_bytes()
        }
        "pdf" => {
            let rows: Vec<Vec<String>> = b.rows.iter().map(|r| b.cols.iter().map(|c| cell_text(r.get(c.key).unwrap_or(&Value::Null), c.ty)).collect()).collect();
            crate::pdf::render(&b.title, &generated, &b.summary, &crate::pdf::PdfTable {
                headers: b.cols.iter().map(|c| c.label.to_string()).collect(),
                rows,
                right: b.cols.iter().map(|c| matches!(c.ty, Ty::Money | Ty::Number | Ty::Percent)).collect(),
            })
        }
        "xlsx" => xlsx(&b, &generated)?,
        _ => return Err(ApiError::validation("format", "Formato inválido. Use PDF, CSV ou XLSX.")),
    };
    std::fs::write(&path, bytes).map_err(|e| ApiError::internal(format!("Não foi possível salvar o arquivo: {e}")))?;
    crate::core::audit(conn, Some(&ctx.uid), None, "exportar_relatorio", None, None, Some(json!({"relatorio": util::arg_str(args, "report")?, "formato": format})));
    Ok(json!({ "ok": true, "path": path.to_string_lossy(), "rows": b.rows.len() }))
}

fn xlsx(b: &Built, generated: &str) -> ApiResult<Vec<u8>> {
    use rust_xlsxwriter::{Format, Workbook};
    let err = |e: rust_xlsxwriter::XlsxError| ApiError::internal(format!("Falha ao gerar XLSX: {e}"));
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();
    ws.set_name("Relatório").map_err(err)?;
    let bold = Format::new().set_bold();
    let title = Format::new().set_bold().set_font_size(14);
    let head = Format::new().set_bold().set_background_color(rust_xlsxwriter::Color::RGB(0xE5E7EB));
    let money = Format::new().set_num_format("\"R$\" #,##0.00");
    let pct = Format::new().set_num_format("0\"%\"");
    let date = Format::new().set_num_format("dd/mm/yyyy");
    let datetime = Format::new().set_num_format("dd/mm/yyyy hh:mm");
    ws.write_string_with_format(0, 0, &b.title, &title).map_err(err)?;
    ws.write_string(1, 0, generated).map_err(err)?;
    let mut row = 3u32;
    for (k, v) in &b.summary {
        ws.write_string_with_format(row, 0, k, &bold).map_err(err)?;
        ws.write_string(row, 1, v).map_err(err)?;
        row += 1;
    }
    row += 1;
    for (i, c) in b.cols.iter().enumerate() {
        ws.write_string_with_format(row, i as u16, c.label, &head).map_err(err)?;
        ws.set_column_width(i as u16, 18).map_err(err)?;
    }
    row += 1;
    for r in &b.rows {
        for (i, c) in b.cols.iter().enumerate() {
            let col = i as u16;
            let v = r.get(c.key).unwrap_or(&Value::Null);
            if v.is_null() {
                continue;
            }
            match c.ty {
                Ty::Money => { ws.write_number_with_format(row, col, v.as_f64().unwrap_or(0.0), &money).map_err(err)?; }
                Ty::Percent => { ws.write_number_with_format(row, col, v.as_f64().unwrap_or(0.0), &pct).map_err(err)?; }
                Ty::Number => { ws.write_number(row, col, v.as_f64().unwrap_or(0.0)).map_err(err)?; }
                Ty::Date | Ty::DateTime => {
                    let s = v.as_str().unwrap_or("");
                    match util::parse_datetime(s).and_then(|d| rust_xlsxwriter::ExcelDateTime::parse_from_str(&d.format("%Y-%m-%dT%H:%M:%S").to_string()).ok()) {
                        Some(dt) => { ws.write_datetime_with_format(row, col, &dt, if c.ty == Ty::Date { &date } else { &datetime }).map_err(err)?; }
                        None => { ws.write_string(row, col, s).map_err(err)?; }
                    }
                }
                _ => { ws.write_string(row, col, cell_text(v, c.ty)).map_err(err)?; }
            }
        }
        row += 1;
    }
    wb.save_to_buffer().map_err(err)
}

#[cfg(test)]
mod tests {
    #[test]
    fn money_format() {
        assert_eq!(super::money(1234.5), "R$ 1.234,50");
        assert_eq!(super::money(-0.5), "-R$ 0,50");
        assert_eq!(super::money(1000000.0), "R$ 1.000.000,00");
    }
}
