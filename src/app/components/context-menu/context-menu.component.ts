import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { openPathBridge, revealInExplorer } from '../../core/tauri-bridge';
import { ContextMenuService } from '../../services/context-menu.service';
import { I18nService } from '../../services/i18n.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';

/**
 * Right-click menu for tree entries. Renders a small floating panel at the
 * cursor with file-system-y actions: open folder, reveal file, open file in
 * editor.
 *
 * Closes on Escape, on outside mousedown, or after invoking any action.
 * If the menu would clip past the viewport edge we shift it back into view
 * once after first paint (via afterRenderEffect).
 */
@Component({
  selector: 'hops-context-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ctx.state(); as menu) {
      <div
        #menuEl
        class="ctx"
        role="menu"
        [style.left.px]="menu.x"
        [style.top.px]="menu.y"
        (mousedown)="$event.stopPropagation()"
        (click)="$event.stopPropagation()"
      >
        <div class="ctx-header" [title]="menu.node.path">
          <span class="ctx-icon">{{ menu.node.isDir ? '📂' : '📄' }}</span>
          <span class="ctx-name">{{ menu.node.name }}</span>
        </div>

        @if (menu.node.isDir) {
          <button type="button" class="ctx-item" (click)="openFolder()" role="menuitem">
            <span class="ctx-item-icon">🔍</span>
            {{ i18n.t('ctx.openFolder') }}
          </button>
          <hr class="ctx-sep" />
          <button type="button" class="ctx-item" (click)="ctx.requestAction('new-file')" role="menuitem">
            <span class="ctx-item-icon">📄</span>
            {{ i18n.t('fileops.newFile') }}
          </button>
          <button type="button" class="ctx-item" (click)="ctx.requestAction('new-folder')" role="menuitem">
            <span class="ctx-item-icon">📁</span>
            {{ i18n.t('fileops.newFolder') }}
          </button>
          <hr class="ctx-sep" />
          <button type="button" class="ctx-item" (click)="ctx.requestAction('rename')" role="menuitem">
            <span class="ctx-item-icon">✏️</span>
            {{ i18n.t('fileops.rename') }}
          </button>
          <button type="button" class="ctx-item ctx-item-danger" (click)="ctx.requestAction('delete')" role="menuitem">
            <span class="ctx-item-icon">🗑️</span>
            {{ i18n.t('fileops.delete') }}
          </button>
        } @else {
          <button type="button" class="ctx-item" (click)="revealFile()" role="menuitem">
            <span class="ctx-item-icon">🔍</span>
            {{ i18n.t('ctx.revealFile') }}
          </button>
          <button type="button" class="ctx-item" (click)="openFile()" role="menuitem">
            <span class="ctx-item-icon">✏️</span>
            {{ i18n.t('ctx.openInEditor') }}
          </button>
          <hr class="ctx-sep" />
          <button type="button" class="ctx-item" (click)="ctx.requestAction('rename')" role="menuitem">
            <span class="ctx-item-icon">✏️</span>
            {{ i18n.t('fileops.rename') }}
          </button>
          <button type="button" class="ctx-item ctx-item-danger" (click)="ctx.requestAction('delete')" role="menuitem">
            <span class="ctx-item-icon">🗑️</span>
            {{ i18n.t('fileops.delete') }}
          </button>
        }
      </div>
    }
  `,
  styles: [
    `
      .ctx {
        position: fixed;
        z-index: 1000;
        min-width: 220px;
        max-width: 340px;
        background: var(--hops-stout-2);
        border: 1px solid var(--hops-border);
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        padding: 0.25rem;
        user-select: none;
      }
      .ctx-header {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.35rem 0.55rem 0.4rem;
        margin-bottom: 0.15rem;
        border-bottom: 1px solid var(--hops-border);
        font-size: 0.75rem;
        color: var(--hops-text-dim);
      }
      .ctx-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--hops-foam);
        font-family: var(--hops-mono);
      }
      .ctx-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        text-align: left;
        background: transparent;
        border: 0;
        color: var(--hops-text);
        font: inherit;
        font-size: 0.85rem;
        padding: 0.4rem 0.6rem;
        border-radius: 3px;
        cursor: pointer;
      }
      .ctx-item:hover {
        background: rgba(245, 197, 66, 0.1);
        color: var(--hops-foam);
      }
      .ctx-item-icon {
        font-size: 0.95em;
      }
      .ctx-item-danger {
        color: var(--hops-error, #e05c5c);
      }
      .ctx-item-danger:hover {
        background: rgba(224, 92, 92, 0.12);
        color: var(--hops-error, #e05c5c);
      }
      .ctx-sep {
        border: none;
        border-top: 1px solid var(--hops-border);
        margin: 0.2rem 0.4rem;
      }
    `,
  ],
})
export class ContextMenuComponent {
  protected readonly ctx = inject(ContextMenuService);
  protected readonly i18n = inject(I18nService);
  private readonly state = inject(MarkdownStructureService);
  private readonly menuEl = viewChild<ElementRef<HTMLElement>>('menuEl');

  private readonly currentNode = computed(() => this.ctx.state()?.node ?? null);

  constructor() {
    // While the menu is open, capture document-level clicks + Escape to
    // dismiss it. The menu's own (mousedown) stops propagation, so these
    // listeners only fire for outside interactions.
    let cleanup: (() => void) | null = null;
    effect(() => {
      cleanup?.();
      cleanup = null;
      if (!this.ctx.state()) return;
      const onMouseDown = () => this.ctx.close();
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.ctx.close();
      };
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('keydown', onKeyDown);
      cleanup = () => {
        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('keydown', onKeyDown);
      };
    });
    inject(DestroyRef).onDestroy(() => cleanup?.());

    // Nudge the menu back into the viewport if it would clip off the edge.
    afterRenderEffect(() => {
      const state = this.ctx.state();
      const el = this.menuEl()?.nativeElement;
      if (!state || !el) return;
      const rect = el.getBoundingClientRect();
      const overflowX = state.x + rect.width - window.innerWidth + 8;
      const overflowY = state.y + rect.height - window.innerHeight + 8;
      if (overflowX > 0) el.style.left = `${Math.max(8, state.x - overflowX)}px`;
      if (overflowY > 0) el.style.top = `${Math.max(8, state.y - overflowY)}px`;
    });
  }

  protected async openFolder(): Promise<void> {
    const node = this.currentNode();
    this.ctx.close();
    if (!node) return;
    await this.safeOpen(() => openPathBridge(node.path));
  }

  protected async revealFile(): Promise<void> {
    const node = this.currentNode();
    this.ctx.close();
    if (!node) return;
    await this.safeOpen(() => revealInExplorer(node.path));
  }

  protected async openFile(): Promise<void> {
    const node = this.currentNode();
    this.ctx.close();
    if (!node) return;
    await this.safeOpen(() => openPathBridge(node.path));
  }

  private async safeOpen(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.state.showError(
        this.i18n.t('error.actionFailed', {
          detail: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
