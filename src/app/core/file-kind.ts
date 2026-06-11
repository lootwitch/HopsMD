/** Coarse file classification driving which viewer a file opens in. Mirrors
 *  the Rust `FileKind` in commands/recipe_book.rs. */
export type FileKind =
  | 'markdown'
  | 'text'
  | 'email'
  | 'image'
  | 'json'
  | 'http'
  | 'pdf'
  | 'unsupported';

const MARKDOWN = ['md', 'markdown', 'mdx'];
const TEXT = ['txt', 'text', 'log'];
const EMAIL = ['eml', 'msg'];
const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'avif', 'ico'];
const JSON_FILES = ['json'];
const HTTP = ['http', 'rest'];
const PDF = ['pdf'];

/** Extract a lowercase extension (no dot) from a path or filename. */
export function extensionOf(pathOrName: string): string {
  const base = pathOrName.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function classify(pathOrName: string): FileKind {
  const ext = extensionOf(pathOrName);
  if (MARKDOWN.includes(ext)) return 'markdown';
  if (TEXT.includes(ext)) return 'text';
  if (EMAIL.includes(ext)) return 'email';
  if (IMAGE.includes(ext)) return 'image';
  if (JSON_FILES.includes(ext)) return 'json';
  if (HTTP.includes(ext)) return 'http';
  if (PDF.includes(ext)) return 'pdf';
  return 'unsupported';
}

/** Kinds the in-app editor can edit + save. */
export function isEditableKind(kind: FileKind): boolean {
  return kind === 'markdown' || kind === 'text' || kind === 'json' || kind === 'http';
}
