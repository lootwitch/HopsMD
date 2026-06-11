# Changelog

All notable changes to **HopsMD** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Structured viewers for `.json`, `.http`/`.rest`, and `.pdf`** — the recipe
  tree now lists and opens JSON files (collapsible tree view; invalid files
  fall back to highlighted raw text, very large ones to plain text), HTTP
  request files (VS Code REST-Client format rendered as request cards with
  method badge, headers, and body — display only, no execution), and PDFs
  (embedded read-only viewer via the platform webview). JSON and HTTP files
  are editable in-app with syntax-aware CodeMirror highlighting.

## [1.1.0] - 2026-06-09

Phase 2 — read/edit mode, settings & theming, and multi-format viewing.

### Added
- **Multi-format viewing** — the recipe tree now lists and opens plain-text
  files (`.txt`/`.text`/`.log`, shown verbatim and editable like markdown),
  emails (`.eml`/`.msg`, read-only header + sanitised HTML/text body +
  attachment names), and common images (`.png`/`.jpg`/`.gif`/`.svg`/`.webp`/
  `.bmp`/`.avif`/`.ico`, fit-to-view with dimensions). HTML email bodies are
  sanitised and the app CSP blocks all remote content, so nothing phones home.
- **Read/Edit mode toggle** — any `.md` file can now be edited in-app.
  Click the ✎ button in the filebar (or press **Ctrl+E**) to switch to a
  **CodeMirror 6** source editor with Markdown syntax highlighting and line
  numbers. A `•` dirty marker appears as soon as the buffer diverges from the
  on-disk content.
- **One-click theme switcher** in the top bar — cycles through the Brewpub Dark
  / Pilsner Light / High Contrast presets (mirrors the language toggle), with a
  ☀️/🌙/◐ glyph showing the active theme.
- The current **app version** is shown small at the bottom of the recipe-book
  sidebar.
- **Explicit save** — **Ctrl+S** or the *Save* button writes the buffer to disk
  atomically (BOM-free, via a sibling temp-file rename in Rust). The watcher
  echo-cancels its own save event by content comparison, so the editor is
  never clobbered by the round-trip.
- **Unsaved-changes guards** — switching to another file, navigating to
  Settings, or closing the window while the buffer is dirty triggers a
  discard-confirmation prompt.
- **External-change conflict banner** — if the open file is modified on disk
  by another tool while you are editing, a banner appears offering *Reload
  (discard my edits)* or *Keep my edits*.
- **Tree file operations** — right-click any node in the recipe tree to access
  *New file*, *New folder*, *Rename* (inline input in the tree row), and
  *Delete* (confirmation required). The tree refreshes automatically via the
  existing watcher after each structural change.
- The open workspace (the **Sudhaus**) is now watched live: `.md` files and
  folders added, removed, or renamed on disk appear in the recipe-book tree
  automatically, without a manual *Nachschlag* (~250 ms debounce). The previous
  single-file watcher was replaced by **one** recursive watcher bound to the
  brewhouse lifecycle (`notify-debouncer-full` instead of `-mini`). Expanded
  state and selection are preserved across the refresh; a plain content save of
  the open file still triggers only a content reload, not a tree re-scan.
- Clicking the file path in the top bar copies the absolute path to the
  clipboard and briefly confirms with "✓ Path copied".
- Settings page (`#/settings`) with an Appearance section: colour theme presets
  (Brewpub Dark / Pilsner Light / High Contrast) plus per-token fine-tuning,
  body/mono fonts, text size, and language — all saved automatically.
- Markdown rendering parity: syntax highlighting (highlight.js, lazy-loaded per
  fenced block), math via KaTeX (inline `$…$` and display `$$…$$`), footnotes
  (`marked-footnote`), admonitions/callouts (`marked-alert`: NOTE / TIP /
  IMPORTANT / WARNING / CAUTION), task-list checkboxes, emoji shortcodes
  (`:beer:` style), definition lists, and wiki-links (`[[Page]]` /
  `[[Page|label]]`). Custom extensions live in `core/markdown-extensions/`.

### Changed
- Edit mode is now entered **only** via the ✎ button or **Ctrl+E** —
  double-clicking the rendered article no longer enters edit mode (it was too
  easy to trigger accidentally).
- The pencil button on a code-block toolbar now opens the file in the **in-app
  CodeMirror editor** instead of launching the OS-default external editor.

### Fixed
- The top bar now follows the active colour theme — on the **Pilsner Light**
  preset its icons (e.g. the settings gear) were invisible because the bar was
  hardcoded dark while the icons used the light-theme foreground colour.
- Newly created **empty folders** now appear in the recipe-book tree
  immediately; the directory scan previously hid folders with no markdown
  children, so a freshly created folder showed in the OS file manager but never
  in the navigation.
- The window can be **closed via the X button** again. The close handler relied
  on `window.destroy()`, which was missing the `core:window:allow-destroy`
  capability, so the close was silently rejected.

## [1.0.0] - 2026-05-19

Promotion to 1.0 — no functional changes vs. 0.1.1. Phase 1
(read-only viewer) is considered feature-complete and the version
label is bumped accordingly. Future breaking work (e.g. an editing
mode, plugin surface) is reserved for 2.0; additive Phase-1 polish
continues to ship as 1.x.

## [0.1.1] - 2026-05-19

First public release. Bundles everything from the initial scaffold plus
the Phase-1 read-only feature set (folder picker, recursive Markdown
tree, GitHub-flavoured rendering with live Mermaid, hot-reload on
external edits, runtime DE/EN, TOC, code-block toolbar, Mermaid
fullscreen with pan + zoom, pinned Stammsudhaus, content zoom).

### Added
- Tauri v2 + Angular 21 scaffold with brewing-themed UI ("Sudhaus",
  "Rezeptbuch", "Maischen", "Anstich")
- Folder picker via native Tauri dialog; recursive Markdown tree scan in
  Rust with depth cap (16), asset-folder preservation, and noise-dir
  filtering (`.git`, `node_modules`, `target`, …)
- GitHub-flavoured Markdown rendering with `marked` + DOMPurify
- Live MermaidJS diagram rendering with per-diagram error isolation —
  one broken diagram surfaces as `<pre>` inside its own container without
  taking down the page
- Local image resolution via Tauri's asset protocol
- Filesystem watcher (`notify-debouncer-mini`) with 250 ms debounce;
  external edits (e.g. saving from VS Code) refresh the open file
  automatically
- "Aktualisiert vor X" relative-time badge in the filebar (live-ticking
  every 5 s, absolute timestamp on hover)
- Windows MSI + NSIS installer bundling (per-machine NSIS,
  download-bootstrapper WebView2, en-US WiX, German/English NSIS UI)
- GitHub Actions release pipeline: `tauri-apps/tauri-action` builds on
  `v*` tag, `vedantmgoyal2009/winget-releaser` auto-PRs new versions to
  `microsoft/winget-pkgs`
- Winget manifest templates under `winget/` for the first manual
  submission
- In-app updater scaffold via `tauri-plugin-updater` (feature-gated; off
  by default until an ed25519 keypair exists — see `docs/RELEASE.md`)
- **Ctrl + Mouse wheel** now zooms the rendered Markdown content (range
  60 %–250 %, 10 % steps), driven by `ContentZoomService`. The zoom factor is
  persisted in `localStorage`, so the next start pours at the same text size.
  Sidebar, toolbar, and filebar stay stable — only the reading column scales.
  The reading column's `max-width` grows 1:1 with the zoom so the
  characters-per-line proportion is preserved on large displays.

### Fixed
- Mermaid placeholders showed only "🍺 Maischt…" forever because Angular's
  `DomSanitizer` was stripping `id` and `data-*` attributes during
  `[innerHTML]` binding. Fixed by wrapping `marked` + DOMPurify output in
  `bypassSecurityTrustHtml`, and switching the post-binding hook from
  `effect + queueMicrotask` to `afterRenderEffect` for reliable DOM
  timing.

[Unreleased]: https://github.com/lootwitch/HopsMD/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/lootwitch/HopsMD/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/lootwitch/HopsMD/releases/tag/v1.0.0
[0.1.1]: https://github.com/lootwitch/HopsMD/releases/tag/v0.1.1
