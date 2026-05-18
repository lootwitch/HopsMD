//! Filesystem watcher — keeps the currently-open recipe fresh.
//!
//! The frontend calls [`watch_recipe`] right after [`tap_recipe`]. Whenever
//! `notify` reports a change on that exact file, we emit a `recipe:changed`
//! Tauri event with the absolute path. The Angular layer re-reads via
//! `tap_recipe` and updates the view.
//!
//! Only one file is watched at a time — selecting a new recipe replaces the
//! previous debouncer entirely, so there are no leaks and no need for the
//! caller to remember to unwatch.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use tauri::{AppHandle, Emitter, State};

use super::recipe_book::CommandError;

/// Event name pushed to the webview. Payload: absolute path as a string.
pub const EVENT_RECIPE_CHANGED: &str = "recipe:changed";

/// Debounce window — coalesces the bursts editors emit on save (write, rename,
/// temp-file swap).
const DEBOUNCE_MS: u64 = 250;

/// Tauri-managed singleton holding the currently-active watcher (if any) and
/// the file it's pointed at.
#[derive(Default)]
pub struct RecipeWatcher {
    debouncer: Mutex<Option<Debouncer<RecommendedWatcher>>>,
    current_path: Mutex<Option<PathBuf>>,
}

/// Begin watching `path`. Any previous watcher is dropped. The file does not
/// have to exist on every event — only at the time `watch_recipe` is called.
#[tauri::command]
pub fn watch_recipe(
    path: String,
    app: AppHandle,
    watcher: State<'_, RecipeWatcher>,
) -> Result<(), CommandError> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(CommandError::NotFound(path));
    }
    let parent = target
        .parent()
        .ok_or_else(|| CommandError::NotFound(path.clone()))?
        .to_path_buf();

    // Drop any previous watcher first — the Debouncer's Drop impl cleans up
    // the underlying notify watch handle on every platform.
    drop_current(&watcher);

    let app_handle = app.clone();
    let watched = target.clone();
    let mut debouncer = new_debouncer(
        Duration::from_millis(DEBOUNCE_MS),
        move |res: DebounceEventResult| match res {
            Ok(events) => {
                let touched = events.iter().any(|ev| ev.path == watched);
                if touched {
                    // Best-effort emit; if no listener is registered Tauri
                    // just drops it silently, which is fine.
                    let _ = app_handle.emit(EVENT_RECIPE_CHANGED, watched.to_string_lossy());
                }
            }
            Err(err) => {
                eprintln!("[HopsMD/watcher] notify error: {err:?}");
            }
        },
    )
    .map_err(|e| CommandError::Watch(e.to_string()))?;

    // Watch the parent directory non-recursively. On Windows this is the
    // only reliable way to catch atomic-save patterns (temp file → rename).
    debouncer
        .watcher()
        .watch(&parent, RecursiveMode::NonRecursive)
        .map_err(|e| CommandError::Watch(e.to_string()))?;

    *watcher.debouncer.lock().expect("watcher mutex poisoned") = Some(debouncer);
    *watcher.current_path.lock().expect("watcher path mutex poisoned") = Some(target);
    Ok(())
}

/// Stop watching the currently-watched file, if any. Idempotent.
#[tauri::command]
pub fn unwatch_recipe(watcher: State<'_, RecipeWatcher>) -> Result<(), CommandError> {
    drop_current(&watcher);
    Ok(())
}

fn drop_current(watcher: &RecipeWatcher) {
    watcher
        .current_path
        .lock()
        .expect("watcher path mutex poisoned")
        .take();
    watcher
        .debouncer
        .lock()
        .expect("watcher mutex poisoned")
        .take(); // Drop runs here, releasing the OS-level watch handle.
}
