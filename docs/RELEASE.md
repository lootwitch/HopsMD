# Release runbook

Everything human-in-the-loop about shipping a HopsMD version on Windows.
The repo ships unsigned, install-via-MSI/NSIS, distributed through GitHub
Releases and Winget. In-app updates are wired up but feature-flagged off
until an ed25519 keypair exists.

---

## TL;DR — cutting a release

```bash
# 1. Bump version in three places
#    package.json
#    src-tauri/Cargo.toml
#    src-tauri/tauri.conf.json
git commit -am "chore: bump v0.2.0"

# 2. Tag and push
git tag v0.2.0
git push origin main --tags
```

That fires `.github/workflows/release.yml` → builds MSI + NSIS → creates a
**draft** GitHub Release with both attached. Review the draft, hit
"Publish release", and:

- `winget.yml` triggers → opens a PR against `microsoft/winget-pkgs` with
  the new version. Usually merged within a day.
- If the in-app updater is active, `latest.json` is uploaded and existing
  installations will pick it up on next start.

---

## One-time setup before the first real release

### 1. Push to GitHub

The release pipeline assumes the repo lives at `github.com/CloudBrew/HopsMD`
(referenced in `tauri.conf.json` and the winget manifests). Adjust if the
final URL differs.

```bash
gh repo create CloudBrew/HopsMD --source . --private --push
```

(Or the org of your choice — search-and-replace `CloudBrew/HopsMD` first.)

### 2. Generate the updater keypair (only if you want in-app updates)

Tauri's updater verifies update artefacts with ed25519. Keypair lives
**outside** the repo; only the public key is committed.

```bash
cd HopsMD
npx tauri signer generate -w ~/.tauri/hopsmd.key
# Prompts for a password; remember it — same one used in CI.
```

Two things appear:

- A private-key file at `~/.tauri/hopsmd.key` — **never commit this**.
- A base64 public key printed to stdout (and saved as `hopsmd.key.pub`).

Paste the public key into `src-tauri/tauri.conf.json` →
`plugins.updater.pubkey`, replace `REPLACE_AFTER_RUNNING_npx_tauri_signer_generate`,
and flip `plugins.updater.active` from `false` to `true`.

Then enable the Rust feature flag — either:

- locally: `cargo build --features updater` from `src-tauri/`
- in CI: add `--features updater` to the `args:` line in
  `.github/workflows/release.yml`

And activate the updater capability file (it's pre-staged but disabled):

```bash
mv src-tauri/capabilities/updater.json.disabled src-tauri/capabilities/updater.json
```

### 3. GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value | Needed for |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | contents of `~/.tauri/hopsmd.key` | In-app updater signing |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the passphrase you set | In-app updater signing |
| `WINGET_PAT` | fine-grained PAT, `public_repo` scope | winget PR auto-submit |

The `GITHUB_TOKEN` used by tauri-action is auto-provided.

### 4. First winget submission (manual, just once)

`winget-releaser` only handles updates to **already-published** packages.
The very first version needs a manual PR.

```bash
# Cut release v0.1.0 first (CI runs, MSI + NSIS land on Releases).
# Get SHA256 of each installer from the release-asset metadata.

# Fork microsoft/winget-pkgs and clone your fork
gh repo fork microsoft/winget-pkgs --clone
cd winget-pkgs
git checkout -b cloudbrew-hopsmd-0.1.0

# Copy our templates into the correct path (lowercase first-letter folder!)
mkdir -p manifests/c/CloudBrew/HopsMD/0.1.0
cp ../HopsMD/winget/*.yaml manifests/c/CloudBrew/HopsMD/0.1.0/

# Edit the two SHA256 placeholders in installer.yaml with the real hashes
# Validate locally:
winget validate --manifest manifests/c/CloudBrew/HopsMD/0.1.0/

git add manifests/c/CloudBrew/HopsMD/0.1.0/
git commit -m "New version: CloudBrew.HopsMD version 0.1.0"
git push origin cloudbrew-hopsmd-0.1.0
gh pr create --repo microsoft/winget-pkgs --fill
```

Maintainers' automation validates and usually merges within a day or two.
Subsequent versions go through `winget-releaser` automatically.

---

## Recurring tasks

### Bumping the version

Three files must agree on the version string. There's no automation for
this yet — single search-and-replace:

```bash
# Example: 0.1.0 → 0.2.0
sed -i 's/"version": "0\.1\.0"/"version": "0.2.0"/' package.json src-tauri/tauri.conf.json
sed -i 's/^version = "0\.1\.0"/version = "0.2.0"/' src-tauri/Cargo.toml
```

### Producing installers locally for testing

```bash
npm run tauri:build
# → src-tauri/target/release/bundle/nsis/HopsMD_<v>_x64-setup.exe
# → src-tauri/target/release/bundle/msi/HopsMD_<v>_x64_en-US.msi
```

First build downloads WiX 3 + NSIS to the user-local Tauri cache (one-time,
~50 MB). Subsequent builds are warm.

### Testing the local manifest against winget

The committed manifests in `winget/` point at the future GitHub Release
URLs and use SHA256 placeholders — they're for the upstream PR, not for
local installation. To test the winget flow against your local build:

```powershell
# One-time:
winget settings --enable LocalManifestFiles

# Build installers + spin up a loopback HTTP server + write a throw-away
# manifest with real hashes to winget/local/ (gitignored):
npm run tauri:build
python scripts\winget_local_test.py

# In a second shell:
winget install --manifest .\winget\local\

# Cleanup:
winget uninstall CloudBrew.HopsMD
# Ctrl+C in the first shell to stop the HTTP server
```

Why the HTTP server: winget's manifest schema rejects `file://` URLs in
`InstallerUrl` and the install path always re-downloads + hash-verifies
the artefact, so we serve the bundle folder over `http://127.0.0.1:8765`
just long enough for the install to finish.

---

## SmartScreen and signing

Unsigned installers will show:

> Windows protected your PC
> Microsoft Defender SmartScreen prevented an unrecognized app from starting.

Users click **More info → Run anyway**. winget's `winget install` flow
bypasses SmartScreen entirely — that's the cleanest delivery path while
the project is unsigned.

### Migrating to SignPath.io (Free for OSS)

Once the project is publicly visible and has a few users:

1. Apply at <https://signpath.org/opensource> — they verify the GitHub
   org/repo and grant a free OV certificate.
2. SignPath provides a GitHub Action snippet that signs the installers as
   a post-build step. Drop it into `release.yml` between the
   `tauri-action` step and the release-publish step.
3. The cert chain is owned by SignPath; we never see the private key. No
   secret rotation on our side.

After SignPath is wired, SmartScreen accepts the installer immediately and
the in-app updater verification still works (the updater signature is
independent of the code-signing cert).

---

## Architecture cheatsheet

```
                       ┌──────────────────────────────────────┐
git push tag v0.2.0 ──►│ .github/workflows/release.yml        │
                       │  • tauri-action builds MSI + NSIS    │
                       │  • signs update artefacts (ed25519)  │
                       │  • drafts GitHub Release             │
                       └────────────────┬─────────────────────┘
                                        │
                  manually "Publish"    ▼
                       ┌──────────────────────────────────────┐
                       │ GitHub Release v0.2.0                │
                       │  • HopsMD_0.2.0_x64-setup.exe (NSIS) │
                       │  • HopsMD_0.2.0_x64_en-US.msi  (MSI) │
                       │  • latest.json + signatures          │
                       └─────────┬───────────────┬────────────┘
                                 │               │
       release.published         │               │  in-app check on startup
                                 ▼               ▼
                ┌────────────────────────┐  ┌────────────────────────────┐
                │ .github/winget.yml     │  │ tauri-plugin-updater       │
                │  vedantmgoyal2009/     │  │  • checks latest.json      │
                │  winget-releaser@v2    │  │  • verifies ed25519 sig    │
                │  • PR to winget-pkgs   │  │  • downloads + installs    │
                └───────────┬────────────┘  │  • relaunches              │
                            │               └──────────┬─────────────────┘
                            ▼                          ▼
                ┌────────────────────────┐  ┌────────────────────────────┐
                │ winget install         │  │ User sees "🍻 Neuer Sud    │
                │   CloudBrew.HopsMD     │  │  v0.2.0 — jetzt …" button  │
                └────────────────────────┘  └────────────────────────────┘
```
