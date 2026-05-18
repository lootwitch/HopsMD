import { Injectable, computed, signal } from '@angular/core';
import { invokeBridge, pickBrewhouse } from '../core/tauri-bridge';
import type { RecipeNode } from '../models/recipe-node.model';

/**
 * Owns the tree-shaped state of the currently opened workspace
 * (the "Sudhaus"), the currently selected file, and the raw markdown
 * fetched from disk. Pure signals — no RxJS exposed to the UI.
 */
@Injectable({ providedIn: 'root' })
export class MarkdownStructureService {
  // --- state ---
  private readonly _brewhouse = signal<string | null>(null);
  private readonly _tree = signal<RecipeNode | null>(null);
  private readonly _selectedPath = signal<string | null>(null);
  private readonly _selectedContent = signal<string>('');
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // --- public read-only views ---
  readonly brewhouse = this._brewhouse.asReadonly();
  readonly tree = this._tree.asReadonly();
  readonly selectedPath = this._selectedPath.asReadonly();
  readonly selectedContent = this._selectedContent.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isOpen = computed(() => this._tree() !== null);

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
      const content = await invokeBridge<string>('tap_recipe', { path: node.path });
      this._selectedContent.set(content);
    } catch (err) {
      this._selectedContent.set('');
      this._error.set(this.describe(err));
    } finally {
      this._loading.set(false);
    }
  }

  /** Clear current selection (e.g. when switching workspaces). */
  closeRecipe(): void {
    this._selectedPath.set(null);
    this._selectedContent.set('');
  }

  // --- internals ---

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
