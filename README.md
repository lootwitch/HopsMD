# HopsMD

> _Brewing Markdown, one document at a time._

[![Release](https://img.shields.io/github/v/release/lootwitch/HopsMD?display_name=tag&sort=semver)](https://github.com/lootwitch/HopsMD/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/lootwitch/HopsMD/release.yml?label=build)](https://github.com/lootwitch/HopsMD/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-f5c542.svg)](./LICENSE)
[![Made with Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?logo=tauri&logoColor=white)](https://v2.tauri.app)
[![Made with Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-c87b1e.svg)](https://www.conventionalcommits.org)

A lightweight, local-first Markdown & Mermaid viewer built on **Tauri v2** + **Angular 21**.
HopsMD is a side project of the **CloudBrew** family — a small love letter to documentation
and to a properly poured pint of beer.

## What it does (Phase 1 — Read Only)

- Pick a local folder (the **Sudhaus / Brewhouse**) via the native Tauri file dialog.
- Browse the recursive Markdown tree (the **Rezeptbuch / Recipe Book**) in a left sidebar.
- View any `.md` file with full rendering: GitHub-flavoured Markdown, **syntax-highlighted
  code** (highlight.js, lazy-loaded), locally-resolved images, and **live MermaidJS
  diagrams** — plus **math** (KaTeX inline & display), **footnotes**, **admonitions /
  callouts** (NOTE / TIP / IMPORTANT / WARNING / CAUTION), **task lists**, **emoji
  shortcodes**, **definition lists**, and **wiki-links** (`[[Page]]` / `[[Page|label]]`).
- Auto-refresh on external edits — save in your editor, the view updates within ~250 ms.
- Live folder watching — `.md` files and folders added, removed, or renamed on disk
  appear in the tree automatically, no manual *Nachschlag* needed.
- "Aktualisiert vor X" badge keeps you honest about how stale the open file is.
- Mermaid syntax errors surface as a `<pre>` inside the affected diagram container —
  one bad batch never ruins the whole brew.

## Install

### winget — recommended

```powershell
winget install CloudBrew.HopsMD
```

This is the friction-free path: `winget install` does not trigger the
Windows SmartScreen warning, even though the underlying installer is
unsigned. **Once the manifest is merged into `microsoft/winget-pkgs`,
this is the install path we point everyone at.**

> The very first version is pending its manual submission to
> `microsoft/winget-pkgs` — until that PR is merged (typically a day or
> two), use the manual download below.

### Manual download

For users who do not (yet) have winget, or who prefer downloading the
installer directly: grab it from
[the latest GitHub Release](https://github.com/lootwitch/HopsMD/releases/latest).

- `HopsMD_<version>_x64-setup.exe` — NSIS, smaller, per-machine
- `HopsMD_<version>_x64_en-US.msi` — MSI, group-policy friendly

> **First-time SmartScreen warning:** the installer is unsigned. Windows
> will show *"Windows protected your PC"* — click **More info → Run
> anyway** to proceed. Code signing is parked until the project has
> accumulated enough public traction to qualify for one of the OSS
> code-signing programmes (e.g. SignPath OSS). Until then, the cleanest
> way to dodge the warning entirely is `winget install`.

### Updates

- Installed via winget? `winget upgrade CloudBrew.HopsMD`
- Installed manually? The in-app updater (when active) shows a banner
  "🍻 Neuer Sud — jetzt installieren" in the toolbar.

## Tech stack

| Layer       | Choice                                                          |
|-------------|-----------------------------------------------------------------|
| Shell       | Tauri v2 (Rust) — minimal: filesystem bridge only               |
| UI          | Angular 21 — standalone components, signals everywhere          |
| Markdown    | [`marked`](https://marked.js.org) with a custom renderer        |
| Diagrams    | [`mermaid`](https://mermaid.js.org) v11, lazy-loaded             |
| Sanitizer   | `DOMPurify` (output then re-trusted for Angular's `[innerHTML]`)|
| Watcher     | [`notify-debouncer-full`](https://crates.io/crates/notify-debouncer-full) — one recursive watch per workspace, 250 ms debounce |
| Installer   | NSIS + MSI (WiX 3) via `cargo tauri build`                       |
| Updater     | `tauri-plugin-updater` + ed25519 signatures (feature-gated)      |

## Project layout

```
HopsMD/
├── src/                  # Angular workspace (the Schankraum / tap room)
│   └── app/
│       ├── services/     # MarkdownStructure, MarkdownParser, MermaidRender, Updater
│       ├── components/   # FileTree, MarkdownView, BreweryToolbar
│       ├── core/         # tauri-bridge, path-utils
│       └── models/
├── src-tauri/            # Tauri / Rust shell (the Braukessel / brew kettle)
│   ├── src/commands/     # recipe_book.rs (file tree + read), watcher.rs
│   ├── capabilities/
│   └── tauri.conf.json
├── winget/               # winget-pkgs manifest templates
├── .github/workflows/    # release.yml + winget.yml
└── docs/RELEASE.md       # human runbook
```

## Local development

Prerequisites: **Node 20+**, **Rust 1.78+**, the platform Tauri toolchain
(see <https://v2.tauri.app/start/prerequisites/>).

```bash
npm install
npm run tauri:dev   # spins up Angular dev server on :3300 + Tauri shell
```

Standalone Angular dev (no shell, for fast UI iteration):

```bash
npm start           # serves on http://localhost:3300
```

Production build:

```bash
npm run tauri:build
# → src-tauri/target/release/bundle/nsis/HopsMD_<v>_x64-setup.exe
# → src-tauri/target/release/bundle/msi/HopsMD_<v>_x64_en-US.msi
```

## Brewing glossary

A few user-facing labels lean into the theme — the code stays plain English so it is
still searchable.

| UI term            | Code term            | Meaning                                  |
|--------------------|----------------------|------------------------------------------|
| Sudhaus / Brewhouse| workspace root       | The folder you opened                    |
| Rezeptbuch         | recipe tree          | The tree of `.md` files                  |
| Anstich            | open / select        | Opening a file                           |
| Maischen           | loading              | Async I/O in flight                      |
| Trübung            | error                | Syntax error in a Mermaid block          |
| Frisch gezapft     | freshly rendered     | Successful Mermaid render                |
| Nachschlag         | refresh              | Re-scan the workspace                    |
| Neuer Sud          | new version          | Available update                         |

## Contributing

Bug reports, fixes, and ideas welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md)
for the build/test/PR workflow and [`docs/RELEASE.md`](./docs/RELEASE.md) for
the release runbook. Security findings go through
[GitHub Security Advisories](https://github.com/lootwitch/HopsMD/security/advisories/new)
(see [`SECURITY.md`](./SECURITY.md)).

Changes are tracked in [`CHANGELOG.md`](./CHANGELOG.md) following
[Keep a Changelog](https://keepachangelog.com/).

## License

[MIT](./LICENSE) © 2026 Ludwig Biermann.
