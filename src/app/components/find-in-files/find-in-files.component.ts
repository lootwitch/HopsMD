import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { searchBrewhouseBridge, type SearchHit } from '../../core/tauri-bridge';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { I18nService } from '../../services/i18n.service';

/** Debounce on user typing before firing a search. 250 ms feels live but
 *  spares the Rust walker from running on every keystroke. */
const SEARCH_DEBOUNCE_MS = 250;

interface HitGroup {
  path: string;
  fileName: string;
  hits: SearchHit[];
}

/**
 * Overlay panel for brewhouse-wide full-text search. Opened by Ctrl+Shift+F.
 * Mounted at the shell level so it can float above whatever view the user
 * is in. Results are grouped per file; clicking a hit opens the file and
 * scrolls (best-effort) to roughly the matching line.
 */
@Component({
  selector: 'hops-find-in-files',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="backdrop" (click)="close()"></div>
      <section class="panel" role="dialog" aria-label="Find in Files">
        <header class="panel-head">
          <input
            #input
            type="text"
            class="panel-search"
            [value]="query()"
            (input)="onInput($event)"
            (keydown.escape)="close()"
            [placeholder]="i18n.t('find.placeholder')"
            spellcheck="false"
            autocomplete="off"
          />
          <label class="panel-toggle" [title]="i18n.t('find.caseSensitive')">
            <input
              type="checkbox"
              [checked]="caseSensitive()"
              (change)="onCaseToggle($event)"
            />
            Aa
          </label>
          <button type="button" class="panel-close" (click)="close()" title="Esc">×</button>
        </header>
        <div class="panel-body">
          @if (busy()) {
            <div class="panel-status">{{ i18n.t('find.searching') }}</div>
          } @else if (error(); as err) {
            <div class="panel-status panel-status-error">{{ err }}</div>
          } @else if (query().length < 2) {
            <div class="panel-status">{{ i18n.t('find.startHint') }}</div>
          } @else if (groups().length === 0) {
            <div class="panel-status">{{ i18n.t('find.noResults') }}</div>
          } @else {
            <div class="panel-summary">
              {{ i18n.t('find.summary', { hits: results().length, files: groups().length }) }}
            </div>
            @for (group of groups(); track group.path) {
              <details class="group" open>
                <summary class="group-head">
                  <span class="group-name">{{ group.fileName }}</span>
                  <span class="group-count">{{ group.hits.length }}</span>
                  <span class="group-path">{{ group.path }}</span>
                </summary>
                <ul class="group-list">
                  @for (hit of group.hits; track hit.lineNumber) {
                    <li class="hit">
                      <button
                        type="button"
                        class="hit-btn"
                        (click)="openHit(hit)"
                      >
                        <span class="hit-line">{{ hit.lineNumber }}</span>
                        <span class="hit-context">{{ hit.context }}</span>
                      </button>
                    </li>
                  }
                </ul>
              </details>
            }
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      :host { display: contents; }
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        z-index: 80;
      }
      .panel {
        position: fixed;
        top: 64px;
        left: 50%;
        transform: translateX(-50%);
        width: min(820px, 90vw);
        max-height: calc(100vh - 120px);
        background: var(--hops-stout-2);
        border: 1px solid var(--hops-border);
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
        z-index: 81;
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
      }
      .panel-search {
        flex: 1;
        background: var(--hops-stout-3);
        color: var(--hops-text);
        border: 1px solid var(--hops-border);
        border-radius: 4px;
        padding: 0.4rem 0.6rem;
        font-family: var(--hops-mono);
        font-size: 0.88rem;
        outline: none;
      }
      .panel-search:focus {
        border-color: rgba(245, 197, 66, 0.55);
      }
      .panel-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        color: var(--hops-text-dim);
        font-family: var(--hops-mono);
        font-size: 0.85rem;
        cursor: pointer;
        user-select: none;
      }
      .panel-close {
        appearance: none;
        background: transparent;
        border: 0;
        color: var(--hops-text-dim);
        font-size: 1.2rem;
        line-height: 1;
        padding: 0.2rem 0.5rem;
        cursor: pointer;
        border-radius: 4px;
      }
      .panel-close:hover {
        color: var(--hops-foam);
        background: rgba(245, 197, 66, 0.1);
      }
      .panel-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 0.4rem 0.5rem 0.8rem;
      }
      .panel-status {
        color: var(--hops-text-dim);
        padding: 0.6rem 0.75rem;
        font-size: 0.85rem;
      }
      .panel-status-error {
        color: var(--hops-cherry);
      }
      .panel-summary {
        color: var(--hops-text-dim);
        padding: 0.3rem 0.75rem 0.5rem;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .group {
        margin: 0 0 0.3rem;
        border-radius: 5px;
        overflow: hidden;
      }
      .group-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.6rem;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.04);
        list-style: none;
        font-family: var(--hops-mono);
        font-size: 0.82rem;
      }
      .group-head::-webkit-details-marker { display: none; }
      .group-head::marker { content: ''; }
      .group-name {
        color: var(--hops-foam);
        font-weight: 500;
      }
      .group-count {
        color: var(--hops-pilsner);
        background: rgba(245, 197, 66, 0.12);
        border-radius: 999px;
        padding: 0 0.5em;
        font-size: 0.72rem;
      }
      .group-path {
        flex: 1;
        min-width: 0;
        color: var(--hops-text-dim);
        font-size: 0.72rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: right;
      }
      .group-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .hit {
        padding: 0;
      }
      .hit-btn {
        appearance: none;
        background: transparent;
        border: 0;
        text-align: left;
        width: 100%;
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
        padding: 0.25rem 0.75rem 0.25rem 1.4rem;
        cursor: pointer;
        color: var(--hops-text);
        font-family: var(--hops-mono);
        font-size: 0.82rem;
        line-height: 1.4;
      }
      .hit-btn:hover {
        background: rgba(245, 197, 66, 0.08);
        color: var(--hops-foam);
      }
      .hit-line {
        color: var(--hops-text-dim);
        font-size: 0.72rem;
        flex-shrink: 0;
        min-width: 2.5em;
        text-align: right;
      }
      .hit-context {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class FindInFilesComponent {
  protected readonly state = inject(MarkdownStructureService);
  protected readonly i18n = inject(I18nService);

  protected readonly visible = signal<boolean>(false);
  protected readonly query = signal<string>('');
  protected readonly caseSensitive = signal<boolean>(false);
  protected readonly busy = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly results = signal<readonly SearchHit[]>([]);

  protected readonly groups = computed<readonly HitGroup[]>(() => {
    const byPath = new Map<string, HitGroup>();
    for (const hit of this.results()) {
      const existing = byPath.get(hit.path);
      if (existing) {
        existing.hits.push(hit);
      } else {
        byPath.set(hit.path, {
          path: hit.path,
          fileName: hit.path.split(/[\\/]/).pop() ?? hit.path,
          hits: [hit],
        });
      }
    }
    return Array.from(byPath.values());
  });

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterRenderEffect(() => {
      // Focus the input every time the panel becomes visible.
      if (this.visible()) {
        const el = this.input()?.nativeElement;
        if (el && document.activeElement !== el) {
          el.focus();
          el.select();
        }
      }
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
    });
  }

  open(): void {
    this.error.set(null);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  toggle(): void {
    if (this.visible()) this.close();
    else this.open();
  }

  protected onInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.query.set(q);
    this.scheduleSearch();
  }

  protected onCaseToggle(event: Event): void {
    this.caseSensitive.set((event.target as HTMLInputElement).checked);
    this.scheduleSearch();
  }

  private scheduleSearch(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.query().trim().length < 2) {
      this.results.set([]);
      this.busy.set(false);
      this.error.set(null);
      return;
    }
    this.debounceTimer = setTimeout(() => void this.runSearch(), SEARCH_DEBOUNCE_MS);
  }

  private async runSearch(): Promise<void> {
    const brewhouse = this.state.brewhouse();
    if (!brewhouse) {
      this.error.set(this.i18n.t('find.noBrewhouse'));
      this.results.set([]);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const hits = await searchBrewhouseBridge(
        brewhouse,
        this.query(),
        this.caseSensitive(),
      );
      this.results.set(hits);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      this.results.set([]);
    } finally {
      this.busy.set(false);
    }
  }

  protected async openHit(hit: SearchHit): Promise<void> {
    await this.state.openFileByPath(hit.path);
    this.close();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      e.key.toLowerCase() === 'f'
    ) {
      e.preventDefault();
      this.toggle();
    }
  }
}
