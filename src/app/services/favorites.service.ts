import { Injectable, signal } from '@angular/core';

/**
 * Persistent "Stammsudhaus" — the user's pinned brewhouse, auto-opened at
 * startup.
 *
 * Single-favorite model: pinning a new folder replaces the old one. State
 * lives in `localStorage` (per Tauri webview origin), so no extra plugin
 * dependency is needed. Reads happen once at service-construction time and
 * are surfaced as a signal that the toolbar binds to.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private static readonly STORAGE_KEY = 'hopsmd:favoriteBrewhouse';

  private readonly _favorite = signal<string | null>(this.read());
  readonly favorite = this._favorite.asReadonly();

  /** True when `path` is the currently pinned Stammsudhaus. */
  isPinned(path: string | null | undefined): boolean {
    return !!path && path === this._favorite();
  }

  /** Pin `path` as the Stammsudhaus, replacing any previous one. */
  pin(path: string): void {
    this._favorite.set(path);
    this.write(path);
  }

  /** Forget the Stammsudhaus. */
  unpin(): void {
    this._favorite.set(null);
    this.write(null);
  }

  /** Toggle the pin for the given path. Null paths are ignored. */
  toggle(path: string | null | undefined): void {
    if (!path) return;
    if (this.isPinned(path)) this.unpin();
    else this.pin(path);
  }

  private read(): string | null {
    try {
      return localStorage.getItem(FavoritesService.STORAGE_KEY);
    } catch {
      // Private mode / disabled storage — favorite simply doesn't persist.
      return null;
    }
  }

  private write(value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(FavoritesService.STORAGE_KEY);
      else localStorage.setItem(FavoritesService.STORAGE_KEY, value);
    } catch {
      // ignore — see read()
    }
  }
}
