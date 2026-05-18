import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'hopsmd:locale';

/**
 * English source of truth for every user-facing string in the app. TypeScript
 * enforces (via `Record<keyof typeof EN, string>` below) that the German
 * translation has the same key set, so adding a new English string without
 * a matching German one is a compile error.
 *
 * Placeholders use `{name}` and are filled by `t(key, { name: '…' })`.
 */
const EN = {
  // -- toolbar --
  'toolbar.brandTitle': 'HopsMD — a CloudBrew side project',
  'toolbar.brandTagline': 'brewing Markdown · CloudBrew',
  'toolbar.sudhausLabel': 'Brewhouse:',
  'toolbar.fileLabel': 'File:',
  'toolbar.noFileOpen': 'No file open — pick a recipe on the left.',
  'toolbar.noSudhaus': 'No brew in the kettle yet.',
  'toolbar.loading': '· mashing…',
  'toolbar.updateInstalling': 'Mashing the update…',
  'toolbar.updateAvailable': '🍻 New brew {version} — install now',
  'toolbar.updateTooltip': 'New version available',
  'toolbar.pickBrewhouse': 'Pick brewhouse',
  'toolbar.refresh': 'Refill',
  'toolbar.refreshTooltip': 'Refill — re-scan directory',
  'toolbar.toggleLocale': 'Switch language',

  // -- favourites panel --
  'favorites.title': 'Brewhouses',
  'favorites.unpinTooltip': 'Unpin from favourites',
  'favorites.pinCurrent': 'Pin: {name}',
  'favorites.pinCurrentEmpty': 'Pin',
  'favorites.empty':
    'No brewhouses pinned yet. Open one from the top-right, then a ‘＋ Pin’ button will appear here.',
  'favorites.entryTitleSuffix': '\n(double-click the name to rename)',

  // -- markdown view --
  'view.errorPrefix': 'Spilled:',
  'view.pickRecipeTitle': 'A freshly poured recipe awaits.',
  'view.pickRecipeBody':
    'Pick a Markdown document from the <strong>recipe book</strong> on the left.',
  'view.welcomeTitle': 'Welcome to the tap room.',
  'view.welcomeBody':
    'Open a <strong>brewhouse</strong> at the top right — a folder of Markdown files — to start.',
  'view.welcomeHint':
    'Tip: HopsMD understands GitHub-flavoured Markdown and live-rendered Mermaid diagrams.',
  'view.modifiedPrefix': 'Updated',

  // -- relative time --
  'time.justNow': 'just now',
  'time.secondsAgo': '{n}s ago',
  'time.minutesAgo': '{n}m ago',
  'time.hoursAgo': '{n}h ago',
  'time.dayAgo': '1 day ago',
  'time.daysAgo': '{n} days ago',

  // -- toc --
  'toc.title': 'Outline',
  'toc.show': 'Show outline',
  'toc.hide': 'Hide outline',
  'toc.ariaLabel': 'Table of contents',

  // -- mermaid fullscreen --
  'fullscreen.zoomOut': 'Zoom out (−)',
  'fullscreen.fit': 'Fit (0)',
  'fullscreen.zoomIn': 'Zoom in (+)',
  'fullscreen.close': 'Close (Esc)',
  'fullscreen.hint': 'Wheel / drag · +/− · 0 · Esc',

  // -- tree context menu --
  'ctx.openFolder': 'Open folder in Explorer',
  'ctx.revealFile': 'Reveal in Explorer',
  'ctx.openInEditor': 'Open with default editor',

  // -- code block toolbar (parser-emitted markup) --
  'code.toggleSource': 'Show source / renderer',
  'code.copy': 'Copy',
  'code.openInEditor': 'Open file in default editor',
  'code.fullscreen': 'Enlarge diagram',
  'code.mermaidPending': '🍺 Mashing…',

  // -- error messages --
  'error.diagramRerenderFailed': 'Diagram could not be re-rendered for fullscreen.',
  'error.noDocOpen': 'No document open — nothing to edit.',
  'error.openEditorFailed': 'Editor could not be opened: {detail}',
  'error.actionFailed': 'Action failed: {detail}',

  // -- mermaid render error overlay --
  'mermaid.couldntLoad': 'Mermaid could not load: {detail}',
  'mermaid.couldntDecode': 'Could not decode diagram source: {detail}',
  'mermaid.errorPrefix': 'Cloudiness in diagram:',
  'mermaid.sourceSeparator': '--- source ---',
} as const;

/** All known translation keys. */
export type TranslationKey = keyof typeof EN;

const DE: Record<TranslationKey, string> = {
  'toolbar.brandTitle': 'HopsMD — ein CloudBrew-Nebenprojekt',
  'toolbar.brandTagline': 'brewing Markdown · CloudBrew',
  'toolbar.sudhausLabel': 'Sudhaus:',
  'toolbar.fileLabel': 'Datei:',
  'toolbar.noFileOpen': 'Keine Datei geöffnet — wähle links ein Rezept aus.',
  'toolbar.noSudhaus': 'Noch kein Sud im Kessel.',
  'toolbar.loading': '· Maischen…',
  'toolbar.updateInstalling': 'Maischt das Update…',
  'toolbar.updateAvailable': '🍻 Neuer Sud {version} — jetzt installieren',
  'toolbar.updateTooltip': 'Neue Version verfügbar',
  'toolbar.pickBrewhouse': 'Sudhaus auswählen',
  'toolbar.refresh': 'Nachschlag',
  'toolbar.refreshTooltip': 'Nachschlag — Verzeichnis neu einlesen',
  'toolbar.toggleLocale': 'Sprache wechseln',

  'favorites.title': 'Sudhause',
  'favorites.unpinTooltip': 'Vom Stammsudhaus-Pin lösen',
  'favorites.pinCurrent': 'Anstecken: {name}',
  'favorites.pinCurrentEmpty': 'Anstecken',
  'favorites.empty':
    'Noch keine Stammsudhause angepinnt. Öffne oben rechts ein Sudhaus, dann erscheint hier ein „＋ Anstecken“-Button.',
  'favorites.entryTitleSuffix': '\n(Doppelklick auf den Namen zum Umbenennen)',

  'view.errorPrefix': 'Verschüttet:',
  'view.pickRecipeTitle': 'Frisch gezapft wartet ein Rezept.',
  'view.pickRecipeBody':
    'Wähle links im <strong>Rezeptbuch</strong> ein Markdown-Dokument, um es zu lesen.',
  'view.welcomeTitle': 'Willkommen im Schankraum.',
  'view.welcomeBody':
    'Öffne oben rechts ein <strong>Sudhaus</strong> — also einen Ordner mit Markdown-Dateien — um zu starten.',
  'view.welcomeHint':
    'Tipp: HopsMD versteht GitHub-Markdown und live gerenderte Mermaid-Diagramme.',
  'view.modifiedPrefix': 'Aktualisiert',

  'time.justNow': 'gerade aktualisiert',
  'time.secondsAgo': 'vor {n} Sek.',
  'time.minutesAgo': 'vor {n} Min.',
  'time.hoursAgo': 'vor {n} Std.',
  'time.dayAgo': 'vor 1 Tag',
  'time.daysAgo': 'vor {n} Tagen',

  'toc.title': 'Gliederung',
  'toc.show': 'Gliederung anzeigen',
  'toc.hide': 'Gliederung einklappen',
  'toc.ariaLabel': 'Inhaltsverzeichnis',

  'fullscreen.zoomOut': 'Verkleinern (−)',
  'fullscreen.fit': 'Anpassen (0)',
  'fullscreen.zoomIn': 'Vergrößern (+)',
  'fullscreen.close': 'Schließen (Esc)',
  'fullscreen.hint': 'Mausrad / Drag · +/− · 0 · Esc',

  'ctx.openFolder': 'Ordner im Explorer öffnen',
  'ctx.revealFile': 'Im Explorer anzeigen',
  'ctx.openInEditor': 'Mit Standard-Editor öffnen',

  'code.toggleSource': 'Quelltext zeigen / Renderer',
  'code.copy': 'Kopieren',
  'code.openInEditor': 'Datei im Standard-Editor öffnen',
  'code.fullscreen': 'Diagramm vergrößern',
  'code.mermaidPending': '🍺 Maischt…',

  'error.diagramRerenderFailed':
    'Diagramm konnte für Vollbild nicht erneut gerendert werden.',
  'error.noDocOpen': 'Kein Dokument geöffnet — nichts zum Editieren.',
  'error.openEditorFailed': 'Editor konnte nicht geöffnet werden: {detail}',
  'error.actionFailed': 'Aktion fehlgeschlagen: {detail}',

  'mermaid.couldntLoad': 'Mermaid konnte nicht geladen werden: {detail}',
  'mermaid.couldntDecode': 'Konnte Diagramm-Quelltext nicht dekodieren: {detail}',
  'mermaid.errorPrefix': 'Trübung im Diagramm:',
  'mermaid.sourceSeparator': '--- Quelle ---',
};

export type Locale = 'de' | 'en';

/**
 * Tiny runtime-switching i18n service. Two locales, one flat key set, signal-
 * backed so every `i18n.t('…')` call in a template auto-reflows on toggle.
 *
 * Default locale is taken from `navigator.language` (anything starting with
 * "de" → DE, else EN), overridden by an explicit user choice persisted in
 * localStorage.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _locale = signal<Locale>(this.detectLocale());
  readonly locale = this._locale.asReadonly();
  readonly localeLabel = computed(() => this._locale().toUpperCase());

  /** BCP-47 tag for Intl.* APIs (date formatters). */
  readonly intlLocale = computed<string>(() =>
    this._locale() === 'de' ? 'de-DE' : 'en-US',
  );

  /**
   * Look up `key` in the active locale and interpolate `{name}` placeholders.
   * Unknown keys return the key itself, so missing strings surface obviously
   * in the UI instead of crashing or going blank.
   */
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const map = this._locale() === 'de' ? DE : EN;
    let result: string = map[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.split(`{${k}}`).join(String(v));
      }
    }
    return result;
  }

  set(locale: Locale): void {
    this._locale.set(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // private mode / disabled — locale just won't persist
    }
  }

  /** Cycle between the two supported locales. */
  toggle(): void {
    this.set(this._locale() === 'de' ? 'en' : 'de');
  }

  private detectLocale(): Locale {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'de' || stored === 'en') return stored;
    } catch {
      // ignore
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
    }
    return 'en';
  }
}
