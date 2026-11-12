//! Registro de entidades e motor genérico de CRUD com validação e autorização.
//!
//! Cada módulo do aplicativo é descrito por um `EntityDef`. Os nomes de colunas
//! vêm sempre desta lista estática (nunca da entrada do usuário), e os valores
//! são passados como parâmetros SQL, evitando injeção de SQL.

use crate::core::{audit, Ctx};
use crate::error::{ApiError, ApiResult};
use crate::util::{self, now};
use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use serde_json::{json, Map, Value};

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum K {
    Text(usize),
    LongText,
    Int(i64, i64),
    Real(f64),
    Bool,
    Date,
    DateTime,
    Time,
    Enum(&'static [&'static str]),
    Json,
    User,
    Ref(&'static str),
    Color,
}

#[derive(Clone, Copy, Debug)]
pub struct F {
    pub col: &'static str,
    pub kind: K,
    pub required: bool,
}

const fn f(col: &'static str, kind: K) -> F {
    F { col, kind, required: false }
}
const fn req(col: &'static str, kind: K) -> F {
    F { col, kind, required: true }
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Scopes {
    Personal,
    Family,
    Both,
}

#[derive(Debug)]
pub struct EntityDef {
    pub name: &'static str,
    pub label: &'static str,
    pub table: &'static str,
    pub module: Option<&'static str>,
    pub scopes: Scopes,
    pub area: &'static str,
    /// (entidade pai, coluna FK)
    pub parent: Option<(&'static str, &'static str)>,
    pub fields: &'static [F],
    pub date_col: Option<&'static str>,
    pub search_cols: &'static [&'static str],
    pub shareable: bool,
    /// Campos que integrantes da família podem alterar em registros pessoais compartilhados.
    pub collab: &'static [&'static str],
    pub default_sort: &'static str,
}

const PRIO: K = K::Int(0, 3);
const T200: K = K::Text(200);
const T120: K = K::Text(120);
const T60: K = K::Text(60);
const RECUR: K = K::Enum(&["nenhuma", "diaria", "semanal", "mensal", "anual"]);

macro_rules! rec_fields {
    ($($extra:expr),* $(,)?) => {
        &[req("title", T200), f("body", K::LongText), f("category", T60), f("status", T60),
          f("priority", PRIO), f("date_start", K::Text(25)), f("date_end", K::Text(25)),
          f("amount", K::Real(-1e12)), f("progress", K::Real(0.0)), f("ref_id", K::Text(64)),
          f("assignee_id", K::User), f("position", K::Int(-1_000_000, 1_000_000)),
          f("data", K::Json), f("parent_id", K::Text(64)) $(, $extra)*]
    };
}

const REC_SEARCH: &[&str] = &["title", "body", "category"];
const REC_FIELDS: &[F] = rec_fields!();
const FREC_FIELDS: &[F] = rec_fields!(f("restricted_to", K::Json));

const fn prec(name: &'static str, label: &'static str, parent: Option<&'static str>, date_col: &'static str) -> EntityDef {
    EntityDef {
        name,
        label,
        table: "personal_records",
        module: Some(name),
        scopes: Scopes::Personal,
        area: "personal",
        parent: match parent {
            Some(p) => Some((p, "parent_id")),
            None => None,
        },
        fields: REC_FIELDS,
        date_col: Some(date_col),
        search_cols: REC_SEARCH,
        shareable: false,
        collab: &[],
        default_sort: "updated_at DESC",
    }
}

const fn frec(name: &'static str, label: &'static str, area: &'static str, parent: Option<&'static str>, date_col: &'static str) -> EntityDef {
    EntityDef {
        name,
        label,
        table: "family_records",
        module: Some(name),
        scopes: Scopes::Family,
        area,
        parent: match parent {
            Some(p) => Some((p, "parent_id")),
            None => None,
        },
        fields: FREC_FIELDS,
        date_col: Some(date_col),
        search_cols: REC_SEARCH,
        shareable: false,
        collab: &[],
        default_sort: "updated_at DESC",
    }
}

pub static ENTITIES: &[EntityDef] = &[
    EntityDef {
        name: "events", label: "Compromissos", table: "events", module: None, scopes: Scopes::Both, area: "agenda",
        parent: None,
        fields: &[req("title", T200), f("description", K::LongText), f("location", T200), req("start_at", K::DateTime),
            f("end_at", K::DateTime), f("all_day", K::Bool), f("priority", PRIO), f("category", T60), f("recurrence", RECUR),
            f("recurrence_until", K::Date), f("reminder_minutes", K::Int(0, 60 * 24 * 30)), f("color", K::Color),
            f("assignee_id", K::User), f("data", K::Json)],
        date_col: Some("start_at"), search_cols: &["title", "description", "location", "category"], shareable: true,
        collab: &[], default_sort: "start_at ASC",
    },
    EntityDef {
        name: "tasks", label: "Tarefas", table: "tasks", module: None, scopes: Scopes::Both, area: "tasks", parent: None,
        fields: &[req("title", T200), f("notes", K::LongText), f("status", K::Enum(&["pendente", "em_andamento", "concluida"])),
            f("priority", PRIO), f("due_date", K::Text(25)), f("category", T60), f("project_id", K::Ref("projects")),
            f("assignee_id", K::User), f("recurrence", RECUR), f("reminder_minutes", K::Int(0, 60 * 24 * 30)), f("data", K::Json)],
        date_col: Some("due_date"), search_cols: &["title", "notes", "category"], shareable: true, collab: &["status"],
        default_sort: "CASE WHEN status = 'concluida' THEN 1 ELSE 0 END, due_date IS NULL, due_date ASC, priority DESC",
    },
    EntityDef {
        name: "subtasks", label: "Subtarefas", table: "subtasks", module: None, scopes: Scopes::Both, area: "tasks",
        parent: Some(("tasks", "task_id")),
        fields: &[req("task_id", K::Text(64)), req("title", T200), f("done", K::Bool), f("position", K::Int(-1_000_000, 1_000_000))],
        date_col: None, search_cols: &["title"], shareable: false, collab: &["done"], default_sort: "position ASC, created_at ASC",
    },
    EntityDef {
        name: "projects", label: "Projetos", table: "projects", module: None, scopes: Scopes::Personal, area: "personal", parent: None,
        fields: &[req("title", T200), f("objective", K::LongText), f("description", K::LongText),
            f("status", K::Enum(&["planejado", "em_andamento", "pausado", "concluido"])), f("start_date", K::Date), f("due_date", K::Date),
            f("category", T60), f("color", K::Color), f("progress", K::Real(0.0)), f("data", K::Json)],
        date_col: Some("due_date"), search_cols: &["title", "objective", "description", "category"], shareable: false, collab: &[],
        default_sort: "CASE WHEN status = 'concluido' THEN 1 ELSE 0 END, updated_at DESC",
    },
    EntityDef {
        name: "project_steps", label: "Etapas de projeto", table: "project_steps", module: None, scopes: Scopes::Personal, area: "personal",
        parent: Some(("projects", "project_id")),
        fields: &[req("project_id", K::Text(64)), req("title", T200), f("description", K::LongText), f("done", K::Bool),
            f("due_date", K::Date), f("position", K::Int(-1_000_000, 1_000_000))],
        date_col: Some("due_date"), search_cols: &["title", "description"], shareable: false, collab: &[], default_sort: "position ASC, created_at ASC",
    },
    EntityDef {
        name: "goals", label: "Metas", table: "goals", module: None, scopes: Scopes::Both, area: "goals", parent: None,
        fields: &[req("title", T200), f("description", K::LongText), f("category", T60),
            f("status", K::Enum(&["em_andamento", "pausada", "concluida", "cancelada"])), f("start_date", K::Date), f("due_date", K::Date),
            f("indicator", T60), f("target_value", K::Real(-1e12)), f("current_value", K::Real(-1e12)), f("progress", K::Real(0.0)),
            f("assignee_id", K::User), f("data", K::Json)],
        date_col: Some("due_date"), search_cols: &["title", "description", "category"], shareable: true, collab: &[],
        default_sort: "CASE WHEN status = 'concluida' THEN 1 ELSE 0 END, due_date IS NULL, due_date ASC",
    },
    EntityDef {
        name: "goal_milestones", label: "Marcos de meta", table: "goal_milestones", module: None, scopes: Scopes::Both, area: "goals",
        parent: Some(("goals", "goal_id")),
        fields: &[req("goal_id", K::Text(64)), req("title", T200), f("done", K::Bool), f("due_date", K::Date), f("assignee_id", K::User),
            f("position", K::Int(-1_000_000, 1_000_000))],
        date_col: Some("due_date"), search_cols: &["title"], shareable: false, collab: &["done"], default_sort: "position ASC, created_at ASC",
    },
    EntityDef {
        name: "habits", label: "Hábitos", table: "habits", module: None, scopes: Scopes::Personal, area: "personal", parent: None,
        fields: &[req("title", T200), f("description", K::LongText), f("category", T60), f("frequency", K::Enum(&["diario", "semanal", "dias"])),
            f("weekdays", K::Json), f("target_per_week", K::Int(1, 7)), f("reminder_time", K::Time), f("color", K::Color), f("active", K::Bool),
            f("data", K::Json)],
        date_col: None, search_cols: &["title", "description", "category"], shareable: false, collab: &[], default_sort: "active DESC, title ASC",
    },
    EntityDef {
        name: "notes", label: "Notas", table: "notes", module: None, scopes: Scopes::Personal, area: "personal", parent: None,
        fields: &[req("title", T200), f("content", K::LongText), f("folder", T60), f("tags", T200), f("pinned", K::Bool), f("color", K::Color),
            f("data", K::Json)],
        date_col: None, search_cols: &["title", "content", "folder", "tags"], shareable: false, collab: &[], default_sort: "pinned DESC, updated_at DESC",
    },
    EntityDef {
        name: "documents", label: "Documentos", table: "documents", module: None, scopes: Scopes::Both, area: "documents", parent: None,
        fields: &[req("title", T200), f("description", K::LongText), f("category", T60), f("doc_number", T120), f("issue_date", K::Date),
            f("expiry_date", K::Date), f("reminder_days", K::Int(0, 3650)), f("restricted_to", K::Json), f("data", K::Json)],
        date_col: Some("expiry_date"), search_cols: &["title", "description", "category", "doc_number"], shareable: true, collab: &[],
        default_sort: "updated_at DESC",
    },
    EntityDef {
        name: "transactions", label: "Lançamentos financeiros", table: "transactions", module: None, scopes: Scopes::Both, area: "finance",
        parent: None,
        fields: &[req("kind", K::Enum(&["receita", "despesa"])), req("title", T200), req("amount", K::Real(0.0)), f("category", T60),
            req("date", K::Date), f("account", T60), f("payment_method", T60), f("notes", K::LongText), f("bill_id", K::Text(64)), f("data", K::Json)],
        date_col: Some("date"), search_cols: &["title", "category", "notes", "account"], shareable: false, collab: &[], default_sort: "date DESC, created_at DESC",
    },
    EntityDef {
        name: "budgets", label: "Orçamentos", table: "budgets", module: None, scopes: Scopes::Both, area: "finance", parent: None,
        fields: &[req("category", T60), f("month", K::Text(7)), req("amount_limit", K::Real(0.0)), f("alert_percent", K::Int(1, 100)),
            f("notes", K::LongText), f("data", K::Json)],
        date_col: None, search_cols: &["category", "notes"], shareable: false, collab: &[], default_sort: "category ASC",
    },
    EntityDef {
        name: "bills", label: "Contas", table: "bills", module: None, scopes: Scopes::Both, area: "finance", parent: None,
        fields: &[req("title", T200), f("amount", K::Real(0.0)), req("due_date", K::Date), f("category", T60), f("recurrence", RECUR),
            f("paid", K::Bool), f("paid_amount", K::Real(0.0)), f("reminder_days", K::Int(0, 365)), f("assignee_id", K::User),
            f("notes", K::LongText), f("data", K::Json)],
        date_col: Some("due_date"), search_cols: &["title", "category", "notes"], shareable: false, collab: &[], default_sort: "paid ASC, due_date ASC",
    },
    EntityDef {
        name: "shopping_lists", label: "Listas de compras", table: "shopping_lists", module: None, scopes: Scopes::Both, area: "shopping",
        parent: None,
        fields: &[req("title", T200), f("category", T60), f("status", K::Enum(&["aberta", "concluida"])), f("store", T120),
            f("notes", K::LongText), f("data", K::Json)],
        date_col: None, search_cols: &["title", "category", "store", "notes"], shareable: true, collab: &[],
        default_sort: "CASE WHEN status = 'concluida' THEN 1 ELSE 0 END, updated_at DESC",
    },
    EntityDef {
        name: "shopping_items", label: "Itens de compra", table: "shopping_items", module: None, scopes: Scopes::Both, area: "shopping",
        parent: Some(("shopping_lists", "list_id")),
        fields: &[req("list_id", K::Text(64)), req("title", T200), f("quantity", K::Real(0.0)), f("unit", K::Text(20)), f("category", T60),
            f("est_price", K::Real(0.0)), f("bought", K::Bool), f("assignee_id", K::User), f("position", K::Int(-1_000_000, 1_000_000))],
        date_col: None, search_cols: &["title", "category"], shareable: false, collab: &["bought"], default_sort: "bought ASC, category ASC, position ASC",
    },
    EntityDef {
        name: "recipes", label: "Receitas", table: "recipes", module: None, scopes: Scopes::Both, area: "home", parent: None,
        fields: &[req("title", T200), f("category", T60), f("servings", K::Int(0, 1000)), f("prep_minutes", K::Int(0, 100_000)),
            f("instructions", K::LongText), f("data", K::Json)],
        date_col: None, search_cols: &["title", "category", "instructions"], shareable: false, collab: &[], default_sort: "title ASC",
    },
    // ----- módulos pessoais em personal_records -----
    prec("routine", "Rotinas", None, "date_start"),
    prec("routine_step", "Etapas de rotina", Some("routine"), "date_start"),
    prec("study_subject", "Matérias", None, "date_start"),
    prec("study_item", "Itens de estudo", None, "date_start"),
    prec("study_session", "Sessões de estudo", None, "date_start"),
    prec("course", "Cursos", None, "date_start"),
    prec("course_lesson", "Aulas", Some("course"), "date_start"),
    prec("wishlist", "Lista de desejos", None, "date_start"),
    prec("diary", "Diário", None, "date_start"),
    prec("book", "Livros", None, "date_start"),
    prec("language", "Idiomas", None, "date_start"),
    prec("vocab", "Vocabulário", Some("language"), "date_start"),
    prec("time_session", "Controle de tempo", None, "date_start"),
    prec("pomodoro_session", "Sessões Pomodoro", None, "date_start"),
    prec("health_appointment", "Saúde e consultas", None, "date_start"),
    prec("health_professional", "Profissionais de saúde", None, "date_start"),
    prec("mindmap", "Mapas mentais", None, "date_start"),
    prec("portfolio", "Portfólio", None, "date_start"),
    prec("research", "Pesquisas", None, "date_start"),
    // ----- módulos familiares em family_records -----
    frec("duty", "Divisão de responsabilidades", "tasks", None, "date_start"),
    frec("pantry", "Despensa", "home", None, "date_end"),
    frec("inventory", "Inventário", "home", None, "date_start"),
    frec("menu", "Cardápio", "home", None, "date_start"),
    frec("maintenance", "Manutenção da casa", "home", None, "date_end"),
    frec("maintenance_log", "Registros de manutenção", "home", Some("maintenance"), "date_start"),
    frec("family_event", "Eventos", "memories", None, "date_start"),
    frec("event_task", "Preparativos", "memories", Some("family_event"), "date_start"),
    frec("birthday", "Aniversários", "memories", None, "date_start"),
    frec("board_post", "Mural familiar", "social", None, "date_start"),
    frec("conversation", "Conversas", "social", None, "date_start"),
    frec("message", "Mensagens", "social", Some("conversation"), "date_start"),
    frec("poll", "Votações", "social", None, "date_end"),
    frec("trip", "Viagens e passeios", "goals", None, "date_start"),
    frec("album", "Álbuns de fotos", "memories", None, "date_start"),
    frec("photo", "Fotos", "memories", Some("album"), "date_start"),
    frec("memory", "Memórias familiares", "memories", None, "date_start"),
    frec("person", "Árvore genealógica", "memories", None, "date_start"),
];

pub fn def(name: &str) -> ApiResult<&'static EntityDef> {
    ENTITIES
        .iter()
        .find(|e| e.name == name)
        .ok_or_else(|| ApiError::bad_request(format!("Módulo desconhecido: {name}")))
}

pub fn allows_scope(d: &EntityDef, scope: &str) -> bool {
    matches!(
        (d.scopes, scope),
        (Scopes::Both, "personal" | "family") | (Scopes::Personal, "personal") | (Scopes::Family, "family")
    )
}

/// Colunas tratadas como booleanas na saída JSON.
fn is_bool_col(d: &EntityDef, col: &str) -> bool {
    col == "shared" || d.fields.iter().any(|f| f.col == col && f.kind == K::Bool) || matches!(col, "paid" | "overdue")
}

// ------------------------------------------------------------------
// Conversão de linhas
// ------------------------------------------------------------------

pub fn row_to_json(d: &EntityDef, row: &rusqlite::Row, cols: &[String]) -> rusqlite::Result<Map<String, Value>> {
    let mut m = Map::new();
    for (i, c) in cols.iter().enumerate() {
        let v = match row.get_ref(i)? {
            ValueRef::Null => Value::Null,
            ValueRef::Integer(n) => {
                if is_bool_col(d, c) {
                    Value::Bool(n != 0)
                } else {
                    json!(n)
                }
            }
            ValueRef::Real(x) => json!(x),
            ValueRef::Text(t) => {
                let s = String::from_utf8_lossy(t).to_string();
                if c == "data" || c == "restricted_to" || c == "weekdays" {
                    serde_json::from_str(&s).unwrap_or(Value::Null)
                } else {
                    Value::String(s)
                }
            }
            ValueRef::Blob(_) => Value::Null,
        };
        m.insert(c.clone(), v);
    }
    m.insert("entity".into(), Value::String(d.name.to_string()));
    Ok(m)
}

pub fn query_rows(conn: &Connection, d: &EntityDef, sql: &str, p: &[SqlValue]) -> ApiResult<Vec<Map<String, Value>>> {
    let mut st = conn.prepare(sql)?;
    let cols: Vec<String> = st.column_names().map(|s| s.to_string()).collect();
    let rows = st.query_map(params_from_iter(p.iter()), |r| row_to_json(d, r, &cols))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

// ------------------------------------------------------------------
// Autorização
// ------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Action {
    View,
    Update,
    Delete,
}

pub struct RowMeta {
    pub scope: String,
    pub owner_id: String,
    pub family_id: Option<String>,
    pub shared: bool,
    pub restricted_to: Option<Vec<String>>,
    pub assignee_id: Option<String>,
    pub deleted: bool,
}

pub fn load_meta(conn: &Connection, d: &EntityDef, id: &str) -> ApiResult<RowMeta> {
    let has_assignee = d.fields.iter().any(|f| f.col == "assignee_id");
    let sql = format!(
        "SELECT scope, owner_id, family_id, shared, restricted_to, {}, deleted_at FROM {} WHERE id = ?1{}",
        if has_assignee { "assignee_id" } else { "NULL" },
        d.table,
        if d.module.is_some() { " AND module = ?2" } else { "" }
    );
    let mut p: Vec<SqlValue> = vec![SqlValue::Text(id.to_string())];
    if let Some(m) = d.module {
        p.push(SqlValue::Text(m.to_string()));
    }
    conn.query_row(&sql, params_from_iter(p.iter()), |r| {
        let rt: Option<String> = r.get(4)?;
        Ok(RowMeta {
            scope: r.get(0)?,
            owner_id: r.get(1)?,
            family_id: r.get(2)?,
            shared: r.get::<_, i64>(3)? != 0,
            restricted_to: rt.and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok()),
            assignee_id: r.get(5)?,
            deleted: r.get::<_, Option<String>>(6)?.is_some(),
        })
    })
    .optional()?
    .ok_or_else(|| ApiError::not_found(format!("{} não encontrado(a).", d.label)))
}

/// Verifica se o usuário pode realizar `action` sobre a linha. `collab` indica
/// que a alteração toca somente campos colaborativos.
pub fn check_access(ctx: &Ctx, d: &EntityDef, meta: &RowMeta, action: Action, collab: bool) -> ApiResult<()> {
    let deny = || Err(ApiError::forbidden("Você não tem permissão para acessar este registro."));
    if meta.scope == "personal" {
        if meta.owner_id == ctx.uid {
            return Ok(());
        }
        // Registro pessoal compartilhado com a família do usuário.
        if meta.shared && meta.family_id.is_some() && meta.family_id.as_deref() == ctx.family_id() {
            let area_view = format!("{}.view", d.area);
            return match action {
                Action::View if ctx.can(&area_view) => Ok(()),
                Action::Update if collab && ctx.can(&format!("{}.create", d.area)) => Ok(()),
                _ => deny(),
            };
        }
        return deny();
    }
    // Registro familiar
    let Some(fam) = ctx.family.as_ref() else { return deny() };
    if meta.family_id.as_deref() != Some(fam.id.as_str()) {
        return deny();
    }
    let is_owner = meta.owner_id == ctx.uid;
    if let Some(list) = &meta.restricted_to {
        if !list.is_empty() && !is_owner && fam.role != "admin" && !list.iter().any(|u| u == &ctx.uid) {
            return deny();
        }
    }
    let area = d.area;
    match action {
        Action::View => {
            if ctx.can(&format!("{area}.view")) {
                Ok(())
            } else {
                deny()
            }
        }
        Action::Update | Action::Delete => {
            if ctx.can(&format!("{area}.manage")) {
                return Ok(());
            }
            if is_owner && ctx.can(&format!("{area}.create")) {
                return Ok(());
            }
            if action == Action::Update
                && meta.assignee_id.as_deref() == Some(ctx.uid.as_str())
                && ctx.can(&format!("{area}.view"))
            {
                return Ok(());
            }
            if action == Action::Update && collab && ctx.can(&format!("{area}.create")) {
                return Ok(());
            }
            deny()
        }
    }
}

pub fn can_view(conn: &Connection, ctx: &Ctx, entity: &str, id: &str) -> ApiResult<()> {
    let d = def(entity)?;
    let meta = load_meta(conn, d, id)?;
    if meta.deleted {
        return Err(ApiError::not_found("O registro está na lixeira."));
    }
    check_access(ctx, d, &meta, Action::View, false)
}

/// Filtro SQL de visibilidade para listagens no ambiente informado.
pub fn scope_filter(ctx: &Ctx, d: &EntityDef, scope: &str, alias: &str, p: &mut Vec<SqlValue>) -> ApiResult<String> {
    if !allows_scope(d, scope) {
        return Err(ApiError::bad_request(format!("{} não está disponível neste ambiente.", d.label)));
    }
    let mut sql = String::new();
    if let Some(m) = d.module {
        sql.push_str(&format!("{alias}.module = ? AND "));
        p.push(SqlValue::Text(m.into()));
    }
    if scope == "personal" {
        sql.push_str(&format!("{alias}.scope = 'personal' AND {alias}.owner_id = ?"));
        p.push(SqlValue::Text(ctx.uid.clone()));
    } else {
        let fam = ctx.require_family()?;
        if !ctx.can(&format!("{}.view", d.area)) {
            return Err(ApiError::forbidden(format!("Você não tem permissão para visualizar {} da família.", d.label.to_lowercase())));
        }
        sql.push_str(&format!(
            "{alias}.family_id = ? AND ({alias}.scope = 'family' OR {alias}.shared = 1)"
        ));
        p.push(SqlValue::Text(fam.id.clone()));
        if fam.role != "admin" && d.fields.iter().any(|f| f.col == "restricted_to") {
            sql.push_str(&format!(
                " AND ({alias}.restricted_to IS NULL OR {alias}.restricted_to = '[]' OR {alias}.owner_id = ? OR EXISTS (SELECT 1 FROM json_each({alias}.restricted_to) j WHERE j.value = ?))"
            ));
            p.push(SqlValue::Text(ctx.uid.clone()));
            p.push(SqlValue::Text(ctx.uid.clone()));
        }
    }
    Ok(sql)
}

// ------------------------------------------------------------------
// Validação de valores
// ------------------------------------------------------------------

fn is_family_member(conn: &Connection, family_id: &str, uid: &str) -> ApiResult<bool> {
    Ok(conn
        .query_row(
            "SELECT 1 FROM family_members WHERE family_id = ?1 AND user_id = ?2",
            params![family_id, uid],
            |_| Ok(()),
        )
        .optional()?
        .is_some())
}

fn convert(conn: &Connection, ctx: &Ctx, scope: &str, fdef: &F, v: &Value) -> ApiResult<SqlValue> {
    let col = fdef.col;
    let bad = |msg: &str| Err(ApiError::validation(col, msg.to_string()));
    if v.is_null() || (v.as_str().map(|s| s.trim().is_empty()).unwrap_or(false) && !matches!(fdef.kind, K::Json)) {
        if fdef.required {
            return bad("Campo obrigatório.");
        }
        return Ok(match fdef.kind {
            K::Bool => SqlValue::Integer(0),
            _ => SqlValue::Null,
        });
    }
    match fdef.kind {
        K::Text(max) => {
            let s = v.as_str().map(|s| s.trim().to_string()).or_else(|| v.as_f64().map(|n| n.to_string()));
            match s {
                Some(s) if s.chars().count() <= max => Ok(SqlValue::Text(s)),
                Some(_) => bad(&format!("Máximo de {max} caracteres.")),
                None => bad("Texto inválido."),
            }
        }
        K::LongText => match v.as_str() {
            Some(s) if s.len() <= 200_000 => Ok(SqlValue::Text(s.to_string())),
            Some(_) => bad("Texto muito longo."),
            None => bad("Texto inválido."),
        },
        K::Int(min, max) => {
            let n = v.as_i64().or_else(|| v.as_f64().map(|x| x.round() as i64)).or_else(|| v.as_str().and_then(|s| s.trim().parse().ok()));
            match n {
                Some(n) if n >= min && n <= max => Ok(SqlValue::Integer(n)),
                Some(_) => bad(&format!("Informe um número entre {min} e {max}.")),
                None => bad("Número inválido."),
            }
        }
        K::Real(min) => {
            let n = v.as_f64().or_else(|| v.as_str().and_then(|s| s.trim().replace(',', ".").parse().ok()));
            match n {
                Some(n) if n.is_finite() && n >= min && n <= 1e13 => Ok(SqlValue::Real((n * 10000.0).round() / 10000.0)),
                Some(_) => bad(if min == 0.0 { "Informe um valor maior ou igual a zero." } else { "Valor fora do intervalo permitido." }),
                None => bad("Número inválido."),
            }
        }
        K::Bool => Ok(SqlValue::Integer(match v {
            Value::Bool(b) => *b as i64,
            Value::Number(n) => (n.as_i64().unwrap_or(0) != 0) as i64,
            Value::String(s) => matches!(s.as_str(), "1" | "true" | "sim") as i64,
            _ => 0,
        })),
        K::Date => match v.as_str().and_then(util::parse_date) {
            Some(d) => Ok(SqlValue::Text(d.format("%Y-%m-%d").to_string())),
            None => bad("Data inválida (use AAAA-MM-DD)."),
        },
        K::DateTime => match v.as_str().and_then(util::parse_datetime) {
            Some(d) => Ok(SqlValue::Text(d.format("%Y-%m-%dT%H:%M").to_string())),
            None => bad("Data e hora inválidas."),
        },
        K::Time => match v.as_str().and_then(|s| chrono::NaiveTime::parse_from_str(s.trim(), "%H:%M").ok()) {
            Some(t) => Ok(SqlValue::Text(t.format("%H:%M").to_string())),
            None => bad("Horário inválido (use HH:MM)."),
        },
        K::Enum(opts) => match v.as_str() {
            Some(s) if opts.contains(&s) => Ok(SqlValue::Text(s.to_string())),
            _ => bad(&format!("Valor inválido. Opções: {}.", opts.join(", "))),
        },
        K::Json => {
            if !(v.is_object() || v.is_array()) {
                return bad("Estrutura inválida.");
            }
            if !util::json_size_ok(v, 1_000_000) {
                return bad("Conteúdo muito grande.");
            }
            if col == "restricted_to" {
                let arr = v.as_array().ok_or_else(|| ApiError::validation(col, "Lista de integrantes inválida."))?;
                let fid = ctx.family_id().unwrap_or_default().to_string();
                for u in arr {
                    let Some(u) = u.as_str() else { return bad("Integrante inválido.") };
                    if !is_family_member(conn, &fid, u)? {
                        return bad("Só é possível restringir a integrantes da família.");
                    }
                }
                if arr.is_empty() {
                    return Ok(SqlValue::Null);
                }
            }
            Ok(SqlValue::Text(v.to_string()))
        }
        K::User => {
            let Some(u) = v.as_str() else { return bad("Usuário inválido.") };
            if u == ctx.uid {
                return Ok(SqlValue::Text(u.into()));
            }
            if scope == "family" {
                if let Some(fid) = ctx.family_id() {
                    if is_family_member(conn, fid, u)? {
                        return Ok(SqlValue::Text(u.into()));
                    }
                }
            }
            bad("O responsável deve ser um integrante da família.")
        }
        K::Ref(entity) => {
            let Some(id) = v.as_str() else { return bad("Referência inválida.") };
            can_view(conn, ctx, entity, id).map_err(|_| ApiError::validation(col, "Registro relacionado não encontrado ou sem acesso."))?;
            Ok(SqlValue::Text(id.into()))
        }
        K::Color => match v.as_str() {
            Some(s) if s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit()) => Ok(SqlValue::Text(s.to_lowercase())),
            _ => bad("Cor inválida."),
        },
    }
}

// ------------------------------------------------------------------
// Operações
// ------------------------------------------------------------------

pub fn get(conn: &Connection, ctx: &Ctx, entity: &str, id: &str) -> ApiResult<Value> {
    let d = def(entity)?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::View, false)?;
    let mut rows = query_rows(conn, d, &format!("SELECT * FROM {} WHERE id = ?", d.table), &[SqlValue::Text(id.into())])?;
    crate::decorate::decorate(conn, ctx, d, &mut rows)?;
    let mut row = rows.pop().ok_or_else(|| ApiError::not_found("Registro não encontrado."))?;
    row.insert("can_edit".into(), Value::Bool(check_access(ctx, d, &meta, Action::Update, false).is_ok()));
    Ok(Value::Object(row))
}

pub struct ListOpts {
    pub page: i64,
    pub page_size: i64,
}

pub fn list(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let d = def(util::arg_str(args, "entity")?)?;
    let scope = args.get("scope").and_then(|v| v.as_str()).unwrap_or("personal");
    let mut p: Vec<SqlValue> = Vec::new();
    let mut wh = vec![scope_filter(ctx, d, scope, "t", &mut p)?];
    let trash = util::arg_bool(args, "trash");
    wh.push(if trash { "t.deleted_at IS NOT NULL".into() } else { "t.deleted_at IS NULL".into() });

    if let Some(q) = util::arg_opt_str(args, "q") {
        let qn = format!("%{}%", util::normalize(q).replace('%', "").replace('_', ""));
        let parts: Vec<String> = d.search_cols.iter().map(|c| format!("plu_norm(t.{c}) LIKE ?")).collect();
        for _ in d.search_cols {
            p.push(SqlValue::Text(qn.clone()));
        }
        wh.push(format!("({})", parts.join(" OR ")));
    }
    // filtros de igualdade em colunas conhecidas
    if let Some(filters) = args.get("filters").and_then(|v| v.as_object()) {
        for (k, v) in filters {
            let allowed = d.fields.iter().any(|f| f.col == k) || k == "shared" || k == "owner_id" || k == "overdue" || k == "paid";
            if !allowed || k == "data" {
                return Err(ApiError::bad_request(format!("Filtro inválido: {k}")));
            }
            match v {
                Value::Null => wh.push(format!("t.{k} IS NULL")),
                Value::Bool(b) => {
                    wh.push(format!("t.{k} = ?"));
                    p.push(SqlValue::Integer(*b as i64));
                }
                Value::Number(n) => {
                    wh.push(format!("t.{k} = ?"));
                    if let Some(i) = n.as_i64() { p.push(SqlValue::Integer(i)) } else { p.push(SqlValue::Real(n.as_f64().unwrap_or(0.0))) }
                }
                Value::String(s) => {
                    wh.push(format!("t.{k} = ?"));
                    p.push(SqlValue::Text(s.clone()));
                }
                Value::Array(arr) => {
                    let ph: Vec<&str> = arr.iter().map(|_| "?").collect();
                    if ph.is_empty() {
                        wh.push("0".into());
                    } else {
                        wh.push(format!("t.{k} IN ({})", ph.join(",")));
                        for x in arr {
                            p.push(SqlValue::Text(x.as_str().unwrap_or_default().to_string()));
                        }
                    }
                }
                _ => return Err(ApiError::bad_request("Filtro inválido.")),
            }
        }
    }
    if let Some(dc) = d.date_col {
        if let Some(from) = util::arg_opt_str(args, "from") {
            wh.push(format!("substr(t.{dc}, 1, 10) >= ?"));
            p.push(SqlValue::Text(from[..from.len().min(10)].to_string()));
        }
        if let Some(to) = util::arg_opt_str(args, "to") {
            wh.push(format!("substr(t.{dc}, 1, 10) <= ?"));
            p.push(SqlValue::Text(to[..to.len().min(10)].to_string()));
        }
    }
    let where_sql = wh.join(" AND ");
    let total: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM {} t WHERE {}", d.table, where_sql),
        params_from_iter(p.iter()),
        |r| r.get(0),
    )?;
    let sort = match args.get("sort").and_then(|v| v.as_str()) {
        Some(s) => {
            let mut parts = Vec::new();
            for piece in s.split(',').map(str::trim).filter(|p| !p.is_empty()).take(4) {
                let (col, dir) = piece.split_once(' ').unwrap_or((piece, "ASC"));
                let ok = d.fields.iter().any(|f| f.col == col) || matches!(col, "created_at" | "updated_at" | "deleted_at");
                if !ok || !(dir.eq_ignore_ascii_case("asc") || dir.eq_ignore_ascii_case("desc")) {
                    return Err(ApiError::bad_request("Ordenação inválida."));
                }
                parts.push(format!("t.{col} {}", if dir.eq_ignore_ascii_case("desc") { "DESC" } else { "ASC" }));
            }
            if parts.is_empty() {
                return Err(ApiError::bad_request("Ordenação inválida."));
            }
            parts.join(", ")
        }
        None => {
            if trash { "t.deleted_at DESC".into() } else { d.default_sort.to_string() }
        }
    };
    let page_size = util::arg_i64(args, "page_size").unwrap_or(50).clamp(1, 500);
    let page = util::arg_i64(args, "page").unwrap_or(1).max(1);
    let sql = format!(
        "SELECT t.* FROM {} t WHERE {} ORDER BY {} LIMIT {} OFFSET {}",
        d.table,
        where_sql,
        sort,
        page_size,
        (page - 1) * page_size
    );
    let mut rows = query_rows(conn, d, &sql, &p)?;
    crate::decorate::decorate(conn, ctx, d, &mut rows)?;
    for r in rows.iter_mut() {
        let mine = r.get("owner_id").and_then(|v| v.as_str()) == Some(ctx.uid.as_str());
        r.insert("mine".into(), Value::Bool(mine));
    }
    Ok(json!({ "items": rows, "total": total, "page": page, "page_size": page_size }))
}

fn validate_values(conn: &Connection, ctx: &Ctx, d: &EntityDef, scope: &str, values: &Map<String, Value>, creating: bool)
    -> ApiResult<Vec<(&'static str, SqlValue)>> {
    let mut out = Vec::new();
    for (k, _) in values {
        if k == "parent_id" && d.parent.is_none() {
            return Err(ApiError::validation(k, "Este módulo não possui registro principal."));
        }
        if !d.fields.iter().any(|f| f.col == k) {
            return Err(ApiError::validation(k, format!("Campo desconhecido: {k}")));
        }
    }
    for fdef in d.fields {
        match values.get(fdef.col) {
            Some(v) => {
                if fdef.col == "restricted_to" && scope != "family" {
                    continue;
                }
                out.push((fdef.col, convert(conn, ctx, scope, fdef, v)?));
            }
            None if creating && fdef.required => {
                // título derivado do corpo (ex.: mensagens)
                if fdef.col == "title" {
                    if let Some(body) = values.get("body").and_then(|v| v.as_str()).filter(|s| !s.trim().is_empty()) {
                        let t: String = body.trim().chars().take(80).collect();
                        out.push(("title", SqlValue::Text(t)));
                        continue;
                    }
                }
                return Err(ApiError::validation(fdef.col, "Campo obrigatório."));
            }
            None => {}
        }
    }
    Ok(out)
}

pub fn create(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let d = def(util::arg_str(args, "entity")?)?;
    let empty = Map::new();
    let values = args.get("values").and_then(|v| v.as_object()).unwrap_or(&empty);
    let mut scope = args.get("scope").and_then(|v| v.as_str()).unwrap_or("personal").to_string();
    let mut owner = ctx.uid.clone();
    let mut family_id: Option<String> = None;
    let mut shared = false;

    // Entidades filhas herdam o ambiente do registro pai.
    if let Some((pent, pcol)) = d.parent {
        let pid = values.get(pcol).and_then(|v| v.as_str()).ok_or_else(|| ApiError::validation(pcol, "Registro principal não informado."))?;
        let pdef = def(pent)?;
        let pmeta = load_meta(conn, pdef, pid)?;
        if pmeta.deleted {
            return Err(ApiError::bad_request("O registro principal está na lixeira."));
        }
        let collab = values.keys().all(|k| k == pcol || k == "title" || d.collab.contains(&k.as_str()) || k == "quantity" || k == "unit" || k == "position");
        // Criar filho exige poder editar o pai (ou colaborar em itens compartilhados).
        if pmeta.scope == "family" {
            // Na família, quem pode ver o registro principal e criar na área pode adicionar itens
            // (mensagens em conversas, fotos em álbuns, preparativos etc.).
            check_access(ctx, pdef, &pmeta, Action::View, false)?;
            if !ctx.can(&format!("{}.create", d.area)) {
                return Err(ApiError::forbidden("Você não tem permissão para adicionar itens nesta área da família."));
            }
        } else {
            check_access(ctx, pdef, &pmeta, Action::Update, collab && !d.collab.is_empty())?;
        }
        scope = pmeta.scope.clone();
        family_id = pmeta.family_id.clone();
        shared = pmeta.shared;
        if scope == "personal" {
            owner = pmeta.owner_id.clone();
        }
    } else if scope == "family" {
        let fam = ctx.require_family()?;
        if !ctx.can(&format!("{}.create", d.area)) {
            return Err(ApiError::forbidden(format!("Você não tem permissão para criar {} na família.", d.label.to_lowercase())));
        }
        family_id = Some(fam.id.clone());
    }
    if !allows_scope(d, &scope) {
        return Err(ApiError::bad_request(format!("{} não está disponível neste ambiente.", d.label)));
    }
    let vals = validate_values(conn, ctx, d, &scope, values, true)?;
    let id = util::new_id();
    let ts = now();
    let mut cols: Vec<&str> = vec!["id", "scope", "owner_id", "family_id", "shared", "created_by", "updated_by", "created_at", "updated_at"];
    let mut p: Vec<SqlValue> = vec![
        SqlValue::Text(id.clone()),
        SqlValue::Text(scope.clone()),
        SqlValue::Text(owner.clone()),
        family_id.clone().map(SqlValue::Text).unwrap_or(SqlValue::Null),
        SqlValue::Integer(shared as i64),
        SqlValue::Text(ctx.uid.clone()),
        SqlValue::Text(ctx.uid.clone()),
        SqlValue::Text(ts.clone()),
        SqlValue::Text(ts.clone()),
    ];
    if let Some(m) = d.module {
        cols.push("module");
        p.push(SqlValue::Text(m.into()));
    }
    for (c, v) in vals {
        cols.push(c);
        p.push(v);
    }
    let ph: Vec<&str> = cols.iter().map(|_| "?").collect();
    crate::db::tx(conn, |conn| {
        conn.execute(
            &format!("INSERT INTO {} ({}) VALUES ({})", d.table, cols.join(", "), ph.join(", ")),
            params_from_iter(p.iter()),
        )?;
        crate::hooks::after_write(conn, ctx, d, &id, None)?;
        audit(conn, Some(&ctx.uid), family_id.as_deref(), "criar", Some(d.name), Some(&id), None);
        Ok(())
    })?;
    get(conn, ctx, d.name, &id)
}

pub fn update(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let d = def(util::arg_str(args, "entity")?)?;
    let id = util::arg_str(args, "id")?;
    let empty = Map::new();
    let values = args.get("values").and_then(|v| v.as_object()).unwrap_or(&empty);
    let meta = load_meta(conn, d, id)?;
    if meta.deleted {
        return Err(ApiError::bad_request("Restaure o registro da lixeira antes de editá-lo."));
    }
    let collab = !values.is_empty() && values.keys().all(|k| d.collab.contains(&k.as_str()));
    check_access(ctx, d, &meta, Action::Update, collab)?;
    // Responsáveis só podem alterar o estado/conclusão quando não têm permissão total.
    if meta.scope == "family" && meta.owner_id != ctx.uid && !ctx.can(&format!("{}.manage", d.area)) && !ctx.can(&format!("{}.create", d.area)) {
        let ok = values.keys().all(|k| matches!(k.as_str(), "status" | "done" | "bought" | "paid" | "data"));
        if !ok {
            return Err(ApiError::forbidden("Como responsável, você só pode atualizar o andamento deste registro."));
        }
    }
    if let Some((_, pcol)) = d.parent {
        if values.contains_key(pcol) {
            return Err(ApiError::validation(pcol, "Não é possível mover o registro para outro principal."));
        }
    }
    let vals = validate_values(conn, ctx, d, &meta.scope, values, false)?;
    if vals.is_empty() {
        return get(conn, ctx, d.name, id);
    }
    let before = get(conn, ctx, d.name, id)?;
    let mut sets: Vec<String> = Vec::new();
    let mut p: Vec<SqlValue> = Vec::new();
    let changed: Vec<&str> = vals.iter().map(|(c, _)| *c).collect();
    for (c, v) in vals.iter() {
        sets.push(format!("{c} = ?"));
        p.push(v.clone());
    }
    sets.push("updated_at = ?".into());
    p.push(SqlValue::Text(now()));
    sets.push("updated_by = ?".into());
    p.push(SqlValue::Text(ctx.uid.clone()));
    p.push(SqlValue::Text(id.into()));
    crate::db::tx(conn, |conn| {
        conn.execute(&format!("UPDATE {} SET {} WHERE id = ?", d.table, sets.join(", ")), params_from_iter(p.iter()))?;
        crate::hooks::after_write(conn, ctx, d, id, Some(&before))?;
        audit(conn, Some(&ctx.uid), meta.family_id.as_deref(), "editar", Some(d.name), Some(id), Some(json!({ "campos": changed })));
        Ok(())
    })?;
    get(conn, ctx, d.name, id)
}

/// Exclusão lógica (lixeira).
pub fn delete(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let d = def(util::arg_str(args, "entity")?)?;
    let id = util::arg_str(args, "id")?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::Delete, false)?;
    // Responsável sem permissão de criação não exclui.
    if meta.scope == "family" && meta.owner_id != ctx.uid && !ctx.can(&format!("{}.manage", d.area)) {
        return Err(ApiError::forbidden("Somente o autor ou quem gerencia a área pode excluir este registro."));
    }
    let ts = now();
    crate::db::tx(conn, |conn| {
        conn.execute(&format!("UPDATE {} SET deleted_at = ?1, updated_by = ?2 WHERE id = ?3", d.table), params![ts, ctx.uid, id])?;
        if d.parent.is_some() {
            crate::hooks::after_child_change(conn, ctx, d, id)?;
        }
        audit(conn, Some(&ctx.uid), meta.family_id.as_deref(), "excluir", Some(d.name), Some(id), None);
        Ok(())
    })?;
    Ok(json!({ "ok": true }))
}

pub fn restore(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let d = def(util::arg_str(args, "entity")?)?;
    let id = util::arg_str(args, "id")?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::Delete, false)?;
    conn.execute(&format!("UPDATE {} SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2", d.table), params![now(), id])?;
    if d.parent.is_some() {
        crate::hooks::after_child_change(conn, ctx, d, id)?;
    }
    audit(conn, Some(&ctx.uid), meta.family_id.as_deref(), "restaurar", Some(d.name), Some(id), None);
    get(conn, ctx, d.name, id)
}

/// Exclusão definitiva (somente itens na lixeira).
pub fn purge(core_dir: &std::path::Path, conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let d = def(util::arg_str(args, "entity")?)?;
    let id = util::arg_str(args, "id")?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::Delete, false)?;
    if !meta.deleted {
        return Err(ApiError::bad_request("Mova o registro para a lixeira antes de excluí-lo definitivamente."));
    }
    crate::db::tx(conn, |conn| {
        crate::attachments::delete_for_record(core_dir, conn, d.name, id)?;
        conn.execute("DELETE FROM record_logs WHERE entity = ?1 AND record_id = ?2", params![d.name, id])?;
        conn.execute(&format!("DELETE FROM {} WHERE id = ?1", d.table), params![id])?;
        audit(conn, Some(&ctx.uid), meta.family_id.as_deref(), "excluir_definitivo", Some(d.name), Some(id), None);
        Ok(())
    })?;
    Ok(json!({ "ok": true }))
}

/// Lista a lixeira do usuário (itens próprios excluídos, de todos os módulos).
pub fn trash(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    let mut out = Vec::new();
    for d in ENTITIES.iter().filter(|d| d.parent.is_none()) {
        let mut p: Vec<SqlValue> = Vec::new();
        let mut wh = String::from("t.deleted_at IS NOT NULL AND t.owner_id = ?");
        p.push(SqlValue::Text(ctx.uid.clone()));
        if let Some(m) = d.module {
            wh.push_str(" AND t.module = ?");
            p.push(SqlValue::Text(m.into()));
        }
        let rows = query_rows(conn, d, &format!("SELECT t.id, t.title, t.scope, t.deleted_at FROM {} t WHERE {} ORDER BY t.deleted_at DESC LIMIT 200",
            d.table, wh).replace("t.title", if d.fields.iter().any(|f| f.col == "title") { "t.title" } else { "t.category AS title" }), &p)?;
        for mut r in rows {
            r.insert("label".into(), Value::String(d.label.into()));
            out.push(Value::Object(r));
        }
    }
    out.sort_by(|a, b| b["deleted_at"].as_str().cmp(&a["deleted_at"].as_str()));
    Ok(json!({ "items": out }))
}

/// Compartilha explicitamente um registro pessoal com a família do usuário.
pub fn share(conn: &Connection, ctx: &Ctx, args: &Value, on: bool) -> ApiResult<Value> {
    let d = def(util::arg_str(args, "entity")?)?;
    let id = util::arg_str(args, "id")?;
    if !d.shareable {
        return Err(ApiError::bad_request(format!("{} não podem ser compartilhados.", d.label)));
    }
    let meta = load_meta(conn, d, id)?;
    if meta.scope != "personal" || meta.owner_id != ctx.uid {
        return Err(ApiError::forbidden("Somente o dono de um registro pessoal pode compartilhá-lo."));
    }
    let (fid, shared) = if on {
        let fam = ctx.require_family()?;
        (Some(fam.id.clone()), 1)
    } else {
        (None, 0)
    };
    crate::db::tx(conn, |conn| {
        set_shared(conn, d, id, fid.as_deref(), shared)?;
        audit(conn, Some(&ctx.uid), fid.as_deref().or(meta.family_id.as_deref()), if on { "compartilhar" } else { "cancelar_compartilhamento" },
            Some(d.name), Some(id), None);
        Ok(())
    })?;
    get(conn, ctx, d.name, id)
}

pub fn set_shared(conn: &Connection, d: &EntityDef, id: &str, fid: Option<&str>, shared: i64) -> ApiResult<()> {
    conn.execute(&format!("UPDATE {} SET family_id = ?1, shared = ?2, updated_at = ?3 WHERE id = ?4", d.table), params![fid, shared, now(), id])?;
    for child in ENTITIES.iter().filter(|c| c.parent.map(|p| p.0) == Some(d.name)) {
        let (_, col) = child.parent.unwrap();
        conn.execute(&format!("UPDATE {} SET family_id = ?1, shared = ?2 WHERE {} = ?3", child.table, col), params![fid, shared, id])?;
    }
    Ok(())
}

/// Histórico de alterações de um registro (auditoria).
pub fn history(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let entity = util::arg_str(args, "entity")?;
    let id = util::arg_str(args, "id")?;
    let d = def(entity)?;
    let meta = load_meta(conn, d, id)?;
    check_access(ctx, d, &meta, Action::View, false)?;
    let mut st = conn.prepare(
        "SELECT a.action, a.details, a.created_at, COALESCE(u.full_name, 'Perfil removido')
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
         WHERE a.entity = ?1 AND a.record_id = ?2 ORDER BY a.created_at DESC LIMIT 100",
    )?;
    let rows = st.query_map(params![entity, id], |r| {
        Ok(json!({
            "action": r.get::<_, String>(0)?,
            "details": r.get::<_, Option<String>>(1)?.and_then(|s| serde_json::from_str::<Value>(&s).ok()),
            "created_at": r.get::<_, String>(2)?,
            "user_name": r.get::<_, String>(3)?,
        }))
    })?;
    let items: Vec<Value> = rows.collect::<Result<_, _>>()?;
    Ok(json!({ "items": items }))
}

/// Exposição do esquema para a interface (validação cruzada e formulários).
pub fn schema() -> Value {
    let list: Vec<Value> = ENTITIES
        .iter()
        .map(|d| {
            json!({
                "name": d.name, "label": d.label, "table": d.table, "module": d.module,
                "scopes": match d.scopes { Scopes::Personal => "personal", Scopes::Family => "family", Scopes::Both => "both" },
                "area": d.area, "parent": d.parent.map(|p| json!({"entity": p.0, "column": p.1})),
                "fields": d.fields.iter().map(|f| json!({"col": f.col, "required": f.required, "kind": format!("{:?}", f.kind)})).collect::<Vec<_>>(),
                "date_col": d.date_col, "shareable": d.shareable,
            })
        })
        .collect();
    json!({ "entities": list })
}
