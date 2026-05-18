"""
Generate a winget multi-file manifest that points at the locally-built
installers, serve them over loopback HTTP, so `winget install --manifest`
can verify the SHA256 hashes and run end-to-end.

Why this exists: winget's manifest schema rejects `file://` URLs in
`InstallerUrl` (it requires `http(s)://`), and the install path always
re-downloads + hash-verifies the artefact. So we serve the bundle
folder over `http://127.0.0.1:8765` just long enough for the install
to finish.

Prereqs:
  - winget settings --enable LocalManifestFiles   (one-time)
  - npm run tauri:build                            (produces installers)

Usage:
  python scripts/winget_local_test.py
  # Then in a second shell:
  winget install --manifest .\\winget\\local\\
  winget uninstall CloudBrew.HopsMD
  # Ctrl+C in the first shell to stop the HTTP server.

Optional flags:
  --port 8765          which loopback port to bind
  --version 0.1.0      which built version to manifest
"""
from __future__ import annotations

import argparse
import hashlib
import http.server
import os
import socketserver
import subprocess
import sys
from datetime import date
from pathlib import Path
from textwrap import dedent

REPO_ROOT = Path(__file__).resolve().parent.parent


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def write_manifest(out_dir: Path, version: str, port: int,
                   nsis_hash: str, msi_hash: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()

    (out_dir / "CloudBrew.HopsMD.installer.yaml").write_text(dedent(f"""\
        PackageIdentifier: CloudBrew.HopsMD
        PackageVersion: {version}
        InstallerLocale: en-US
        Platform:
          - Windows.Desktop
        MinimumOSVersion: 10.0.17763.0
        InstallModes:
          - interactive
          - silent
          - silentWithProgress
        UpgradeBehavior: install
        Scope: machine
        ReleaseDate: {today}
        Installers:
          - Architecture: x64
            InstallerType: nullsoft
            InstallerUrl: http://127.0.0.1:{port}/nsis/HopsMD_{version}_x64-setup.exe
            InstallerSha256: {nsis_hash}
          - Architecture: x64
            InstallerType: wix
            InstallerUrl: http://127.0.0.1:{port}/msi/HopsMD_{version}_x64_en-US.msi
            InstallerSha256: {msi_hash}
        ManifestType: installer
        ManifestVersion: 1.6.0
    """), encoding="utf-8")

    (out_dir / "CloudBrew.HopsMD.locale.en-US.yaml").write_text(dedent(f"""\
        PackageIdentifier: CloudBrew.HopsMD
        PackageVersion: {version}
        PackageLocale: en-US
        Publisher: CloudBrew
        PublisherUrl: https://github.com/CloudBrew
        PublisherSupportUrl: https://github.com/CloudBrew/HopsMD/issues
        Author: Ludwig Biermann
        PackageName: HopsMD
        PackageUrl: https://github.com/CloudBrew/HopsMD
        License: MIT
        LicenseUrl: https://github.com/CloudBrew/HopsMD/blob/main/LICENSE
        Copyright: "(C) 2026 Ludwig Biermann (CloudBrew)"
        ShortDescription: Local Markdown & Mermaid viewer.
        Description: |-
          HopsMD is a lightweight, offline-first reader for Markdown
          documentation with live MermaidJS diagram rendering. Local
          test build.
        Moniker: hopsmd
        Tags:
          - markdown
          - mermaid
          - viewer
          - documentation
          - tauri
          - cloudbrew
        ManifestType: defaultLocale
        ManifestVersion: 1.6.0
    """), encoding="utf-8")

    (out_dir / "CloudBrew.HopsMD.yaml").write_text(dedent(f"""\
        PackageIdentifier: CloudBrew.HopsMD
        PackageVersion: {version}
        DefaultLocale: en-US
        ManifestType: version
        ManifestVersion: 1.6.0
    """), encoding="utf-8")


def serve_forever(directory: Path, port: int) -> None:
    handler = lambda *a, **kw: http.server.SimpleHTTPRequestHandler(
        *a, directory=str(directory), **kw
    )
    # Allow quick rebind on Ctrl+C → re-run.
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nbye.", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--version", default="0.1.0")
    args = parser.parse_args()

    bundle_dir = REPO_ROOT / "src-tauri" / "target" / "release" / "bundle"
    nsis = bundle_dir / "nsis" / f"HopsMD_{args.version}_x64-setup.exe"
    msi  = bundle_dir / "msi"  / f"HopsMD_{args.version}_x64_en-US.msi"

    for p in (nsis, msi):
        if not p.exists():
            print(f"missing: {p}", file=sys.stderr)
            print("run `npm run tauri:build` first.", file=sys.stderr)
            return 1

    print("hashing installers...")
    nsis_hash = sha256(nsis)
    msi_hash  = sha256(msi)

    out_dir = REPO_ROOT / "winget" / "local"
    write_manifest(out_dir, args.version, args.port, nsis_hash, msi_hash)
    print(f"wrote manifest to {out_dir}")

    print("validating manifest...")
    rc = subprocess.call(["winget", "validate", "--manifest", str(out_dir)])
    if rc != 0:
        print(f"winget validate failed (exit {rc})", file=sys.stderr)
        return rc

    print()
    print(f"NSIS SHA256: {nsis_hash}")
    print(f"MSI  SHA256: {msi_hash}")
    print()
    print("In a SECOND shell:")
    print(f"  winget install --manifest {out_dir}")
    print("  winget uninstall CloudBrew.HopsMD")
    print()
    print(f"Serving bundle on http://127.0.0.1:{args.port}  (Ctrl+C to stop)")
    serve_forever(bundle_dir, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
