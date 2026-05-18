//! Filesystem bridge — the "Rezeptbuch" (recipe book).
//!
//! Two commands are exposed to the webview:
//!
//! * [`open_brewhouse`] — scan a folder recursively and return a tree of
//!   markdown files plus any asset-looking folders, so the sidebar can show
//!   the user what is on disk.
//! * [`tap_recipe`] — read a single `.md` file as UTF-8 and hand the contents
//!   back to the frontend.
//!
//! Safety bound is shallow on purpose: we limit depth so a user who opens
//! `C:\` by accident does not block the UI for minutes.

use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

/// How deep we walk into a brewhouse. Documentation trees rarely nest beyond
/// a handful of levels; the cap keeps accidental "open root" foot-guns cheap.
const MAX_DEPTH: usize = 16;

/// Extensions counted as "markdown" — show up in the tree as recipes.
const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdx"];

/// Folders we always show even if they contain no markdown, because they
/// typically hold images / diagrams referenced by the surrounding docs.
const ASSET_FOLDER_HINTS: &[&str] = &[
    "assets",
    "images",
    "img",
    "media",
    "attachments",
    "figures",
    "diagrams",
    "screenshots",
];

/// Folders we never descend into — pure noise inside a docs tree.
const IGNORED_DIR_NAMES: &[&str] = &[
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "target",
    "dist",
    "build",
    ".angular",
    ".cache",
    ".idea",
    ".vscode",
    ".venv",
    "__pycache__",
    ".next",
    ".nuxt",
    ".turbo",
    "bin",
    "obj",
];

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecipeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub extension: String,
    pub children: Vec<RecipeNode>,
}

#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("Pfad existiert nicht: {0}")]
    NotFound(String),
    #[error("Pfad ist kein Verzeichnis: {0}")]
    NotADirectory(String),
    #[error("Pfad ist kein regulärer Datei-Pfad: {0}")]
    NotAFile(String),
    #[error("Datei ist kein Markdown ({0})")]
    NotMarkdown(String),
    #[error("Datei ist zu groß zum Anzeigen ({size} bytes, Maximum 20 MB)")]
    TooLarge { size: u64 },
    #[error("I/O-Fehler: {0}")]
    Io(#[from] std::io::Error),
    #[error("Datei enthält ungültiges UTF-8")]
    InvalidUtf8,
}

impl serde::Serialize for CommandError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// Hard cap on file size — bigger files almost certainly aren't documentation
/// and would freeze the webview while marked parses them.
const MAX_FILE_SIZE: u64 = 20 * 1024 * 1024;

#[tauri::command]
pub fn open_brewhouse(path: String) -> Result<RecipeNode, CommandError> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(CommandError::NotFound(path));
    }
    if !p.is_dir() {
        return Err(CommandError::NotADirectory(path));
    }
    let root = scan(&p, 0).unwrap_or_else(|| RecipeNode {
        name: file_name(&p),
        path: p.to_string_lossy().into_owned(),
        is_dir: true,
        extension: String::new(),
        children: Vec::new(),
    });
    Ok(root)
}

#[tauri::command]
pub fn tap_recipe(path: String) -> Result<String, CommandError> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(CommandError::NotFound(path));
    }
    if !p.is_file() {
        return Err(CommandError::NotAFile(path));
    }
    if !is_markdown(&p) {
        return Err(CommandError::NotMarkdown(path));
    }
    let meta = fs::metadata(&p)?;
    if meta.len() > MAX_FILE_SIZE {
        return Err(CommandError::TooLarge { size: meta.len() });
    }
    let bytes = fs::read(&p)?;
    String::from_utf8(bytes).map_err(|_| CommandError::InvalidUtf8)
}

// ---------- internals ----------

fn scan(dir: &Path, depth: usize) -> Option<RecipeNode> {
    if depth > MAX_DEPTH {
        return None;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let mut children: Vec<RecipeNode> = Vec::new();

    for entry in entries.flatten() {
        let file_type = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();

        if name.starts_with('.') && name != "." && name != ".." {
            // Skip dot-files / dot-dirs at every level — they're rarely docs.
            continue;
        }

        if file_type.is_dir() {
            if is_ignored_dir(&name) {
                continue;
            }
            if let Some(sub) = scan(&path, depth + 1) {
                let is_asset_hint = ASSET_FOLDER_HINTS
                    .iter()
                    .any(|h| h.eq_ignore_ascii_case(&name));
                if !sub.children.is_empty() || is_asset_hint {
                    children.push(sub);
                }
            }
        } else if file_type.is_file() {
            if !is_markdown(&path) {
                continue;
            }
            children.push(RecipeNode {
                name,
                path: path.to_string_lossy().into_owned(),
                is_dir: false,
                extension: extension_of(&path),
                children: Vec::new(),
            });
        }
        // Symlinks: ignored on purpose — keeps the scan side-effect-free.
    }

    children.sort_by(sort_nodes);

    Some(RecipeNode {
        name: file_name(dir),
        path: dir.to_string_lossy().into_owned(),
        is_dir: true,
        extension: String::new(),
        children,
    })
}

fn sort_nodes(a: &RecipeNode, b: &RecipeNode) -> Ordering {
    match (a.is_dir, b.is_dir) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    }
}

fn is_markdown(path: &Path) -> bool {
    let ext = extension_of(path);
    MARKDOWN_EXTENSIONS.iter().any(|m| m.eq_ignore_ascii_case(&ext))
}

fn is_ignored_dir(name: &str) -> bool {
    IGNORED_DIR_NAMES
        .iter()
        .any(|ignored| ignored.eq_ignore_ascii_case(name))
}

fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default()
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}
