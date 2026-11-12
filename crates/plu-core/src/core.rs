//! Estado central do aplicativo: conexão SQLite, sessão do perfil atual e contexto de permissões.

use crate::error::{ApiError, ApiResult};
use crate::perms;
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use web_time::Instant;

pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const MAX_PROFILES: i64 = 6;
pub const MAX_FAMILY_MEMBERS: i64 = 6;

pub struct Session {
    pub user_id: String,
    pub locked: bool,
    pub last_activity: Instant,
}

pub struct Core {
    pub data_dir: PathBuf,
    pub(crate) conn: Mutex<Connection>,
    pub(crate) session: Mutex<Option<Session>>,
}

/// Contexto de família do usuário autenticado.
#[derive(Clone, Debug)]
pub struct FamilyCtx {
    pub id: String,
    pub role: String,
    pub admin_id: String,
    pub perms: HashSet<String>,
}

/// Contexto por chamada: quem é o usuário e qual família (se houver).
#[derive(Clone, Debug)]
pub struct Ctx {
    pub uid: String,
    pub family: Option<FamilyCtx>,
}

impl Ctx {
    pub fn family_id(&self) -> Option<&str> {
        self.family.as_ref().map(|f| f.id.as_str())
    }
    pub fn is_family_admin(&self) -> bool {
        self.family.as_ref().map(|f| f.role == "admin").unwrap_or(false)
    }
    pub fn can(&self, key: &str) -> bool {
        self.family.as_ref().map(|f| f.perms.contains(key)).unwrap_or(false)
    }
    pub fn require_family(&self) -> ApiResult<&FamilyCtx> {
        self.family.as_ref().ok_or_else(|| {
            ApiError::forbidden("Você ainda não participa de uma família. Crie ou entre em uma família primeiro.")
        })
    }
    pub fn require(&self, key: &str) -> ApiResult<()> {
        self.require_family()?;
        if self.can(key) {
            Ok(())
        } else {
            Err(ApiError::forbidden(format!(
                "Você não tem permissão para esta ação na família ({key})."
            )))
        }
    }
}

impl Core {
    /// Abre (ou cria) o banco no diretório de dados informado.
    pub fn open(data_dir: &Path) -> ApiResult<Core> {
        std::fs::create_dir_all(data_dir)?;
        std::fs::create_dir_all(data_dir.join("attachments"))?;
        std::fs::create_dir_all(data_dir.join("backups"))?;
        crate::logger::init(data_dir.join("logs"));
        crate::logger::info(&format!("iniciando PERSONAL LIFE ULTRA {APP_VERSION}"));
        let conn = crate::db::open(&data_dir.join("plu.db"))?;
        Ok(Core { data_dir: data_dir.to_path_buf(), conn: Mutex::new(conn), session: Mutex::new(None) })
    }

    /// Abre um banco em memória (versão web): opcionalmente restaurado a partir de bytes
    /// serializados do SQLite. Não usa o sistema de arquivos.
    pub fn open_memory(bytes: Option<&[u8]>) -> ApiResult<Core> {
        let mut conn = Connection::open_in_memory()?;
        if let Some(b) = bytes.filter(|b| !b.is_empty()) {
            conn.deserialize_read_exact(rusqlite::MAIN_DB, b, b.len(), false)?;
        }
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        crate::db::configure_functions(&conn)?;
        crate::db::migrate(&conn)?;
        Ok(Core { data_dir: PathBuf::from("/plu"), conn: Mutex::new(conn), session: Mutex::new(None) })
    }

    /// Bytes do banco atual (para guardar no navegador).
    pub fn export_db(&self) -> ApiResult<Vec<u8>> {
        let mut conn = self.conn.lock().unwrap();
        Ok(conn.serialize(rusqlite::MAIN_DB)?.to_vec())
    }

    pub fn db_path(&self) -> PathBuf {
        self.data_dir.join("plu.db")
    }

    pub fn attachments_dir(&self) -> PathBuf {
        self.data_dir.join("attachments")
    }

    pub fn current_user(&self) -> Option<String> {
        self.session.lock().unwrap().as_ref().map(|s| s.user_id.clone())
    }

    /// Retorna o id do usuário com sessão ativa e desbloqueada.
    pub(crate) fn require_user(&self) -> ApiResult<String> {
        let mut guard = self.session.lock().unwrap();
        match guard.as_mut() {
            None => Err(ApiError::unauthenticated()),
            Some(s) if s.locked => Err(ApiError::new("locked", "O perfil está bloqueado. Digite sua senha para continuar.")),
            Some(s) => {
                s.last_activity = Instant::now();
                Ok(s.user_id.clone())
            }
        }
    }
}

/// Monta o contexto de família e permissões efetivas do usuário.
pub fn load_ctx(conn: &Connection, uid: &str) -> ApiResult<Ctx> {
    let fam: Option<(String, String, String)> = conn
        .query_row(
            "SELECT m.family_id, m.role, f.admin_id FROM family_members m
             JOIN families f ON f.id = m.family_id WHERE m.user_id = ?1",
            params![uid],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let family = match fam {
        None => None,
        Some((fid, role, admin_id)) => {
            let mut set: HashSet<String> = HashSet::new();
            let mut overrides: Vec<(String, bool)> = Vec::new();
            if role == "personalizado" {
                let mut st = conn.prepare(
                    "SELECT perm_key, allowed FROM permissions WHERE family_id = ?1 AND user_id = ?2",
                )?;
                let rows = st.query_map(params![fid, uid], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0)))?;
                for r in rows {
                    overrides.push(r?);
                }
            }
            for k in perms::all_keys() {
                let mut allowed = perms::default_allowed(&role, &k);
                if let Some((_, a)) = overrides.iter().find(|(ok, _)| ok == &k) {
                    allowed = *a;
                }
                if allowed {
                    set.insert(k);
                }
            }
            Some(FamilyCtx { id: fid, role, admin_id, perms: set })
        }
    };
    Ok(Ctx { uid: uid.to_string(), family })
}

pub fn audit(
    conn: &Connection,
    uid: Option<&str>,
    family_id: Option<&str>,
    action: &str,
    entity: Option<&str>,
    record_id: Option<&str>,
    details: Option<serde_json::Value>,
) {
    let res = conn.execute(
        "INSERT INTO audit_logs (id, user_id, family_id, action, entity, record_id, details, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            crate::util::new_id(),
            uid,
            family_id,
            action,
            entity,
            record_id,
            details.map(|d| d.to_string()),
            crate::util::now()
        ],
    );
    if let Err(e) = res {
        crate::logger::warn(&format!("falha ao registrar auditoria: {e}"));
    }
}
