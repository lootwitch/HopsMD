import { Injectable, computed, signal } from '@angular/core';

/**
 * Stammsudhaus-Liste — persistent set of pinned brewhouses the user can
 * jump between from the sidebar. Auto-open behaviour (which brewhouse the
 * app re-opens on launch) is intentionally *separate*: see
 * `lastBrewhouse` in MarkdownStructureService.
 *
 * Single-source-of-truth: a deduped, insertion-ordered array of absolute
 * paths. Storage is `localStorage` (per Tauri webview origin) so no extra
 * plugin dependency is needed.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private static readonly STORAGE_KEY = 'hopsmd:favorites';

  private readonly _favorites = signal<readonly string[]>(this.read());
  readonly favorites = this._favorites.asReadonly();
  readonly count = computed(() => this._favorites().length);

  /** True when `path` is currently in the favorites list. */
  isPinned(path: string | null | undefined): boolean {
    if (!path) return false;
    return this._favorites().includes(path);
  }

  /** Append `path` to favorites if not already present. Returns true if added. */
  pin(path: string): boolean {
    if (this.isPinned(path)) return false;
    const next = [...this._favorites(), path];
    this._favorites.set(next);
    this.write(next);
    return true;
  }

  /** Remove `path` from favorites. Idempotent. */
  unpin(path: string): void {
    const next = this._favorites().filter((p) => p !== path);
    if (next.length === this._favorites().length) return;
    this._favorites.set(next);
    this.write(next);
  }

  /** Toggle pin state for `path`. Null/empty is a no-op. */
  toggle(path: string | null | undefined): void {
    if (!path) return;
    if (this.isPinned(path)) this.unpin(path);
    else this.pin(path);
  }

  private read(): string[] {
    try {
      const raw = localStorage.getItem(FavoritesService.STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Defensive: keep only string entries, dedupe in insertion order.
      const seen = new Set<string>();
      const out: string[] = [];
      for (const item of parsed) {
        if (typeof item !== 'string' || seen.has(item)) continue;
        seen.add(item);
        out.push(item);
      }
      return out;
    } catch {
      return [];
    }
  }

  private write(value: readonly string[]): void {
    try {
      localStorage.setItem(FavoritesService.STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Private mode / quota / disabled storage — favourites simply don't persist.
    }
  }
}
