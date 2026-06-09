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

/// Folders we never descend into — pure noise inside a docs tree. Shared with
/// the watcher, which filters out filesystem events under these directories so
/// `node_modules`/`.git` churn never triggers a tree re-scan.
pub(crate) const IGNORED_DIR_NAMES: &[&str] = &[
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

/// Returned by [`tap_recipe`]. `modified_at` is the file's last-modified time
/// as Unix epoch milliseconds, or `None` if the platform doesn't expose it.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecipeContent {
    pub content: String,
    pub modified_at: Option<i64>,
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
    #[error("Pfad existiert bereits: {0}")]
    AlreadyExists(String),
    #[error("Watcher-Fehler: {0}")]
    Watch(String),
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
pub fn tap_recipe(path: String) -> Result<RecipeContent, CommandError> {
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
    let content = strip_bom(String::from_utf8(bytes).map_err(|_| CommandError::InvalidUtf8)?);
    Ok(RecipeContent {
        content,
        modified_at: modified_at_epoch_ms(&meta),
    })
}

#[tauri::command]
pub fn save_recipe(path: String, content: String) -> Result<(), CommandError> {
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
    if content.len() as u64 > MAX_FILE_SIZE {
        return Err(CommandError::TooLarge { size: content.len() as u64 });
    }
    atomic_write(&p, &content)?;
    Ok(())
}

/// Reject names that are empty, contain path separators, or are `.`/`..`.
fn is_safe_name(name: &str) -> bool {
    !name.is_empty()
        && name != "."
        && name != ".."
        && !name.contains('/')
        && !name.contains('\\')
}

#[tauri::command]
pub fn create_recipe(dir: String, name: String) -> Result<String, CommandError> {
    if !is_safe_name(&name) {
        return Err(CommandError::NotAFile(name));
    }
    let d = PathBuf::from(&dir);
    if !d.is_dir() {
        return Err(CommandError::NotADirectory(dir));
    }
    let file_name = if name.to_ascii_lowercase().ends_with(".md") {
        name.clone()
    } else {
        format!("{name}.md")
    };
    let target = d.join(&file_name);
    if target.exists() {
        return Err(CommandError::AlreadyExists(target.to_string_lossy().into_owned()));
    }
    let stem = target.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    fs::write(&target, format!("# {stem}\n"))?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn create_folder(dir: String, name: String) -> Result<String, CommandError> {
    if !is_safe_name(&name) {
        return Err(CommandError::NotADirectory(name));
    }
    let target = PathBuf::from(&dir).join(&name);
    if target.exists() {
        return Err(CommandError::AlreadyExists(target.to_string_lossy().into_owned()));
    }
    fs::create_dir(&target)?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn rename_path(from: String, to_name: String) -> Result<String, CommandError> {
    if !is_safe_name(&to_name) {
        return Err(CommandError::NotAFile(to_name));
    }
    let src = PathBuf::from(&from);
    if !src.exists() {
        return Err(CommandError::NotFound(from));
    }
    let parent = src.parent().ok_or_else(|| CommandError::NotFound(from.clone()))?;
    // Preserve a markdown extension on files when the user omits it.
    let final_name = if src.is_file() && is_markdown(&src) && !to_name.to_ascii_lowercase().ends_with(".md") {
        format!("{to_name}.md")
    } else {
        to_name.clone()
    };
    let dest = parent.join(&final_name);
    if dest.exists() {
        return Err(CommandError::AlreadyExists(dest.to_string_lossy().into_owned()));
    }
    fs::rename(&src, &dest)?;
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), CommandError> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(CommandError::NotFound(path));
    }
    if p.is_dir() {
        fs::remove_dir_all(&p)?;
    } else {
        fs::remove_file(&p)?;
    }
    Ok(())
}

fn modified_at_epoch_ms(meta: &fs::Metadata) -> Option<i64> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let mtime = meta.modified().ok()?;
    match mtime.duration_since(UNIX_EPOCH) {
        Ok(d) => i64::try_from(d.as_millis()).ok(),
        // Pre-1970 mtimes — vanishingly rare but represent negative.
        Err(e) => {
            let back = e.duration().as_millis();
            i64::try_from(back).ok().map(|v| -v)
        }
    }
    .or_else(|| {
        // SystemTime fell outside i64ms range; let mtime be unknown rather
        // than fail the whole read.
        let _ = SystemTime::now();
        None
    })
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
                // Show every non-ignored folder, including empty ones: a folder
                // the user just created has no children yet but must appear in
                // the tree immediately. (Noise dirs are already skipped above.)
                children.push(sub);
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
        _ => natural_compare(&a.name, &b.name),
    }
}

/// Compare two names the way humans expect to see filenames sorted:
/// case-insensitive, with embedded numeric runs treated as numbers — so
/// "Kapitel 2" sorts before "Kapitel 10", and "10-Setup.md" before
/// "2-Setup.md" both group naturally with their siblings. Falls back to
/// case-sensitive compare to make ties between equal-lowercased names
/// deterministic ("a.md" stable relative to "A.md").
fn natural_compare(a: &str, b: &str) -> Ordering {
    let a_norm = a.to_lowercase();
    let b_norm = b.to_lowercase();
    let mut ai = a_norm.chars().peekable();
    let mut bi = b_norm.chars().peekable();

    loop {
        match (ai.peek().copied(), bi.peek().copied()) {
            (None, None) => break,
            (None, _) => return Ordering::Less,
            (_, None) => return Ordering::Greater,
            (Some(ac), Some(bc)) => {
                if ac.is_ascii_digit() && bc.is_ascii_digit() {
                    let an = consume_digits(&mut ai);
                    let bn = consume_digits(&mut bi);
                    match an.cmp(&bn) {
                        Ordering::Equal => continue,
                        other => return other,
                    }
                } else {
                    ai.next();
                    bi.next();
                    match ac.cmp(&bc) {
                        Ordering::Equal => continue,
                        other => return other,
                    }
                }
            }
        }
    }
    // Lowercased forms compare equal — break the tie with the original
    // so the order is stable between runs.
    a.cmp(b)
}

fn consume_digits<I: Iterator<Item = char>>(iter: &mut std::iter::Peekable<I>) -> u64 {
    let mut n: u64 = 0;
    while let Some(&c) = iter.peek() {
        if !c.is_ascii_digit() {
            break;
        }
        n = n
            .saturating_mul(10)
            .saturating_add(c.to_digit(10).unwrap_or(0) as u64);
        iter.next();
    }
    n
}

pub(crate) fn is_markdown(path: &Path) -> bool {
    let ext = extension_of(path);
    MARKDOWN_EXTENSIONS.iter().any(|m| m.eq_ignore_ascii_case(&ext))
}

fn is_ignored_dir(name: &str) -> bool {
    IGNORED_DIR_NAMES
        .iter()
        .any(|ignored| ignored.eq_ignore_ascii_case(name))
}

/// True if any component of `path` is an ignored directory name. Used by the
/// watcher to drop events that bubble up from `node_modules`, `.git`, etc.,
/// since a recursive notify watch sees them but the tree scan never shows them.
pub(crate) fn is_under_ignored_dir(path: &Path) -> bool {
    path.components().any(|c| match c {
        std::path::Component::Normal(os) => {
            os.to_str().is_some_and(is_ignored_dir)
        }
        _ => false,
    })
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

/// Write `content` to `path` atomically: write a sibling temp file on the same
/// filesystem, then rename it onto the target. Keeps the watcher seeing a single
/// event and avoids a half-written file on crash.
fn atomic_write(path: &Path, content: &str) -> std::io::Result<()> {
    let tmp = path.with_extension("hopsmd-tmp");
    fs::write(&tmp, content.as_bytes())?;
    fs::rename(&tmp, path)
}

/// Remove a leading UTF-8 BOM (`\u{feff}`) if present.  Some editors (notably
/// Windows Notepad and certain CI toolchains) prepend a BOM even to UTF-8
/// files; marked trips on it and renders a stray `ï»¿` at the top of the page.
pub(crate) fn strip_bom(mut s: String) -> String {
    if s.starts_with('\u{feff}') {
        s.drain(..'\u{feff}'.len_utf8());
    }
    s
}

#[cfg(test)]
mod tests {
    use super::{atomic_write, is_safe_name, strip_bom};
    use std::fs;

    #[test]
    fn atomic_write_replaces_file_contents() {
        let dir = std::env::temp_dir().join("hopsmd_test_atomic");
        let _ = fs::create_dir_all(&dir);
        let f = dir.join("note.md");
        fs::write(&f, "old").unwrap();
        atomic_write(&f, "new content").unwrap();
        assert_eq!(fs::read_to_string(&f).unwrap(), "new content");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn safe_name_rejects_traversal() {
        assert!(is_safe_name("note.md"));
        assert!(!is_safe_name(""));
        assert!(!is_safe_name(".."));
        assert!(!is_safe_name("a/b"));
        assert!(!is_safe_name("a\\b"));
    }

    #[test]
    fn strips_leading_bom_only() {
        // BOM at the start is removed.
        let with_bom = "\u{feff}# Hello\nworld".to_string();
        assert_eq!(strip_bom(with_bom), "# Hello\nworld");

        // String without BOM is unchanged.
        let no_bom = "# Hello\nworld".to_string();
        assert_eq!(strip_bom(no_bom), "# Hello\nworld");

        // BOM in the middle is NOT removed.
        let mid_bom = "Hello\u{feff}world".to_string();
        assert_eq!(strip_bom(mid_bom.clone()), mid_bom);

        // Empty string is unchanged.
        assert_eq!(strip_bom(String::new()), "");
    }
}
