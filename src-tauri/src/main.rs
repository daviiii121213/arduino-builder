// Evita a janela de console extra no Windows em produção.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    plu_app::run()
}
