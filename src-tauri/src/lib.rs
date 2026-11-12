//! Aplicativo desktop (Tauri): encaminha as chamadas da interface para o núcleo local,
//! executa a rotina periódica (lembretes, automações, backup automático) e integra
//! bandeja do sistema, notificações do Windows e instância única.

use plu_core::{ApiError, Core};
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, State, WindowEvent};
use tauri_plugin_notification::NotificationExt;

struct AppState {
    core: Arc<Core>,
    close_to_tray: Arc<AtomicBool>,
}

/// Comando único da API: executado fora da thread da interface para não bloqueá-la.
#[tauri::command]
async fn api(state: State<'_, AppState>, cmd: String, args: Option<Value>) -> Result<Value, ApiError> {
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || core.call(&cmd, args.unwrap_or(Value::Null)))
        .await
        .map_err(|_| ApiError::internal("Falha interna ao executar a operação."))?
}

#[tauri::command]
fn set_close_to_tray(state: State<'_, AppState>, enabled: bool) {
    state.close_to_tray.store(enabled, Ordering::Relaxed);
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("diretório de dados indisponível");
            let core = Arc::new(Core::open(&dir).map_err(|e| format!("Falha ao abrir os dados locais: {e}"))?);
            let close_to_tray = Arc::new(AtomicBool::new(false));
            app.manage(AppState { core: core.clone(), close_to_tray: close_to_tray.clone() });

            // Bandeja do sistema
            let open = MenuItem::with_id(app, "open", "Abrir PERSONAL LIFE ULTRA", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let mut tray = TrayIconBuilder::new().tooltip("PERSONAL LIFE ULTRA").menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.on_menu_event(|app, e| match e.id.as_ref() {
                "open" => show_main(app),
                "quit" => app.exit(0),
                _ => {}
            })
            .build(app)?;

            if std::env::args().any(|a| a == "--minimized") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }

            // Rotina periódica: lembretes, automações, bloqueio e backup automático.
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(60));
                for n in core.tick() {
                    let _ = handle
                        .notification()
                        .builder()
                        .title(n["title"].as_str().unwrap_or("PERSONAL LIFE ULTRA"))
                        .body(n["body"].as_str().unwrap_or(""))
                        .show();
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let st = window.state::<AppState>();
                if st.close_to_tray.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![api, set_close_to_tray])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o PERSONAL LIFE ULTRA");
}
