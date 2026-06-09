import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { dirname, resolveRelative } from '../../core/path-utils';
import { openPathBridge, openUrlBridge } from '../../core/tauri-bridge';
import type { TocItem } from '../../models/toc-item.model';
import { I18nService } from '../../services/i18n.service';
import { MarkdownParserService } from '../../services/markdown-parser.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { MermaidFullscreenService } from '../../services/mermaid-fullscreen.service';
import { MermaidRenderService } from '../../services/mermaid-render.service';
import { MarkdownEditorComponent } from '../markdown-editor/markdown-editor.component';
import { TocComponent } from '../toc/toc.component';
import { EmailViewComponent } from '../email-view/email-view.component';
import { ImageViewComponent } from '../image-view/image-view.component';
import { classify } from '../../core/file-kind';

/** How often the "Updated X ago" label re-evaluates. 5 s is fine-grained
 *  enough that the user notices it ticking, cheap enough to ignore. */
const RELATIVE_TIME_TICK_MS = 5_000;

/** How long the filebar path shows "✓ copied" before reverting to the path. */
const PATH_COPIED_MS = 1_500;

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
  imports: [TocComponent, MarkdownEditorComponent, EmailViewComponent, ImageViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.error(); as err) {
      <section class="banner banner-error">
        <strong>{{ i18n.t('view.errorPrefix') }}</strong> {{ err }}
      </section>
    }

    @if (state.selectedPath(); as path) {
      <header class="filebar" [title]="path">
        <span class="filebar-icon">🍺</span>
        <button
          type="button"
          class="filebar-path"
          [title]="i18n.t('filebar.copyPath')"
          (click)="copyPath()"
        >
          @if (pathCopied()) {
            <span class="filebar-copied">{{ i18n.t('filebar.copied') }}</span>
          } @else {
            {{ path }}
          }
        </button>
        @if (modifiedLabel(); as label) {
          <span class="filebar-sep">·</span>
          <span class="filebar-modified" [title]="modifiedAbsolute()">
            {{ i18n.t('view.modifiedPrefix') }} {{ label }}
          </span>
        }
        <span class="filebar-actions">
          @if (state.dirty()) { <span class="dirty" [title]="i18n.t('edit.dirtyTooltip')">•</span> }
          @if (state.mode() === 'viewing' && state.selectedPath() && state.editable()) {
            <button type="button" class="fbtn" (click)="enterEdit()" [title]="i18n.t('edit.enter')">✎</button>
          } @else if (state.mode() === 'editing') {
            <button type="button" class="fbtn primary" (click)="save()">{{ i18n.t('edit.save') }}</button>
            <button type="button" class="fbtn" (click)="cancel()">{{ i18n.t('edit.cancel') }}</button>
          }
        </span>
      </header>
    }

    @if (!state.selectedPath() && state.isOpen()) {
      <div class="empty">
        <div class="empty-icon">📜</div>
        <h2>{{ i18n.t('view.pickRecipeTitle') }}</h2>
        <p [innerHTML]="i18n.t('view.pickRecipeBody')"></p>
      </div>
    }

    @if (!state.isOpen() && !state.error()) {
      <div class="empty">
        <div class="empty-icon">🛢️</div>
        <h2>{{ i18n.t('view.welcomeTitle') }}</h2>
        <p [innerHTML]="i18n.t('view.welcomeBody')"></p>
        <p class="hint">{{ i18n.t('view.welcomeHint') }}</p>
      </div>
    }

    @if (state.mode() === 'editing') {
      <div class="editor-container">
        @if (state.externalConflict()) {
          <section class="banner banner-conflict">
            {{ i18n.t('edit.conflictMessage') }}
            <button type="button" (click)="reload()">{{ i18n.t('edit.conflictReload') }}</button>
            <button type="button" (click)="keep()">{{ i18n.t('edit.conflictKeep') }}</button>
          </section>
        }
        <hops-markdown-editor
          class="editor-pane"
          [content]="state.editBuffer()"
          (contentChange)="state.updateBuffer($event)"
        />
      </div>
    } @else {
      @switch (state.selectedKind()) {
        @case ('email') {
          @if (state.selectedEmail(); as mail) {
            <hops-email-view [email]="mail" />
          }
        }
        @case ('image') {
          @if (state.selectedImageUrl(); as url) {
            <hops-image-view [src]="url" [name]="fileName()" />
          }
        }
        @case ('text') {
          <div class="view-grid" [hidden]="!state.selectedContent()">
            <pre class="hops-plaintext" #host (click)="onContentClick($event)">{{ state.selectedContent() }}</pre>
          </div>
        }
        @default {
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
        }
      }
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        background: var(--hops-stout);
        /* No overflow here: each branch owns its own scroll (view-grid scrolls
           the rendered article; CodeMirror scrolls itself in edit mode). */
      }
      .view-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      .editor-container {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        height: 100%;
        overflow: hidden; /* CodeMirror owns its internal scroller */
      }
      .editor-pane {
        flex: 1;
        min-height: 0;
        height: 100%;
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
        flex-shrink: 0;
      }
      .banner-error {
        background: rgba(179, 64, 54, 0.18);
        color: #ffd8d5;
        border-bottom: 1px solid rgba(179, 64, 54, 0.4);
      }
      .banner-conflict {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: rgba(245, 197, 66, 0.12);
        color: var(--hops-pilsner);
        border-bottom: 1px solid rgba(245, 197, 66, 0.3);
      }
      .banner-conflict button {
        appearance: none;
        background: rgba(245, 197, 66, 0.15);
        border: 1px solid rgba(245, 197, 66, 0.35);
        border-radius: 3px;
        color: var(--hops-foam);
        font-size: 0.78rem;
        padding: 0.15rem 0.55rem;
        cursor: pointer;
        white-space: nowrap;
      }
      .banner-conflict button:hover {
        background: rgba(245, 197, 66, 0.25);
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
        flex-shrink: 0;
      }
      .filebar-path {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        /* Reset button chrome — reads like the path text, behaves like a
           button (click to copy the absolute path). */
        appearance: none;
        background: transparent;
        border: 0;
        margin: 0;
        padding: 0.12rem 0.35rem;
        font: inherit;
        color: inherit;
        text-align: left;
        border-radius: 3px;
        cursor: pointer;
      }
      .filebar-path:hover {
        background: rgba(245, 197, 66, 0.1);
        color: var(--hops-foam);
      }
      .filebar-path:focus-visible {
        outline: 1px solid var(--hops-malt);
        outline-offset: 1px;
      }
      .filebar-copied {
        color: var(--hops-pilsner);
        font-weight: 500;
      }
      .filebar-sep {
        color: var(--hops-malt);
      }
      .filebar-modified {
        color: var(--hops-pilsner);
        white-space: nowrap;
      }
      .filebar-actions {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-shrink: 0;
      }
      .dirty {
        color: var(--hops-pilsner);
        font-size: 1.1rem;
        line-height: 1;
        font-weight: 700;
      }
      .fbtn {
        appearance: none;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--hops-border);
        border-radius: 3px;
        color: var(--hops-text-dim);
        font-family: var(--hops-mono);
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        cursor: pointer;
        white-space: nowrap;
        line-height: 1.4;
      }
      .fbtn:hover {
        background: rgba(245, 197, 66, 0.1);
        color: var(--hops-foam);
        border-color: rgba(245, 197, 66, 0.35);
      }
      .fbtn.primary {
        background: rgba(245, 197, 66, 0.15);
        border-color: rgba(245, 197, 66, 0.4);
        color: var(--hops-pilsner);
        font-weight: 500;
      }
      .fbtn.primary:hover {
        background: rgba(245, 197, 66, 0.25);
        color: var(--hops-foam);
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
      .hops-plaintext {
        margin: 0;
        padding: 1.25rem 1.5rem;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: var(--hops-mono);
        font-size: 0.85rem;
        line-height: 1.5;
        color: var(--hops-text);
      }
    `,
  ],
})
export class MarkdownViewComponent {
  protected readonly state = inject(MarkdownStructureService);
  protected readonly i18n = inject(I18nService);
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

  /** Anchor to scroll to once the next document has finished rendering — set
   *  by handleLinkClick when the user follows a `./other.md#section` link. */
  private pendingAnchor: string | null = null;

  /** Ticks every few seconds so the relative-time label refreshes itself. */
  private readonly nowTick = signal<number>(Date.now());

  /** True for a short beat after the path is copied, so the filebar swaps the
   *  path text for a "✓ copied" confirmation. */
  protected readonly pathCopied = signal<boolean>(false);
  private pathCopiedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly modifiedLabel = computed<string | null>(() => {
    const mtime = this.state.lastModified();
    if (mtime === null) return null;
    return this.formatRelative(mtime, this.nowTick());
  });

  protected readonly fileName = computed(() => {
    const p = this.state.selectedPath();
    return p ? (p.split(/[\\/]/).pop() ?? '') : '';
  });

  protected readonly modifiedAbsolute = computed<string>(() => {
    const mtime = this.state.lastModified();
    return mtime === null
      ? ''
      : new Date(mtime).toLocaleString(this.i18n.intlLocale());
  });

  private formatRelative(mtime: number, now: number): string {
    const deltaSec = Math.max(0, Math.floor((now - mtime) / 1000));
    if (deltaSec < 5) return this.i18n.t('time.justNow');
    if (deltaSec < 60) return this.i18n.t('time.secondsAgo', { n: deltaSec });
    const min = Math.floor(deltaSec / 60);
    if (min < 60) return this.i18n.t('time.minutesAgo', { n: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return this.i18n.t('time.hoursAgo', { n: hr });
    const days = Math.floor(hr / 24);
    if (days < 7) {
      return days === 1
        ? this.i18n.t('time.dayAgo')
        : this.i18n.t('time.daysAgo', { n: days });
    }
    return new Date(mtime).toLocaleDateString(this.i18n.intlLocale());
  }

  constructor() {
    // Re-parse whenever the selected content, its path, OR the active locale
    // changes — the parser injects translated tooltips and a "Mashing…"
    // placeholder into the rendered HTML, so the language flip needs a fresh
    // pass through marked + DOMPurify for those strings to refresh.
    effect(() => {
      const content = this.state.selectedContent();
      const path = this.state.selectedPath();
      this.i18n.locale(); // tracked dependency, used inside parser
      if (this.state.selectedKind() !== 'markdown') {
        this.html.set(null);
        return;
      }
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
      if (host) {
        this.toc.set(this.extractToc(host));
        // If we arrived via a cross-file link with `#anchor`, scroll once
        // the new content has been parsed + the heading IDs assigned.
        if (this.pendingAnchor) {
          const anchor = this.pendingAnchor;
          this.pendingAnchor = null;
          this.scrollToHeading(anchor);
        }
      }
    });

    // Drive the relative-time label.
    const tickId = setInterval(
      () => this.nowTick.set(Date.now()),
      RELATIVE_TIME_TICK_MS,
    );
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tickId);
      if (this.pathCopiedTimer) clearTimeout(this.pathCopiedTimer);
    });
  }

  /**
   * Copy the open file's absolute path to the clipboard and flash a short
   * confirmation in the filebar. Mirrors the code-block copy behaviour but
   * surfaces the result inline (signal-driven) rather than via a tooltip.
   */
  protected async copyPath(): Promise<void> {
    const path = this.state.selectedPath();
    if (!path) return;
    if (!(await this.writeClipboard(path))) return;
    this.pathCopied.set(true);
    if (this.pathCopiedTimer) clearTimeout(this.pathCopiedTimer);
    this.pathCopiedTimer = setTimeout(() => this.pathCopied.set(false), PATH_COPIED_MS);
  }

  // ── Edit mode controls ──────────────────────────────────────────────────

  protected enterEdit(): void {
    this.state.enterEditing();
  }

  protected async save(): Promise<void> {
    await this.state.saveRecipe();
  }

  protected cancel(): void {
    if (this.state.dirty() && !confirm(this.i18n.t('edit.discardConfirm'))) return;
    this.state.cancelEditing();
  }

  protected reload(): void {
    void this.state.reloadFromDisk();
  }

  protected keep(): void {
    this.state.keepMyEdits();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (this.state.mode() === 'editing') void this.state.saveRecipe();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      if (this.state.mode() === 'viewing' && this.state.selectedPath()) this.state.enterEditing();
      return;
    }
    if (e.key === 'Escape' && this.state.mode() === 'editing') {
      this.cancel();
    }
  }

  // ── Content click handler ───────────────────────────────────────────────

  /**
   * Event-delegate clicks on the toolbar buttons that the parser injects
   * into every code block (`<button class="hops-code-action" data-action="…">`).
   * Goes through the article so the bound innerHTML doesn't need per-button
   * Angular event wiring.
   */
  protected onContentClick(event: Event): void {
    const target = event.target as HTMLElement | null;

    // Anchor inside the rendered markdown — cross-file link, in-page anchor,
    // or external URL. Always preventDefault: the browser's native navigation
    // would try to load the href inside the Tauri webview, which is wrong
    // for every case here.
    const link = target?.closest<HTMLAnchorElement>('a[href]');
    if (link) {
      const href = link.getAttribute('href');
      if (href) {
        event.preventDefault();
        event.stopPropagation();
        void this.handleLinkClick(href);
      }
      return;
    }

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

  /**
   * Resolve and act on an anchor href from the rendered markdown. Four cases:
   *   `#anchor`       → scroll within the current file
   *   http(s)/mail/tel → open externally via the system handler
   *   ./other.md#x    → resolve relative to the current file's directory,
   *                     load that file via state.openFileByPath, then scroll
   *                     to `x` after the next render
   *   ./photo.png     → non-markdown path, hand off to the OS-default app
   */
  private async handleLinkClick(rawHref: string): Promise<void> {
    if (!rawHref) return;

    // In-page anchor.
    if (rawHref.startsWith('#')) {
      this.scrollToHeading(decodeURIComponent(rawHref.slice(1)));
      return;
    }

    // External URL — defer to the system browser/handler. Covers http(s),
    // mailto:, and tel: links — all routed through the opener plugin.
    if (/^(https?|mailto|tel):/i.test(rawHref)) {
      try {
        await openUrlBridge(rawHref);
      } catch (err) {
        this.state.showError(
          this.i18n.t('error.actionFailed', {
            detail: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }

    // Anything else is treated as a filesystem path. Without an open file we
    // have no anchor for relative resolution, so bail out quietly.
    const currentPath = this.state.selectedPath();
    if (!currentPath) return;

    const [pathPart, anchor] = rawHref.split('#');
    if (!pathPart) {
      // Edge case: just '#' or '#?' with no anchor.
      if (anchor) this.scrollToHeading(decodeURIComponent(anchor));
      return;
    }
    const decodedPath = decodeURIComponent(pathPart);
    const resolved = resolveRelative(dirname(currentPath), decodedPath);

    if (classify(decodedPath) !== 'unsupported') {
      if (anchor) this.pendingAnchor = decodeURIComponent(anchor);
      await this.state.openFileByPath(resolved);
      return;
    }

    // Non-markdown — let the OS pick the right app.
    try {
      await openPathBridge(resolved);
    } catch (err) {
      this.state.showError(
        this.i18n.t('error.actionFailed', {
          detail: err instanceof Error ? err.message : String(err),
        }),
      );
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
        else this.state.showError(this.i18n.t('error.diagramRerenderFailed'));
      });
  }

  private async copySource(block: HTMLElement, button: HTMLElement): Promise<void> {
    const source = decodeBase64(block.dataset['source'] ?? '');
    if (await this.writeClipboard(source)) this.flashCopied(button);
  }

  /**
   * Write `text` to the clipboard, returning whether it succeeded. Prefers the
   * async Clipboard API and falls back to a hidden-textarea `execCommand`
   * copy, because some webview configurations block the async API without a
   * "trusted" user gesture in ways that are hard to predict.
   */
  private async writeClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        return document.execCommand('copy');
      } catch {
        return false;
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

  /**
   * The code-block toolbar's pencil now enters the in-app CodeMirror editor
   * rather than launching the OS-default editor — CodeMirror is the editor.
   */
  private openInEditor(): void {
    if (!this.state.selectedPath()) {
      this.state.showError(this.i18n.t('error.noDocOpen'));
      return;
    }
    this.state.enterEditing();
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
