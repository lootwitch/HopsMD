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
