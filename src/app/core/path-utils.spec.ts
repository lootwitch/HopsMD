import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, resolveObsidianStyle, resolveRelative } from './path-utils';

/**
 * Simulated vault matching the reported bug: a note that isn't at the vault
 * root links to another note the way Obsidian writes it — relative to the
 * vault root, not to the linking file's own folder.
 *
 *   /vault/Home.md
 *   /vault/Projects/Alpha.md
 *   /vault/Projects/Notes/Detail.md
 *   /vault/Projects/Notes/Sibling.md
 *   /vault/assets/img.png
 */
function knownPaths(paths: readonly string[]): (path: string) => boolean {
  const known = new Set(paths.map(normalize));
  return (path: string) => known.has(normalize(path));
}

const exists = knownPaths([
  '/vault/Home.md',
  '/vault/Projects/Alpha.md',
  '/vault/Projects/Notes/Detail.md',
  '/vault/Projects/Notes/Sibling.md',
  '/vault/assets/img.png',
]);

test('falls back to a vault-root-relative resolution when the file-relative target does not exist', () => {
  const resolved = resolveObsidianStyle('/vault/Projects/Notes', '/vault', 'Projects/Alpha.md', exists);
  assert.equal(normalize(resolved), '/vault/Projects/Alpha.md');
});

test('keeps an ordinary same-folder relative link unaffected', () => {
  const resolved = resolveObsidianStyle('/vault/Projects/Notes', '/vault', './Sibling.md', exists);
  assert.equal(normalize(resolved), '/vault/Projects/Notes/Sibling.md');
});

test('prefers the file-relative resolution when both interpretations would exist', () => {
  const resolved = resolveObsidianStyle('/vault/Projects', '/vault', 'Notes/Detail.md', exists);
  assert.equal(normalize(resolved), '/vault/Projects/Notes/Detail.md');
});

test('falls back to a vault-root-relative resolution for image references too', () => {
  const resolved = resolveObsidianStyle('/vault/Projects/Notes', '/vault', 'assets/img.png', exists);
  assert.equal(normalize(resolved), '/vault/assets/img.png');
});

test('a broken link (neither location exists) falls back to the file-relative interpretation unchanged', () => {
  const resolved = resolveObsidianStyle('/vault/Projects/Notes', '/vault', 'Nowhere/Ghost.md', exists);
  assert.equal(resolved, resolveRelative('/vault/Projects/Notes', 'Nowhere/Ghost.md'));
});

test('behaves exactly like resolveRelative when no vault root is known', () => {
  const resolved = resolveObsidianStyle('/vault/Projects/Notes', null, 'assets/img.png', exists);
  assert.equal(resolved, resolveRelative('/vault/Projects/Notes', 'assets/img.png'));
});

test('passes protocol URLs through untouched', () => {
  const resolved = resolveObsidianStyle('/vault/Projects/Notes', '/vault', 'https://example.com/x.png', exists);
  assert.equal(resolved, 'https://example.com/x.png');
});

test('a link from a root-level file resolves the same way under both interpretations', () => {
  const resolved = resolveObsidianStyle('/vault', '/vault', 'Projects/Alpha.md', exists);
  assert.equal(normalize(resolved), '/vault/Projects/Alpha.md');
});
