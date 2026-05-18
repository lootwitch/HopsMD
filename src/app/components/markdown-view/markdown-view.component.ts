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
import { MarkdownParserService } from '../../services/markdown-parser.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { MermaidRenderService } from '../../services/mermaid-render.service';

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
@Component({
  selector: 'hops-markdown-view',
  standalone: true,
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

    <article
      #host
      class="hops-markdown"
      [hidden]="!html()"
      [innerHTML]="html()"
    ></article>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
        background: var(--hops-stout);
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
  private readonly sanitizer = inject(DomSanitizer);

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  /**
   * The rendered HTML, pre-sanitised by our parser (marked + DOMPurify) and
   * then wrapped in `SafeHtml` to bypass Angular's second-pass sanitizer —
   * otherwise Angular would strip the `id` and `data-*` attributes on our
   * Mermaid placeholder DIVs, leaving the renderer with nothing to find.
   */
  protected readonly html = signal<SafeHtml | null>(null);

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
    // pending Mermaid placeholders and render them. afterRenderEffect fires
    // *after* Angular has applied the binding, so the placeholders we just
    // produced are guaranteed to be in the DOM.
    afterRenderEffect(() => {
      if (!this.html()) return;
      void this.mermaid.renderAll(this.host()?.nativeElement ?? null);
    });

    // Drive the relative-time label.
    const tickId = setInterval(
      () => this.nowTick.set(Date.now()),
      RELATIVE_TIME_TICK_MS,
    );
    inject(DestroyRef).onDestroy(() => clearInterval(tickId));
  }
}
