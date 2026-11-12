//! Anexos: arquivos copiados para o diretório local do aplicativo, com referência no SQLite.
//! O acesso a um anexo exige acesso ao registro ao qual ele pertence.

use crate::core::{audit, Core, Ctx};
use crate::entities::{check_access, def, load_meta, Action};
use crate::error::{ApiError, ApiResult};
use crate::util::{self, now};
use base64::Engine;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::Path;

pub const MAX_SIZE: usize = 50 * 1024 * 1024;

const BLOCKED_EXT: &[&str] = &["exe", "bat", "cmd", "com", "msi", "ps1", "vbs", "js", "scr", "dll", "lnk", "jar", "hta", "reg"];

pub fn mime_for(name: &str) -> &'static str {
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "csv" => "text/csv",
        "doc" | "docx" => "application/msword",
        "xls" | "xlsx" => "application/vnd.ms-excel",
        _ => "application/octet-stream",
    }
}

fn safe_name(name: &str) -> String {
    let n: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') { c } else { '_' })
        .collect();
    let n = n.trim().trim_start_matches('.').to_string();
    if n.is_empty() { "arquivo".into() } else { n.chars().take(120).collect() }
}

fn ensure_record_access(conn: &Connection, ctx: &Ctx, entity: &str, record_id: &str, action: Action) -> ApiResult<()> {
    let d = def(entity)?;
    let meta = load_meta(conn, d, record_id)?;
    check_access(ctx, d, &meta, action, false)
}

pub fn add(core: &Core, conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let entity = util::arg_str(args, "entity")?;
    let record_id = util::arg_str(args, "record_id")?;
    ensure_record_access(conn, ctx, entity, record_id, Action::Update)?;
    let (name, bytes) = if let Some(path) = util::arg_opt_str(args, "path") {
        let p = Path::new(path);
        let meta = std::fs::metadata(p).map_err(|_| ApiError::validation("path", "Arquivo não encontrado."))?;
        if !meta.is_file() {
            return Err(ApiError::validation("path", "Selecione um arquivo."));
        }
        if meta.len() as usize > MAX_SIZE {
            return Err(ApiError::validation("path", "O arquivo excede o limite de 50 MB."));
        }
        (p.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "arquivo".into()), std::fs::read(p)?)
    } else {
        let name = util::arg_str(args, "name")?.to_string();
        let data = util::arg_str(args, "data")?;
        let b64 = data.split_once(',').map(|x| x.1).unwrap_or(data);
        let bytes = base64::engine::general_purpose::STANDARD.decode(b64).map_err(|_| ApiError::validation("data", "Conteúdo do arquivo inválido."))?;
        (name, bytes)
    };
    if bytes.len() > MAX_SIZE {
        return Err(ApiError::validation("data", "O arquivo excede o limite de 50 MB."));
    }
    let name = safe_name(&name);
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    if BLOCKED_EXT.contains(&ext.as_str()) {
        return Err(ApiError::validation("data", "Por segurança, arquivos executáveis não podem ser anexados."));
    }
    let id = util::new_id();
    let hash = hex::encode(Sha256::digest(&bytes));
    let sub = match ctx.family_id() {
        Some(_) if load_meta(conn, def(entity)?, record_id)?.scope == "family" => format!("family/{}", ctx.family_id().unwrap()),
        _ => format!("users/{}", ctx.uid),
    };
    let rel = format!("attachments/{sub}/{id}{}", if ext.is_empty() { String::new() } else { format!(".{ext}") });
    let full = core.data_dir.join(&rel);
    std::fs::create_dir_all(full.parent().unwrap())?;
    std::fs::write(&full, &bytes)?;
    let res = conn.execute(
        "INSERT INTO attachments (id, entity, record_id, owner_id, file_name, stored_path, mime, size, sha256, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![id, entity, record_id, ctx.uid, name, rel, mime_for(&name), bytes.len() as i64, hash, now()],
    );
    if let Err(e) = res {
        let _ = std::fs::remove_file(&full);
        return Err(e.into());
    }
    audit(conn, Some(&ctx.uid), ctx.family_id(), "anexar", Some(entity), Some(record_id), Some(json!({"arquivo": name})));
    Ok(json!({ "id": id, "file_name": name, "size": bytes.len(), "mime": mime_for(&name) }))
}

pub fn list(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let entity = util::arg_str(args, "entity")?;
    let record_id = util::arg_str(args, "record_id")?;
    ensure_record_access(conn, ctx, entity, record_id, Action::View)?;
    let mut st = conn.prepare("SELECT a.id, a.file_name, a.mime, a.size, a.created_at, u.full_name FROM attachments a LEFT JOIN users u ON u.id = a.owner_id WHERE a.entity = ?1 AND a.record_id = ?2 ORDER BY a.created_at")?;
    let items: Vec<Value> = st
        .query_map(params![entity, record_id], |r| Ok(json!({"id": r.get::<_, String>(0)?, "file_name": r.get::<_, String>(1)?, "mime": r.get::<_, Option<String>>(2)?,
            "size": r.get::<_, i64>(3)?, "created_at": r.get::<_, String>(4)?, "owner_name": r.get::<_, Option<String>>(5)?})))?
        .collect::<Result<_, _>>()?;
    Ok(json!({ "items": items }))
}

fn load(conn: &Connection, id: &str) -> ApiResult<(String, String, String, String, Option<String>, String)> {
    conn.query_row("SELECT entity, record_id, stored_path, file_name, mime, owner_id FROM attachments WHERE id = ?1", params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)))
        .optional()?
        .ok_or_else(|| ApiError::not_found("Anexo não encontrado."))
}

/// Retorna o caminho absoluto do arquivo, após verificar a permissão (para abrir no aplicativo padrão).
pub fn path_for(core: &Core, conn: &Connection, ctx: &Ctx, id: &str) -> ApiResult<std::path::PathBuf> {
    let (entity, rid, rel, ..) = load(conn, id)?;
    ensure_record_access(conn, ctx, &entity, &rid, Action::View)?;
    let full = core.data_dir.join(&rel);
    if !full.starts_with(&core.data_dir) || !full.exists() {
        return Err(ApiError::not_found("Arquivo do anexo não encontrado no disco."));
    }
    Ok(full)
}

/// Conteúdo em data URL (para pré-visualização de imagens; limite de 15 MB).
pub fn data_url(core: &Core, conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "id")?;
    let full = path_for(core, conn, ctx, id)?;
    let (_, _, _, name, mime, _) = load(conn, id)?;
    let bytes = std::fs::read(full)?;
    if bytes.len() > 15 * 1024 * 1024 {
        return Err(ApiError::bad_request("Arquivo grande demais para pré-visualização."));
    }
    let mime = mime.unwrap_or_else(|| mime_for(&name).into());
    Ok(json!({ "data_url": format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)), "file_name": name }))
}

/// Copia o anexo para um destino escolhido pelo usuário.
pub fn export(core: &Core, conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "id")?;
    let dest = util::arg_str(args, "dest")?;
    let full = path_for(core, conn, ctx, id)?;
    std::fs::copy(full, dest)?;
    Ok(json!({ "ok": true, "path": dest }))
}

pub fn delete(core: &Core, conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "id")?;
    let (entity, rid, rel, name, _, _) = load(conn, id)?;
    ensure_record_access(conn, ctx, &entity, &rid, Action::Update)?;
    conn.execute("DELETE FROM attachments WHERE id = ?1", params![id])?;
    let _ = std::fs::remove_file(core.data_dir.join(rel));
    audit(conn, Some(&ctx.uid), ctx.family_id(), "remover_anexo", Some(&entity), Some(&rid), Some(json!({"arquivo": name})));
    Ok(json!({ "ok": true }))
}

pub fn delete_for_record(data_dir: &Path, conn: &Connection, entity: &str, record_id: &str) -> ApiResult<()> {
    let mut st = conn.prepare("SELECT stored_path FROM attachments WHERE entity = ?1 AND record_id = ?2")?;
    let paths: Vec<String> = st.query_map(params![entity, record_id], |r| r.get(0))?.collect::<Result<_, _>>()?;
    conn.execute("DELETE FROM attachments WHERE entity = ?1 AND record_id = ?2", params![entity, record_id])?;
    for p in paths {
        let _ = std::fs::remove_file(data_dir.join(p));
    }
    Ok(())
}
