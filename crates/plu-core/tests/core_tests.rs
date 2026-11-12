//! Testes de integração do núcleo: executam operações reais em um banco SQLite temporário.

use plu_core::Core;
use serde_json::{json, Value};
use std::path::Path;

fn ok(core: &Core, cmd: &str, args: Value) -> Value {
    match core.call(cmd, args.clone()) {
        Ok(v) => v,
        Err(e) => panic!("{cmd} falhou: {e:?} (args {args})"),
    }
}

fn err(core: &Core, cmd: &str, args: Value) -> plu_core::ApiError {
    match core.call(cmd, args) {
        Ok(v) => panic!("{cmd} deveria falhar, retornou {v}"),
        Err(e) => e,
    }
}

fn register(core: &Core, user: &str, name: &str) -> String {
    let r = ok(core, "auth.register", json!({"full_name": name, "username": user, "password": "senha1234", "password_confirm": "senha1234"}));
    r["user"]["id"].as_str().unwrap().to_string()
}

fn login(core: &Core, user: &str) {
    ok(core, "auth.login", json!({"username": user, "password": "senha1234"}));
}

fn setup(dir: &Path) -> (Core, String, String) {
    let core = Core::open(dir).unwrap();
    let a = register(&core, "ana", "Ana Souza");
    let b = register(&core, "bruno", "Bruno Lima");
    (core, a, b)
}

#[test]
fn registration_and_login() {
    let dir = tempfile::tempdir().unwrap();
    let core = Core::open(dir.path()).unwrap();
    // primeiro cadastro inicia sessão
    let st = ok(&core, "app.status", json!({}));
    assert_eq!(st["users"], 0);
    let a = register(&core, "ana", "Ana Souza");
    assert!(ok(&core, "app.status", json!({}))["session"]["user_id"] == a.as_str());
    // validações
    let e = err(&core, "auth.register", json!({"full_name": "X Y", "username": "ANA", "password": "senha1234", "password_confirm": "senha1234"}));
    assert_eq!(e.field.as_deref(), Some("username"));
    let e = err(&core, "auth.register", json!({"full_name": "X Y", "username": "xy", "password": "senha1234", "password_confirm": "senha1234"}));
    assert_eq!(e.field.as_deref(), Some("username"));
    let e = err(&core, "auth.register", json!({"full_name": "X Y", "username": "xyz", "password": "curta", "password_confirm": "curta"}));
    assert_eq!(e.field.as_deref(), Some("password"));
    let e = err(&core, "auth.register", json!({"full_name": "X Y", "username": "xyz", "password": "senha1234", "password_confirm": "senha12345"}));
    assert_eq!(e.field.as_deref(), Some("password_confirm"));
    // senha nunca em texto puro
    let db = rusqlite::Connection::open(dir.path().join("plu.db")).unwrap();
    let h: String = db.query_row("SELECT password_hash FROM users WHERE id = ?1", [&a], |r| r.get(0)).unwrap();
    assert!(h.starts_with("$argon2id$") && !h.contains("senha1234"));
    // logout / login
    ok(&core, "auth.logout", json!({}));
    assert_eq!(err(&core, "rec.list", json!({"entity": "tasks"})).code, "unauthenticated");
    // cadastro anônimo bloqueado após o primeiro perfil
    assert_eq!(err(&core, "auth.register", json!({"full_name": "Zé Silva", "username": "ze", "password": "senha1234", "password_confirm": "senha1234"})).code, "forbidden");
    let e = err(&core, "auth.login", json!({"username": "ana", "password": "errada123"}));
    assert_eq!(e.code, "invalid_credentials");
    login(&core, "ANA");
    // bloqueio de perfil
    ok(&core, "auth.lock", json!({}));
    assert_eq!(err(&core, "rec.list", json!({"entity": "tasks"})).code, "locked");
    assert!(core.call("auth.unlock", json!({"password": "nao"})).is_err());
    ok(&core, "auth.unlock", json!({"password": "senha1234"}));
    // alteração de senha
    ok(&core, "auth.change_password", json!({"current": "senha1234", "new": "novaSenha99", "confirm": "novaSenha99"}));
    ok(&core, "auth.logout", json!({}));
    assert!(core.call("auth.login", json!({"username": "ana", "password": "senha1234"})).is_err());
    ok(&core, "auth.login", json!({"username": "ana", "password": "novaSenha99"}));
}

#[test]
fn login_rate_limit() {
    let dir = tempfile::tempdir().unwrap();
    let core = Core::open(dir.path()).unwrap();
    register(&core, "ana", "Ana Souza");
    ok(&core, "auth.logout", json!({}));
    for _ in 0..5 {
        let _ = core.call("auth.login", json!({"username": "ana", "password": "x1234567"}));
    }
    let e = err(&core, "auth.login", json!({"username": "ana", "password": "senha1234"}));
    assert_eq!(e.code, "too_many_attempts");
}

#[test]
fn max_six_profiles() {
    let dir = tempfile::tempdir().unwrap();
    let core = Core::open(dir.path()).unwrap();
    register(&core, "user1", "Usuário Um");
    for i in 2..=6 {
        register(&core, &format!("user{i}"), &format!("Usuário {i}"));
    }
    let e = err(&core, "auth.register", json!({"full_name": "Sete", "username": "user7", "password": "senha1234", "password_confirm": "senha1234"}));
    assert_eq!(e.code, "conflict");
    assert_eq!(ok(&core, "auth.profiles", json!({}))["items"].as_array().unwrap().len(), 6);
}

#[test]
fn personal_data_isolation() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _a, _b) = setup(dir.path());
    // sessão atual: ana (primeiro cadastro)
    let t = ok(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "Pagar escola", "priority": 2}}));
    let tid = t["id"].as_str().unwrap().to_string();
    let n = ok(&core, "rec.create", json!({"entity": "diary", "values": {"title": "Dia 1", "body": "Texto privado"}}));
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    assert_eq!(ok(&core, "rec.list", json!({"entity": "tasks"}))["total"], 0);
    assert_eq!(ok(&core, "rec.list", json!({"entity": "diary"}))["total"], 0);
    assert_eq!(err(&core, "rec.get", json!({"entity": "tasks", "id": tid})).code, "forbidden");
    assert_eq!(err(&core, "rec.update", json!({"entity": "tasks", "id": tid, "values": {"title": "x"}})).code, "forbidden");
    assert_eq!(err(&core, "rec.delete", json!({"entity": "diary", "id": n["id"]})).code, "forbidden");
    let s = ok(&core, "search.query", json!({"q": "privado"}));
    assert_eq!(s["total"], 0);
    // família sem participação
    assert_eq!(err(&core, "rec.list", json!({"entity": "tasks", "scope": "family"})).code, "forbidden");
}

#[test]
fn crud_validation_trash_and_history() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _, _) = setup(dir.path());
    let e = err(&core, "rec.create", json!({"entity": "tasks", "values": {"priority": 2}}));
    assert_eq!(e.field.as_deref(), Some("title"));
    let e = err(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "x", "status": "invalido"}}));
    assert_eq!(e.field.as_deref(), Some("status"));
    let e = err(&core, "rec.create", json!({"entity": "transactions", "values": {"kind": "despesa", "title": "x", "amount": -5, "date": "2026-01-01"}}));
    assert_eq!(e.field.as_deref(), Some("amount"));
    let e = err(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "x", "evil; DROP TABLE users": 1}}));
    assert_eq!(e.code, "validation");
    let e = err(&core, "rec.list", json!({"entity": "tasks", "sort": "title; DROP TABLE users"}));
    assert_eq!(e.code, "bad_request");

    let t = ok(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "Estudar Rust", "due_date": "2026-02-10", "category": "Estudos"}}));
    let id = t["id"].as_str().unwrap();
    let s = ok(&core, "rec.create", json!({"entity": "subtasks", "values": {"task_id": id, "title": "Capítulo 1"}}));
    ok(&core, "rec.update", json!({"entity": "subtasks", "id": s["id"], "values": {"done": true}}));
    let got = ok(&core, "rec.get", json!({"entity": "tasks", "id": id}));
    assert_eq!(got["subtasks_total"], 1);
    assert_eq!(got["subtasks_done"], 1);
    let up = ok(&core, "rec.update", json!({"entity": "tasks", "id": id, "values": {"status": "concluida"}}));
    assert!(up["completed_at"].is_string());
    // pesquisa sem acento
    assert_eq!(ok(&core, "rec.list", json!({"entity": "tasks", "q": "ESTUDOS"}))["total"], 1);
    // lixeira
    ok(&core, "rec.delete", json!({"entity": "tasks", "id": id}));
    assert_eq!(ok(&core, "rec.list", json!({"entity": "tasks"}))["total"], 0);
    let trash = ok(&core, "rec.trash", json!({}));
    assert_eq!(trash["items"].as_array().unwrap().len(), 1);
    ok(&core, "rec.restore", json!({"entity": "tasks", "id": id}));
    assert_eq!(ok(&core, "rec.list", json!({"entity": "tasks"}))["total"], 1);
    ok(&core, "rec.delete", json!({"entity": "tasks", "id": id}));
    ok(&core, "rec.purge", json!({"entity": "tasks", "id": id}));
    assert!(core.call("rec.get", json!({"entity": "tasks", "id": id})).is_err());
    let h = ok(&core, "rec.trash", json!({}));
    assert_eq!(h["items"].as_array().unwrap().len(), 0);
}

#[test]
fn every_module_create_and_list() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _, _) = setup(dir.path());
    ok(&core, "family.create", json!({"name": "Família Souza"}));
    let schema = ok(&core, "schema", json!({}));
    let mut created: std::collections::HashMap<String, String> = Default::default();
    // primeiro pais, depois filhos
    let ents: Vec<Value> = schema["entities"].as_array().unwrap().clone();
    for pass in 0..2 {
        for e in &ents {
            let name = e["name"].as_str().unwrap();
            let parent = e["parent"].clone();
            if (pass == 0) != parent.is_null() {
                continue;
            }
            let scope = if e["scopes"] == "family" { "family" } else { "personal" };
            let mut values = serde_json::Map::new();
            for f in e["fields"].as_array().unwrap() {
                if f["required"] != true { continue; }
                let col = f["col"].as_str().unwrap();
                let kind = f["kind"].as_str().unwrap();
                let v = if Some(col) == parent["column"].as_str() {
                    json!(created[parent["entity"].as_str().unwrap()])
                } else if kind.starts_with("Enum") {
                    json!(if name == "transactions" { "despesa" } else { "x" })
                } else if kind == "Date" { json!("2026-03-01") } else if kind == "DateTime" { json!("2026-03-01T10:00") }
                else if kind.starts_with("Real") || kind.starts_with("Int") { json!(10) } else { json!(format!("Teste {name}")) };
                values.insert(col.into(), v);
            }
            if let Some(pc) = parent["column"].as_str() {
                values.insert(pc.into(), json!(created[parent["entity"].as_str().unwrap()]));
            }
            let r = ok(&core, "rec.create", json!({"entity": name, "scope": scope, "values": values}));
            created.insert(name.into(), r["id"].as_str().unwrap().into());
            let mut la = json!({"entity": name, "scope": scope});
            if let Some(pc) = parent["column"].as_str() {
                la["filters"] = json!({ pc: created[parent["entity"].as_str().unwrap()] });
            }
            let l = ok(&core, "rec.list", la);
            assert!(l["total"].as_i64().unwrap() >= 1, "lista vazia para {name}");
        }
    }
    assert_eq!(created.len(), ents.len());
}

#[test]
fn family_flow_permissions_and_sharing() {
    let dir = tempfile::tempdir().unwrap();
    let (core, ana, bruno) = setup(dir.path());
    // Ana cria a família
    let info = ok(&core, "family.create", json!({"name": "Família Souza"}));
    let fid = info["family"]["id"].as_str().unwrap().to_string();
    assert!(fid.starts_with("FAM-"));
    assert_ne!(fid, ana);
    // Bruno tenta entrar só com o FAMILY ID: vira solicitação pendente, sem acesso
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    let r = ok(&core, "family.request_join", json!({"family_id": fid}));
    assert!(r["family"].is_null());
    assert_eq!(err(&core, "rec.list", json!({"entity": "events", "scope": "family"})).code, "forbidden");
    // código errado não funciona
    assert!(core.call("family.accept_invite", json!({"code": "AAAA-BBBB"})).is_err());
    ok(&core, "auth.logout", json!({}));
    login(&core, "ana");
    let info = ok(&core, "family.info", json!({}));
    assert_eq!(info["requests"].as_array().unwrap().len(), 1);
    // Ana prefere convidar com código
    let inv = ok(&core, "family.invite", json!({"user_id": bruno}));
    let code = inv["code"].as_str().unwrap().to_string();
    assert_ne!(code, fid);
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    let info = ok(&core, "family.info", json!({}));
    assert_eq!(info["received_invitations"].as_array().unwrap().len(), 1);
    let info = ok(&core, "family.accept_invite", json!({"code": code.to_lowercase()}));
    assert_eq!(info["family"]["id"], fid.as_str());
    assert_eq!(info["family"]["my_role"], "integrante");
    // integrante não gerencia integrantes nem finanças por padrão
    assert_eq!(err(&core, "family.invite", json!({"user_id": ana})).code, "forbidden");
    assert_eq!(err(&core, "rec.create", json!({"entity": "transactions", "scope": "family", "values": {"kind": "despesa", "title": "x", "amount": 1, "date": "2026-01-01"}})).code, "forbidden");
    // cria evento familiar
    let ev = ok(&core, "rec.create", json!({"entity": "events", "scope": "family", "values": {"title": "Churrasco", "start_at": "2026-05-01T12:00"}}));
    // dado pessoal do Bruno não aparece na família
    let p = ok(&core, "rec.create", json!({"entity": "events", "values": {"title": "Consulta privada", "start_at": "2026-05-02T09:00"}}));
    ok(&core, "auth.logout", json!({}));
    login(&core, "ana");
    let fam_events = ok(&core, "rec.list", json!({"entity": "events", "scope": "family"}));
    assert_eq!(fam_events["total"], 1);
    assert_eq!(err(&core, "rec.get", json!({"entity": "events", "id": p["id"]})).code, "forbidden");
    // Ana (admin) pode editar evento do Bruno
    ok(&core, "rec.update", json!({"entity": "events", "id": ev["id"], "values": {"location": "Casa"}}));
    // compartilhamento explícito
    let mine = ok(&core, "rec.create", json!({"entity": "shopping_lists", "values": {"title": "Mercado"}}));
    ok(&core, "rec.create", json!({"entity": "shopping_items", "values": {"list_id": mine["id"], "title": "Arroz", "quantity": 2}}));
    let item2 = ok(&core, "rec.create", json!({"entity": "shopping_items", "values": {"list_id": mine["id"], "title": "Feijão"}}));
    ok(&core, "rec.share", json!({"entity": "shopping_lists", "id": mine["id"]}));
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    let fl = ok(&core, "rec.list", json!({"entity": "shopping_lists", "scope": "family"}));
    assert_eq!(fl["total"], 1);
    // Bruno pode marcar item comprado (colaboração), mas não renomear a lista
    ok(&core, "rec.update", json!({"entity": "shopping_items", "id": item2["id"], "values": {"bought": true}}));
    assert_eq!(err(&core, "rec.update", json!({"entity": "shopping_lists", "id": mine["id"], "values": {"title": "Outro"}})).code, "forbidden");
    // histórico
    let h = ok(&core, "rec.history", json!({"entity": "shopping_lists", "id": mine["id"]}));
    assert!(h["items"].as_array().unwrap().iter().any(|x| x["action"] == "compartilhar"));
    ok(&core, "auth.logout", json!({}));
    login(&core, "ana");
    ok(&core, "rec.unshare", json!({"entity": "shopping_lists", "id": mine["id"]}));
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    assert_eq!(ok(&core, "rec.list", json!({"entity": "shopping_lists", "scope": "family"}))["total"], 0);
    // permissões personalizadas: Ana remove a visão de finanças do Bruno
    ok(&core, "auth.logout", json!({}));
    login(&core, "ana");
    let mut perms: Vec<String> = Vec::new();
    for a in ["agenda", "tasks", "shopping", "home", "documents", "social", "memories", "goals", "reports"] {
        perms.push(format!("{a}.view"));
        perms.push(format!("{a}.create"));
    }
    ok(&core, "family.set_permissions", json!({"user_id": bruno, "role": "personalizado", "permissions": perms}));
    ok(&core, "rec.create", json!({"entity": "bills", "scope": "family", "values": {"title": "Luz", "amount": 120, "due_date": "2026-05-10"}}));
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    assert_eq!(err(&core, "rec.list", json!({"entity": "bills", "scope": "family"})).code, "forbidden");
    let s = ok(&core, "search.query", json!({"q": "luz"}));
    assert_eq!(s["total"], 0);
    // restrição de acesso a documento familiar
    ok(&core, "auth.logout", json!({}));
    login(&core, "ana");
    ok(&core, "rec.create", json!({"entity": "documents", "scope": "family", "values": {"title": "Escritura", "restricted_to": [ana]}}));
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    assert_eq!(ok(&core, "rec.list", json!({"entity": "documents", "scope": "family"}))["total"], 0);
    // transferência e saída
    ok(&core, "auth.logout", json!({}));
    login(&core, "ana");
    assert_eq!(err(&core, "family.leave", json!({"confirm": true})).code, "conflict");
    ok(&core, "family.transfer_admin", json!({"user_id": bruno}));
    let info = ok(&core, "family.leave", json!({"confirm": true}));
    assert!(info["family"].is_null());
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    let info = ok(&core, "family.info", json!({}));
    assert_eq!(info["members"].as_array().unwrap().len(), 1);
    assert_eq!(info["family"]["my_role"], "admin");
    // evento criado pela família continua
    assert_eq!(ok(&core, "rec.list", json!({"entity": "events", "scope": "family"}))["total"], 1);
}

#[test]
fn family_member_limit() {
    let dir = tempfile::tempdir().unwrap();
    let core = Core::open(dir.path()).unwrap();
    register(&core, "user1", "Usuário Um");
    let mut ids = vec![];
    for i in 2..=6 {
        ids.push(register(&core, &format!("user{i}"), &format!("Usuário {i}")));
    }
    ok(&core, "family.create", json!({"name": "Grande"}));
    let mut codes = vec![];
    for id in &ids {
        codes.push(ok(&core, "family.invite", json!({"user_id": id}))["code"].as_str().unwrap().to_string());
    }
    for (i, c) in codes.iter().enumerate() {
        ok(&core, "auth.logout", json!({}));
        login(&core, &format!("user{}", i + 2));
        ok(&core, "family.accept_invite", json!({"code": c}));
    }
    ok(&core, "auth.logout", json!({}));
    login(&core, "user1");
    let info = ok(&core, "family.info", json!({}));
    assert_eq!(info["members"].as_array().unwrap().len(), 6);
}

#[test]
fn automations_recurrence_and_progress() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _, _) = setup(dir.path());
    // tarefa recorrente gera a próxima ocorrência
    let t = ok(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "Regar plantas", "due_date": "2030-01-31", "recurrence": "mensal"}}));
    ok(&core, "rec.update", json!({"entity": "tasks", "id": t["id"], "values": {"status": "concluida"}}));
    let l = ok(&core, "rec.list", json!({"entity": "tasks", "filters": {"status": "pendente"}}));
    assert_eq!(l["items"][0]["due_date"], "2030-02-28");
    // tarefa atrasada
    ok(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "Atrasada", "due_date": "2020-01-01"}}));
    ok(&core, "notif.scan", json!({}));
    let l = ok(&core, "rec.list", json!({"entity": "tasks", "filters": {"overdue": true}}));
    assert_eq!(l["total"], 1);
    let n = ok(&core, "notif.list", json!({}));
    assert!(n["items"].as_array().unwrap().iter().any(|x| x["kind"] == "atraso"));
    // progresso de projeto
    let p = ok(&core, "rec.create", json!({"entity": "projects", "values": {"title": "Reforma"}}));
    let s1 = ok(&core, "rec.create", json!({"entity": "project_steps", "values": {"project_id": p["id"], "title": "Orçamento"}}));
    ok(&core, "rec.create", json!({"entity": "project_steps", "values": {"project_id": p["id"], "title": "Obra"}}));
    ok(&core, "rec.update", json!({"entity": "project_steps", "id": s1["id"], "values": {"done": true}}));
    assert_eq!(ok(&core, "rec.get", json!({"entity": "projects", "id": p["id"]}))["progress"], 50.0);
    let logs = ok(&core, "auto.logs", json!({}));
    assert!(logs["items"].as_array().unwrap().len() >= 2);
    // desativar regra
    let rules = ok(&core, "auto.list", json!({}));
    let pr = rules["items"].as_array().unwrap().iter().find(|r| r["rule_type"] == "project_progress").unwrap().clone();
    ok(&core, "auto.update", json!({"id": pr["id"], "enabled": false}));
    ok(&core, "rec.update", json!({"entity": "project_steps", "id": s1["id"], "values": {"done": false}}));
    assert_eq!(ok(&core, "rec.get", json!({"entity": "projects", "id": p["id"]}))["progress"], 50.0);
    assert!(core.call("auto.update", json!({"id": rules["items"].as_array().unwrap().iter().find(|r| r["rule_type"] == "bill_due").unwrap()["id"], "params": {"days_before": 999}})).is_err());
    // lista concluída automaticamente
    let sl = ok(&core, "rec.create", json!({"entity": "shopping_lists", "values": {"title": "Feira"}}));
    let it = ok(&core, "rec.create", json!({"entity": "shopping_items", "values": {"list_id": sl["id"], "title": "Banana"}}));
    ok(&core, "rec.update", json!({"entity": "shopping_items", "id": it["id"], "values": {"bought": true}}));
    assert_eq!(ok(&core, "rec.get", json!({"entity": "shopping_lists", "id": sl["id"]}))["status"], "concluida");
    // orçamento
    let month = &chrono::Local::now().format("%Y-%m").to_string();
    ok(&core, "rec.create", json!({"entity": "budgets", "values": {"category": "Lazer", "amount_limit": 100, "alert_percent": 80}}));
    ok(&core, "rec.create", json!({"entity": "transactions", "values": {"kind": "despesa", "title": "Cinema", "amount": 90, "category": "Lazer", "date": format!("{month}-05")}}));
    let n = ok(&core, "notif.list", json!({}));
    assert!(n["items"].as_array().unwrap().iter().any(|x| x["kind"] == "orcamento"));
    // conta paga gera lançamento e próxima recorrência
    let b = ok(&core, "rec.create", json!({"entity": "bills", "values": {"title": "Internet", "amount": 99.9, "due_date": "2026-03-10", "recurrence": "mensal"}}));
    ok(&core, "rec.update", json!({"entity": "bills", "id": b["id"], "values": {"paid": true}}));
    let tx = ok(&core, "rec.list", json!({"entity": "transactions", "filters": {"bill_id": b["id"]}}));
    assert_eq!(tx["total"], 1);
    let bills = ok(&core, "rec.list", json!({"entity": "bills", "filters": {"paid": false}}));
    assert_eq!(bills["items"][0]["due_date"], "2026-04-10");
    // hábito
    let h = ok(&core, "rec.create", json!({"entity": "habits", "values": {"title": "Ler"}}));
    ok(&core, "habit.toggle", json!({"habit_id": h["id"]}));
    let g = ok(&core, "rec.get", json!({"entity": "habits", "id": h["id"]}));
    assert_eq!(g["done_today"], true);
    assert_eq!(g["streak"], 1);
    assert!(core.call("habit.toggle", json!({"habit_id": h["id"], "date": "2999-01-01"})).is_err());
}

#[test]
fn calendar_recurrence_expansion() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _, _) = setup(dir.path());
    ok(&core, "rec.create", json!({"entity": "events", "values": {"title": "Aula", "start_at": "2026-01-05T19:00", "recurrence": "semanal", "recurrence_until": "2026-02-28"}}));
    let r = ok(&core, "calendar.range", json!({"scope": "personal", "from": "2026-02-01", "to": "2026-02-28"}));
    let aulas: Vec<&Value> = r["items"].as_array().unwrap().iter().filter(|i| i["title"] == "Aula").collect();
    assert_eq!(aulas.len(), 4);
    assert_eq!(aulas[0]["start_at"], "2026-02-02T19:00");
}

#[test]
fn search_reports_exports() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _, _) = setup(dir.path());
    ok(&core, "rec.create", json!({"entity": "transactions", "values": {"kind": "receita", "title": "Salário", "amount": 5000, "date": "2026-03-05", "category": "Trabalho"}}));
    ok(&core, "rec.create", json!({"entity": "transactions", "values": {"kind": "despesa", "title": "Aluguel ação", "amount": 1500.5, "date": "2026-03-06", "category": "Moradia"}}));
    ok(&core, "rec.create", json!({"entity": "notes", "values": {"title": "Ideias de ação", "content": "Plano de férias"}}));
    let s = ok(&core, "search.query", json!({"q": "acao"}));
    assert_eq!(s["total"], 2);
    let s = ok(&core, "search.query", json!({"q": "", "from": "2026-03-06", "to": "2026-03-06"}));
    assert_eq!(s["total"], 1);
    assert_eq!(ok(&core, "search.history", json!({}))["items"][0], "acao");
    let p = ok(&core, "report.preview", json!({"report": "financas", "from": "2026-03-01", "to": "2026-03-31"}));
    assert_eq!(p["total"], 2);
    assert!(p["summary"].to_string().contains("R$ 3.499,50"));
    for fmt in ["pdf", "csv", "xlsx"] {
        let path = dir.path().join(format!("rel.{fmt}"));
        let r = ok(&core, "report.export", json!({"report": "financas", "format": fmt, "path": path, "from": "2026-03-01", "to": "2026-03-31", "columns": ["date", "title", "amount"]}));
        assert_eq!(r["rows"], 2);
        let bytes = std::fs::read(&path).unwrap();
        match fmt {
            "pdf" => assert!(bytes.starts_with(b"%PDF")),
            "xlsx" => assert!(bytes.starts_with(b"PK")),
            _ => {
                let s = String::from_utf8(bytes).unwrap();
                assert!(s.contains("Salário") && s.contains("1500,50") && s.contains("Data;Descrição;Valor"));
            }
        }
    }
    for r in ok(&core, "report.catalog", json!({}))["reports"].as_array().unwrap() {
        ok(&core, "report.preview", json!({"report": r["key"], "scope": "personal"}));
    }
    let f = ok(&core, "finance.summary", json!({"month": "2026-03"}));
    assert_eq!(f["balance"], 3499.5);
}

#[test]
fn backup_restore_and_persistence() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let bpath = out.path().join("b.pluback");
    let epath = out.path().join("enc.pluback");
    {
        let (core, _, _) = setup(dir.path());
        let t = ok(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "Antes do backup"}}));
        ok(&core, "attach.add", json!({"entity": "tasks", "record_id": t["id"], "name": "nota.txt", "data": "b2zDoSBtdW5kbw=="}));
        assert!(core.call("attach.add", json!({"entity": "tasks", "record_id": t["id"], "name": "virus.exe", "data": "AA=="})).is_err());
        let b = ok(&core, "backup.create", json!({"path": bpath}));
        assert_eq!(b["encrypted"], false);
        ok(&core, "backup.create", json!({"path": epath, "password": "segredo123", "password_confirm": "segredo123"}));
        // só o administrador da instalação faz backup completo
        ok(&core, "auth.logout", json!({}));
        login(&core, "bruno");
        assert_eq!(err(&core, "backup.create", json!({"path": out.path().join("x.pluback")})).code, "forbidden");
        ok(&core, "backup.export_my_data", json!({"path": out.path().join("meus.zip")}));
        ok(&core, "auth.logout", json!({}));
        login(&core, "ana");
        ok(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "Depois do backup"}}));
        assert_eq!(ok(&core, "rec.list", json!({"entity": "tasks"}))["total"], 2);
        // verificação
        assert_eq!(err(&core, "backup.verify", json!({"path": epath})).code, "password_required");
        assert!(core.call("backup.verify", json!({"path": epath, "password": "errada000"})).is_err());
        ok(&core, "backup.verify", json!({"path": epath, "password": "segredo123"}));
        // arquivo adulterado é rejeitado
        let mut bytes = std::fs::read(&bpath).unwrap();
        let tampered = out.path().join("t.pluback");
        let n = bytes.len();
        bytes.truncate(n / 2);
        std::fs::write(&tampered, &bytes).unwrap();
        assert!(core.call("backup.verify", json!({"path": tampered})).is_err());
        assert!(core.call("backup.restore", json!({"path": tampered, "confirm": true, "account_password": "senha1234"})).is_err());
        // restauração exige confirmação e senha do perfil
        assert!(core.call("backup.restore", json!({"path": bpath})).is_err());
        assert!(core.call("backup.restore", json!({"path": bpath, "confirm": true, "account_password": "errada"})).is_err());
        let r = ok(&core, "backup.restore", json!({"path": epath, "password": "segredo123", "confirm": true, "account_password": "senha1234"}));
        assert!(Path::new(r["safety_backup"].as_str().unwrap()).exists());
        // sessão encerrada após restaurar
        assert_eq!(err(&core, "rec.list", json!({"entity": "tasks"})).code, "unauthenticated");
        login(&core, "ana");
        let l = ok(&core, "rec.list", json!({"entity": "tasks"}));
        assert_eq!(l["total"], 1);
        assert_eq!(l["items"][0]["title"], "Antes do backup");
        let att = ok(&core, "attach.list", json!({"entity": "tasks", "record_id": l["items"][0]["id"]}));
        let du = ok(&core, "attach.data_url", json!({"id": att["items"][0]["id"]}));
        assert!(du["data_url"].as_str().unwrap().ends_with("b2zDoSBtdW5kbw=="));
    }
    // persistência após reabrir
    let core = Core::open(dir.path()).unwrap();
    login(&core, "ana");
    assert_eq!(ok(&core, "rec.list", json!({"entity": "tasks"}))["total"], 1);
    let st = ok(&core, "app.status", json!({}));
    assert_eq!(st["schema_version"], 1);
}

#[test]
fn transactions_rollback_on_error() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _, _) = setup(dir.path());
    // erro dentro da transação de permissões não deixa dados parciais
    ok(&core, "family.create", json!({"name": "F"}));
    let before = ok(&core, "family.info", json!({}));
    assert!(core.call("family.set_permissions", json!({"user_id": "inexistente", "role": "personalizado", "permissions": ["x"]})).is_err());
    let after = ok(&core, "family.info", json!({}));
    assert_eq!(before["members"], after["members"]);
    // migrações idempotentes
    drop(core);
    let core = Core::open(dir.path()).unwrap();
    let st = ok(&core, "app.status", json!({}));
    assert_eq!(st["users"], 2);
}

#[test]
fn dashboard_settings_onboarding() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _, _) = setup(dir.path());
    let d = ok(&core, "dashboard.get", json!({"workspace": "personal"}));
    let n = d["widgets"].as_array().unwrap().len();
    assert!(n >= 5);
    let mut w = d["widgets"].as_array().unwrap().clone();
    w.reverse();
    w.pop();
    let s = ok(&core, "dashboard.save", json!({"workspace": "personal", "widgets": w}));
    assert_eq!(s["widgets"].as_array().unwrap().len(), n - 1);
    assert!(core.call("dashboard.save", json!({"workspace": "personal", "widgets": [{"widget_type": "board_posts"}]})).is_err());
    let r = ok(&core, "dashboard.reset", json!({"workspace": "personal"}));
    assert_eq!(r["widgets"].as_array().unwrap().len(), n);
    let data = ok(&core, "dashboard.data", json!({"workspace": "personal"}));
    assert!(data["tasks_summary"]["pending"].is_number());
    assert_eq!(ok(&core, "dashboard.data", json!({"workspace": "family"}))["no_family"], true);
    // configurações
    let s = ok(&core, "settings.set", json!({"values": {"theme": "escuro", "notifications": {"quiet_enabled": true}}}));
    assert_eq!(s["theme"], "escuro");
    assert_eq!(s["notifications"]["advance_minutes"], 30);
    assert!(core.call("settings.set", json!({"values": {"theme": "roxo"}})).is_err());
    assert!(core.call("settings.set", json!({"values": {"senha": "x"}})).is_err());
    // manual
    let o = ok(&core, "onboarding.get", json!({}));
    assert_eq!(o["should_show"], true);
    ok(&core, "onboarding.save", json!({"current_step": 4}));
    ok(&core, "auth.logout", json!({}));
    login(&core, "ana");
    assert_eq!(ok(&core, "onboarding.get", json!({}))["current_step"], 4);
    ok(&core, "onboarding.save", json!({"completed": true, "current_step": 8}));
    assert_eq!(ok(&core, "onboarding.get", json!({}))["should_show"], false);
    assert!(core.call("onboarding.save", json!({"current_step": 9})).is_err());
    ok(&core, "onboarding.restart", json!({}));
    assert_eq!(ok(&core, "onboarding.get", json!({}))["should_show"], true);
    // progresso é por usuário
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    assert_eq!(ok(&core, "onboarding.get", json!({}))["current_step"], 1);
}

#[test]
fn polls_menu_and_delete_profile() {
    let dir = tempfile::tempdir().unwrap();
    let (core, _ana, bruno) = setup(dir.path());
    ok(&core, "family.create", json!({"name": "F"}));
    let code = ok(&core, "family.invite", json!({"user_id": bruno}))["code"].as_str().unwrap().to_string();
    let poll = ok(&core, "rec.create", json!({"entity": "poll", "scope": "family", "values": {"title": "Destino", "data": {"options": [{"text": "Praia"}, {"text": "Serra"}]}}}));
    ok(&core, "poll.vote", json!({"poll_id": poll["id"], "options": [1]}));
    assert!(core.call("poll.vote", json!({"poll_id": poll["id"], "options": [0, 1]})).is_err());
    let p = ok(&core, "rec.get", json!({"entity": "poll", "id": poll["id"]}));
    assert_eq!(p["votes"]["1"], 1);
    // cardápio + receitas -> lista de ingredientes
    let rec = ok(&core, "rec.create", json!({"entity": "recipes", "scope": "family", "values": {"title": "Panqueca", "servings": 2, "data": {"ingredients": [{"name": "Farinha", "quantity": 200, "unit": "g"}, {"name": "Ovo", "quantity": 2, "unit": "un"}]}}}));
    ok(&core, "rec.create", json!({"entity": "menu", "scope": "family", "values": {"title": "Café", "date_start": "2026-04-01", "ref_id": rec["id"], "data": {"servings": 4}}}));
    ok(&core, "rec.create", json!({"entity": "menu", "scope": "family", "values": {"title": "Jantar", "date_start": "2026-04-02", "ref_id": rec["id"]}}));
    let list = ok(&core, "rec.create", json!({"entity": "shopping_lists", "scope": "family", "values": {"title": "Semana"}}));
    let ing = ok(&core, "menu.ingredients", json!({"from": "2026-04-01", "to": "2026-04-07", "add_to_list": list["id"]}));
    let farinha = ing["items"].as_array().unwrap().iter().find(|i| i["name"] == "Farinha").unwrap();
    assert_eq!(farinha["quantity"], 600.0);
    assert_eq!(ok(&core, "rec.list", json!({"entity": "shopping_items", "scope": "family", "filters": {"list_id": list["id"]}}))["total"], 2);
    // integrante adiciona mensagem em conversa criada por outro
    let conv = ok(&core, "rec.create", json!({"entity": "conversation", "scope": "family", "values": {"title": "Geral"}}));
    ok(&core, "auth.logout", json!({}));
    login(&core, "bruno");
    ok(&core, "family.accept_invite", json!({"code": code}));
    ok(&core, "rec.create", json!({"entity": "message", "values": {"parent_id": conv["id"], "body": "Oi!"}}));
    assert_eq!(ok(&core, "rec.list", json!({"entity": "board_post", "scope": "family", "sort": "priority DESC, created_at DESC"}))["total"], 0);
    // exclusão de perfil
    ok(&core, "rec.create", json!({"entity": "notes", "values": {"title": "Minha nota"}}));
    assert!(core.call("auth.delete_profile", json!({"password": "errada"})).is_err());
    ok(&core, "auth.delete_profile", json!({"password": "senha1234"}));
    assert_eq!(ok(&core, "auth.profiles", json!({}))["items"].as_array().unwrap().len(), 1);
    login(&core, "ana");
    assert_eq!(ok(&core, "family.info", json!({}))["members"].as_array().unwrap().len(), 1);
}

#[test]
fn memory_core_roundtrip() {
    let core = Core::open_memory(None).unwrap();
    register(&core, "ana", "Ana Souza");
    ok(&core, "rec.create", json!({"entity": "tasks", "values": {"title": "Na memória"}}));
    let bytes = core.export_db().unwrap();
    let core2 = Core::open_memory(Some(&bytes)).unwrap();
    login(&core2, "ana");
    assert_eq!(ok(&core2, "rec.list", json!({"entity": "tasks"}))["total"], 1);
}
