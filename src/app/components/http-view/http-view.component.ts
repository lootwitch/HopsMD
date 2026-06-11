import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { loadHljs } from '../../core/highlight-loader';
import { parseHttpFile } from '../../core/http-file';
import { I18nService } from '../../services/i18n.service';

/** Request body: JSON-looking text gets lazy highlight.js colouring,
 *  everything else renders as a plain pre. */
@Component({
  selector: 'hops-http-body',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (html(); as h) {
      <pre class="body hljs" [innerHTML]="h"></pre>
    } @else {
      <pre class="body">{{ text() }}</pre>
    }
  `,
  styles: [
    `
      .body {
        margin: 0.4rem 0 0; padding: 0.6rem 0.75rem; white-space: pre-wrap; word-break: break-word;
        font-family: var(--hops-mono); font-size: 0.8rem; line-height: 1.5;
        background: rgba(0, 0, 0, 0.18); border: 1px solid var(--hops-border); border-radius: 4px;
        color: var(--hops-text);
      }
    `,
  ],
})
export class HttpBodyComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly text = input.required<string>();
  protected readonly html = signal<SafeHtml | null>(null);

  constructor() {
    effect(() => {
      const t = this.text();
      const trimmed = t.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        this.html.set(null);
        return;
      }
      void loadHljs().then((hljs) => {
        if (t !== this.text()) return; // raced a content change
        const out = hljs.highlight(t, { language: 'json', ignoreIllegals: true }).value;
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(out)));
      });
    });
  }
}

/** Read-only structured viewer for `.http`/`.rest` files: file variables card
 *  plus one card per request (method badge, URL, headers, body). Display only
 *  — no request execution. */
@Component({
  selector: 'hops-http-view',
  standalone: true,
  imports: [HttpBodyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="http">
      @if (file().variables.length) {
        <section class="card">
          <h3 class="card-title">{{ i18n.t('http.variables') }}</h3>
          <dl class="vars">
            @for (v of file().variables; track v.name + $index) {
              <dt>&#64;{{ v.name }}</dt><dd>{{ v.value }}</dd>
            }
          </dl>
        </section>
      }
      @for (b of file().blocks; track $index) {
        @if (b.kind === 'request') {
          <section class="card">
            @if (b.name) { <div class="req-name">{{ b.name }}</div> }
            <div class="req-line">
              <span class="method" [class]="'method m-' + b.method.toLowerCase()">{{ b.method }}</span>
              <span class="url">{{ b.url }}</span>
              @if (b.httpVersion) { <span class="ver">{{ b.httpVersion }}</span> }
            </div>
            @if (b.headers.length) {
              <table class="headers">
                <tbody>
                  @for (h of b.headers; track $index) {
                    <tr><td class="hname">{{ h.name }}</td><td class="hvalue">{{ h.value }}</td></tr>
                  }
                </tbody>
              </table>
            }
            @if (b.body) {
              <div class="body-label">{{ i18n.t('http.body') }}</div>
              <hops-http-body [text]="b.body" />
            }
          </section>
        } @else {
          <pre class="card raw">{{ b.text }}</pre>
        }
      }
      @if (!file().blocks.length) {
        <p class="empty">{{ i18n.t('http.noRequests') }}</p>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; flex: 1; min-height: 0; overflow-y: auto; }
      .http {
        max-width: 880px; margin: 0 auto; padding: 1rem 1.25rem 3rem;
        display: flex; flex-direction: column; gap: 0.8rem;
      }
      .card {
        background: var(--hops-stout-2); border: 1px solid var(--hops-border);
        border-radius: 6px; padding: 0.75rem 0.9rem;
      }
      .card-title {
        margin: 0 0 0.4rem; font-size: 0.78rem; text-transform: uppercase;
        letter-spacing: 0.4px; color: var(--hops-text-dim); font-weight: 600;
      }
      .vars {
        display: grid; grid-template-columns: max-content 1fr; gap: 0.15rem 0.75rem;
        margin: 0; font-family: var(--hops-mono); font-size: 0.82rem;
      }
      .vars dt { color: var(--hops-pilsner); }
      .vars dd { margin: 0; color: var(--hops-text); word-break: break-all; }
      .req-name { font-size: 0.78rem; color: var(--hops-text-dim); margin-bottom: 0.35rem; }
      .req-line { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; font-family: var(--hops-mono); }
      .method {
        font-size: 0.74rem; font-weight: 700; letter-spacing: 0.5px; padding: 0.12rem 0.5rem;
        border-radius: 3px; background: rgba(255, 255, 255, 0.08); color: var(--hops-text);
      }
      .m-get { background: rgba(110, 199, 134, 0.18); color: #8fd9a3; }
      .m-post { background: rgba(245, 197, 66, 0.18); color: var(--hops-pilsner); }
      .m-put { background: rgba(217, 144, 80, 0.18); color: #e0a878; }
      .m-patch { background: rgba(166, 134, 217, 0.18); color: #bca7e3; }
      .m-delete { background: rgba(199, 92, 80, 0.2); color: #e09a90; }
      .url { color: var(--hops-foam); font-size: 0.88rem; word-break: break-all; }
      .ver { color: var(--hops-text-dim); font-size: 0.76rem; }
      .headers { margin-top: 0.5rem; border-collapse: collapse; font-family: var(--hops-mono); font-size: 0.78rem; }
      .headers td { padding: 0.1rem 0.75rem 0.1rem 0; vertical-align: top; }
      .hname { color: var(--hops-pilsner); white-space: nowrap; }
      .hvalue { color: var(--hops-text); word-break: break-all; }
      .body-label {
        margin-top: 0.55rem; font-size: 0.72rem; text-transform: uppercase;
        letter-spacing: 0.4px; color: var(--hops-text-dim);
      }
      .raw { font-family: var(--hops-mono); font-size: 0.8rem; white-space: pre-wrap; word-break: break-word; color: var(--hops-text-dim); }
      .empty { color: var(--hops-text-dim); text-align: center; margin: 2rem 0; }
    `,
  ],
})
export class HttpViewComponent {
  protected readonly i18n = inject(I18nService);
  readonly content = input.required<string>();
  protected readonly file = computed(() => parseHttpFile(this.content()));
}
