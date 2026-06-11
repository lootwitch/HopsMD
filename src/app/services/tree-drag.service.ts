import { Injectable, signal } from '@angular/core';
import type { RecipeNode } from '../models/recipe-node.model';

/**
 * Holds the tree node currently being dragged. The HTML5 DnD API hides
 * `dataTransfer` payloads during `dragover`, so drop-target validation needs
 * this out-of-band signal. Set on dragstart, cleared on drop/dragend.
 */
@Injectable({ providedIn: 'root' })
export class TreeDragService {
  private readonly _dragged = signal<RecipeNode | null>(null);
  readonly dragged = this._dragged.asReadonly();

  start(node: RecipeNode): void {
    this._dragged.set(node);
  }

  clear(): void {
    this._dragged.set(null);
  }
}
