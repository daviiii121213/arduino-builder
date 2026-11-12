//! Backup e restauração.
//!
//! Formato `.pluback` (documentado em docs/BACKUP.md): arquivo ZIP contendo
//!   - manifest.json  (formato, versões, data, lista de arquivos com SHA-256)
//!   - plu.db         (cópia consistente do SQLite obtida com VACUUM INTO)
//!   - attachments/…  (anexos e fotos de perfil)
//! Opcionalmente o ZIP inteiro é criptografado (AES-256-GCM, chave derivada da
//! senha do backup com Argon2id). Arquivo criptografado: cabeçalho "PLUENC1",
//! salt (16 bytes), nonce (12 bytes) e o conteúdo cifrado.

use crate::core::{audit, Core, Ctx};
use crate::error::{ApiError, ApiResult};
use crate::settings;
use crate::util::{self, now};
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::RngCore;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const FORMAT: &str = "personal-life-ultra-backup";
pub const FORMAT_VERSION: i64 = 1;
const ENC_MAGIC: &[u8] = b"PLUENC1";

fn require_installation_admin(conn: &Connection, ctx: &Ctx) -> ApiResult<()> {
    if settings::installation_admin(conn)?.as_deref() != Some(ctx.uid.as_str()) {
        return Err(ApiError::forbidden(
            "O backup completo contém os dados de todos os perfis e só pode ser feito pelo administrador da instalação. Use \"Exportar meus dados\" para uma cópia dos seus registros.",
        ));
    }
    Ok(())
}

fn derive_key(password: &str, salt: &[u8]) -> ApiResult<[u8; 32]> {
    let mut key = [0u8; 32];
    argon2::Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|_| ApiError::internal("Falha ao derivar a chave de criptografia."))?;
    Ok(key)
}

fn encrypt(data: &[u8], password: &str) -> ApiResult<Vec<u8>> {
    let mut salt = [0u8; 16];
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce);
    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| ApiError::internal("Chave inválida."))?;
    let ct = cipher.encrypt(Nonce::from_slice(&nonce), data).map_err(|_| ApiError::internal("Falha ao criptografar o backup."))?;
    let mut out = ENC_MAGIC.to_vec();
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ct);
    Ok(out)
}

fn decrypt(data: &[u8], password: Option<&str>) -> ApiResult<Vec<u8>> {
    if !data.starts_with(ENC_MAGIC) {
        return Ok(data.to_vec());
    }
    let Some(pw) = password.filter(|p| !p.is_empty()) else {
        return Err(ApiError::new("password_required", "Este backup é protegido por senha. Informe a senha do backup."));
    };
    if data.len() < ENC_MAGIC.len() + 28 {
        return Err(ApiError::bad_request("Arquivo de backup incompleto."));
    }
    let salt = &data[ENC_MAGIC.len()..ENC_MAGIC.len() + 16];
    let nonce = &data[ENC_MAGIC.len() + 16..ENC_MAGIC.len() + 28];
    let key = derive_key(pw, salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| ApiError::internal("Chave inválida."))?;
    cipher
        .decrypt(Nonce::from_slice(nonce), &data[ENC_MAGIC.len() + 28..])
        .map_err(|_| ApiError::validation("password", "Senha do backup incorreta ou arquivo corrompido."))
}

fn walk(dir: &Path, base: &Path, out: &mut Vec<(String, PathBuf)>) -> ApiResult<()> {
    if !dir.exists() {
        return Ok(());
    }
    for e in std::fs::read_dir(dir)? {
        let e = e?;
        let p = e.path();
        if p.is_dir() {
            walk(&p, base, out)?;
        } else {
            let rel = p.strip_prefix(base).unwrap().to_string_lossy().replace('\\', "/");
            out.push((rel, p));
        }
    }
    Ok(())
}

/// Gera os bytes de um backup completo.
pub fn build(core: &Core, conn: &Connection, password: Option<&str>) -> ApiResult<(Vec<u8>, Value)> {
    let tmp = core.data_dir.join(format!("backups/.tmp-{}.db", util::new_id()));
    let _ = std::fs::remove_file(&tmp);
    conn.execute("VACUUM INTO ?1", params![tmp.to_string_lossy()])?;
    let db_bytes = std::fs::read(&tmp);
    let _ = std::fs::remove_file(&tmp);
    let db_bytes = db_bytes?;
    let mut files: Vec<(String, PathBuf)> = Vec::new();
    walk(&core.attachments_dir(), &core.data_dir, &mut files)?;

    let mut list = vec![json!({"path": "plu.db", "size": db_bytes.len(), "sha256": hex::encode(Sha256::digest(&db_bytes))})];
    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let mut zw = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zw.start_file("plu.db", opts)?;
        zw.write_all(&db_bytes)?;
        for (rel, full) in &files {
            let bytes = std::fs::read(full)?;
            list.push(json!({"path": rel, "size": bytes.len(), "sha256": hex::encode(Sha256::digest(&bytes))}));
            zw.start_file(rel.as_str(), opts)?;
            zw.write_all(&bytes)?;
        }
        let users: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))?;
        let manifest = json!({
            "format": FORMAT, "format_version": FORMAT_VERSION, "app_version": crate::core::APP_VERSION,
            "schema_version": crate::db::current_version(conn)?, "created_at": now(), "profiles": users,
            "encrypted": password.is_some(), "files": list,
        });
        zw.start_file("manifest.json", opts)?;
        zw.write_all(serde_json::to_string_pretty(&manifest)?.as_bytes())?;
        zw.finish()?;
    }
    let zip_bytes = buf.into_inner();
    let manifest = inspect_zip(&zip_bytes)?;
    let out = match password {
        Some(p) => encrypt(&zip_bytes, p)?,
        None => zip_bytes,
    };
    Ok((out, manifest))
}

/// Lê e valida o manifesto e os hashes de todos os arquivos de um ZIP de backup.
pub fn inspect_zip(zip_bytes: &[u8]) -> ApiResult<Value> {
    let mut za = zip::ZipArchive::new(std::io::Cursor::new(zip_bytes))?;
    let manifest: Value = {
        let mut f = za.by_name("manifest.json").map_err(|_| ApiError::bad_request("Backup sem manifesto: arquivo inválido ou incompleto."))?;
        let mut s = String::new();
        f.read_to_string(&mut s)?;
        serde_json::from_str(&s)?
    };
    if manifest["format"] != FORMAT {
        return Err(ApiError::bad_request("O arquivo não é um backup do PERSONAL LIFE ULTRA."));
    }
    if manifest["format_version"].as_i64().unwrap_or(0) > FORMAT_VERSION {
        return Err(ApiError::bad_request("Backup criado por uma versão mais nova do aplicativo. Atualize o aplicativo para restaurá-lo."));
    }
    if manifest["schema_version"].as_i64().unwrap_or(0) > crate::db::schema_version_latest() {
        return Err(ApiError::bad_request("O banco de dados do backup é de uma versão mais nova do aplicativo."));
    }
    let files = manifest["files"].as_array().ok_or_else(|| ApiError::bad_request("Manifesto inválido."))?;
    if !files.iter().any(|f| f["path"] == "plu.db") {
        return Err(ApiError::bad_request("Backup sem banco de dados."));
    }
    for f in files {
        let path = f["path"].as_str().unwrap_or_default();
        if path.contains("..") || path.starts_with('/') || path.contains('\\') {
            return Err(ApiError::bad_request("Backup com caminho de arquivo inválido."));
        }
        let mut entry = za.by_name(path).map_err(|_| ApiError::bad_request(format!("Backup incompleto: falta {path}.")))?;
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes)?;
        if hex::encode(Sha256::digest(&bytes)) != f["sha256"].as_str().unwrap_or_default() {
            return Err(ApiError::bad_request(format!("Falha de integridade no arquivo {path}.")));
        }
    }
    Ok(manifest)
}

fn default_folder(core: &Core, conn: &Connection) -> ApiResult<PathBuf> {
    Ok(settings::app_get(conn, "backup_folder")?.map(PathBuf::from).unwrap_or_else(|| core.data_dir.join("backups")))
}

fn write_file(path: &Path, bytes: &[u8]) -> ApiResult<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    // grava em arquivo temporário e renomeia: evita backups incompletos
    let tmp = path.with_extension("partial");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

pub fn create(core: &Core, conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    require_installation_admin(conn, ctx)?;
    let password = util::arg_opt_str(args, "password");
    if let Some(p) = password {
        if p.chars().count() < 8 {
            return Err(ApiError::validation("password", "A senha do backup deve ter pelo menos 8 caracteres."));
        }
        if Some(p) != util::arg_opt_str(args, "password_confirm") {
            return Err(ApiError::validation("password_confirm", "As senhas do backup não conferem."));
        }
    }
    let (bytes, manifest) = build(core, conn, password)?;
    let path = match util::arg_opt_str(args, "path") {
        Some(p) => PathBuf::from(p),
        None => default_folder(core, conn)?.join(format!("PersonalLifeUltra-{}.pluback", now().replace([':', 'T'], "-"))),
    };
    write_file(&path, &bytes)?;
    // verificação após gravar
    let written = std::fs::read(&path)?;
    let check = decrypt(&written, password).and_then(|z| inspect_zip(&z));
    if let Err(e) = check {
        let _ = std::fs::remove_file(&path);
        return Err(ApiError::internal(format!("O backup gravado não passou na verificação: {}", e.message)));
    }
    settings::app_set(conn, "last_backup_at", &now())?;
    settings::app_set(conn, "last_backup_path", &path.to_string_lossy())?;
    audit(conn, Some(&ctx.uid), None, "backup", None, None, Some(json!({"criptografado": password.is_some(), "arquivos": manifest["files"].as_array().map(|a| a.len())})));
    crate::logger::info("backup criado");
    Ok(json!({ "ok": true, "path": path.to_string_lossy(), "size": bytes.len(), "encrypted": password.is_some(), "manifest": manifest }))
}

pub fn verify(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let _ = conn;
    let _ = ctx;
    let path = util::arg_str(args, "path")?;
    let bytes = std::fs::read(path).map_err(|_| ApiError::validation("path", "Não foi possível ler o arquivo selecionado."))?;
    let encrypted = bytes.starts_with(ENC_MAGIC);
    let zip = decrypt(&bytes, util::arg_opt_str(args, "password"))?;
    let manifest = inspect_zip(&zip)?;
    Ok(json!({ "ok": true, "encrypted": encrypted, "manifest": manifest }))
}

/// Restaura um backup completo. Antes, cria automaticamente um backup de segurança dos dados atuais.
pub fn restore(core: &Core, conn_guard: &mut Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    require_installation_admin(conn_guard, ctx)?;
    if !util::arg_bool(args, "confirm") {
        return Err(ApiError::bad_request("Confirme que deseja substituir os dados atuais."));
    }
    crate::auth::verify(conn_guard, &ctx.uid, &json!({"password": args.get("account_password").cloned().unwrap_or(Value::Null)}))
        .map_err(|_| ApiError::validation("account_password", "Confirme com a senha do seu perfil."))?;
    let path = util::arg_str(args, "path")?;
    let bytes = std::fs::read(path).map_err(|_| ApiError::validation("path", "Não foi possível ler o arquivo selecionado."))?;
    let zip_bytes = decrypt(&bytes, util::arg_opt_str(args, "password"))?;
    let manifest = inspect_zip(&zip_bytes)?;

    // 1) backup de segurança do estado atual
    let (safety, _) = build(core, conn_guard, None)?;
    let safety_path = core.data_dir.join("backups").join(format!("antes-da-restauracao-{}.pluback", now().replace([':', 'T'], "-")));
    write_file(&safety_path, &safety)?;

    // 2) extrai para diretório temporário
    let staging = core.data_dir.join(format!("restore-staging-{}", util::new_id()));
    std::fs::create_dir_all(&staging)?;
    let res = (|| -> ApiResult<()> {
        let mut za = zip::ZipArchive::new(std::io::Cursor::new(&zip_bytes))?;
        for i in 0..za.len() {
            let mut f = za.by_index(i)?;
            let Some(name) = f.enclosed_name() else { return Err(ApiError::bad_request("Caminho inválido no backup.")) };
            if f.is_dir() {
                continue;
            }
            let out = staging.join(name);
            std::fs::create_dir_all(out.parent().unwrap())?;
            let mut w = std::fs::File::create(&out)?;
            std::io::copy(&mut f, &mut w)?;
        }
        // valida o banco extraído
        let test = Connection::open(staging.join("plu.db"))?;
        let ok: String = test.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
        if ok != "ok" {
            return Err(ApiError::bad_request("O banco de dados do backup está corrompido."));
        }
        Ok(())
    })();
    if let Err(e) = res {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(e);
    }

    // 3) troca os arquivos: fecha a conexão atual
    let placeholder = Connection::open_in_memory()?;
    let old = std::mem::replace(conn_guard, placeholder);
    drop(old);
    let db = core.db_path();
    let swap = (|| -> ApiResult<()> {
        let old_dir = core.data_dir.join(format!("replaced-{}", util::new_id()));
        std::fs::create_dir_all(&old_dir)?;
        for ext in ["", "-wal", "-shm"] {
            let p = PathBuf::from(format!("{}{}", db.to_string_lossy(), ext));
            if p.exists() {
                std::fs::rename(&p, old_dir.join(format!("plu.db{ext}")))?;
            }
        }
        let att = core.attachments_dir();
        if att.exists() {
            std::fs::rename(&att, old_dir.join("attachments"))?;
        }
        std::fs::rename(staging.join("plu.db"), &db)?;
        if staging.join("attachments").exists() {
            std::fs::rename(staging.join("attachments"), &att)?;
        } else {
            std::fs::create_dir_all(&att)?;
        }
        let _ = std::fs::remove_dir_all(&old_dir);
        Ok(())
    })();
    let _ = std::fs::remove_dir_all(&staging);
    // 4) reabre (aplicando migrações, se o backup for de esquema anterior)
    match crate::db::open(&db) {
        Ok(c) => *conn_guard = c,
        Err(e) => {
            crate::logger::error(&format!("falha ao reabrir após restauração: {e}"));
            return Err(ApiError::internal(format!("Falha ao abrir o banco restaurado. Um backup de segurança foi salvo em {}", safety_path.to_string_lossy())));
        }
    }
    swap?;
    *core.session.lock().unwrap() = None;
    audit(conn_guard, None, None, "restauracao", None, None, Some(json!({"backup_criado_em": manifest["created_at"]})));
    crate::logger::info("backup restaurado");
    Ok(json!({ "ok": true, "safety_backup": safety_path.to_string_lossy(), "manifest": manifest }))
}

pub fn status(core: &Core, conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    let admin = settings::installation_admin(conn)?;
    let folder = default_folder(core, conn)?;
    let mut recent = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&folder) {
        let mut v: Vec<(String, u64, String)> = rd
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map(|x| x == "pluback").unwrap_or(false))
            .filter_map(|e| {
                let m = e.metadata().ok()?;
                let modified: chrono::DateTime<chrono::Local> = m.modified().ok()?.into();
                Some((e.path().to_string_lossy().to_string(), m.len(), modified.format("%Y-%m-%dT%H:%M:%S").to_string()))
            })
            .collect();
        v.sort_by(|a, b| b.2.cmp(&a.2));
        recent = v.into_iter().take(15).map(|(p, s, m)| json!({"path": p, "size": s, "modified_at": m})).collect();
    }
    Ok(json!({
        "is_installation_admin": admin.as_deref() == Some(ctx.uid.as_str()),
        "last_backup_at": settings::app_get(conn, "last_backup_at")?,
        "last_backup_path": settings::app_get(conn, "last_backup_path")?,
        "folder": folder.to_string_lossy(),
        "auto_enabled": settings::app_get(conn, "backup_auto")?.as_deref() == Some("1"),
        "auto_interval_days": settings::app_get(conn, "backup_interval_days")?.and_then(|s| s.parse::<i64>().ok()).unwrap_or(7),
        "auto_keep": settings::app_get(conn, "backup_keep")?.and_then(|s| s.parse::<i64>().ok()).unwrap_or(10),
        "data_dir": core.data_dir.to_string_lossy(),
        "recent": recent,
    }))
}

pub fn configure(core: &Core, conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    require_installation_admin(conn, ctx)?;
    if let Some(f) = args.get("folder") {
        match f.as_str().filter(|s| !s.trim().is_empty()) {
            Some(folder) => {
                let p = PathBuf::from(folder);
                std::fs::create_dir_all(&p).map_err(|_| ApiError::validation("folder", "Não foi possível usar esta pasta."))?;
                let probe = p.join(".plu-write-test");
                std::fs::write(&probe, b"ok").map_err(|_| ApiError::validation("folder", "Sem permissão de escrita nesta pasta."))?;
                let _ = std::fs::remove_file(probe);
                settings::app_set(conn, "backup_folder", folder)?;
            }
            None => {
                conn.execute("DELETE FROM app_settings WHERE key = 'backup_folder'", [])?;
            }
        }
    }
    if let Some(a) = args.get("auto_enabled").and_then(|v| v.as_bool()) {
        settings::app_set(conn, "backup_auto", if a { "1" } else { "0" })?;
    }
    if let Some(n) = util::arg_i64(args, "auto_interval_days") {
        if !(1..=90).contains(&n) {
            return Err(ApiError::validation("auto_interval_days", "Use um intervalo entre 1 e 90 dias."));
        }
        settings::app_set(conn, "backup_interval_days", &n.to_string())?;
    }
    if let Some(n) = util::arg_i64(args, "auto_keep") {
        if !(1..=100).contains(&n) {
            return Err(ApiError::validation("auto_keep", "Mantenha entre 1 e 100 backups."));
        }
        settings::app_set(conn, "backup_keep", &n.to_string())?;
    }
    audit(conn, Some(&ctx.uid), None, "configurar_backup", None, None, None);
    status(core, conn, ctx)
}

/// Executa o backup automático se estiver habilitado e vencido. Chamado periodicamente.
pub fn auto_tick(core: &Core, conn: &Connection) -> ApiResult<Option<String>> {
    if settings::app_get(conn, "backup_auto")?.as_deref() != Some("1") {
        return Ok(None);
    }
    let interval = settings::app_get(conn, "backup_interval_days")?.and_then(|s| s.parse::<i64>().ok()).unwrap_or(7);
    let due = match settings::app_get(conn, "last_backup_at")?.and_then(|s| util::parse_datetime(&s)) {
        Some(last) => util::now_naive() - last >= chrono::Duration::days(interval),
        None => true,
    };
    if !due {
        return Ok(None);
    }
    let (bytes, _) = build(core, conn, None)?;
    let folder = default_folder(core, conn)?;
    let path = folder.join(format!("PersonalLifeUltra-auto-{}.pluback", now().replace([':', 'T'], "-")));
    write_file(&path, &bytes)?;
    settings::app_set(conn, "last_backup_at", &now())?;
    settings::app_set(conn, "last_backup_path", &path.to_string_lossy())?;
    // retenção: remove apenas backups automáticos antigos
    let keep = settings::app_get(conn, "backup_keep")?.and_then(|s| s.parse::<usize>().ok()).unwrap_or(10);
    if let Ok(rd) = std::fs::read_dir(&folder) {
        let mut autos: Vec<PathBuf> = rd.filter_map(|e| e.ok()).map(|e| e.path())
            .filter(|p| p.file_name().map(|n| n.to_string_lossy().starts_with("PersonalLifeUltra-auto-")).unwrap_or(false)).collect();
        autos.sort();
        while autos.len() > keep {
            let _ = std::fs::remove_file(autos.remove(0));
        }
    }
    audit(conn, None, None, "backup_automatico", None, None, None);
    Ok(Some(path.to_string_lossy().to_string()))
}

/// Exporta uma cópia dos dados do próprio usuário (JSON + anexos) — disponível a todos os perfis.
pub fn export_my_data(core: &Core, conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let mut data = serde_json::Map::new();
    let mut files: Vec<(String, PathBuf)> = Vec::new();
    for d in crate::entities::ENTITIES.iter() {
        let mut p = vec![rusqlite::types::Value::Text(ctx.uid.clone())];
        let mut sql = format!("SELECT * FROM {} WHERE owner_id = ? AND scope = 'personal'", d.table);
        if let Some(m) = d.module {
            sql.push_str(" AND module = ?");
            p.push(rusqlite::types::Value::Text(m.into()));
        }
        let rows = crate::entities::query_rows(conn, d, &sql, &p)?;
        if !rows.is_empty() {
            data.insert(d.name.to_string(), json!(rows));
        }
    }
    let mut st = conn.prepare("SELECT habit_id, log_date, note FROM habit_logs WHERE user_id = ?1")?;
    let logs: Vec<Value> = st.query_map(params![ctx.uid], |r| Ok(json!({"habit_id": r.get::<_, String>(0)?, "date": r.get::<_, String>(1)?, "note": r.get::<_, Option<String>>(2)?})))?.collect::<Result<_, _>>()?;
    data.insert("habit_logs".into(), json!(logs));
    let mut st = conn.prepare("SELECT stored_path, file_name, entity, record_id FROM attachments WHERE owner_id = ?1")?;
    let att: Vec<(String, String, String, String)> = st.query_map(params![ctx.uid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?.collect::<Result<_, _>>()?;
    for (rel, _, _, _) in &att {
        files.push((rel.clone(), core.data_dir.join(rel)));
    }
    data.insert("attachments".into(), json!(att.iter().map(|(p, n, e, r)| json!({"path": p, "file_name": n, "entity": e, "record_id": r})).collect::<Vec<_>>()));
    let profile = crate::auth::public_user(core, conn, &ctx.uid)?;
    let export = json!({"format": "personal-life-ultra-export", "version": 1, "created_at": now(), "profile": {"id": profile["id"], "username": profile["username"], "full_name": profile["full_name"]}, "data": data});

    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let mut zw = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::SimpleFileOptions::default();
        zw.start_file("dados.json", opts)?;
        zw.write_all(serde_json::to_string_pretty(&export)?.as_bytes())?;
        for (rel, full) in files {
            if let Ok(bytes) = std::fs::read(&full) {
                zw.start_file(rel, opts)?;
                zw.write_all(&bytes)?;
            }
        }
        zw.finish()?;
    }
    let path = match util::arg_opt_str(args, "path") {
        Some(p) => PathBuf::from(p),
        None => core.data_dir.join("exports").join(format!("meus-dados-{}.zip", now().replace([':', 'T'], "-"))),
    };
    write_file(&path, &buf.into_inner())?;
    audit(conn, Some(&ctx.uid), None, "exportar_dados", None, None, None);
    Ok(json!({ "ok": true, "path": path.to_string_lossy() }))
}
