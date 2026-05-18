import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { openPathBridge } from '../../core/tauri-bridge';
import type { TocItem } from '../../models/toc-item.model';
import { MarkdownParserService } from '../../services/markdown-parser.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { MermaidFullscreenService } from '../../services/mermaid-fullscreen.service';
import { MermaidRenderService } from '../../services/mermaid-render.service';
import { TocComponent } from '../toc/toc.component';

/** How often the "Aktualisiert vor X" label re-evaluates. 5 s is fine-grained
 *  enough that the user notices it ticking, cheap enough to ignore. */
const RELATIVE_TIME_TICK_MS = 5_000;

/** Format an mtime as a German relative label, given a "now" reference. */
function formatRelative(mtime: number, now: number): string {
  const deltaSec = Math.max(0, Math.floor((now - mtime) / 1000));
  if (deltaSec < 5) return 'gerade aktualisiert';
  if (deltaSec < 60) return `vor ${deltaSec} Sek.`;
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `vor ${min} Min.`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `vor ${hr} Std.`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
  return new Date(mtime).toLocaleDateString('de-DE');
}

/** Absolute timestamp shown as the title= tooltip of the relative label. */
function formatAbsolute(mtime: number): string {
  return new Date(mtime).toLocaleString('de-DE');
}

/**
 * Renders the currently selected markdown file.
 *
 * Pipeline (all signal-driven):
 *   selectedContent → parse() → html signal → bound to [innerHTML]
 *                                          → afterRenderEffect kicks Mermaid
 *
 * The filebar at the top shows the absolute path plus a live "Aktualisiert
 * vor X" badge tied to the FileWatcher event stream from Rust.
 */
const TOC_COLLAPSE_KEY = 'hopsmd:tocCollapsed';

@Component({
  selector: 'hops-markdown-view',
  standalone: true,
  imports: [TocComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.error(); as err) {
      <section class="banner banner-error">
        <strong>Verschüttet:</strong> {{ err }}
      </section>
    }

    @if (state.selectedPath(); as path) {
      <header class="filebar" [title]="path">
        <span class="filebar-icon">🍺</span>
        <span class="filebar-path">{{ path }}</span>
        @if (modifiedLabel(); as label) {
          <span class="filebar-sep">·</span>
          <span class="filebar-modified" [title]="modifiedAbsolute()">
            Aktualisiert {{ label }}
          </span>
        }
      </header>
    }

    @if (!state.selectedPath() && state.isOpen()) {
      <div class="empty">
        <div class="empty-icon">📜</div>
        <h2>Frisch gezapft wartet ein Rezept.</h2>
        <p>Wähle links im <strong>Rezeptbuch</strong> ein Markdown-Dokument, um es zu lesen.</p>
      </div>
    }

    @if (!state.isOpen() && !state.error()) {
      <div class="empty">
        <div class="empty-icon">🛢️</div>
        <h2>Willkommen im Schankraum.</h2>
        <p>Öffne oben rechts ein <strong>Sudhaus</strong> — also einen Ordner mit Markdown-Dateien — um zu starten.</p>
        <p class="hint">Tipp: HopsMD versteht GitHub-Markdown und live gerenderte Mermaid-Diagramme.</p>
      </div>
    }

    <div class="view-grid" [hidden]="!html()">
      <article
        #host
        class="hops-markdown"
        [innerHTML]="html()"
        (click)="onContentClick($event)"
      ></article>
      @if (toc().length > 0) {
        <aside class="toc-pane">
          <hops-toc
            [items]="toc()"
            [collapsed]="tocCollapsed()"
            (itemSelected)="scrollToHeading($event)"
            (collapseToggled)="onTocToggle()"
          />
        </aside>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
        background: var(--hops-stout);
      }
      .view-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
      }
      .toc-pane {
        position: sticky;
        top: 0;
        align-self: start;
        z-index: 1;
      }
      .banner {
        margin: 0;
        padding: 0.6rem 1rem;
        font-size: 0.85rem;
      }
      .banner-error {
        background: rgba(179, 64, 54, 0.18);
        color: #ffd8d5;
        border-bottom: 1px solid rgba(179, 64, 54, 0.4);
      }
      .filebar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 1rem;
        background: var(--hops-stout-2);
        border-bottom: 1px solid var(--hops-border);
        font-family: var(--hops-mono);
        font-size: 0.78rem;
        color: var(--hops-text-dim);
      }
      .filebar-path {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .filebar-sep {
        color: var(--hops-malt);
      }
      .filebar-modified {
        color: var(--hops-pilsner);
        white-space: nowrap;
      }
      .empty {
        max-width: 540px;
        margin: 6rem auto;
        padding: 0 2rem;
        text-align: center;
        color: var(--hops-text-dim);
      }
      .empty-icon {
        font-size: 3rem;
        margin-bottom: 0.5rem;
        filter: drop-shadow(0 0 8px rgba(245, 197, 66, 0.25));
      }
      .empty h2 {
        color: var(--hops-foam);
        font-weight: 500;
        margin: 0.25rem 0 0.6rem;
        font-size: 1.15rem;
      }
      .empty p {
        margin: 0.35rem 0;
      }
      .empty .hint {
        margin-top: 1.2rem;
        font-size: 0.8rem;
        color: var(--hops-malt);
      }
    `,
  ],
})
export class MarkdownViewComponent {
  protected readonly state = inject(MarkdownStructureService);
  private readonly parser = inject(MarkdownParserService);
  private readonly mermaid = inject(MermaidRenderService);
  private readonly fullscreen = inject(MermaidFullscreenService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  /**
   * The rendered HTML, pre-sanitised by our parser (marked + DOMPurify) and
   * then wrapped in `SafeHtml` to bypass Angular's second-pass sanitizer —
   * otherwise Angular would strip the `id` and `data-*` attributes on our
   * Mermaid placeholder DIVs, leaving the renderer with nothing to find.
   */
  protected readonly html = signal<SafeHtml | null>(null);

  /** Table of contents extracted from the post-render article DOM. */
  protected readonly toc = signal<readonly TocItem[]>([]);

  /** TOC collapse state, persisted across reloads. */
  protected readonly tocCollapsed = signal<boolean>(
    typeof localStorage !== 'undefined' && localStorage.getItem(TOC_COLLAPSE_KEY) === '1',
  );

  /** Ticks every few seconds so the relative-time label refreshes itself. */
  private readonly nowTick = signal<number>(Date.now());

  protected readonly modifiedLabel = computed<string | null>(() => {
    const mtime = this.state.lastModified();
    if (mtime === null) return null;
    return formatRelative(mtime, this.nowTick());
  });

  protected readonly modifiedAbsolute = computed<string>(() => {
    const mtime = this.state.lastModified();
    return mtime === null ? '' : formatAbsolute(mtime);
  });

  constructor() {
    // Re-parse whenever the selected content (or its path) changes.
    effect(() => {
      const content = this.state.selectedContent();
      const path = this.state.selectedPath();
      if (!content) {
        this.html.set(null);
        return;
      }
      void this.parser.parse(content, path).then((rendered) => {
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(rendered));
      });
    });

    // After the HTML has been written into the DOM by [innerHTML], find any
    // pending Mermaid placeholders and render them. Then scan for headings
    // so the TOC reflects the freshly mounted content. afterRenderEffect
    // fires *after* Angular has applied the binding, so the article is
    // populated when this runs.
    afterRenderEffect(() => {
      if (!this.html()) {
        this.toc.set([]);
        return;
      }
      const host = this.host()?.nativeElement ?? null;
      void this.mermaid.renderAll(host);
      if (host) this.toc.set(this.extractToc(host));
    });

    // Drive the relative-time label.
    const tickId = setInterval(
      () => this.nowTick.set(Date.now()),
      RELATIVE_TIME_TICK_MS,
    );
    inject(DestroyRef).onDestroy(() => clearInterval(tickId));
  }

  /**
   * Event-delegate clicks on the toolbar buttons that the parser injects
   * into every code block (`<button class="hops-code-action" data-action="…">`).
   * Goes through the article so the bound innerHTML doesn't need per-button
   * Angular event wiring.
   */
  protected onContentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    const action = target?.closest<HTMLElement>('.hops-code-action');
    if (!action) return;
    const block = action.closest<HTMLElement>('.hops-code-block');
    if (!block) return;
    const kind = action.dataset['action'];
    event.preventDefault();
    event.stopPropagation();

    switch (kind) {
      case 'copy':
        void this.copySource(block, action);
        break;
      case 'toggle':
        this.toggleView(block);
        break;
      case 'open-editor':
        void this.openInEditor();
        break;
      case 'fullscreen':
        this.openFullscreen(block);
        break;
    }
  }

  /** Scroll the heading with `id` into the top of the article viewport.
   *  `behavior: 'instant'` is intentional — `'smooth'` silently no-ops in
   *  the Chromium webview configuration we ship with, and a rAF-based
   *  animation depends on requestAnimationFrame firing, which is also
   *  throttled in some webview lifecycles. The scroll-margin-top in
   *  styles.scss keeps the heading from being flush against the viewport
   *  edge. */
  protected scrollToHeading(id: string): void {
    const target = this.host()?.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  protected onTocToggle(): void {
    this.tocCollapsed.update((v) => !v);
    try {
      localStorage.setItem(TOC_COLLAPSE_KEY, this.tocCollapsed() ? '1' : '0');
    } catch {
      // ignore
    }
  }

  /**
   * Walk the article DOM, assign de-duplicated slug IDs to every h1-h6 we
   * find, and produce a flat TOC list. Indent depth is normalised to the
   * shallowest heading present so a doc that starts at h2 doesn't appear
   * to indent its top level.
   */
  private extractToc(host: HTMLElement): TocItem[] {
    const headings = Array.from(
      host.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6'),
    );
    if (headings.length === 0) return [];

    const used = new Set<string>();
    const raw: { id: string; text: string; level: number }[] = [];
    for (const h of headings) {
      const text = (h.textContent ?? '').trim();
      if (!text) continue;
      const id = uniqueSlug(slugify(text) || 'abschnitt', used);
      h.id = id;
      raw.push({ id, text, level: Number(h.tagName.charAt(1)) });
    }
    if (raw.length === 0) return [];
    const minLevel = Math.min(...raw.map((r) => r.level));
    return raw.map((r) => ({
      ...r,
      indent: Math.max(0, r.level - minLevel),
    }));
  }

  private openFullscreen(block: HTMLElement): void {
    const source = decodeBase64(block.dataset['source'] ?? '');
    if (!source) return;
    // Re-render Mermaid from source rather than cloning the inline SVG —
    // cloneNode duplicates IDs of <marker>/<defs>, the browser then resolves
    // url(#id) references to whichever node it finds first in document
    // order (usually the original), and the fullscreen copy renders blank.
    void this.mermaid
      .renderToSvg(source)
      .then((svg) => {
        if (svg) this.fullscreen.open(svg);
        else this.state.showError('Diagramm konnte für Vollbild nicht erneut gerendert werden.');
      });
  }

  private async copySource(block: HTMLElement, button: HTMLElement): Promise<void> {
    const source = decodeBase64(block.dataset['source'] ?? '');
    try {
      await navigator.clipboard.writeText(source);
      this.flashCopied(button);
    } catch {
      // Some webviews block clipboard without user gesture in odd ways.
      // Fall back to a temp textarea select+copy.
      const textarea = document.createElement('textarea');
      textarea.value = source;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.flashCopied(button);
      } catch {
        // give up silently — at least the source view is one click away
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  private flashCopied(button: HTMLElement): void {
    const original = button.getAttribute('title') ?? '';
    button.classList.add('copied');
    button.setAttribute('title', 'Kopiert!');
    setTimeout(() => {
      button.classList.remove('copied');
      button.setAttribute('title', original);
    }, 1200);
  }

  private toggleView(block: HTMLElement): void {
    const view = block.dataset['view'] === 'rendered' ? 'source' : 'rendered';
    block.dataset['view'] = view;
  }

  private async openInEditor(): Promise<void> {
    const path = this.state.selectedPath();
    if (!path) {
      this.state.showError('Kein Dokument geöffnet — nichts zum Editieren.');
      return;
    }
    try {
      await openPathBridge(path);
    } catch (err) {
      this.state.showError(
        `Editor konnte nicht geöffnet werden: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/** Lowercase + diacritic-strip + non-alphanumeric collapse to dashes. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Disambiguate `base` against `used` by appending -2, -3, … as needed. */
function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  const id = `${base}-${n}`;
  used.add(id);
  return id;
}

/** Inverse of the parser's encodeBase64Utf8 helper — kept inline to avoid a
 *  service round-trip just to flip base64. */
function decodeBase64(payload: string): string {
  if (!payload) return '';
  try {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}
