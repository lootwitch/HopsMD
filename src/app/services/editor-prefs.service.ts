import { Injectable, effect, signal } from '@angular/core';

const SPELLCHECK_KEY = 'hopsmd:editor.spellcheck';
const AUTOSAVE_KEY = 'hopsmd:editor.autoSave';
const AUTOSAVE_DELAY_KEY = 'hopsmd:editor.autoSaveDelayMs';

const AUTOSAVE_DEFAULT_DELAY_MS = 1500;
const AUTOSAVE_MIN_DELAY_MS = 300;
const AUTOSAVE_MAX_DELAY_MS = 10_000;

const readBool = (key: string, fallback: boolean): boolean => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1' || raw === 'true';
  } catch {
    return fallback;
  }
};

const readNumber = (key: string, fallback: number, min: number, max: number): number => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  } catch {
    return fallback;
  }
};

/**
 * User preferences scoped to the CodeMirror editor — spellcheck on/off,
 * auto-save on/off, auto-save debounce. Each setting persists to localStorage
 * the moment it changes.
 *
 * Kept separate from theme/font/zoom services because these don't affect the
 * rendered article — only the edit experience.
 */
@Injectable({ providedIn: 'root' })
export class EditorPrefsService {
  readonly spellcheck = signal<boolean>(readBool(SPELLCHECK_KEY, false));
  readonly autoSave = signal<boolean>(readBool(AUTOSAVE_KEY, false));
  readonly autoSaveDelayMs = signal<number>(
    readNumber(AUTOSAVE_DELAY_KEY, AUTOSAVE_DEFAULT_DELAY_MS, AUTOSAVE_MIN_DELAY_MS, AUTOSAVE_MAX_DELAY_MS),
  );

  readonly minAutoSaveDelay = AUTOSAVE_MIN_DELAY_MS;
  readonly maxAutoSaveDelay = AUTOSAVE_MAX_DELAY_MS;

  constructor() {
    effect(() => {
      try { localStorage.setItem(SPELLCHECK_KEY, this.spellcheck() ? '1' : '0'); } catch { /* ignore */ }
    });
    effect(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, this.autoSave() ? '1' : '0'); } catch { /* ignore */ }
    });
    effect(() => {
      try { localStorage.setItem(AUTOSAVE_DELAY_KEY, String(this.autoSaveDelayMs())); } catch { /* ignore */ }
    });
  }
}
