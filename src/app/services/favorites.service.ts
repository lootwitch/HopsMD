import { Injectable, computed, signal } from '@angular/core';

/**
 * One entry in the Stammsudhaus-Liste. `label` is a user-chosen display
 * name shown in the sidebar; if absent, the UI falls back to the path's
 * basename.
 */
export interface Favorite {
  readonly path: string;
  readonly label?: string;
}

/**
 * Stammsudhaus-Liste — persistent set of pinned brewhouses the user can
 * jump between from the sidebar. Auto-open behaviour (which brewhouse the
 * app re-opens on launch) is intentionally *separate*: see
 * `lastBrewhouse` in MarkdownStructureService.
 *
 * Storage is `localStorage` (per Tauri webview origin). The reader migrates
 * the historic `string[]` shape to the current `Favorite[]` shape on the
 * fly so existing pins survive the upgrade.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private static readonly STORAGE_KEY = 'hopsmd:favorites';

  private readonly _favorites = signal<readonly Favorite[]>(this.read());
  readonly favorites = this._favorites.asReadonly();
  readonly count = computed(() => this._favorites().length);

  /** True when `path` is currently in the favorites list. */
  isPinned(path: string | null | undefined): boolean {
    if (!path) return false;
    return this._favorites().some((f) => f.path === path);
  }

  /** Append `path` to favorites if not already present. Returns true if added. */
  pin(path: string): boolean {
    if (this.isPinned(path)) return false;
    const next = [...this._favorites(), { path }];
    this._favorites.set(next);
    this.write(next);
    return true;
  }

  /** Remove `path` from favorites. Idempotent. */
  unpin(path: string): void {
    const next = this._favorites().filter((f) => f.path !== path);
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

  /** The custom display label for `path`, or null if it falls back to basename. */
  labelFor(path: string): string | null {
    return this._favorites().find((f) => f.path === path)?.label ?? null;
  }

  /**
   * Apply a custom display label to a pinned brewhouse. Pass null / empty
   * to clear the label so the UI falls back to basename. No-op if `path`
   * isn't pinned or the value would be unchanged.
   */
  rename(path: string, label: string | null): void {
    const trimmed = label?.trim() || null;
    let changed = false;
    const next: Favorite[] = this._favorites().map((f) => {
      if (f.path !== path) return f;
      if ((f.label ?? null) === trimmed) return f;
      changed = true;
      return trimmed ? { path: f.path, label: trimmed } : { path: f.path };
    });
    if (!changed) return;
    this._favorites.set(next);
    this.write(next);
  }

  private read(): Favorite[] {
    try {
      const raw = localStorage.getItem(FavoritesService.STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const seen = new Set<string>();
      const out: Favorite[] = [];
      for (const item of parsed) {
        const entry = this.parseEntry(item);
        if (!entry || seen.has(entry.path)) continue;
        seen.add(entry.path);
        out.push(entry);
      }
      return out;
    } catch {
      return [];
    }
  }

  /** Accept both the legacy `string` and current `{path, label?}` shapes. */
  private parseEntry(item: unknown): Favorite | null {
    if (typeof item === 'string' && item) return { path: item };
    if (!item || typeof item !== 'object') return null;
    const obj = item as { path?: unknown; label?: unknown };
    if (typeof obj.path !== 'string' || !obj.path) return null;
    if (typeof obj.label === 'string' && obj.label.trim()) {
      return { path: obj.path, label: obj.label.trim() };
    }
    return { path: obj.path };
  }

  private write(value: readonly Favorite[]): void {
    try {
      localStorage.setItem(FavoritesService.STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Private mode / quota / disabled storage — favourites simply don't persist.
    }
  }
}
