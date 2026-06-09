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
  /** Emitted on every document change. */
  readonly contentChange = output<string>();

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
        { EditorState },
        { markdown },
        { languages },
        { defaultKeymap, history, historyKeymap },
        { syntaxHighlighting, defaultHighlightStyle },
      ] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/lang-markdown'),
        import('@codemirror/language-data'),
        import('@codemirror/commands'),
        import('@codemirror/language'),
      ]);

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
        },
        { dark: true },
      );

      const updateListener = EditorView.updateListener.of((u) => {
        if (u.docChanged) this.contentChange.emit(u.state.doc.toString());
      });

      const state = EditorState.create({
        doc: this.content(),
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ codeLanguages: languages }),
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
