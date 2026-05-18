//! HopsMD — a CloudBrew side project.
//!
//! The Rust layer is intentionally tiny: it just bridges the webview to the
//! local filesystem (folder scan + file read). All workspace/view state lives
//! in the Angular frontend.

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::recipe_book::open_brewhouse,
            commands::recipe_book::tap_recipe,
        ])
        .run(tauri::generate_context!())
        .expect("HopsMD: der Braukessel ist umgekippt — Tauri konnte nicht starten");
}
