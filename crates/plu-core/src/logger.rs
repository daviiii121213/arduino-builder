//! Log local simples em arquivo, com rotação por tamanho.
//! Não registre senhas, códigos de convite completos ou conteúdo privado.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

static LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
const MAX_SIZE: u64 = 2 * 1024 * 1024;

pub fn init(dir: PathBuf) {
    let _ = fs::create_dir_all(&dir);
    *LOG_PATH.lock().unwrap() = Some(dir.join("app.log"));
}

fn write(level: &str, msg: &str) {
    let guard = LOG_PATH.lock().unwrap();
    let Some(path) = guard.as_ref() else {
        return;
    };
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > MAX_SIZE {
            let _ = fs::rename(path, path.with_extension("log.1"));
        }
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{} [{}] {}", crate::util::now(), level, msg.replace('\n', " "));
    }
}

pub fn info(msg: &str) {
    write("INFO", msg);
}
pub fn warn(msg: &str) {
    write("WARN", msg);
}
pub fn error(msg: &str) {
    write("ERROR", msg);
}
