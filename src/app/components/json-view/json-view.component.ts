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
import { I18nService } from '../../services/i18n.service';

/** Above this source size the tree is skipped (DOM-explosion guard) and the
 *  file shows as plain raw text instead. */
const MAX_TREE_SOURCE_CHARS = 1024 * 1024;

type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'invalid' | 'tooLarge' };

/** One node of the collapsible JSON tree; recurses for objects and arrays. */
@Component({
  selector: 'hops-json-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (composite()) {
      <button type="button" class="row toggle" (click)="toggle()">
        <span class="chevron">{{ isExpanded() ? '▾' : '▸' }}</span>
        @if (key() !== null) { <span class="key">{{ key() }}</span><span class="colon">:</span> }
        <span class="badge">{{ summary() }}</span>
      </button>
      @if (isExpanded()) {
        <div class="children">
          @for (e of entries(); track e.key) {
            <hops-json-node [key]="e.key" [value]="e.value" [depth]="depth() + 1" />
          }
        </div>
      }
    } @else {
      <div class="row">
        @if (key() !== null) { <span class="key">{{ key() }}</span><span class="colon">:</span> }
        <span class="value" [class]="'value ' + valueClass()">{{ display() }}</span>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .row {
        display: flex; align-items: baseline; gap: 0.3rem; padding: 0.06rem 0;
        font-family: var(--hops-mono); font-size: 0.84rem; line-height: 1.45;
      }
      button.row {
        appearance: none; background: transparent; border: 0; width: 100%;
        text-align: left; cursor: pointer; color: inherit; border-radius: 3px;
      }
      button.row:hover { background: rgba(245, 197, 66, 0.07); }
      .chevron { color: var(--hops-text-dim); width: 0.9rem; flex-shrink: 0; }
      .key { color: var(--hops-pilsner); }
      .colon { color: var(--hops-text-dim); }
      .badge { color: var(--hops-text-dim); font-size: 0.76rem; }
      .value.string { color: #8fc97f; word-break: break-word; white-space: pre-wrap; }
      .value.number { color: #7fb8d9; }
      .value.boolean { color: #d9a06b; }
      .value.null { color: var(--hops-text-dim); font-style: italic; }
      .children { margin-left: 0.65rem; padding-left: 0.55rem; border-left: 1px solid var(--hops-border); }
    `,
  ],
})
export class JsonNodeComponent {
  readonly key = input<string | null>(null);
  readonly value = input.required<unknown>();
  readonly depth = input(0);

  /** null = untouched → default (expand the top two levels). */
  private readonly userExpanded = signal<boolean | null>(null);
  protected readonly isExpanded = computed(() => this.userExpanded() ?? this.depth() < 2);

  protected readonly composite = computed(() => {
    const v = this.value();
    return v !== null && typeof v === 'object';
  });
  protected readonly entries = computed(() => {
    const v = this.value();
    if (Array.isArray(v)) return v.map((value, i) => ({ key: String(i), value: value as unknown }));
    if (v && typeof v === 'object') {
      return Object.entries(v as Record<string, unknown>).map(([key, value]) => ({ key, value }));
    }
    return [];
  });
  protected readonly summary = computed(() => {
    const n = this.entries().length;
    return Array.isArray(this.value()) ? `[${n}]` : `{${n}}`;
  });
  protected readonly display = computed(() => {
    const v = this.value();
    return typeof v === 'string' ? JSON.stringify(v) : String(v);
  });
  protected readonly valueClass = computed(() => {
    const v = this.value();
    return v === null ? 'null' : typeof v;
  });

  protected toggle(): void {
    this.userExpanded.set(!this.isExpanded());
  }
}

/** Structured JSON viewer: collapsible tree, falling back to highlighted raw
 *  text for invalid JSON and to plain raw text for very large files. */
@Component({
  selector: 'hops-json-view',
  standalone: true,
  imports: [JsonNodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (parsed(); as p) {
      @if (p.ok) {
        <div class="tree"><hops-json-node [value]="p.value" /></div>
      } @else {
        <section class="hint">
          {{ p.reason === 'invalid' ? i18n.t('json.invalid') : i18n.t('json.tooLarge') }}
        </section>
        @if (fallbackHtml(); as html) {
          <pre class="raw hljs" [innerHTML]="html"></pre>
        } @else {
          <pre class="raw">{{ content() }}</pre>
        }
      }
    }
  `,
  styles: [
    `
      :host { display: block; flex: 1; min-height: 0; overflow-y: auto; }
      .tree { padding: 1rem 1.25rem 3rem; }
      .hint {
        margin: 0; padding: 0.5rem 1rem; font-size: 0.8rem;
        background: rgba(245, 197, 66, 0.1); color: var(--hops-pilsner);
        border-bottom: 1px solid rgba(245, 197, 66, 0.3);
      }
      .raw {
        margin: 0; padding: 1.25rem 1.5rem; white-space: pre-wrap; word-break: break-word;
        font-family: var(--hops-mono); font-size: 0.85rem; line-height: 1.5; color: var(--hops-text);
      }
    `,
  ],
})
export class JsonViewComponent {
  protected readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly content = input.required<string>();

  protected readonly parsed = computed<ParseResult>(() => {
    const src = this.content();
    if (src.length > MAX_TREE_SOURCE_CHARS) return { ok: false, reason: 'tooLarge' };
    try {
      return { ok: true, value: JSON.parse(src) as unknown };
    } catch {
      return { ok: false, reason: 'invalid' };
    }
  });

  protected readonly fallbackHtml = signal<SafeHtml | null>(null);

  constructor() {
    // Highlight the raw fallback only for *invalid* JSON — too-large files
    // stay plain (highlighting a multi-MB file would freeze the webview).
    effect(() => {
      const p = this.parsed();
      const src = this.content();
      if (p.ok || p.reason !== 'invalid') {
        this.fallbackHtml.set(null);
        return;
      }
      void loadHljs().then((hljs) => {
        if (src !== this.content()) return; // raced a content change
        const out = hljs.highlight(src, { language: 'json', ignoreIllegals: true }).value;
        this.fallbackHtml.set(this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(out)));
      });
    });
  }
}
