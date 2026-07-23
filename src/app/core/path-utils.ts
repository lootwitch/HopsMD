/**
 * Tiny cross-platform path helpers. Tauri returns Windows-style paths on
 * Windows and POSIX paths on Unix; the viewer normalises both to forward
 * slashes for joining/relative resolution, then hands the result back to
 * Tauri unchanged (Tauri accepts either separator).
 */

const SEP_RE = /[\\/]+/g;

export function normalize(path: string): string {
  return path.replace(SEP_RE, '/').replace(/\/+$/g, '');
}

export function dirname(path: string): string {
  const n = normalize(path);
  const idx = n.lastIndexOf('/');
  return idx <= 0 ? n : n.slice(0, idx);
}

export function basename(path: string): string {
  const n = normalize(path);
  const idx = n.lastIndexOf('/');
  return idx < 0 ? n : n.slice(idx + 1);
}

/**
 * Resolve a relative reference (`./img/foo.png`, `../assets/bar.svg`,
 * `media/baz.gif`) against an absolute base directory. Absolute paths and
 * URLs are returned untouched.
 */
export function resolveRelative(base: string, ref: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return ref; // protocol — http, file, asset, data, …
  if (ref.startsWith('/')) return ref;
  if (/^[a-zA-Z]:[\\/]/.test(ref)) return ref; // windows absolute

  const baseParts = normalize(base).split('/').filter(Boolean);
  const refParts = normalize(ref).split('/').filter(Boolean);

  // Preserve a Windows drive prefix if present.
  const drive = /^[a-zA-Z]:$/.test(baseParts[0] ?? '') ? baseParts.shift() : undefined;

  for (const part of refParts) {
    if (part === '.') continue;
    if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }

  const joined = baseParts.join('/');
  return drive ? `${drive}/${joined}` : `/${joined}`;
}

/**
 * Resolve a relative reference the way real-world vaults actually write
 * them: some links are relative to the current file (plain Markdown
 * convention), others are relative to the vault root (Obsidian's default
 * "shortest path" / "absolute path in vault" link styles both produce these
 * once a file moves out of the root folder). We can't know which style a
 * given link uses, so we try file-relative first — unchanged default
 * behaviour — and only fall back to root-relative when that target doesn't
 * actually exist and a root-relative resolution does.
 */
export function resolveObsidianStyle(
  fileDir: string,
  vaultRoot: string | null,
  ref: string,
  exists: (path: string) => boolean,
): string {
  const relativeToFile = resolveRelative(fileDir, ref);
  if (!vaultRoot || exists(relativeToFile)) return relativeToFile;
  const relativeToRoot = resolveRelative(vaultRoot, ref);
  if (relativeToRoot !== relativeToFile && exists(relativeToRoot)) return relativeToRoot;
  return relativeToFile;
}
