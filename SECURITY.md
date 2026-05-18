# Security Policy

## Supported versions

HopsMD is pre-1.0 and only the latest minor receives fixes.

| Version | Supported |
| ------- | --------- |
| 0.x.y (latest) | ✅ |
| older 0.x | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security findings.

Use GitHub's private vulnerability reporting:

1. Go to <https://github.com/lootwitch/HopsMD/security/advisories/new>
2. Fill in what you observed, how to reproduce, and the impact you see
3. Submit — the report is visible only to repo maintainers

You'll get an acknowledgement within a few days. If the finding is valid,
we'll work on a fix in a private draft advisory and credit you (or stay
anonymous if you prefer) in the release notes when the patched version
ships.

## Scope

In scope for security reports:

- The Tauri Rust backend (filesystem access, command handlers, watcher)
- Markdown rendering pipeline (`marked`, DOMPurify, Angular sanitization)
- Mermaid diagram rendering
- The auto-updater signature verification

Out of scope:

- Third-party crates / npm packages — please report upstream
- SmartScreen warnings on unsigned installers — that's the documented
  state during the MVP (see [`docs/RELEASE.md`](./docs/RELEASE.md))
- Reading arbitrary files outside the chosen Sudhaus is a *feature* of
  `tap_recipe` by design (the user picks the folder); only behaviour that
  bypasses the user-selected scope qualifies

## Updater key handling

The ed25519 private key used to sign update artefacts is held as a GitHub
Actions secret and never appears in this repo. If you suspect the key has
been compromised, treat that as in scope and report it.
