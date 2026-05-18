//! HopsMD — a CloudBrew side project.
//!
//! The Rust layer is intentionally tiny: it just bridges the webview to the
//! local filesystem (folder scan + file read). All workspace/view state lives
//! in the Angular frontend.

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(commands::watcher::RecipeWatcher::default());

    // In-app updater is feature-gated so the build still succeeds before the
    // ed25519 keypair has been generated. Enable with `cargo build --features
    // updater` (or via tauri-action's `args:` in the release workflow).
    #[cfg(feature = "updater")]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![
            commands::recipe_book::open_brewhouse,
            commands::recipe_book::tap_recipe,
            commands::watcher::watch_recipe,
            commands::watcher::unwatch_recipe,
        ])
        .run(tauri::generate_context!())
        .expect("HopsMD: der Braukessel ist umgekippt — Tauri konnte nicht starten");
}
