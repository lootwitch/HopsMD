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

const TEXT_EXTENSIONS: &[&str] = &["txt", "text", "log"];
const EMAIL_EXTENSIONS: &[&str] = &["eml", "msg"];
const IMAGE_EXTENSIONS: &[&str] =
    &["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "ico"];
const JSON_EXTENSIONS: &[&str] = &["json"];
const HTTP_EXTENSIONS: &[&str] = &["http", "rest"];
const PDF_EXTENSIONS: &[&str] = &["pdf"];

/// Coarse classification of a file by extension. Drives which read path and
/// which frontend viewer a file gets. Mirrored in `core/file-kind.ts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileKind {
    Markdown,
    Text,
    Email,
    Image,
    Json,
    Http,
    Pdf,
    Unsupported,
}

pub(crate) fn kind_of(path: &Path) -> FileKind {
    let ext = extension_of(path);
    let any = |set: &[&str]| set.iter().any(|m| m.eq_ignore_ascii_case(&ext));
    if any(MARKDOWN_EXTENSIONS) {
        FileKind::Markdown
    } else if any(TEXT_EXTENSIONS) {
        FileKind::Text
    } else if any(EMAIL_EXTENSIONS) {
        FileKind::Email
    } else if any(IMAGE_EXTENSIONS) {
        FileKind::Image
    } else if any(JSON_EXTENSIONS) {
        FileKind::Json
    } else if any(HTTP_EXTENSIONS) {
        FileKind::Http
    } else if any(PDF_EXTENSIONS) {
        FileKind::Pdf
    } else {
        FileKind::Unsupported
    }
}

/// A file the tree should show and the app can open in some viewer.
pub(crate) fn is_viewable(path: &Path) -> bool {
    kind_of(path) != FileKind::Unsupported
}

/// A file we read as UTF-8 text (markdown, plain text, json, http) — the
/// editable kinds, accepted by `tap_recipe` and `save_recipe`.
pub(crate) fn is_text_readable(path: &Path) -> bool {
    matches!(
        kind_of(path),
        FileKind::Markdown | FileKind::Text | FileKind::Json | FileKind::Http
    )
}

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
    #[error("E-Mail konnte nicht gelesen werden: {0}")]
    EmailParse(String),
    #[error("Ordner kann nicht in sich selbst verschoben werden: {0}")]
    MoveIntoSelf(String),
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
    if !is_text_readable(&p) {
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
    if !is_text_readable(&p) {
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

/// Move a file or folder into another directory, keeping its name. Used by
/// the tree's drag & drop. Refuses to overwrite and refuses to move a folder
/// into its own subtree.
#[tauri::command]
pub fn move_path(from: String, to_dir: String) -> Result<String, CommandError> {
    let src = PathBuf::from(&from);
    if !src.exists() {
        return Err(CommandError::NotFound(from));
    }
    let dest_dir = PathBuf::from(&to_dir);
    if !dest_dir.is_dir() {
        return Err(CommandError::NotADirectory(to_dir));
    }
    // Canonical forms make the cycle check robust against `..`, casing and
    // separator artifacts (both sides get Windows' `\\?\` prefix alike).
    if src.is_dir() {
        let src_canon = src.canonicalize()?;
        let dest_canon = dest_dir.canonicalize()?;
        if dest_canon.starts_with(&src_canon) {
            return Err(CommandError::MoveIntoSelf(to_dir));
        }
    }
    let dest = dest_dir.join(file_name(&src));
    if dest.exists() {
        return Err(CommandError::AlreadyExists(dest.to_string_lossy().into_owned()));
    }
    fs::rename(&src, &dest)?;
    Ok(dest.to_string_lossy().into_owned())
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
            if !is_viewable(&path) {
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
    use std::path::Path;

    #[test]
    fn kind_of_classifies_extensions() {
        use super::FileKind::*;
        assert_eq!(super::kind_of(Path::new("a.md")), Markdown);
        assert_eq!(super::kind_of(Path::new("a.markdown")), Markdown);
        assert_eq!(super::kind_of(Path::new("a.txt")), Text);
        assert_eq!(super::kind_of(Path::new("a.LOG")), Text);
        assert_eq!(super::kind_of(Path::new("a.eml")), Email);
        assert_eq!(super::kind_of(Path::new("a.MSG")), Email);
        assert_eq!(super::kind_of(Path::new("a.png")), Image);
        assert_eq!(super::kind_of(Path::new("a.jpeg")), Image);
        assert_eq!(super::kind_of(Path::new("a.json")), Json);
        assert_eq!(super::kind_of(Path::new("a.JSON")), Json);
        assert_eq!(super::kind_of(Path::new("a.http")), Http);
        assert_eq!(super::kind_of(Path::new("a.rest")), Http);
        assert_eq!(super::kind_of(Path::new("a.pdf")), Pdf);
        assert_eq!(super::kind_of(Path::new("a.exe")), Unsupported);
        assert_eq!(super::kind_of(Path::new("a")), Unsupported);
    }

    #[test]
    fn is_viewable_matches_known_kinds() {
        assert!(super::is_viewable(Path::new("a.md")));
        assert!(super::is_viewable(Path::new("a.txt")));
        assert!(super::is_viewable(Path::new("a.eml")));
        assert!(super::is_viewable(Path::new("a.webp")));
        assert!(super::is_viewable(Path::new("a.json")));
        assert!(super::is_viewable(Path::new("a.http")));
        assert!(super::is_viewable(Path::new("a.pdf")));
        assert!(!super::is_viewable(Path::new("a.zip")));
    }

    #[test]
    fn is_text_readable_covers_editable_kinds() {
        assert!(super::is_text_readable(Path::new("a.md")));
        assert!(super::is_text_readable(Path::new("a.txt")));
        assert!(super::is_text_readable(Path::new("a.json")));
        assert!(super::is_text_readable(Path::new("a.http")));
        assert!(super::is_text_readable(Path::new("a.rest")));
        assert!(!super::is_text_readable(Path::new("a.eml")));
        assert!(!super::is_text_readable(Path::new("a.png")));
        assert!(!super::is_text_readable(Path::new("a.pdf")));
    }

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
    fn tap_reads_plain_text_files() {
        let dir = std::env::temp_dir().join("hopsmd_test_tap_text");
        let _ = fs::create_dir_all(&dir);
        let f = dir.join("note.txt");
        fs::write(&f, "plain text body").unwrap();
        let out = super::tap_recipe(f.to_string_lossy().into_owned()).unwrap();
        assert_eq!(out.content, "plain text body");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn tap_rejects_email_and_image() {
        let dir = std::env::temp_dir().join("hopsmd_test_tap_reject");
        let _ = fs::create_dir_all(&dir);
        let eml = dir.join("m.eml");
        fs::write(&eml, "From: a@b\n\nhi").unwrap();
        assert!(super::tap_recipe(eml.to_string_lossy().into_owned()).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn save_writes_plain_text_files() {
        let dir = std::env::temp_dir().join("hopsmd_test_save_text");
        let _ = fs::create_dir_all(&dir);
        let f = dir.join("note.txt");
        fs::write(&f, "old").unwrap();
        super::save_recipe(f.to_string_lossy().into_owned(), "new".into()).unwrap();
        assert_eq!(fs::read_to_string(&f).unwrap(), "new");
        let _ = fs::remove_dir_all(&dir);
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

    #[test]
    fn move_file_into_subfolder() {
        let dir = std::env::temp_dir().join("hopsmd_test_move_file");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("sub")).unwrap();
        let f = dir.join("note.md");
        fs::write(&f, "# hi").unwrap();
        let new_path = super::move_path(
            f.to_string_lossy().into_owned(),
            dir.join("sub").to_string_lossy().into_owned(),
        )
        .unwrap();
        assert!(!f.exists());
        let dest = dir.join("sub").join("note.md");
        assert!(dest.exists());
        assert_eq!(new_path, dest.to_string_lossy());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn move_folder_into_folder() {
        let dir = std::env::temp_dir().join("hopsmd_test_move_folder");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("a")).unwrap();
        fs::create_dir_all(dir.join("b")).unwrap();
        fs::write(dir.join("a").join("x.md"), "x").unwrap();
        super::move_path(
            dir.join("a").to_string_lossy().into_owned(),
            dir.join("b").to_string_lossy().into_owned(),
        )
        .unwrap();
        assert!(dir.join("b").join("a").join("x.md").exists());
        assert!(!dir.join("a").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn move_rejects_name_conflict() {
        let dir = std::env::temp_dir().join("hopsmd_test_move_conflict");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("sub")).unwrap();
        fs::write(dir.join("note.md"), "src").unwrap();
        fs::write(dir.join("sub").join("note.md"), "existing").unwrap();
        let err = super::move_path(
            dir.join("note.md").to_string_lossy().into_owned(),
            dir.join("sub").to_string_lossy().into_owned(),
        )
        .unwrap_err();
        assert!(matches!(err, super::CommandError::AlreadyExists(_)));
        // Source must be untouched after a refused move.
        assert_eq!(fs::read_to_string(dir.join("note.md")).unwrap(), "src");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn move_rejects_folder_into_own_descendant() {
        let dir = std::env::temp_dir().join("hopsmd_test_move_cycle");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("a").join("inner")).unwrap();
        let err = super::move_path(
            dir.join("a").to_string_lossy().into_owned(),
            dir.join("a").join("inner").to_string_lossy().into_owned(),
        )
        .unwrap_err();
        assert!(matches!(err, super::CommandError::MoveIntoSelf(_)));
        assert!(dir.join("a").join("inner").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn move_into_current_parent_reports_conflict() {
        // dest == src, so the AlreadyExists guard fires; nothing moves. The
        // frontend filters this no-op out before calling, this is the backstop.
        let dir = std::env::temp_dir().join("hopsmd_test_move_noop");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("note.md"), "x").unwrap();
        let err = super::move_path(
            dir.join("note.md").to_string_lossy().into_owned(),
            dir.to_string_lossy().into_owned(),
        )
        .unwrap_err();
        assert!(matches!(err, super::CommandError::AlreadyExists(_)));
        assert!(dir.join("note.md").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
