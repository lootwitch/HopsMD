# Contributing to HopsMD

Thanks for stopping by the brewhouse. This is a small personal project, but
contributions are welcome — bug reports, fixes, new features, docs, polish.

## Quick start

Prerequisites:
- **Node 20+** and **npm 10+**
- **Rust 1.78+** with the platform Tauri toolchain
  (<https://v2.tauri.app/start/prerequisites/>)
- On Windows: WebView2 Runtime (preinstalled on Windows 11; Tauri's
  bootstrapper installs it on Windows 10)

```bash
git clone https://github.com/lootwitch/HopsMD.git
cd HopsMD
npm install
npm run tauri:dev
```

For pure UI iteration (no Tauri shell, no filesystem access):

```bash
npm start
```

Then open <http://localhost:3300>. The folder picker and file watcher won't
work — that's expected, the bridge intentionally falls back to a friendly
error in browser-only mode.

## Branching + commits

- Branch from `main`. Keep branches focused on one concern.
- **Conventional Commits** required:

  ```
  feat(view): add bulk image lazy-loading
  fix(api): prevent null reference in tap_recipe
  chore: bump Angular dependencies to v21.3
  refactor(watcher): extract debounce into helper
  ```

  Types in use: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`,
  `perf`, `test`, `ci`, `build`. Subject ≤ 72 chars, imperative, no
  trailing period. Body explains the *why*.

- Squash-merge PRs into `main`.

## Code style

- TypeScript strict mode, no `any` without justification.
- **Angular**: standalone components only, signals for state, no NgModule,
  OnPush change detection where it doesn't break things.
- **Rust**: edition 2021. `cargo fmt` before pushing.
- Default to **writing no comments**. Only add one when the *why* is
  non-obvious — a hidden constraint, a workaround for a known bug, behavior
  that would surprise a reader. Don't explain *what* the code does — names
  do that.
- The brewing theme (Sudhaus, Rezeptbuch, Maischen, …) lives in user-facing
  strings. Code identifiers stay plain English so they're searchable.

## Testing your change

- **Frontend**: `npm run build` (production build with strict template
  type-checking)
- **Backend**: `cd src-tauri && cargo check`
- **End-to-end**: `npm run tauri:dev`, open a folder of `.md` files
  including at least one with a Mermaid block, edit a file in an external
  editor and confirm the view refreshes

There is no automated test suite yet — that's on the roadmap.

## Pull requests

- Reference the issue you're closing in the PR description (e.g. `Closes #42`).
- Include a screenshot for any user-visible change.
- Check `npm run build` + `cargo check` locally before pushing.
- Be willing to iterate on review comments — small project, friendly tone.

## Reporting bugs / requesting features

Use the [issue templates](https://github.com/lootwitch/HopsMD/issues/new/choose).
Security findings: see [SECURITY.md](./SECURITY.md).

## Code of Conduct

By participating, you agree to abide by the
[Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
A local copy will be added as `CODE_OF_CONDUCT.md` shortly — until then,
the link above is the authoritative version.

🍻 Prost.
