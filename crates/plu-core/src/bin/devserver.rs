//! Servidor HTTP local usado SOMENTE em desenvolvimento e testes automatizados
//! (interface no navegador + núcleo real). Não faz parte do aplicativo instalado.
//! Escuta apenas em 127.0.0.1.

use plu_core::Core;
use serde_json::{json, Value};
use std::sync::Arc;

fn main() {
    let dir = std::env::args().nth(1).unwrap_or_else(|| "./.devdata".into());
    let port = std::env::var("PLU_DEV_PORT").unwrap_or_else(|_| "1430".into());
    let core = Arc::new(Core::open(std::path::Path::new(&dir)).expect("falha ao abrir dados"));
    let server = tiny_http::Server::http(format!("127.0.0.1:{port}")).expect("porta indisponível");
    println!("plu-devserver em http://127.0.0.1:{port} (dados: {dir})");
    {
        let c = core.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_secs(20));
            let _ = c.tick();
        });
    }
    let cors = [
        tiny_http::Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap(),
        tiny_http::Header::from_bytes("Access-Control-Allow-Headers", "content-type").unwrap(),
        tiny_http::Header::from_bytes("Content-Type", "application/json; charset=utf-8").unwrap(),
    ];
    for mut req in server.incoming_requests() {
        if req.method() == &tiny_http::Method::Options {
            let mut r = tiny_http::Response::empty(204);
            for h in &cors { r.add_header(h.clone()); }
            let _ = req.respond(r);
            continue;
        }
        let mut body = String::new();
        let _ = req.as_reader().read_to_string(&mut body);
        let parsed: Value = serde_json::from_str(&body).unwrap_or(json!({}));
        let cmd = parsed["cmd"].as_str().unwrap_or("").to_string();
        let out = if cmd == "__tick" {
            json!({"ok": true, "data": core.tick()})
        } else {
            match core.call(&cmd, parsed["args"].clone()) {
                Ok(v) => json!({"ok": true, "data": v}),
                Err(e) => json!({"ok": false, "error": e}),
            }
        };
        let mut r = tiny_http::Response::from_string(out.to_string());
        for h in &cors { r.add_header(h.clone()); }
        let _ = req.respond(r);
    }
}
