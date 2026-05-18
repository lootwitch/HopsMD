import { Injectable, signal } from '@angular/core';

/**
 * Holds the currently-fullscreened Mermaid SVG element (cloned from the
 * inline diagram so the original keeps its event handlers intact).
 *
 * The MermaidFullscreenComponent subscribes to `svg()` and mounts the
 * clone into its overlay; `close()` clears the slot which removes the
 * overlay.
 */
@Injectable({ providedIn: 'root' })
export class MermaidFullscreenService {
  private readonly _svg = signal<SVGElement | null>(null);
  readonly svg = this._svg.asReadonly();

  open(svg: SVGElement): void {
    this._svg.set(svg);
  }

  close(): void {
    this._svg.set(null);
  }
}
