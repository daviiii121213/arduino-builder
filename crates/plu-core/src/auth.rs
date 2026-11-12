//! Perfis locais: cadastro, autenticação, bloqueio, alteração de senha e exclusão.
//! Senhas são armazenadas exclusivamente como hash Argon2id com salt aleatório.

use crate::core::{audit, Core, Session, MAX_PROFILES};
use crate::error::{ApiError, ApiResult};
use crate::util::{self, now};
use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use base64::Engine;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::time::Instant;

pub fn hash_password(pw: &str) -> ApiResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pw.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| ApiError::internal("Falha ao proteger a senha."))
}

pub fn verify_password(pw: &str, hash: &str) -> bool {
    PasswordHash::new(hash).map(|h| Argon2::default().verify_password(pw.as_bytes(), &h).is_ok()).unwrap_or(false)
}

pub fn validate_password(pw: &str, field: &str) -> ApiResult<()> {
    if pw.chars().count() < 8 {
        return Err(ApiError::validation(field, "A senha deve ter pelo menos 8 caracteres."));
    }
    if pw.chars().count() > 128 {
        return Err(ApiError::validation(field, "A senha deve ter no máximo 128 caracteres."));
    }
    if !pw.chars().any(|c| c.is_alphabetic()) || !pw.chars().any(|c| c.is_ascii_digit()) {
        return Err(ApiError::validation(field, "Use letras e números na senha."));
    }
    Ok(())
}

fn validate_username(u: &str) -> ApiResult<String> {
    let u = u.trim();
    if u.len() < 3 || u.len() > 32 {
        return Err(ApiError::validation("username", "O nome de usuário deve ter entre 3 e 32 caracteres."));
    }
    if !u.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-') {
        return Err(ApiError::validation("username", "Use apenas letras sem acento, números, ponto, hífen ou sublinhado."));
    }
    Ok(u.to_lowercase())
}

fn validate_color(c: Option<&str>) -> ApiResult<Option<String>> {
    match c {
        None => Ok(None),
        Some(s) if s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit()) => Ok(Some(s.to_lowercase())),
        Some(_) => Err(ApiError::validation("color", "Cor inválida.")),
    }
}

pub fn avatar_data_url(core: &Core, path: Option<String>) -> Option<String> {
    let p = path?;
    let full = core.data_dir.join(&p);
    let bytes = std::fs::read(full).ok()?;
    let mime = if p.ends_with(".png") { "image/png" } else if p.ends_with(".webp") { "image/webp" } else { "image/jpeg" };
    Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

pub fn public_user(core: &Core, conn: &Connection, uid: &str) -> ApiResult<Value> {
    let (username, full_name, color, avatar, created, last_login): (String, String, Option<String>, Option<String>, String, Option<String>) = conn.query_row(
        "SELECT username, full_name, color, avatar_path, created_at, last_login_at FROM users WHERE id = ?1",
        params![uid],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
    )?;
    let inst_admin = crate::settings::installation_admin(conn)?;
    Ok(json!({
        "id": uid, "username": username, "full_name": full_name, "color": color,
        "avatar": avatar_data_url(core, avatar), "created_at": created, "last_login_at": last_login,
        "installation_admin": inst_admin.as_deref() == Some(uid),
    }))
}

/// Lista pública de perfis para a tela de entrada (sem dados privados).
pub fn list_profiles(core: &Core, conn: &Connection) -> ApiResult<Value> {
    let mut st = conn.prepare("SELECT id, username, full_name, color, avatar_path, locked_until FROM users ORDER BY created_at")?;
    let rows: Vec<(String, String, String, Option<String>, Option<String>, Option<String>)> =
        st.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)))?.collect::<Result<_, _>>()?;
    let n = now();
    let items: Vec<Value> = rows
        .into_iter()
        .map(|(id, u, f, c, a, l)| {
            json!({"id": id, "username": u, "full_name": f, "color": c, "avatar": avatar_data_url(core, a),
                   "temporarily_locked": l.map(|x| x > n).unwrap_or(false)})
        })
        .collect();
    Ok(json!({ "items": items, "max": MAX_PROFILES }))
}

pub fn register(core: &Core, conn: &Connection, args: &Value) -> ApiResult<Value> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))?;
    if count >= MAX_PROFILES {
        return Err(ApiError::conflict(format!("Esta instalação já possui o máximo de {MAX_PROFILES} perfis.")));
    }
    // Após o primeiro perfil, novos cadastros exigem um perfil autenticado (evita criação anônima).
    if count > 0 && core.require_user().is_err() {
        return Err(ApiError::forbidden("Entre com um perfil existente para cadastrar um novo perfil nesta instalação."));
    }
    let full_name = util::require_text("full_name", "Nome completo", util::arg_str(args, "full_name").unwrap_or(""), 120)?;
    if full_name.chars().count() < 2 {
        return Err(ApiError::validation("full_name", "Informe o nome completo."));
    }
    let username = validate_username(util::arg_str(args, "username").unwrap_or(""))?;
    let password = util::arg_str(args, "password").unwrap_or("");
    let confirm = util::arg_str(args, "password_confirm").unwrap_or("");
    validate_password(password, "password")?;
    if password != confirm {
        return Err(ApiError::validation("password_confirm", "As senhas não conferem."));
    }
    let color = validate_color(util::arg_opt_str(args, "color"))?;
    let taken: Option<String> = conn.query_row("SELECT id FROM users WHERE username = ?1", params![username], |r| r.get(0)).optional()?;
    if taken.is_some() {
        return Err(ApiError::validation("username", "Este nome de usuário já está em uso."));
    }
    let id = util::new_id();
    let hash = hash_password(password)?;
    let ts = now();
    crate::db::tx(conn, |conn| {
        conn.execute(
            "INSERT INTO users (id, username, full_name, password_hash, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![id, username, full_name, hash, color, ts],
        )?;
        conn.execute("INSERT INTO onboarding_progress (user_id, updated_at) VALUES (?1, ?2)", params![id, ts])?;
        crate::automation::seed_for_user(conn, &id)?;
        crate::dashboard::ensure_default(conn, &id, "personal")?;
        crate::dashboard::ensure_default(conn, &id, "family")?;
        if count == 0 {
            crate::settings::app_set(conn, "installation_admin", &id)?;
        }
        audit(conn, Some(&id), None, "cadastro_perfil", Some("users"), Some(&id), None);
        Ok(())
    })?;
    if let Some(av) = util::arg_opt_str(args, "avatar") {
        save_avatar(core, conn, &id, av)?;
    }
    crate::logger::info("novo perfil cadastrado");
    // O primeiro cadastro já inicia a sessão; os seguintes mantêm a sessão atual.
    if count == 0 {
        *core.session.lock().unwrap() = Some(Session { user_id: id.clone(), locked: false, last_activity: Instant::now() });
        conn.execute("UPDATE users SET last_login_at = ?1 WHERE id = ?2", params![now(), id])?;
    }
    Ok(json!({ "user": public_user(core, conn, &id)?, "logged_in": count == 0 }))
}

pub fn login(core: &Core, conn: &Connection, args: &Value) -> ApiResult<Value> {
    let username = util::arg_str(args, "username").unwrap_or("").trim().to_lowercase();
    let password = util::arg_str(args, "password").unwrap_or("");
    let row: Option<(String, String, i64, Option<String>)> = conn
        .query_row("SELECT id, password_hash, failed_attempts, locked_until FROM users WHERE username = ?1", params![username], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .optional()?;
    let Some((id, hash, fails, locked_until)) = row else {
        return Err(ApiError::new("invalid_credentials", "Usuário ou senha incorretos."));
    };
    if let Some(l) = &locked_until {
        if l.as_str() > now().as_str() {
            return Err(ApiError::new("too_many_attempts", "Muitas tentativas incorretas. Aguarde alguns instantes e tente novamente."));
        }
    }
    if !verify_password(password, &hash) {
        let f = fails + 1;
        let lock = if f >= 5 {
            let secs = 30 * 2i64.pow(((f - 5) as u32).min(6));
            Some((util::now_naive() + chrono::Duration::seconds(secs)).format("%Y-%m-%dT%H:%M:%S").to_string())
        } else {
            None
        };
        conn.execute("UPDATE users SET failed_attempts = ?1, locked_until = ?2 WHERE id = ?3", params![f, lock, id])?;
        audit(conn, Some(&id), None, "falha_login", Some("users"), Some(&id), None);
        return Err(ApiError::new("invalid_credentials", "Usuário ou senha incorretos."));
    }
    conn.execute("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?1 WHERE id = ?2", params![now(), id])?;
    *core.session.lock().unwrap() = Some(Session { user_id: id.clone(), locked: false, last_activity: Instant::now() });
    audit(conn, Some(&id), None, "login", Some("users"), Some(&id), None);
    crate::automation::seed_for_user(conn, &id)?;
    Ok(json!({ "user": public_user(core, conn, &id)? }))
}

pub fn logout(core: &Core, conn: &Connection) -> ApiResult<Value> {
    if let Some(s) = core.session.lock().unwrap().take() {
        audit(conn, Some(&s.user_id), None, "logout", Some("users"), Some(&s.user_id), None);
    }
    Ok(json!({ "ok": true }))
}

pub fn lock(core: &Core) -> ApiResult<Value> {
    if let Some(s) = core.session.lock().unwrap().as_mut() {
        s.locked = true;
    }
    Ok(json!({ "ok": true }))
}

pub fn unlock(core: &Core, conn: &Connection, args: &Value) -> ApiResult<Value> {
    let uid = core.session.lock().unwrap().as_ref().map(|s| s.user_id.clone()).ok_or_else(ApiError::unauthenticated)?;
    let hash: String = conn.query_row("SELECT password_hash FROM users WHERE id = ?1", params![uid], |r| r.get(0))?;
    if !verify_password(util::arg_str(args, "password").unwrap_or(""), &hash) {
        return Err(ApiError::validation("password", "Senha incorreta."));
    }
    if let Some(s) = core.session.lock().unwrap().as_mut() {
        s.locked = false;
        s.last_activity = Instant::now();
    }
    Ok(json!({ "ok": true }))
}

/// Confirma a senha do usuário atual (usado para áreas protegidas, como o Diário).
pub fn verify(conn: &Connection, uid: &str, args: &Value) -> ApiResult<Value> {
    let hash: String = conn.query_row("SELECT password_hash FROM users WHERE id = ?1", params![uid], |r| r.get(0))?;
    if !verify_password(util::arg_str(args, "password").unwrap_or(""), &hash) {
        return Err(ApiError::validation("password", "Senha incorreta."));
    }
    Ok(json!({ "ok": true }))
}

pub fn change_password(conn: &Connection, uid: &str, args: &Value) -> ApiResult<Value> {
    let hash: String = conn.query_row("SELECT password_hash FROM users WHERE id = ?1", params![uid], |r| r.get(0))?;
    if !verify_password(util::arg_str(args, "current").unwrap_or(""), &hash) {
        return Err(ApiError::validation("current", "A senha atual está incorreta."));
    }
    let new = util::arg_str(args, "new").unwrap_or("");
    validate_password(new, "new")?;
    if new != util::arg_str(args, "confirm").unwrap_or("") {
        return Err(ApiError::validation("confirm", "As senhas não conferem."));
    }
    conn.execute("UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3", params![hash_password(new)?, now(), uid])?;
    audit(conn, Some(uid), None, "alterar_senha", Some("users"), Some(uid), None);
    Ok(json!({ "ok": true }))
}

pub fn update_profile(core: &Core, conn: &Connection, uid: &str, args: &Value) -> ApiResult<Value> {
    if let Some(n) = args.get("full_name").and_then(|v| v.as_str()) {
        let n = util::require_text("full_name", "Nome completo", n, 120)?;
        conn.execute("UPDATE users SET full_name = ?1, updated_at = ?2 WHERE id = ?3", params![n, now(), uid])?;
    }
    if args.get("color").is_some() {
        let c = validate_color(util::arg_opt_str(args, "color"))?;
        conn.execute("UPDATE users SET color = ?1, updated_at = ?2 WHERE id = ?3", params![c, now(), uid])?;
    }
    if let Some(av) = args.get("avatar") {
        match av.as_str() {
            Some(s) if !s.is_empty() => save_avatar(core, conn, uid, s)?,
            _ => {
                let old: Option<String> = conn.query_row("SELECT avatar_path FROM users WHERE id = ?1", params![uid], |r| r.get(0))?;
                if let Some(o) = old {
                    let _ = std::fs::remove_file(core.data_dir.join(o));
                }
                conn.execute("UPDATE users SET avatar_path = NULL WHERE id = ?1", params![uid])?;
            }
        }
    }
    public_user(core, conn, uid)
}

/// Salva a foto de perfil recebida como data URL (PNG, JPEG ou WebP, até 2 MB).
fn save_avatar(core: &Core, conn: &Connection, uid: &str, data_url: &str) -> ApiResult<()> {
    let (meta, b64) = data_url.split_once(',').ok_or_else(|| ApiError::validation("avatar", "Imagem inválida."))?;
    let ext = if meta.contains("image/png") { "png" } else if meta.contains("image/webp") { "webp" } else if meta.contains("image/jpeg") { "jpg" } else {
        return Err(ApiError::validation("avatar", "Use uma imagem PNG, JPEG ou WebP."));
    };
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64).map_err(|_| ApiError::validation("avatar", "Imagem inválida."))?;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err(ApiError::validation("avatar", "A imagem deve ter no máximo 2 MB."));
    }
    let dir = core.attachments_dir().join("avatars");
    std::fs::create_dir_all(&dir)?;
    let rel = format!("attachments/avatars/{uid}.{ext}");
    for e in ["png", "jpg", "webp"] {
        let _ = std::fs::remove_file(dir.join(format!("{uid}.{e}")));
    }
    std::fs::write(core.data_dir.join(&rel), bytes)?;
    conn.execute("UPDATE users SET avatar_path = ?1, updated_at = ?2 WHERE id = ?3", params![rel, now(), uid])?;
    Ok(())
}

/// Exclui o próprio perfil e todos os seus dados pessoais (exige senha).
pub fn delete_profile(core: &Core, conn: &Connection, uid: &str, args: &Value) -> ApiResult<Value> {
    let hash: String = conn.query_row("SELECT password_hash FROM users WHERE id = ?1", params![uid], |r| r.get(0))?;
    if !verify_password(util::arg_str(args, "password").unwrap_or(""), &hash) {
        return Err(ApiError::validation("password", "Senha incorreta."));
    }
    let ctx = crate::core::load_ctx(conn, uid)?;
    if let Some(f) = &ctx.family {
        let members: i64 = conn.query_row("SELECT COUNT(*) FROM family_members WHERE family_id = ?1", params![f.id], |r| r.get(0))?;
        if f.role == "admin" && members > 1 {
            return Err(ApiError::conflict("Transfira a administração da família para outro integrante antes de excluir o perfil."));
        }
    }
    let files: Vec<String> = {
        let mut st = conn.prepare("SELECT stored_path FROM attachments WHERE owner_id = ?1")?;
        let v: Vec<String> = st.query_map(params![uid], |r| r.get(0))?.collect::<Result<_, _>>()?;
        v
    };
    crate::db::tx(conn, |conn| {
        if let Some(f) = &ctx.family {
            crate::family::leave_inner(conn, &ctx, &f.id, true)?;
        }
        conn.execute("DELETE FROM family_invitations WHERE user_id = ?1 OR created_by = ?1", params![uid])?;
        conn.execute("DELETE FROM users WHERE id = ?1", params![uid])?;
        if crate::settings::app_get(conn, "installation_admin")?.as_deref() == Some(uid) {
            conn.execute("DELETE FROM app_settings WHERE key = 'installation_admin'", [])?;
            crate::settings::installation_admin(conn)?;
        }
        audit(conn, None, None, "excluir_perfil", Some("users"), Some(uid), None);
        Ok(())
    })?;
    for f in files {
        let _ = std::fs::remove_file(core.data_dir.join(f));
    }
    for e in ["png", "jpg", "webp"] {
        let _ = std::fs::remove_file(core.attachments_dir().join("avatars").join(format!("{uid}.{e}")));
    }
    *core.session.lock().unwrap() = None;
    Ok(json!({ "ok": true }))
}
