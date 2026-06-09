import { Injectable, effect, signal } from '@angular/core';

/**
 * App-wide zoom for the rendered Markdown article (`.hops-markdown`).
 *
 * Ctrl + Mousewheel scales the readable content via the CSS custom property
 * `--hops-content-scale`. The chrome around the article (sidebar, toolbar,
 * file path bar) stays at its native size so layout doesn't drift around as
 * the user adjusts text size for reading comfort.
 *
 * Scale is persisted to localStorage so the next session opens at the same
 * zoom — fonts, locale, favourites and TOC collapse all follow the same
 * "remember it for me" pattern.
 *
 * Not to be confused with the Mermaid fullscreen pan/zoom in
 * MermaidFullscreenService — that one zooms a single diagram in an overlay,
 * this one zooms the article body.
 */
export const MIN_SCALE = 0.6;
export const MAX_SCALE = 2.5;
export const STEP = 0.1;
const DEFAULT_SCALE = 1.0;
const STORAGE_KEY = 'hopsmd:contentScale';

@Injectable({ providedIn: 'root' })
export class ContentZoomService {
  private readonly _scale = signal<number>(this.readStored() ?? DEFAULT_SCALE);

  readonly scale = this._scale.asReadonly();

  constructor() {
    this.applyToDocument();

    effect(() => {
      this.applyToDocument();
      this.persistToStorage();
    });

    // Ctrl+wheel anywhere in the window adjusts the content scale. passive:
    // false so we can call preventDefault and stop the browser from doing its
    // own page zoom on top of ours.
    window.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** Increase by one step. Clamps to MAX_SCALE. */
  increase(): void {
    this.setScale(this._scale() + STEP);
  }

  /** Decrease by one step. Clamps to MIN_SCALE. */
  decrease(): void {
    this.setScale(this._scale() - STEP);
  }

  reset(): void {
    this._scale.set(DEFAULT_SCALE);
  }

  /** Set absolute scale, rounded to one decimal and clamped to [MIN, MAX]. */
  setScale(value: number): void {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rounded));
    this._scale.set(clamped);
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey || event.deltaY === 0) return;
    event.preventDefault();
    // Direction-based step rather than scaling by |deltaY| — mouse wheels and
    // trackpads emit wildly different magnitudes, fixed steps feel intentional.
    if (event.deltaY < 0) this.increase();
    else this.decrease();
  };

  private applyToDocument(): void {
    document.documentElement.style.setProperty(
      '--hops-content-scale',
      String(this._scale()),
    );
  }

  private persistToStorage(): void {
    try {
      if (this._scale() === DEFAULT_SCALE) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(this._scale()));
    } catch {
      // Private mode / disabled storage — service still works, just not persistent.
    }
  }

  private readStored(): number | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return null;
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, parsed));
    } catch {
      return null;
    }
  }
}
