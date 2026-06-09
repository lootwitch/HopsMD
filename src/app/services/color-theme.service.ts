// src/app/services/color-theme.service.ts
import { Injectable, computed, effect, signal } from '@angular/core';
import type { TranslationKey } from './i18n.service';

/** The palette custom properties HopsMD themes, without the `--hops-` prefix. */
export const HOPS_TOKENS = [
  'foam',
  'pilsner',
  'amber',
  'stout',
  'stout-2',
  'stout-3',
  'malt',
  'cellar',
  'leaf',
  'cherry',
  'text',
  'text-dim',
  'border',
] as const;

export type HopsToken = (typeof HOPS_TOKENS)[number];

export interface ColorTheme {
  readonly id: string;
  readonly nameKey: TranslationKey;
  readonly tokens: Readonly<Record<HopsToken, string>>;
}

const BREWPUB_DARK: ColorTheme = {
  id: 'brewpub-dark',
  nameKey: 'settings.preset.brewpubDark',
  tokens: {
    foam: '#f6efd9',
    pilsner: '#f5c542',
    amber: '#c87b1e',
    stout: '#1c130b',
    'stout-2': '#261a10',
    'stout-3': '#322215',
    malt: '#6b4a2b',
    cellar: '#0f0a06',
    leaf: '#6ea84f',
    cherry: '#b34036',
    text: '#efe6cf',
    'text-dim': '#b9ad8e',
    border: 'rgba(245, 197, 66, 0.18)',
  },
};

const PILSNER_HELL: ColorTheme = {
  id: 'pilsner-hell',
  nameKey: 'settings.preset.pilsnerHell',
  tokens: {
    foam: '#2a1c0e',
    pilsner: '#b9851a',
    amber: '#a85e15',
    stout: '#efe2c6',
    'stout-2': '#e7d7b6',
    'stout-3': '#ddcaa3',
    malt: '#c9b483',
    cellar: '#f4ecd8',
    leaf: '#4f7d36',
    cherry: '#9c2f26',
    text: '#2e2415',
    'text-dim': '#6b5a3c',
    border: 'rgba(120, 90, 20, 0.25)',
  },
};

const HOHER_KONTRAST: ColorTheme = {
  id: 'hoher-kontrast',
  nameKey: 'settings.preset.hoherKontrast',
  tokens: {
    foam: '#ffffff',
    pilsner: '#ffd000',
    amber: '#ff8c00',
    stout: '#0a0a0a',
    'stout-2': '#141414',
    'stout-3': '#1f1f1f',
    malt: '#888888',
    cellar: '#000000',
    leaf: '#4ade80',
    cherry: '#ff5a4d',
    text: '#ffffff',
    'text-dim': '#cfcfcf',
    border: 'rgba(255, 255, 255, 0.5)',
  },
};

export const COLOR_THEMES: readonly ColorTheme[] = [
  BREWPUB_DARK,
  PILSNER_HELL,
  HOHER_KONTRAST,
];

const DEFAULT_THEME_ID = BREWPUB_DARK.id;
const STORAGE_KEY = 'hopsmd:theme';

interface StoredTheme {
  preset?: string;
  overrides?: Partial<Record<HopsToken, string>>;
}

/**
 * Central registry for HopsMD's colour palette. A preset id + a map of
 * per-token overrides back the 13 `--hops-*` custom properties. Selecting a
 * preset clears overrides; fine-tuning a single token records an override on
 * top of the active preset.
 *
 * `styles.scss :root` holds the same values as the default (`brewpub-dark`)
 * preset and stays the no-JS first-paint fallback — so when the user is at the
 * pure default we *remove* the inline properties and let the stylesheet win.
 *
 * Lifecycle mirrors FontsService: instantiated via `provideAppInitializer` so
 * the variables are written before first paint (no flash of default colours).
 */
@Injectable({ providedIn: 'root' })
export class ColorThemeService {
  readonly presets = COLOR_THEMES;

  private readonly _presetId = signal<string>(DEFAULT_THEME_ID);
  private readonly _overrides = signal<Partial<Record<HopsToken, string>>>({});

  readonly presetId = this._presetId.asReadonly();
  readonly activePreset = computed<ColorTheme>(
    () => this.presets.find((p) => p.id === this._presetId()) ?? BREWPUB_DARK,
  );
  readonly isDefault = computed(
    () =>
      this._presetId() === DEFAULT_THEME_ID &&
      Object.keys(this._overrides()).length === 0,
  );

  constructor() {
    const stored = this.readStored();
    if (stored.preset && this.presets.some((p) => p.id === stored.preset)) {
      this._presetId.set(stored.preset);
    }
    // `stored.overrides` was already sanitised by readStored().
    if (stored.overrides) {
      this._overrides.set(stored.overrides);
    }

    // Apply synchronously so the initializer writes variables before paint.
    this.applyToDocument();

    effect(() => {
      this.applyToDocument();
      this.persistToStorage();
    });
  }

  /** Effective value of a token: the override if present, else the preset's. */
  token(t: HopsToken): string {
    return this._overrides()[t] ?? this.activePreset().tokens[t];
  }

  /** Switch base preset. Clears any per-token overrides. */
  setPreset(id: string): void {
    if (!this.presets.some((p) => p.id === id)) return;
    this._overrides.set({});
    this._presetId.set(id);
  }

  /** Advance to the next preset in order, wrapping around. Drives the toolbar's
   *  one-click theme switcher (mirrors the locale toggle). Clears overrides. */
  cycle(): void {
    const i = this.presets.findIndex((p) => p.id === this._presetId());
    const next = this.presets[(i + 1) % this.presets.length];
    this.setPreset(next.id);
  }

  /** Override a single token on top of the active preset. */
  setToken(t: HopsToken, value: string): void {
    this._overrides.update((o) => ({ ...o, [t]: value }));
  }

  /** Drop a single override, reverting the token to the preset value. */
  resetToken(t: HopsToken): void {
    this._overrides.update((o) => {
      const next = { ...o };
      delete next[t];
      return next;
    });
  }

  /** Back to the shipped default preset with no overrides. */
  resetAll(): void {
    this._overrides.set({});
    this._presetId.set(DEFAULT_THEME_ID);
  }

  private applyToDocument(): void {
    const root = document.documentElement;
    if (this.isDefault()) {
      for (const t of HOPS_TOKENS) root.style.removeProperty(`--hops-${t}`);
      return;
    }
    const preset = this.activePreset();
    const overrides = this._overrides();
    for (const t of HOPS_TOKENS) {
      root.style.setProperty(`--hops-${t}`, overrides[t] ?? preset.tokens[t]);
    }
  }

  private persistToStorage(): void {
    try {
      if (this.isDefault()) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const out: StoredTheme = { preset: this._presetId() };
      const overrides = this._overrides();
      if (Object.keys(overrides).length > 0) out.overrides = overrides;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      // Private mode / disabled storage — service still works, just not persistent.
    }
  }

  private readStored(): StoredTheme {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const obj = parsed as Record<string, unknown>;
      const out: StoredTheme = {};
      if (typeof obj['preset'] === 'string') out.preset = obj['preset'];
      if (obj['overrides'] && typeof obj['overrides'] === 'object') {
        out.overrides = this.sanitizeOverrides(
          obj['overrides'] as Record<string, unknown>,
        );
      }
      return out;
    } catch {
      return {};
    }
  }

  /** Keep only known tokens with string values. */
  private sanitizeOverrides(
    raw: Record<string, unknown>,
  ): Partial<Record<HopsToken, string>> {
    const out: Partial<Record<HopsToken, string>> = {};
    for (const t of HOPS_TOKENS) {
      const v = raw[t];
      if (typeof v === 'string' && v) out[t] = v;
    }
    return out;
  }
}
