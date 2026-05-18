/**
 * One entry in the recipe book — either a folder or a markdown file.
 * Shape mirrors the Rust `RecipeNode` returned by `open_brewhouse`.
 */
export interface RecipeNode {
  /** Display name (basename). */
  readonly name: string;
  /** Absolute path on disk. */
  readonly path: string;
  /** True if this node is a directory. */
  readonly isDir: boolean;
  /** Lowercase extension without dot, or empty string for directories. */
  readonly extension: string;
  /** Child nodes — empty for files; sorted folders-first, then case-insensitive name. */
  readonly children: ReadonlyArray<RecipeNode>;
}
