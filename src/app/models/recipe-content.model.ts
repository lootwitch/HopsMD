/**
 * Payload returned by the Rust `tap_recipe` command.
 * Shape mirrors `RecipeContent` in `commands/recipe_book.rs`.
 */
export interface RecipeContent {
  readonly content: string;
  /** Unix epoch milliseconds, or null when the OS doesn't expose mtime. */
  readonly modifiedAt: number | null;
}
