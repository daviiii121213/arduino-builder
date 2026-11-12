//! Ponte WebAssembly: executa o MESMO núcleo Rust (SQLite real em memória) dentro do navegador.
//! A persistência é feita pela página, gravando os bytes do banco no armazenamento do navegador.

use plu_core::Core;
use serde_json::{json, Value};
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

thread_local! {
    static CORE: RefCell<Option<Core>> = const { RefCell::new(None) };
}

#[wasm_bindgen]
pub fn init(bytes: Option<Vec<u8>>) -> Result<(), JsValue> {
    let core = Core::open_memory(bytes.as_deref()).map_err(|e| JsValue::from_str(&e.message))?;
    CORE.with(|c| *c.borrow_mut() = Some(core));
    Ok(())
}

#[wasm_bindgen]
pub fn call(cmd: &str, args: &str) -> String {
    let args: Value = serde_json::from_str(args).unwrap_or(Value::Null);
    CORE.with(|c| match c.borrow().as_ref() {
        None => json!({"ok": false, "error": {"code": "internal", "message": "Núcleo não iniciado."}}),
        Some(core) => {
            if cmd == "__tick" {
                return json!({"ok": true, "data": core.tick()});
            }
            match core.call(cmd, args) {
                Ok(v) => json!({"ok": true, "data": v}),
                Err(e) => json!({"ok": false, "error": e}),
            }
        }
    })
    .to_string()
}

#[wasm_bindgen]
pub fn export_db() -> Vec<u8> {
    CORE.with(|c| c.borrow().as_ref().and_then(|core| core.export_db().ok()).unwrap_or_default())
}
