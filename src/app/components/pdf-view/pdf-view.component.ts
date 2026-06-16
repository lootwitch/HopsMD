import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { loadPdfjs } from '../../core/pdfjs-loader';

/** Read-only PDF viewer. Renders each page to a <canvas> via pdf.js, so it
 *  works identically on every platform (webkit2gtk has no inline PDF renderer,
 *  which the old iframe approach relied on). pdf.js is lazy-loaded on first
 *  render to keep the initial bundle small. */
@Component({
  selector: 'hops-pdf-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <p class="pdf-error">{{ error() }}</p>
    }
    <div #pages class="pdf-pages"></div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 1;
        min-height: 0;
        flex-direction: column;
        overflow: auto;
        background: var(--hops-stout);
        align-items: center;
      }
      .pdf-pages {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
      }
      .pdf-pages ::ng-deep canvas {
        max-width: 100%;
        height: auto;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
      }
      .pdf-error {
        margin: 1rem;
        color: var(--hops-foam, #eee);
      }
    `,
  ],
})
export class PdfViewComponent {
  private readonly i18n = inject(I18nService);
  readonly src = input.required<string>();
  private readonly pagesRef = viewChild.required<ElementRef<HTMLDivElement>>('pages');
  protected readonly error = signal<string | null>(null);

  /** A render started for the current src; bumped each render so a slow
   *  earlier render can detect it has been superseded and bail. */
  private renderToken = 0;
  private viewReady = false;

  constructor() {
    afterNextRender(() => {
      this.viewReady = true;
    });
    // Re-render whenever the asset URL changes (including ?t= cache-buster).
    effect(() => {
      const url = this.src();
      if (!this.viewReady) {
        // First pass before the view exists: defer to a microtask after
        // afterNextRender has run.
        queueMicrotask(() => this.viewReady && void this.render(url));
        return;
      }
      void this.render(url);
    });
  }

  private async render(url: string): Promise<void> {
    const token = ++this.renderToken;
    this.error.set(null);
    const host = this.pagesRef().nativeElement;
    host.replaceChildren();
    try {
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument({ url }).promise;
      if (token !== this.renderToken) return; // superseded
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        if (token !== this.renderToken) return; // superseded mid-render
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        host.appendChild(canvas);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch {
      if (token === this.renderToken) this.error.set(this.i18n.t('pdf.loadFailed'));
    }
  }
}
