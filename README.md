# HopsMD

> _Brewing Markdown, one document at a time._

A lightweight, local-first Markdown & Mermaid viewer built on **Tauri v2** + **Angular 21**.
HopsMD is a side project of the **CloudBrew** family — a small love letter to documentation
and to a properly poured pint of beer.

## What it does (Phase 1 — Read Only)

- Pick a local folder (the **Sudhaus / Brewhouse**) via the native Tauri file dialog.
- Browse the recursive Markdown tree (the **Rezeptbuch / Recipe Book**) in a left sidebar.
- View any `.md` file with full rendering: GitHub-flavoured Markdown, syntax-highlighted
  code, locally-resolved images, and **live MermaidJS diagrams**.
- Mermaid syntax errors surface as a `<pre>` inside the affected diagram container —
  one bad batch never ruins the whole brew.

## Tech stack

| Layer       | Choice                                                          |
|-------------|-----------------------------------------------------------------|
| Shell       | Tauri v2 (Rust) — minimal: filesystem bridge only               |
| UI          | Angular 21 — standalone components, signals everywhere          |
| Markdown    | [`marked`](https://marked.js.org) with a custom renderer        |
| Diagrams    | [`mermaid`](https://mermaid.js.org) v11                         |
| Sanitizer   | `DOMPurify`                                                     |

## Project layout

```
HopsMD/
├── src/                  # Angular workspace (the Schankraum / tap room)
│   └── app/
│       ├── services/     # MarkdownStructure, MarkdownParser, MermaidRender
│       ├── components/   # FileTree, MarkdownView, BreweryToolbar
│       └── models/
├── src-tauri/            # Tauri / Rust shell (the Braukessel / brew kettle)
│   ├── src/commands/     # recipe_book.rs — file tree & file read commands
│   ├── capabilities/
│   └── tauri.conf.json
└── package.json
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

## License

Personal project. © Ludwig Biermann.
