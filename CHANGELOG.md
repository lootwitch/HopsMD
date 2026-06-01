# Changelog

All notable changes to **HopsMD** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- **Ctrl + Mausrad** zoomt jetzt den Inhalt der gerenderten Markdown-Ansicht
  (Bereich: 60 %–250 %, Schrittweite 10 %), gesteuert über
  `ContentZoomService`. Der Zoomfaktor wird in `localStorage` persistiert,
  sodass der Sud beim nächsten Start mit der gleichen Schriftgröße zapft.
  Sidebar, Toolbar und Filebar bleiben stabil — nur die Lese-Spalte skaliert.
  Die `max-width` der Lese-Spalte wächst 1:1 mit dem Zoom mit, damit auf
  großen Displays die Zeichen-pro-Zeile-Proportion erhalten bleibt.

### Fixed
- Mermaid placeholders showed only "🍺 Maischt…" forever because Angular's
  `DomSanitizer` was stripping `id` and `data-*` attributes during
  `[innerHTML]` binding. Fixed by wrapping `marked` + DOMPurify output in
  `bypassSecurityTrustHtml`, and switching the post-binding hook from
  `effect + queueMicrotask` to `afterRenderEffect` for reliable DOM
  timing.

[Unreleased]: https://github.com/lootwitch/HopsMD/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lootwitch/HopsMD/releases/tag/v1.0.0
[0.1.1]: https://github.com/lootwitch/HopsMD/releases/tag/v0.1.1
