import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MarkdownParserService } from '../../services/markdown-parser.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { MermaidRenderService } from '../../services/mermaid-render.service';

/**
 * Renders the currently selected markdown file.
 *
 * Pipeline (all signal-driven):
 *   selectedContent → parse() → html signal → bound to [innerHTML]
 *                                         → effect kicks Mermaid renderer
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
        overflow: hidden;
        text-overflow: ellipsis;
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

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  protected readonly html = signal<string>('');

  constructor() {
    // Re-parse whenever the selected content (or its path) changes.
    effect(() => {
      const content = this.state.selectedContent();
      const path = this.state.selectedPath();
      if (!content) {
        this.html.set('');
        return;
      }
      void this.parser.parse(content, path).then((rendered) => this.html.set(rendered));
    });

    // After the HTML has been bound, render any pending Mermaid placeholders.
    effect(() => {
      // Read the signal to register the dependency, even if value goes unused.
      if (!this.html()) return;
      queueMicrotask(() => {
        const el = this.host()?.nativeElement ?? null;
        void this.mermaid.renderAll(el);
      });
    });
  }
}
