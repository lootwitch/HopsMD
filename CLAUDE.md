# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

HopsMD — a local-first Markdown & Mermaid viewer/editor built on **Tauri v2** (Rust shell) +
**Angular 21** (standalone components, signals). It opens a local folder, renders a recursive
Markdown tree, and lets you view/edit `.md`, `.txt`/`.log`, `.json`, `.http`/`.rest`, `.pdf`,
`.eml`/`.msg`, and common image files — all read from disk via Tauri IPC commands, nothing
remote (CSP blocks external content).

## Commands

```bash
npm install
npm run tauri:dev      # Angular dev server (:3300) + Tauri shell — full app, use for most work
npm start               # Angular only, browser at :3300 — no filesystem/dialog/watcher (bridge stubs out)
npm run build            # production Angular build, strict template type-checking — run before pushing
npm run watch             # ng build --watch (development config)
cd src-tauri && cargo check   # Rust backend typecheck — run before pushing
cd src-tauri && cargo fmt     # format Rust before pushing
npm run tauri:build       # full production bundle (installers land in src-tauri/target/release/bundle/)
```

There is **no automated test suite**. Verification is manual: run `npm run tauri:dev`, open
`samples/test-suite/` (a numbered set of `.md` files, one per feature — Mermaid, tables, math,
editor shortcuts, find-in-files, frontmatter, etc.) and click through the relevant page(s) for
whatever you changed. `samples/test-suite/00-START-HERE.md` is the index. When adding a feature,
add a corresponding numbered file there.

## Architecture

**Split brain, thin Rust.** All app/view state lives in the Angular frontend as signals; Rust
(`src-tauri/src/`) is only a filesystem/IPC bridge — folder scan, read/write files, watch for
external changes, parse `.eml`/`.msg`. It has no business logic about *what* a file means.

**IPC boundary — `src/app/core/tauri-bridge.ts`.** Every Rust command is wrapped by a `*Bridge`
function here that checks `isTauri()` first. When run via plain `npm start` (no Tauri shell),
each wrapper throws/no-ops instead of crashing, so browser-only UI iteration stays possible.
Add new commands on both sides: register in `src-tauri/src/lib.rs` (`invoke_handler!` list) +
implement in the matching `src-tauri/src/commands/*.rs`, then add a wrapper here.

**Rust commands** (`src-tauri/src/commands/`):
- `recipe_book.rs` — tree scan (`open_brewhouse`), read/write (`tap_recipe`/`save_recipe`),
  create/rename/delete/move, image asset save, full-text search (`search_brewhouse`, capped at
  500 hits / 50 per file).
- `watcher.rs` — one recursive filesystem watch per open workspace via `notify-debouncer-full`
  (250ms debounce), managed as Tauri state (`BrewhouseWatcher`); emits events the frontend
  listens for via `listenBridge`.
- `email.rs` — `.eml` (`mail-parser`) / `.msg` (`msg_parser`) → sanitized `EmailContent`.

**Frontend layers** (`src/app/`):
- `components/viewer-shell/` — the root shell composing sidebar (file tree), toolbar, and the
  active file viewer; routed at `/` (see `app.routes.ts`; `/settings` is the only other route).
- `components/file-tree/` — recursive tree UI, drag/drop (`services/tree-drag.service.ts`),
  context menu (`components/context-menu/` + `services/context-menu.service.ts`).
- `components/markdown-view/` + `components/markdown-editor/` — render vs. edit modes for the
  same file; editing uses CodeMirror 6, lazy-loaded. `components/code-block-editor/` is the
  per-fenced-code-block split editor (CodeMirror + live preview) added on top of that.
- Other per-file-kind viewers: `email-view`, `image-view`, `json-view`, `http-view`, `pdf-view`
  — dispatched by `core/file-kind.ts` based on extension.
- `services/markdown-parser.service.ts` — wraps `marked` with the custom renderer and the
  extensions in `core/markdown-extensions/` (wiki-links, definition lists, emoji shortcodes).
- `services/markdown-structure.service.ts` — builds the file tree model / TOC
  (`components/toc/`) from scan results.
- `services/mermaid-render.service.ts` + `components/mermaid-fullscreen/` — lazy-loaded Mermaid
  rendering; a bad diagram renders an inline `<pre>` error instead of breaking the page.
- `services/color-theme.service.ts`, `fonts.service.ts`, `i18n.service.ts`,
  `editor-prefs.service.ts` — settings persisted via the `settings-page` component (DE/EN,
  three color presets + per-token overrides, fonts, editor prefs).
- `services/favorites.service.ts` + `components/favorites-panel/` — pinned files/folders.
- `components/find-in-files/` — UI over `searchBrewhouseBridge`.
- All rendered HTML (Markdown output, sanitized email bodies) goes through `DOMPurify` before
  being trusted for Angular `[innerHTML]`.

## Conventions

- **Commits**: Conventional Commits, subject ≤72 chars, imperative, no trailing period
  (`feat(view): ...`, `fix(api): ...`, `chore: ...`). Squash-merge PRs into `main`.
- **TypeScript**: strict mode, no `any` without justification. Standalone components only,
  signals for state, no NgModules, OnPush where it doesn't break things.
- **Rust**: edition 2021, `cargo fmt` before pushing.
- Default to **no comments**; add one only when the *why* is non-obvious (hidden constraint,
  workaround for a specific bug) — never explain *what* code does.
- **Brewing theme stays in user-facing strings only** (Sudhaus = workspace root, Rezeptbuch =
  file tree, Anstich = open file, Nachschlag = refresh, Neuer Sud = update available, etc. —
  full glossary in `README.md`). Code identifiers (functions, variables, Rust command names)
  stay plain English and searchable — e.g. the command is `open_brewhouse`, not `sudhaus_öffnen`.
- Releases: version is bumped in three places (`package.json`, `src-tauri/Cargo.toml`,
  `src-tauri/tauri.conf.json`) and tagged `vX.Y.Z`; see `docs/RELEASE.md` for the full runbook.
