import { Injectable, computed, effect, signal } from '@angular/core';

/**
 * The two font stacks HopsMD ships with. **Edit these constants to change
 * the app-wide defaults** — every UI element that uses `var(--hops-font)`
 * or `var(--hops-mono)` picks the new value up automatically.
 *
 * The matching declarations in `src/styles.scss` are intentionally kept in
 * sync as a no-JS fallback for the very first paint, in case the service
 * hasn't run yet. The service is the runtime source of truth.
 */
export const DEFAULT_BODY_FONT =
  '"Segoe UI", "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

export const DEFAULT_MONO_FONT =
  '"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", monospace';

const STORAGE_KEY = 'hopsmd:fonts';

interface StoredFonts {
  body?: string;
  mono?: string;
}

/**
 * Central registry for HopsMD's font families. Two signals back two CSS
 * custom properties:
 *
 *   --hops-font   →  body / UI text
 *   --hops-mono   →  code blocks, file paths, anywhere monospace is wanted
 *
 * Mutating via `setBody()` / `setMono()` updates the CSS variables and
 * persists the choice to localStorage, surviving restarts. `resetToDefaults()`
 * clears the persisted state and goes back to the DEFAULT_* constants above.
 *
 * Lifecycle: instantiated very early via `provideAppInitializer` in
 * app.config so the CSS variables are written before the first paint —
 * no flash of unstyled content for customised fonts.
 */
@Injectable({ providedIn: 'root' })
export class FontsService {
  private readonly _body = signal<string>(this.readStored().body ?? DEFAULT_BODY_FONT);
  private readonly _mono = signal<string>(this.readStored().mono ?? DEFAULT_MONO_FONT);

  readonly body = this._body.asReadonly();
  readonly mono = this._mono.asReadonly();

  /** True when the corresponding stack matches the shipped default. */
  readonly bodyIsDefault = computed(() => this._body() === DEFAULT_BODY_FONT);
  readonly monoIsDefault = computed(() => this._mono() === DEFAULT_MONO_FONT);

  constructor() {
    // Apply synchronously in the ctor so consumers downstream of the
    // initializer (e.g. the bootstrap-time stylesheet) see the variables
    // immediately. The effect below covers later changes.
    this.applyToDocument();

    effect(() => {
      this.applyToDocument();
      this.persistToStorage();
    });
  }

  /** Set the body / UI font stack. Pass an empty string to revert to default. */
  setBody(stack: string): void {
    this._body.set(stack.trim() || DEFAULT_BODY_FONT);
  }

  /** Set the monospace / code font stack. Pass an empty string to revert. */
  setMono(stack: string): void {
    this._mono.set(stack.trim() || DEFAULT_MONO_FONT);
  }

  resetToDefaults(): void {
    this._body.set(DEFAULT_BODY_FONT);
    this._mono.set(DEFAULT_MONO_FONT);
  }

  private applyToDocument(): void {
    const root = document.documentElement;
    root.style.setProperty('--hops-font', this._body());
    root.style.setProperty('--hops-mono', this._mono());
  }

  private persistToStorage(): void {
    try {
      const out: StoredFonts = {};
      if (this._body() !== DEFAULT_BODY_FONT) out.body = this._body();
      if (this._mono() !== DEFAULT_MONO_FONT) out.mono = this._mono();
      if (Object.keys(out).length === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      // Private mode / disabled storage — service still works, just not persistent.
    }
  }

  private readStored(): StoredFonts {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const obj = parsed as Record<string, unknown>;
      const out: StoredFonts = {};
      if (typeof obj['body'] === 'string' && obj['body']) out.body = obj['body'];
      if (typeof obj['mono'] === 'string' && obj['mono']) out.mono = obj['mono'];
      return out;
    } catch {
      return {};
    }
  }
}
