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

/**
 * Lightweight singleton coordinating the tree's right-click menu. The tree
 * components call `open(node, event)`; the menu component subscribes to the
 * state signal and renders itself at the cursor.
 */
@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  private readonly _state = signal<ContextMenuState | null>(null);
  readonly state = this._state.asReadonly();

  open(node: RecipeNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this._state.set({ node, x: event.clientX, y: event.clientY });
  }

  close(): void {
    this._state.set(null);
  }
}
