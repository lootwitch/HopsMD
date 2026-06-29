import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { saveImageAssetBridge, isTauri } from '../../core/tauri-bridge';
import { dirname, basename } from '../../core/path-utils';

/** Extension picked when the clipboard image has no useful filename. */
const PASTE_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
};

const sanitiseFilename = (raw: string): string => {
  const cleaned = raw
    .replace(/[\\/]+/g, '_')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'pasted-image';
};

@Component({
  selector: 'hops-markdown-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="cm-host"></div>`,
  styles: [
    `
      :host { display: block; height: 100%; min-height: 0; }
      .cm-host { height: 100%; }
      .cm-host :global(.cm-editor) { height: 100%; }
    `,
  ],
})
export class MarkdownEditorComponent {
  /** Initial document; the editor owns its state after creation. */
  readonly content = input<string>('');
  /** Syntax mode; read once at editor creation (the component is recreated
   *  per edit session, so a live binding is unnecessary). */
  readonly language = input<'markdown' | 'json' | 'http'>('markdown');
  /** Absolute path of the file being edited — required for pasted-image
   *  asset placement (images land in `assets/` next to this file). */
  readonly currentPath = input<string | null>(null);
  /** Emitted on every document change. */
  readonly contentChange = output<string>();
  /** Bubbled to the host so an error banner can show — image paste/drop fails
   *  silently in browser-only mode, but surface real Tauri errors. */
  readonly assetError = output<string>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private view: import('@codemirror/view').EditorView | null = null;

  constructor() {
    // Set before the async callback can resume, so a teardown that races the
    // dynamic imports prevents an orphaned EditorView from being created.
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      this.view?.destroy();
    });

    afterNextRender(async () => {
      const [
        { EditorView, keymap, lineNumbers },
        { EditorState, EditorSelection },
        { markdown },
        { languages },
        { defaultKeymap, history, historyKeymap, indentWithTab },
        { syntaxHighlighting, defaultHighlightStyle, LanguageDescription },
        { search, searchKeymap, highlightSelectionMatches },
      ] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/lang-markdown'),
        import('@codemirror/language-data'),
        import('@codemirror/commands'),
        import('@codemirror/language'),
        import('@codemirror/search'),
      ]);

      type Cmd = (view: import('@codemirror/view').EditorView) => boolean;
      const isMarkdown = this.language() === 'markdown';

      const toggleWrap = (mark: string): Cmd => (view) => {
        const { state } = view;
        const changes = state.changeByRange((range) => {
          const inner = state.doc.sliceString(range.from, range.to);
          const before = state.doc.sliceString(Math.max(0, range.from - mark.length), range.from);
          const after = state.doc.sliceString(range.to, Math.min(state.doc.length, range.to + mark.length));
          if (before === mark && after === mark) {
            return {
              changes: [
                { from: range.from - mark.length, to: range.from, insert: '' },
                { from: range.to, to: range.to + mark.length, insert: '' },
              ],
              range: EditorSelection.range(range.from - mark.length, range.to - mark.length),
            };
          }
          if (
            inner.length >= 2 * mark.length &&
            inner.startsWith(mark) &&
            inner.endsWith(mark)
          ) {
            return {
              changes: { from: range.from, to: range.to, insert: inner.slice(mark.length, -mark.length) },
              range: EditorSelection.range(range.from, range.to - 2 * mark.length),
            };
          }
          if (range.empty) {
            return {
              changes: { from: range.from, insert: mark + mark },
              range: EditorSelection.cursor(range.from + mark.length),
            };
          }
          return {
            changes: [
              { from: range.from, insert: mark },
              { from: range.to, insert: mark },
            ],
            range: EditorSelection.range(range.from + mark.length, range.to + mark.length),
          };
        });
        view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input.toggleMark' }));
        return true;
      };

      const insertLink: Cmd = (view) => {
        const { state } = view;
        const changes = state.changeByRange((range) => {
          const text = range.empty ? 'text' : state.doc.sliceString(range.from, range.to);
          const insert = `[${text}](url)`;
          const urlFrom = range.from + 1 + text.length + 2;
          return {
            changes: { from: range.from, to: range.to, insert },
            range: EditorSelection.range(urlFrom, urlFrom + 3),
          };
        });
        view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input.link' }));
        return true;
      };

      const markdownShortcuts = isMarkdown
        ? [
            { key: 'Mod-b', run: toggleWrap('**'), preventDefault: true },
            { key: 'Mod-i', run: toggleWrap('*'), preventDefault: true },
            { key: 'Mod-k', run: insertLink, preventDefault: true },
          ]
        : [];

      const insertImageMarkdown = (
        view: import('@codemirror/view').EditorView,
        filename: string,
      ): void => {
        const alt = filename.replace(/\.[^.]+$/, '');
        const insert = `![${alt}](assets/${filename})`;
        const { state } = view;
        const r = state.selection.main;
        view.dispatch(
          state.update({
            changes: { from: r.from, to: r.to, insert },
            selection: { anchor: r.from + insert.length },
            scrollIntoView: true,
            userEvent: 'input.image',
          }),
        );
      };

      const handleImageBlob = async (
        view: import('@codemirror/view').EditorView,
        blob: File | Blob,
      ): Promise<void> => {
        const path = this.currentPath();
        if (!path || !isTauri()) {
          // In browser-only mode there's no Tauri bridge to write the file —
          // silently no-op so the dev workflow still types nicely.
          return;
        }
        const baseDir = dirname(path);
        const blobName = blob instanceof File ? blob.name : '';
        const ext =
          (blobName && blobName.includes('.')
            ? blobName.split('.').pop()!.toLowerCase()
            : PASTE_EXT_BY_MIME[blob.type] ?? 'png');
        const stem =
          blobName && blobName.includes('.')
            ? blobName.replace(/\.[^.]+$/, '')
            : `pasted-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
        const filename = sanitiseFilename(`${stem}.${ext}`);
        try {
          const buf = new Uint8Array(await blob.arrayBuffer());
          const savedAbs = await saveImageAssetBridge(baseDir, filename, buf);
          insertImageMarkdown(view, basename(savedAbs));
        } catch (err) {
          this.assetError.emit(
            err instanceof Error ? err.message : String(err),
          );
        }
      };

      const editorDomEvents = isMarkdown
        ? EditorView.domEventHandlers({
            paste: (event, view) => {
              const items = event.clipboardData?.items;
              if (!items) return false;
              for (const item of Array.from(items)) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                  const blob = item.getAsFile();
                  if (blob) {
                    event.preventDefault();
                    void handleImageBlob(view, blob);
                    return true;
                  }
                }
              }
              return false;
            },
            drop: (event, view) => {
              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return false;
              const images = Array.from(files).filter((f) =>
                f.type.startsWith('image/'),
              );
              if (images.length === 0) return false;
              event.preventDefault();
              for (const img of images) void handleImageBlob(view, img);
              return true;
            },
          })
        : [];

      const theme = EditorView.theme(
        {
          '&': { color: 'var(--hops-text)', backgroundColor: 'var(--hops-stout)', height: '100%' },
          '.cm-content': { fontFamily: 'var(--hops-mono)', caretColor: 'var(--hops-foam)' },
          '.cm-gutters': {
            backgroundColor: 'var(--hops-stout-2)',
            color: 'var(--hops-text-dim)',
            border: 'none',
          },
          '.cm-activeLine': { backgroundColor: 'rgba(245,197,66,0.05)' },
          '.cm-activeLineGutter': { backgroundColor: 'rgba(245,197,66,0.08)' },
          '&.cm-focused': { outline: 'none' },
          '.cm-cursor': { borderLeftColor: 'var(--hops-foam)' },
          '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(245,197,66,0.25) !important' },
          '.cm-selectionMatch': { backgroundColor: 'rgba(245,197,66,0.18)' },
          '.cm-searchMatch': { backgroundColor: 'rgba(245,197,66,0.35)', outline: '1px solid rgba(245,197,66,0.6)' },
          '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(200,123,30,0.65)' },
          '.cm-panels': {
            backgroundColor: 'var(--hops-stout-2)',
            color: 'var(--hops-text)',
            borderBottom: '1px solid var(--hops-border)',
          },
          '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--hops-border)' },
          '.cm-panel.cm-search': {
            padding: '0.4rem 0.6rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.4rem',
            fontFamily: 'var(--hops-mono)',
            fontSize: '0.78rem',
          },
          '.cm-panel.cm-search input[type="text"]': {
            backgroundColor: 'var(--hops-stout)',
            color: 'var(--hops-text)',
            border: '1px solid var(--hops-border)',
            borderRadius: '3px',
            padding: '0.2rem 0.45rem',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            outline: 'none',
          },
          '.cm-panel.cm-search input[type="text"]:focus': {
            borderColor: 'rgba(245,197,66,0.55)',
          },
          '.cm-panel.cm-search button': {
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: 'var(--hops-text-dim)',
            border: '1px solid var(--hops-border)',
            borderRadius: '3px',
            padding: '0.15rem 0.5rem',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            cursor: 'pointer',
          },
          '.cm-panel.cm-search button:hover': {
            backgroundColor: 'rgba(245,197,66,0.1)',
            color: 'var(--hops-foam)',
            borderColor: 'rgba(245,197,66,0.35)',
          },
          '.cm-panel.cm-search label': {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            color: 'var(--hops-text-dim)',
          },
          '.cm-panel.cm-search [name="close"]': {
            color: 'var(--hops-text-dim)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0 0.4rem',
          },
        },
        { dark: true },
      );

      const updateListener = EditorView.updateListener.of((u) => {
        if (u.docChanged) this.contentChange.emit(u.state.doc.toString());
      });

      // Markdown gets the full lang-markdown package (with embedded code
      // languages); json/http resolve through language-data's lazy registry.
      const langName = this.language();
      const langExtension =
        langName === 'markdown'
          ? markdown({ codeLanguages: languages })
          : ((await LanguageDescription.matchLanguageName(languages, langName, true)?.load()) ?? []);

      const state = EditorState.create({
        doc: this.content(),
        extensions: [
          lineNumbers(),
          history(),
          search({ top: true }),
          highlightSelectionMatches(),
          keymap.of([...markdownShortcuts, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          editorDomEvents,
          langExtension,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          theme,
          updateListener,
        ],
      });

      if (destroyed) return; // component torn down while imports were in flight
      this.view = new EditorView({ state, parent: this.host().nativeElement });
      this.view.focus();
    });
  }
}
