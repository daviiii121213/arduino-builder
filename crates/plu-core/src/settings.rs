//! Preferências por usuário (tabela user_settings) e configurações gerais (app_settings).

use crate::core::Ctx;
use crate::error::{ApiError, ApiResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Map, Value};

pub fn defaults() -> Value {
    json!({
        "theme": "sistema",
        "primary_color": "#4f46e5",
        "accent_color": "#0d9488",
        "density": "confortavel",
        "animations": "normais",
        "font_scale": 100,
        "sidebar_collapsed": false,
        "shortcuts": {},
        "notifications": {
            "enabled": true,
            "os": true,
            "advance_minutes": 30,
            "quiet_enabled": false,
            "quiet_start": "22:00",
            "quiet_end": "07:00",
            "categories": {
                "evento": true, "tarefa": true, "atraso": true, "vencimento": true, "documento": true,
                "habito": true, "manutencao": true, "despensa": true, "aniversario": true, "saude": true, "orcamento": true
            }
        },
        "search_history": true,
        "diary_lock": false,
        "auto_lock_minutes": 0,
        "close_to_tray": false,
        "last_workspace": "personal",
        "currency": "BRL"
    })
}

const ALLOWED: &[&str] = &[
    "theme", "primary_color", "accent_color", "density", "animations", "font_scale", "sidebar_collapsed", "shortcuts",
    "notifications", "search_history", "diary_lock", "auto_lock_minutes", "close_to_tray", "last_workspace", "currency",
];

fn validate(key: &str, v: &Value) -> ApiResult<()> {
    let bad = |m: &str| Err(ApiError::validation(key, m.to_string()));
    match key {
        "theme" if !matches!(v.as_str(), Some("claro" | "escuro" | "sistema")) => bad("Tema inválido."),
        "density" if !matches!(v.as_str(), Some("confortavel" | "compacta")) => bad("Densidade inválida."),
        "animations" if !matches!(v.as_str(), Some("normais" | "reduzidas" | "desativadas")) => bad("Opção inválida."),
        "last_workspace" if !matches!(v.as_str(), Some("personal" | "family")) => bad("Ambiente inválido."),
        "primary_color" | "accent_color" => match v.as_str() {
            Some(s) if s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit()) => Ok(()),
            _ => bad("Cor inválida."),
        },
        "font_scale" => match v.as_i64() {
            Some(n) if (85..=130).contains(&n) => Ok(()),
            _ => bad("Escala entre 85% e 130%."),
        },
        "auto_lock_minutes" => match v.as_i64() {
            Some(n) if (0..=240).contains(&n) => Ok(()),
            _ => bad("Use entre 0 e 240 minutos."),
        },
        "sidebar_collapsed" | "search_history" | "diary_lock" | "close_to_tray" if !v.is_boolean() => bad("Valor inválido."),
        "shortcuts" | "notifications" if !v.is_object() => bad("Estrutura inválida."),
        "notifications" => {
            for k in ["quiet_start", "quiet_end"] {
                if let Some(s) = v.get(k).and_then(|x| x.as_str()) {
                    if chrono::NaiveTime::parse_from_str(s, "%H:%M").is_err() {
                        return Err(ApiError::validation(k, "Horário inválido."));
                    }
                }
            }
            if let Some(n) = v.get("advance_minutes") {
                if !n.as_i64().map(|n| (0..=10080).contains(&n)).unwrap_or(false) {
                    return Err(ApiError::validation("advance_minutes", "Antecedência inválida."));
                }
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

pub fn get_all(conn: &Connection, uid: &str) -> ApiResult<Value> {
    let mut base = defaults();
    let mut st = conn.prepare("SELECT key, value FROM user_settings WHERE user_id = ?1")?;
    let rows = st.query_map(params![uid], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let obj = base.as_object_mut().unwrap();
    for r in rows {
        let (k, v) = r?;
        if let Ok(val) = serde_json::from_str::<Value>(&v) {
            if let (Some(Value::Object(dflt)), Value::Object(user)) = (obj.get(&k).cloned(), &val) {
                // mescla objetos aninhados com os padrões
                let mut merged: Map<String, Value> = dflt.clone();
                for (a, b) in user {
                    if let (Some(Value::Object(d2)), Value::Object(u2)) = (dflt.get(a), b) {
                        let mut m2 = d2.clone();
                        m2.extend(u2.clone());
                        merged.insert(a.clone(), Value::Object(m2));
                    } else {
                        merged.insert(a.clone(), b.clone());
                    }
                }
                obj.insert(k, Value::Object(merged));
            } else {
                obj.insert(k, val);
            }
        }
    }
    Ok(base)
}

pub fn get_one(conn: &Connection, uid: &str, key: &str) -> ApiResult<Value> {
    Ok(get_all(conn, uid)?.get(key).cloned().unwrap_or(Value::Null))
}

pub fn set(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let values = args.get("values").and_then(|v| v.as_object()).ok_or_else(|| ApiError::bad_request("Nenhuma configuração informada."))?;
    for (k, v) in values {
        if !ALLOWED.contains(&k.as_str()) {
            return Err(ApiError::validation(k, format!("Configuração desconhecida: {k}")));
        }
        validate(k, v)?;
    }
    crate::db::tx(conn, |conn| {
        for (k, v) in values {
            conn.execute(
                "INSERT INTO user_settings (user_id, key, value) VALUES (?1, ?2, ?3)
                 ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
                params![ctx.uid, k, v.to_string()],
            )?;
        }
        Ok(())
    })?;
    get_all(conn, &ctx.uid)
}

pub fn reset(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    conn.execute("DELETE FROM user_settings WHERE user_id = ?1 AND key != 'last_workspace'", params![ctx.uid])?;
    get_all(conn, &ctx.uid)
}

// ---------- configurações da instalação ----------

pub fn app_get(conn: &Connection, key: &str) -> ApiResult<Option<String>> {
    Ok(conn.query_row("SELECT value FROM app_settings WHERE key = ?1", params![key], |r| r.get(0)).optional()?)
}

pub fn app_set(conn: &Connection, key: &str, value: &str) -> ApiResult<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

/// Administrador da instalação: responsável por backup completo e restauração.
pub fn installation_admin(conn: &Connection) -> ApiResult<Option<String>> {
    if let Some(id) = app_get(conn, "installation_admin")? {
        let exists: Option<String> = conn.query_row("SELECT id FROM users WHERE id = ?1", params![id], |r| r.get(0)).optional()?;
        if exists.is_some() {
            return Ok(Some(id));
        }
    }
    let first: Option<String> = conn.query_row("SELECT id FROM users ORDER BY created_at LIMIT 1", [], |r| r.get(0)).optional()?;
    if let Some(f) = &first {
        app_set(conn, "installation_admin", f)?;
    }
    Ok(first)
}
