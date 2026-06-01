import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  createFolderBridge,
  createRecipeBridge,
  deletePathBridge,
  invokeBridge,
  isTauri,
  listenBridge,
  pickBrewhouse,
  renamePathBridge,
  saveRecipeBridge,
} from '../core/tauri-bridge';
import type { RecipeContent } from '../models/recipe-content.model';
import type { RecipeNode } from '../models/recipe-node.model';

const EVENT_RECIPE_CHANGED = 'recipe:changed';
const EVENT_BREWHOUSE_CHANGED = 'brewhouse:changed';
const LAST_BREWHOUSE_KEY = 'hopsmd:lastBrewhouse';

/**
 * Owns the tree-shaped state of the currently opened workspace
 * (the "Sudhaus"), the currently selected file, and the raw markdown
 * fetched from disk. Pure signals — no RxJS exposed to the UI.
 *
 * Also wires up the filesystem watcher. A single recursive watcher in Rust is
 * bound to the open workspace (`watch_brewhouse`), and we tell it which file is
 * open via `set_open_recipe`. It pushes two events:
 *
 * - `recipe:changed` — the open file's content changed on disk; we re-read it
 *   via `tap_recipe` so the view stays in sync with whatever editor is open.
 * - `brewhouse:changed` — a file/folder was added, removed, or renamed; we
 *   re-scan the tree (silently, only swapping it in when the structure really
 *   changed — see `rescanTree`).
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
  private readonly _mode = signal<'viewing' | 'editing'>('viewing');
  private readonly _editBuffer = signal<string>('');
  private readonly _externalConflict = signal<boolean>(false);

  // --- public read-only views ---
  readonly brewhouse = this._brewhouse.asReadonly();
  readonly tree = this._tree.asReadonly();
  readonly selectedPath = this._selectedPath.asReadonly();
  readonly selectedContent = this._selectedContent.asReadonly();
  readonly lastModified = this._lastModified.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly mode = this._mode.asReadonly();
  readonly editBuffer = this._editBuffer.asReadonly();
  readonly externalConflict = this._externalConflict.asReadonly();
  readonly dirty = computed(() => this._mode() === 'editing' && this._editBuffer() !== this._selectedContent());

  readonly isOpen = computed(() => this._tree() !== null);

  constructor() {
    if (isTauri()) {
      const unlisteners: Array<() => void> = [];
      void listenBridge<string>(EVENT_RECIPE_CHANGED, (path) => this.onRecipeChanged(path))
        .then((fn) => unlisteners.push(fn));
      void listenBridge<unknown>(EVENT_BREWHOUSE_CHANGED, () => void this.rescanTree())
        .then((fn) => unlisteners.push(fn));
      inject(DestroyRef).onDestroy(() => unlisteners.forEach((fn) => fn()));

      // Auto-open the brewhouse that was active last time we ran. This is
      // decoupled from the favourites list — favourites are a manual
      // bookmark set, "last opened" is automatic session continuity.
      // Failures surface through the normal error banner; we do not clear
      // the last-opened on failure (network drive offline ≠ wipe state).
      //
      // Deferred to a macrotask so the UI shell paints first. A huge
      // recipe tree (or a network drive) can take noticeable time to scan
      // in Rust, and we'd rather the user see the empty-state for a beat
      // than stare at the Tauri window's background colour while the
      // scan + initial parse + Mermaid lazy-load all run in one CD pass.
      const last = this.readLastBrewhouse();
      if (last) setTimeout(() => void this.loadBrewhouse(last), 0);
    }
  }

  /** Switch to a brewhouse by absolute path (e.g. from the favourites list). */
  async openByPath(path: string): Promise<void> {
    await this.loadBrewhouse(path);
  }

  /** Surface a one-off error message in the same banner the loader uses. */
  showError(message: string): void {
    this._error.set(message);
  }

  /** Clear the error banner. */
  clearError(): void {
    this._error.set(null);
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
    await this.openFileByPath(node.path);
  }

  /** Enter edit mode, seeding the buffer from the current on-disk content. */
  enterEditing(): void {
    if (!this._selectedPath()) return;
    this._editBuffer.set(this._selectedContent());
    this._externalConflict.set(false);
    this._mode.set('editing');
  }

  /** Editor change handler. */
  updateBuffer(text: string): void {
    this._editBuffer.set(text);
  }

  /** Leave edit mode, discarding the buffer. Caller is responsible for the
   *  unsaved-changes guard. */
  cancelEditing(): void {
    this._mode.set('viewing');
    this._editBuffer.set('');
    this._externalConflict.set(false);
  }

  /** Write the buffer to disk and return to viewing. */
  async saveRecipe(): Promise<void> {
    const path = this._selectedPath();
    if (!path || this._mode() !== 'editing') return;
    const content = this._editBuffer();
    this._loading.set(true);
    this._error.set(null);
    try {
      await saveRecipeBridge(path, content);
      // Set selectedContent to what is now on disk so the watcher echo-cancels
      // the resulting recipe:changed and `dirty` clears.
      this._selectedContent.set(content);
      this._lastModified.set(Date.now());
      this._externalConflict.set(false);
      this._mode.set('viewing');
      this._editBuffer.set('');
    } catch (err) {
      this._error.set(this.describe(err));
    } finally {
      this._loading.set(false);
    }
  }

  /** Reload the open file from disk, discarding the edit buffer (used by the
   *  external-change conflict banner's "Reload" action). */
  async reloadFromDisk(): Promise<void> {
    const path = this._selectedPath();
    if (!path) return;
    try {
      await this.tap(path);
      this._editBuffer.set(this._selectedContent());
      this._externalConflict.set(false);
    } catch (err) {
      this._error.set(this.describe(err));
    }
  }

  /** Dismiss the conflict banner, keeping the user's edits. */
  keepMyEdits(): void {
    this._externalConflict.set(false);
  }

  /**
   * Open an arbitrary markdown file by absolute path — used for cross-file
   * links inside the viewer, where the target isn't necessarily the node
   * the user just clicked in the tree. Reads via `tap_recipe` and tells the
   * brewhouse watcher which file is now open via `set_open_recipe`.
   */
  async openFileByPath(path: string): Promise<void> {
    if (this.dirty()) {
      this._error.set('Ungespeicherte Änderungen — bitte zuerst speichern oder verwerfen.');
      return;
    }
    this._loading.set(true);
    this._error.set(null);
    this._selectedPath.set(path);
    try {
      await this.tap(path);
      try {
        await invokeBridge<void>('set_open_recipe', { path });
      } catch (err) {
        this._error.set(`Watcher could not start: ${this.describe(err)}`);
      }
    } catch (err) {
      this._selectedContent.set('');
      this._lastModified.set(null);
      this._error.set(this.describe(err));
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Clear current selection (e.g. when switching workspaces). The brewhouse
   * watcher keeps running — only the "open file" pointer is cleared, so tree
   * changes still flow in.
   */
  closeRecipe(): void {
    this._selectedPath.set(null);
    this._selectedContent.set('');
    this._lastModified.set(null);
    this._mode.set('viewing');
    this._editBuffer.set('');
    this._externalConflict.set(false);
    if (isTauri()) {
      void invokeBridge<void>('set_open_recipe', { path: null }).catch(() => undefined);
    }
  }

  // --- file operations (tree) ---

  async newFile(dir: string, name: string): Promise<string | null> {
    try {
      return await createRecipeBridge(dir, name);
    } catch (err) {
      this._error.set(this.describe(err));
      return null;
    }
  }

  async newFolder(dir: string, name: string): Promise<void> {
    try {
      await createFolderBridge(dir, name);
    } catch (err) {
      this._error.set(this.describe(err));
    }
  }

  async renameEntry(from: string, toName: string): Promise<string | null> {
    try {
      return await renamePathBridge(from, toName);
    } catch (err) {
      this._error.set(this.describe(err));
      return null;
    }
  }

  async deleteEntry(path: string): Promise<void> {
    try {
      await deletePathBridge(path);
      if (this._selectedPath() === path) this.closeRecipe();
    } catch (err) {
      this._error.set(this.describe(err));
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
    void invokeBridge<RecipeContent>('tap_recipe', { path })
      .then((result) => {
        if (path !== this._selectedPath()) return; // raced selection change
        // Echo-cancel: identical content means this is our own save bouncing
        // back through the watcher — ignore it.
        if (result.content === this._selectedContent()) return;
        // Genuine external change.
        if (this._mode() === 'editing') {
          // Update the on-disk baseline but DON'T clobber the buffer; warn.
          this._selectedContent.set(result.content);
          this._lastModified.set(result.modifiedAt ?? Date.now());
          this._externalConflict.set(true);
          return;
        }
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
      this.writeLastBrewhouse(tree.path);
      // Start (or replace) the recursive watcher for this workspace so the
      // tree auto-updates as files come and go. Non-fatal: if it fails the
      // viewer still works, the tree just won't refresh on its own.
      try {
        await invokeBridge<void>('watch_brewhouse', { path: tree.path });
      } catch (err) {
        this._error.set(`Folder watching could not start: ${this.describe(err)}`);
      }
    } catch (err) {
      this._tree.set(null);
      this._brewhouse.set(null);
      this._error.set(this.describe(err));
      if (isTauri()) {
        void invokeBridge<void>('unwatch_brewhouse').catch(() => undefined);
      }
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Re-scan the open workspace after a `brewhouse:changed` event and swap in
   * the new tree only when its structure actually changed. Editors save
   * atomically (temp file → rename), which can surface as create/remove
   * events even for a pure content edit; the fingerprint comparison is the
   * reliable arbiter so the sidebar never flickers on a plain save.
   *
   * Deliberately silent: no `loading` flag, no change to the current
   * selection. Angular preserves each folder's expanded state and the active
   * node across the swap because the tree template tracks children by path.
   */
  private async rescanTree(): Promise<void> {
    const root = this._brewhouse();
    if (!root) return;
    try {
      const tree = await invokeBridge<RecipeNode>('open_brewhouse', { path: root });
      if (this._brewhouse() !== root) return; // raced a workspace switch
      if (this.treeFingerprint(tree) === this.treeFingerprint(this._tree())) return;
      this._tree.set(tree);
    } catch (err) {
      this._error.set(this.describe(err));
    }
  }

  /**
   * Stable signature of a tree's *structure* (every node's path, in the
   * already-deterministic scan order). Content and mtimes are irrelevant here
   * — only which files and folders exist.
   */
  private treeFingerprint(node: RecipeNode | null): string {
    if (!node) return '';
    const parts: string[] = [];
    const walk = (n: RecipeNode): void => {
      parts.push((n.isDir ? 'D:' : 'F:') + n.path);
      for (const child of n.children) walk(child);
    };
    walk(node);
    return parts.join('\n');
  }

  private readLastBrewhouse(): string | null {
    try {
      return localStorage.getItem(LAST_BREWHOUSE_KEY);
    } catch {
      return null;
    }
  }

  private writeLastBrewhouse(path: string): void {
    try {
      localStorage.setItem(LAST_BREWHOUSE_KEY, path);
    } catch {
      // Private mode / disabled storage — auto-resume just won't work next time.
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
