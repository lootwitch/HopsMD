import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { invokeBridge, isTauri, listenBridge, pickBrewhouse } from '../core/tauri-bridge';
import type { RecipeContent } from '../models/recipe-content.model';
import type { RecipeNode } from '../models/recipe-node.model';

const EVENT_RECIPE_CHANGED = 'recipe:changed';

/**
 * Owns the tree-shaped state of the currently opened workspace
 * (the "Sudhaus"), the currently selected file, and the raw markdown
 * fetched from disk. Pure signals — no RxJS exposed to the UI.
 *
 * Also wires up the filesystem watcher: when a recipe is selected, we ask
 * Rust to watch it via `watch_recipe`, and on every `recipe:changed` event
 * for the currently-selected path we re-read the file so the view stays in
 * sync with whatever editor the user has open.
 */
@Injectable({ providedIn: 'root' })
export class MarkdownStructureService {
  // --- state ---
  private readonly _brewhouse = signal<string | null>(null);
  private readonly _tree = signal<RecipeNode | null>(null);
  private readonly _selectedPath = signal<string | null>(null);
  private readonly _selectedContent = signal<string>('');
  private readonly _lastModified = signal<number | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // --- public read-only views ---
  readonly brewhouse = this._brewhouse.asReadonly();
  readonly tree = this._tree.asReadonly();
  readonly selectedPath = this._selectedPath.asReadonly();
  readonly selectedContent = this._selectedContent.asReadonly();
  readonly lastModified = this._lastModified.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isOpen = computed(() => this._tree() !== null);

  constructor() {
    if (isTauri()) {
      let unlisten: (() => void) | null = null;
      void listenBridge<string>(EVENT_RECIPE_CHANGED, (path) => this.onRecipeChanged(path))
        .then((fn) => (unlisten = fn));
      inject(DestroyRef).onDestroy(() => unlisten?.());
    }
  }

  /** Show the native folder picker, then scan the chosen Sudhaus. */
  async openBrewhouse(): Promise<void> {
    try {
      const picked = await pickBrewhouse();
      if (!picked) return;
      await this.loadBrewhouse(picked);
    } catch (err) {
      this._error.set(this.describe(err));
    }
  }

  /** Re-scan the current Sudhaus (e.g. after files were added on disk). */
  async refresh(): Promise<void> {
    const current = this._brewhouse();
    if (!current) return;
    await this.loadBrewhouse(current);
  }

  /** Load a specific markdown file's contents. Path must come from the tree. */
  async selectRecipe(node: RecipeNode): Promise<void> {
    if (node.isDir) return;
    this._loading.set(true);
    this._error.set(null);
    this._selectedPath.set(node.path);
    try {
      await this.tap(node.path);
      // Start (or replace) the filesystem watch for live reload. Failures
      // here shouldn't abort the read — surface as error banner but keep the
      // file open in read-only mode.
      try {
        await invokeBridge<void>('watch_recipe', { path: node.path });
      } catch (err) {
        this._error.set(`Watcher konnte nicht starten: ${this.describe(err)}`);
      }
    } catch (err) {
      this._selectedContent.set('');
      this._lastModified.set(null);
      this._error.set(this.describe(err));
    } finally {
      this._loading.set(false);
    }
  }

  /** Clear current selection (e.g. when switching workspaces). */
  closeRecipe(): void {
    this._selectedPath.set(null);
    this._selectedContent.set('');
    this._lastModified.set(null);
    if (isTauri()) {
      void invokeBridge<void>('unwatch_recipe').catch(() => undefined);
    }
  }

  // --- internals ---

  private async tap(path: string): Promise<void> {
    const result = await invokeBridge<RecipeContent>('tap_recipe', { path });
    this._selectedContent.set(result.content);
    this._lastModified.set(result.modifiedAt ?? Date.now());
  }

  private onRecipeChanged(path: string): void {
    if (path !== this._selectedPath()) return;
    // Best-effort silent re-read. We don't toggle the global loading flag —
    // a flicker on every save would be worse than a stale half-second of
    // content. Errors get surfaced through the error banner.
    void invokeBridge<RecipeContent>('tap_recipe', { path })
      .then((result) => {
        if (path !== this._selectedPath()) return; // raced selection change
        this._selectedContent.set(result.content);
        this._lastModified.set(result.modifiedAt ?? Date.now());
        this._error.set(null);
      })
      .catch((err) => this._error.set(this.describe(err)));
  }

  private async loadBrewhouse(path: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    this.closeRecipe();
    try {
      const tree = await invokeBridge<RecipeNode>('open_brewhouse', { path });
      this._tree.set(tree);
      this._brewhouse.set(tree.path);
    } catch (err) {
      this._tree.set(null);
      this._brewhouse.set(null);
      this._error.set(this.describe(err));
    } finally {
      this._loading.set(false);
    }
  }

  private describe(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}
