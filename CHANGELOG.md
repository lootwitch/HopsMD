# Changelog

All notable changes to **HopsMD** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Fixed
- Mermaid placeholders showed only "🍺 Maischt…" forever because Angular's
  `DomSanitizer` was stripping `id` and `data-*` attributes during
  `[innerHTML]` binding. Fixed by wrapping `marked` + DOMPurify output in
  `bypassSecurityTrustHtml`, and switching the post-binding hook from
  `effect + queueMicrotask` to `afterRenderEffect` for reliable DOM
  timing.

[Unreleased]: https://github.com/lootwitch/HopsMD/commits/main
