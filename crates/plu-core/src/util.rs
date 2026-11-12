//! Funções utilitárias: datas, identificadores, normalização de texto e validação.

use crate::error::{ApiError, ApiResult};
use chrono::{Datelike, Local, NaiveDate, NaiveDateTime};
use rand::Rng;
use serde_json::Value;
use unicode_normalization::UnicodeNormalization;

/// Data e hora local no formato ISO sem fuso: `YYYY-MM-DDTHH:MM:SS`.
pub fn now() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

pub fn today() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

pub fn now_naive() -> NaiveDateTime {
    Local::now().naive_local()
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Gera um código legível (sem caracteres ambíguos) de `len` caracteres.
pub fn random_code(len: usize) -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..len).map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char).collect()
}

/// Remove acentos e converte para minúsculas, para pesquisa.
pub fn normalize(s: &str) -> String {
    s.nfd()
        .filter(|c| !unicode_normalization::char::is_combining_mark(*c))
        .collect::<String>()
        .to_lowercase()
}

pub fn parse_date(s: &str) -> Option<NaiveDate> {
    let s = s.trim();
    if s.len() >= 10 {
        NaiveDate::parse_from_str(&s[..10], "%Y-%m-%d").ok()
    } else {
        None
    }
}

pub fn parse_datetime(s: &str) -> Option<NaiveDateTime> {
    let s = s.trim();
    for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"] {
        if let Ok(d) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(d);
        }
    }
    parse_date(s).and_then(|d| d.and_hms_opt(0, 0, 0))
}

pub fn add_months(d: NaiveDate, months: i32) -> NaiveDate {
    let total = d.year() * 12 + d.month0() as i32 + months;
    let (y, m) = (total.div_euclid(12), total.rem_euclid(12) as u32 + 1);
    let mut day = d.day();
    loop {
        if let Some(nd) = NaiveDate::from_ymd_opt(y, m, day) {
            return nd;
        }
        day -= 1;
    }
}

// ---------- leitura de argumentos ----------

pub fn arg_str<'a>(args: &'a Value, key: &str) -> ApiResult<&'a str> {
    args.get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::validation(key, format!("O campo '{key}' é obrigatório.")))
}

pub fn arg_opt_str<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args.get(key).and_then(|v| v.as_str()).filter(|s| !s.is_empty())
}

pub fn arg_i64(args: &Value, key: &str) -> Option<i64> {
    args.get(key).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
}

pub fn arg_bool(args: &Value, key: &str) -> bool {
    args.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
}

/// Valida um texto obrigatório com tamanho máximo.
pub fn require_text(field: &str, label: &str, v: &str, max: usize) -> ApiResult<String> {
    let t = v.trim();
    if t.is_empty() {
        return Err(ApiError::validation(field, format!("{label} é obrigatório.")));
    }
    if t.chars().count() > max {
        return Err(ApiError::validation(field, format!("{label} deve ter no máximo {max} caracteres.")));
    }
    Ok(t.to_string())
}

pub fn json_size_ok(v: &Value, max: usize) -> bool {
    serde_json::to_string(v).map(|s| s.len() <= max).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalize_removes_accents() {
        assert_eq!(normalize("Ação Família ÇÃO"), "acao familia cao");
    }
    #[test]
    fn add_months_clamps() {
        let d = NaiveDate::from_ymd_opt(2026, 1, 31).unwrap();
        assert_eq!(add_months(d, 1), NaiveDate::from_ymd_opt(2026, 2, 28).unwrap());
        assert_eq!(add_months(d, 12), NaiveDate::from_ymd_opt(2027, 1, 31).unwrap());
        assert_eq!(add_months(d, -2), NaiveDate::from_ymd_opt(2025, 11, 30).unwrap());
    }
}
