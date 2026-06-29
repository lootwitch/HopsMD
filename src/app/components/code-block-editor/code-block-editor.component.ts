import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { loadHljs } from '../../core/highlight-loader';
import { I18nService } from '../../services/i18n.service';
import { MermaidRenderService } from '../../services/mermaid-render.service';

/** Wait this long after the last keystroke before re-rendering the preview. */
const PREVIEW_DEBOUNCE_MS = 200;

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Modal split-view editor for a single fenced code block.
 *
 * Left pane: CodeMirror with the block's language preselected via
 * `@codemirror/language-data` (lazy-loaded). Right pane: live preview —
 * Mermaid diagram for `mermaid` blocks, syntax-highlighted code via
 * highlight.js otherwise.
 *
 * The component owns nothing persistent: the parent passes in the initial
 * source / language and listens for `save(newSource)` / `cancel()`. Esc
 * closes without saving.
 */
@Component({
  selector: 'hops-code-block-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="onBackdropClick()"></div>
    <section class="panel" role="dialog" aria-modal="true">
      <header class="panel-head">
        <span class="lang-badge">{{ language() || 'plain' }}</span>
        <span class="title">{{ i18n.t('codeEdit.title') }}</span>
        <span class="spacer"></span>
        @if (dirty()) {
          <span class="dirty" [title]="i18n.t('codeEdit.dirty')">•</span>
        }
        <button type="button" class="btn" (click)="cancel.emit()">
          {{ i18n.t('codeEdit.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!dirty()"
          (click)="onSave()"
        >
          {{ i18n.t('codeEdit.save') }}
        </button>
      </header>

      <div class="split">
        <div class="pane editor-pane">
          <div #editorHost class="cm-host"></div>
        </div>
        <div class="pane preview-pane">
          <div class="preview-head">{{ i18n.t('codeEdit.preview') }}</div>
          @if (previewError(); as err) {
            <div class="preview-error">{{ err }}</div>
          }
          <div
            class="preview-body"
            [class.mermaid-preview]="isMermaid()"
            [innerHTML]="previewHtml()"
          ></div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: contents; }
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        z-index: 90;
      }
      .panel {
        position: fixed;
        top: 5vh;
        left: 5vw;
        width: 90vw;
        height: 90vh;
        background: var(--hops-stout-2);
        border: 1px solid var(--hops-border);
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
        z-index: 91;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .panel-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--hops-border);
        background: var(--hops-stout);
        flex-shrink: 0;
      }
      .lang-badge {
        background: rgba(245, 197, 66, 0.15);
        color: var(--hops-pilsner);
        padding: 0.15rem 0.55rem;
        border-radius: 3px;
        font-family: var(--hops-mono);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .title {
        color: var(--hops-text-dim);
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .spacer { flex: 1; }
      .dirty {
        color: var(--hops-pilsner);
        font-size: 1.2rem;
        line-height: 1;
        font-weight: 700;
      }
      .btn {
        appearance: none;
        background: rgba(255, 255, 255, 0.06);
        color: var(--hops-text-dim);
        border: 1px solid var(--hops-border);
        border-radius: 4px;
        padding: 0.3rem 0.75rem;
        font-family: var(--hops-mono);
        font-size: 0.78rem;
        cursor: pointer;
      }
      .btn:hover:not(:disabled) {
        background: rgba(245, 197, 66, 0.1);
        color: var(--hops-foam);
        border-color: rgba(245, 197, 66, 0.35);
      }
      .btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .btn-primary {
        background: rgba(245, 197, 66, 0.15);
        border-color: rgba(245, 197, 66, 0.4);
        color: var(--hops-pilsner);
        font-weight: 500;
      }
      .btn-primary:hover:not(:disabled) {
        background: rgba(245, 197, 66, 0.25);
        color: var(--hops-foam);
      }
      .split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }
      .pane { min-height: 0; min-width: 0; display: flex; flex-direction: column; }
      .editor-pane { border-right: 1px solid var(--hops-border); }
      .cm-host { flex: 1; min-height: 0; height: 100%; overflow: hidden; }
      .cm-host :global(.cm-editor) { height: 100%; }
      .preview-pane { background: var(--hops-stout); }
      .preview-head {
        padding: 0.4rem 0.7rem;
        border-bottom: 1px solid var(--hops-border);
        color: var(--hops-text-dim);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        background: var(--hops-stout-2);
        flex-shrink: 0;
      }
      .preview-error {
        margin: 0.5rem 0.75rem;
        padding: 0.5rem 0.7rem;
        background: rgba(179, 64, 54, 0.18);
        color: #ffd8d5;
        border: 1px solid rgba(179, 64, 54, 0.4);
        border-radius: 4px;
        font-family: var(--hops-mono);
        font-size: 0.78rem;
        white-space: pre-wrap;
      }
      .preview-body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 0.75rem 1rem;
        font-family: var(--hops-mono);
        font-size: 0.85rem;
        color: var(--hops-text);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .preview-body :global(pre) {
        margin: 0;
        padding: 0;
        background: transparent;
        white-space: pre;
        overflow-x: auto;
      }
      .preview-body :global(code) { font-family: inherit; }
      .preview-body.mermaid-preview {
        white-space: normal;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .preview-body.mermaid-preview :global(svg) {
        max-width: 100%;
        height: auto;
      }
    `,
  ],
})
export class CodeBlockEditorComponent {
  protected readonly i18n = inject(I18nService);
  private readonly mermaid = inject(MermaidRenderService);
  private readonly sanitizer = inject(DomSanitizer);

  /** Initial source — read once when the editor mounts. */
  readonly initialSource = input.required<string>();
  /** Lowercased language tag (`ts`, `mermaid`, etc.) — drives both
   *  CodeMirror syntax loading and the preview path. */
  readonly language = input<string>('');

  readonly save = output<string>();
  readonly cancel = output<void>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');
  private view: import('@codemirror/view').EditorView | null = null;

  /** Live source from the editor — updated on every doc change. */
  protected readonly currentSource = signal<string>('');
  protected readonly previewHtml = signal<SafeHtml | null>(null);
  protected readonly previewError = signal<string | null>(null);

  protected readonly isMermaid = computed(
    () => this.language().toLowerCase() === 'mermaid',
  );
  protected readonly dirty = computed(
    () => this.currentSource() !== this.initialSource(),
  );

  private previewDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(async () => {
      this.currentSource.set(this.initialSource());
      await this.mountEditor();
      void this.renderPreview(this.currentSource());
    });

    // Debounced preview re-render when the live source changes.
    effect(() => {
      const src = this.currentSource();
      if (this.previewDebounce !== null) clearTimeout(this.previewDebounce);
      this.previewDebounce = setTimeout(
        () => void this.renderPreview(src),
        PREVIEW_DEBOUNCE_MS,
      );
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.previewDebounce !== null) clearTimeout(this.previewDebounce);
      this.view?.destroy();
    });
  }

  protected onSave(): void {
    this.save.emit(this.currentSource());
  }

  protected onBackdropClick(): void {
    if (this.dirty()) {
      const ok = confirm(this.i18n.t('codeEdit.discardConfirm'));
      if (!ok) return;
    }
    this.cancel.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.onBackdropClick();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (this.dirty()) this.onSave();
    }
  }

  private async mountEditor(): Promise<void> {
    const [
      { EditorView, keymap, lineNumbers },
      { EditorState },
      { defaultKeymap, history, historyKeymap, indentWithTab },
      { languages },
      { syntaxHighlighting, defaultHighlightStyle, LanguageDescription },
      { search, searchKeymap, highlightSelectionMatches },
    ] = await Promise.all([
      import('@codemirror/view'),
      import('@codemirror/state'),
      import('@codemirror/commands'),
      import('@codemirror/language-data'),
      import('@codemirror/language'),
      import('@codemirror/search'),
    ]);

    const langName = this.language().toLowerCase();
    const langDesc = langName
      ? LanguageDescription.matchLanguageName(languages, langName, true)
      : null;
    const langExtension = langDesc ? (await langDesc.load()) ?? [] : [];

    const theme = EditorView.theme(
      {
        '&': {
          color: 'var(--hops-text)',
          backgroundColor: 'var(--hops-stout)',
          height: '100%',
        },
        '.cm-content': {
          fontFamily: 'var(--hops-mono)',
          caretColor: 'var(--hops-foam)',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--hops-stout-2)',
          color: 'var(--hops-text-dim)',
          border: 'none',
        },
        '.cm-activeLine': { backgroundColor: 'rgba(245,197,66,0.05)' },
        '.cm-activeLineGutter': { backgroundColor: 'rgba(245,197,66,0.08)' },
        '&.cm-focused': { outline: 'none' },
        '.cm-cursor': { borderLeftColor: 'var(--hops-foam)' },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: 'rgba(245,197,66,0.25) !important',
        },
        '.cm-selectionMatch': { backgroundColor: 'rgba(245,197,66,0.18)' },
      },
      { dark: true },
    );

    const updateListener = EditorView.updateListener.of((u) => {
      if (u.docChanged) this.currentSource.set(u.state.doc.toString());
    });

    const state = EditorState.create({
      doc: this.initialSource(),
      extensions: [
        lineNumbers(),
        history(),
        search({ top: true }),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        langExtension,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.lineWrapping,
        theme,
        updateListener,
      ],
    });

    this.view = new EditorView({ state, parent: this.host().nativeElement });
    this.view.focus();
  }

  private async renderPreview(source: string): Promise<void> {
    this.previewError.set(null);
    if (this.isMermaid()) {
      try {
        const svg = await this.mermaid.renderToSvg(source);
        if (svg) {
          this.previewHtml.set(
            this.sanitizer.bypassSecurityTrustHtml(svg.outerHTML),
          );
        } else {
          this.previewError.set(this.i18n.t('codeEdit.mermaidFailed'));
          this.previewHtml.set(null);
        }
      } catch (err) {
        this.previewError.set(
          err instanceof Error ? err.message : String(err),
        );
        this.previewHtml.set(null);
      }
      return;
    }
    // Non-mermaid: highlight.js
    const lang = this.language();
    try {
      const hljs = await loadHljs();
      const result =
        lang && hljs.getLanguage(lang)
          ? hljs.highlight(source, { language: lang, ignoreIllegals: true })
          : hljs.highlightAuto(source);
      const codeClass =
        `hljs${lang ? ` language-${escapeHtml(lang)}` : ''}`;
      const html = `<pre><code class="${codeClass}">${result.value}</code></pre>`;
      this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
    } catch {
      // Highlighting failed — fall back to escaped raw text.
      this.previewHtml.set(
        this.sanitizer.bypassSecurityTrustHtml(
          `<pre><code>${escapeHtml(source)}</code></pre>`,
        ),
      );
    }
  }
}
