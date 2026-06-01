//! Filesystem watcher — keeps the open workspace (the "Sudhaus") in sync.
//!
//! A single recursive watcher is bound to the *brewhouse* lifecycle, not to a
//! single file. The frontend calls [`watch_brewhouse`] when a workspace opens
//! and [`set_open_recipe`] whenever the selected file changes. From that one
//! stream of filesystem events we drive two webview events:
//!
//! * `recipe:changed` — the currently-open file's *content* changed; the
//!   frontend re-reads it via `tap_recipe`. Payload: the absolute path.
//! * `brewhouse:changed` — a *structural* change (a markdown file or folder was
//!   added / removed / renamed) somewhere in the tree; the frontend re-scans
//!   via `open_brewhouse`. No payload — the frontend already knows the root.
//!
//! Switching workspaces replaces the watcher entirely; [`unwatch_brewhouse`]
//! drops it. We use `notify-debouncer-full` (not `-mini`) specifically to keep
//! the `EventKind`, which is what lets us tell a content save from a structural
//! change. A structural event whose path *is* the open file is treated as a
//! content change — that covers editors that save atomically (temp → rename)
//! and would otherwise look like a brand-new file appearing.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify_debouncer_full::notify::event::ModifyKind;
use notify_debouncer_full::notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use tauri::{AppHandle, Emitter, State};

use super::recipe_book::{is_markdown, is_under_ignored_dir, CommandError};

/// Webview event: the open file's content changed. Payload: absolute path.
pub const EVENT_RECIPE_CHANGED: &str = "recipe:changed";

/// Webview event: the tree structure changed. No payload.
pub const EVENT_BREWHOUSE_CHANGED: &str = "brewhouse:changed";

/// Debounce window — coalesces the bursts editors emit on save (write, rename,
/// temp-file swap).
const DEBOUNCE_MS: u64 = 250;

/// Tauri-managed singleton holding the active recursive watcher (if any), the
/// workspace root it covers, and the currently-open file. `open_file` is an
/// `Arc` because the debounce callback (which runs on a background thread)
/// reads it on every batch, while `set_open_recipe` updates it from the command
/// thread without restarting the watcher.
#[derive(Default)]
pub struct BrewhouseWatcher {
    debouncer: Mutex<Option<Debouncer<RecommendedWatcher, FileIdMap>>>,
    root: Mutex<Option<PathBuf>>,
    open_file: Arc<Mutex<Option<PathBuf>>>,
}

/// Start watching `path` (a workspace root) recursively. Any previous watcher
/// is dropped first. Idempotent re-arming is fine — the frontend calls this on
/// every brewhouse open/switch.
#[tauri::command]
pub fn watch_brewhouse(
    path: String,
    app: AppHandle,
    watcher: State<'_, BrewhouseWatcher>,
) -> Result<(), CommandError> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(CommandError::NotFound(path));
    }

    // Drop any previous watcher first — the Debouncer's Drop releases the
    // OS-level watch handles on every platform.
    drop_current(&watcher);

    let app_handle = app.clone();
    let open_file = Arc::clone(&watcher.open_file);

    let mut debouncer = new_debouncer(
        Duration::from_millis(DEBOUNCE_MS),
        None,
        move |res: DebounceEventResult| match res {
            Ok(events) => {
                let current_open = open_file
                    .lock()
                    .ok()
                    .and_then(|guard| guard.clone());

                let mut content_changed = false;
                let mut structural_changed = false;

                for event in &events {
                    let kind = event.kind;
                    for p in &event.paths {
                        if is_under_ignored_dir(p) {
                            continue;
                        }
                        // Anything touching the open file's path is a content
                        // refresh — including an atomic-save rename onto it,
                        // which we deliberately do *not* treat as structural.
                        if current_open.as_deref() == Some(p.as_path()) {
                            content_changed = true;
                            continue;
                        }
                        if is_structural_kind(kind) && looks_structural(p) {
                            structural_changed = true;
                        }
                    }
                }

                // Best-effort emits; if no listener is registered Tauri just
                // drops them silently, which is fine.
                if content_changed {
                    if let Some(open) = current_open.as_ref() {
                        let _ = app_handle.emit(EVENT_RECIPE_CHANGED, open.to_string_lossy());
                    }
                }
                if structural_changed {
                    let _ = app_handle.emit(EVENT_BREWHOUSE_CHANGED, ());
                }
            }
            Err(errors) => {
                for err in errors {
                    eprintln!("[HopsMD/watcher] notify error: {err:?}");
                }
            }
        },
    )
    .map_err(|e| CommandError::Watch(e.to_string()))?;

    // Watch the whole workspace recursively so additions in any subfolder are
    // caught. The cache root teaches the debouncer how to resolve renames.
    debouncer
        .watcher()
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| CommandError::Watch(e.to_string()))?;
    debouncer.cache().add_root(&root, RecursiveMode::Recursive);

    *watcher.debouncer.lock().expect("watcher mutex poisoned") = Some(debouncer);
    *watcher.root.lock().expect("watcher root mutex poisoned") = Some(root);
    Ok(())
}

/// Tell the watcher which file is currently open (or `None`). Lightweight — it
/// only updates the shared pointer the debounce callback reads; it never
/// restarts the watcher.
#[tauri::command]
pub fn set_open_recipe(
    path: Option<String>,
    watcher: State<'_, BrewhouseWatcher>,
) -> Result<(), CommandError> {
    *watcher.open_file.lock().expect("open_file mutex poisoned") = path.map(PathBuf::from);
    Ok(())
}

/// Stop watching the current workspace, if any. Idempotent.
#[tauri::command]
pub fn unwatch_brewhouse(watcher: State<'_, BrewhouseWatcher>) -> Result<(), CommandError> {
    drop_current(&watcher);
    Ok(())
}

/// Structural = a file/folder appeared, vanished, or was renamed. Plain content
/// writes (`Modify(Data)`) and metadata-only touches are intentionally absent.
fn is_structural_kind(kind: EventKind) -> bool {
    matches!(
        kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(ModifyKind::Name(_))
    )
}

/// Whether a structural event on this path could change the rendered tree: it
/// targets a markdown file, an existing directory, or a now-gone path with no
/// extension (a removed/renamed-away folder). Editor temp files (`*.md.tmp`,
/// `*.swp`, …) carry a non-markdown extension and are filtered out here. The
/// frontend's structural fingerprint is the final arbiter, so over-emitting is
/// harmless — this just trims the obvious noise.
fn looks_structural(path: &Path) -> bool {
    is_markdown(path) || path.is_dir() || (!path.exists() && path.extension().is_none())
}

fn drop_current(watcher: &BrewhouseWatcher) {
    watcher
        .root
        .lock()
        .expect("watcher root mutex poisoned")
        .take();
    watcher
        .debouncer
        .lock()
        .expect("watcher mutex poisoned")
        .take(); // Drop runs here, releasing the OS-level watch handles.
    watcher
        .open_file
        .lock()
        .expect("open_file mutex poisoned")
        .take();
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify_debouncer_full::notify::event::{
        AccessKind, CreateKind, DataChange, ModifyKind, RemoveKind, RenameMode,
    };

    #[test]
    fn structural_kinds_are_create_remove_rename_only() {
        assert!(is_structural_kind(EventKind::Create(CreateKind::Any)));
        assert!(is_structural_kind(EventKind::Remove(RemoveKind::Any)));
        assert!(is_structural_kind(EventKind::Modify(ModifyKind::Name(
            RenameMode::Any
        ))));
        // A plain content write or metadata/access touch is NOT structural.
        assert!(!is_structural_kind(EventKind::Modify(ModifyKind::Data(
            DataChange::Any
        ))));
        assert!(!is_structural_kind(EventKind::Access(AccessKind::Any)));
    }

    #[test]
    fn looks_structural_accepts_markdown_and_rejects_temp_files() {
        // Markdown paths qualify even when they no longer exist (a deletion).
        assert!(looks_structural(Path::new("/docs/guide.md")));
        assert!(looks_structural(Path::new("/docs/guide.MARKDOWN")));
        // Editor temp/swap files carry a non-markdown extension — filtered out.
        assert!(!looks_structural(Path::new("/docs/guide.md.tmp")));
        assert!(!looks_structural(Path::new("/docs/.guide.md.swp")));
        // A vanished, extensionless path (a removed/renamed-away folder) counts.
        assert!(looks_structural(Path::new("/docs/chapter-3")));
    }

    #[test]
    fn looks_structural_accepts_existing_directories() {
        assert!(looks_structural(&std::env::temp_dir()));
    }

    #[test]
    fn ignored_dir_events_are_filtered_out() {
        assert!(is_under_ignored_dir(Path::new(
            "/repo/node_modules/pkg/readme.md"
        )));
        assert!(is_under_ignored_dir(Path::new("/repo/.git/COMMIT_EDITMSG")));
        assert!(!is_under_ignored_dir(Path::new("/repo/docs/guide.md")));
    }
}
