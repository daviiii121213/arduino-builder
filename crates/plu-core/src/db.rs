//! Abertura do banco SQLite, configuração (PRAGMAs), funções SQL próprias e migrações versionadas.

use crate::error::ApiResult;
use rusqlite::functions::FunctionFlags;
use rusqlite::{params, Connection};
use std::path::Path;

/// Migrações em ordem. Nunca altere uma migração já publicada: crie uma nova.
pub const MIGRATIONS: &[(i64, &str, &str)] = &[
    (1, "esquema inicial", include_str!("../migrations/001_init.sql")),
];

pub fn schema_version_latest() -> i64 {
    MIGRATIONS.last().map(|m| m.0).unwrap_or(0)
}

pub fn open(path: &Path) -> ApiResult<Connection> {
    let conn = Connection::open(path)?;
    configure(&conn)?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn open_in_memory() -> ApiResult<Connection> {
    let conn = Connection::open_in_memory()?;
    configure(&conn)?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn configure(conn: &Connection) -> ApiResult<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA busy_timeout = 5000;",
    )?;
    configure_functions(conn)
}

pub fn configure_functions(conn: &Connection) -> ApiResult<()> {
    // plu_norm(texto): minúsculas e sem acentos, para pesquisa tolerante.
    conn.create_scalar_function(
        "plu_norm",
        1,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| {
            let v: Option<String> = ctx.get(0)?;
            Ok(v.map(|s| crate::util::normalize(&s)))
        },
    )?;
    Ok(())
}

pub fn current_version(conn: &Connection) -> ApiResult<i64> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )?;
    let v: Option<i64> =
        conn.query_row("SELECT MAX(version) FROM schema_migrations", [], |r| r.get(0))?;
    Ok(v.unwrap_or(0))
}

/// Aplica as migrações pendentes, cada uma em sua própria transação.
pub fn migrate(conn: &Connection) -> ApiResult<()> {
    let current = current_version(conn)?;
    for (version, desc, sql) in MIGRATIONS {
        if *version <= current {
            continue;
        }
        conn.execute_batch("BEGIN IMMEDIATE;")?;
        let res = conn.execute_batch(sql).and_then(|_| {
            conn.execute(
                "INSERT INTO schema_migrations (version, description, applied_at) VALUES (?1, ?2, ?3)",
                params![version, desc, crate::util::now()],
            )
            .map(|_| ())
        });
        match res {
            Ok(()) => conn.execute_batch("COMMIT;")?,
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                crate::logger::error(&format!("migração {version} falhou: {e}"));
                return Err(e.into());
            }
        }
        crate::logger::info(&format!("migração {version} aplicada ({desc})"));
    }
    Ok(())
}

/// Executa `f` dentro de uma transação. Reverte em caso de erro.
pub fn tx<T>(conn: &Connection, f: impl FnOnce(&Connection) -> ApiResult<T>) -> ApiResult<T> {
    conn.execute_batch("SAVEPOINT plu_tx;")?;
    match f(conn) {
        Ok(v) => {
            conn.execute_batch("RELEASE plu_tx;")?;
            Ok(v)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK TO plu_tx; RELEASE plu_tx;");
            Err(e)
        }
    }
}
