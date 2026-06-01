import { Injectable, signal } from '@angular/core';
import type { RecipeNode } from '../models/recipe-node.model';

/**
 * Internal state for the tree's right-click menu.
 */
interface ContextMenuState {
  readonly node: RecipeNode;
  readonly x: number;
  readonly y: number;
}

/** File-operation actions the context menu can request the tree to start. */
export type FileOpAction = 'rename' | 'new-file' | 'new-folder' | 'delete';

/**
 * Lightweight singleton coordinating the tree's right-click menu. The tree
 * components call `open(node, event)`; the menu component subscribes to the
 * state signal and renders itself at the cursor.
 *
 * File-operation actions (rename, new file, new folder, delete) are relayed
 * back to the tree via `pendingAction`. The tree component sets a handler via
 * `registerActionHandler`; the menu component fires `requestAction`.
 */
@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  private readonly _state = signal<ContextMenuState | null>(null);
  readonly state = this._state.asReadonly();

  /** All currently-mounted tree nodes register a handler here. */
  private readonly _actionHandlers = new Set<(node: RecipeNode, action: FileOpAction) => void>();

  open(node: RecipeNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this._state.set({ node, x: event.clientX, y: event.clientY });
  }

  close(): void {
    this._state.set(null);
  }

  /**
   * Register a callback that is invoked when the user picks a file-operation
   * action from the menu. Returns an unregister function to call on destroy.
   * Each tree-node instance registers itself and filters by path internally.
   */
  registerActionHandler(
    handler: (node: RecipeNode, action: FileOpAction) => void,
  ): () => void {
    this._actionHandlers.add(handler);
    return () => this._actionHandlers.delete(handler);
  }

  /** Called by `ContextMenuComponent` to relay a file-op action to the tree. */
  requestAction(action: FileOpAction): void {
    const node = this._state()?.node ?? null;
    this.close();
    if (!node) return;
    for (const handler of this._actionHandlers) {
      handler(node, action);
    }
  }
}
