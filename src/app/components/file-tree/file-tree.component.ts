import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { dirname, normalize } from '../../core/path-utils';
import type { RecipeNode } from '../../models/recipe-node.model';
import { ContextMenuService, FileOpAction } from '../../services/context-menu.service';
import { I18nService } from '../../services/i18n.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { TreeDragService } from '../../services/tree-drag.service';

/**
 * Recursive directory tree. Each node is rendered by this same component —
 * folders show a toggle, files behave as buttons that fire `selectRecipe`.
 *
 * State that belongs to the tree itself (which folders are open) lives in a
 * per-instance signal rather than in the global service, since it's pure UI.
 */
@Component({
  selector: 'hops-file-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let n = node();
    @if (n) {
      <div class="row" [class.is-dir]="n.isDir" [class.is-active]="isActive()" [class.drop-target]="dropHover()">
        @if (n.isDir) {
          @if (inlineMode() === 'rename') {
            <div class="entry folder inline-edit-row">
              <span class="caret" [class.open]="open()">▶</span>
              <span class="icon">{{ open() ? '🍻' : '🍺' }}</span>
              <input
                #inlineInput
                class="inline-input"
                [value]="draft()"
                (input)="draft.set($any($event.target).value)"
                (keydown.enter)="commitInline()"
                (keydown.escape)="cancelInline()"
                (blur)="cancelInline()"
                autofocus
              />
            </div>
          } @else {
            <button
              type="button"
              class="entry folder"
              draggable="true"
              (click)="toggle()"
              (contextmenu)="onContextMenu($event, n)"
              (dragstart)="onDragStart($event, n)"
              (dragend)="onDragEnd()"
              (dragover)="onDragOver($event, n)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event, n)"
              [attr.aria-expanded]="open()"
              [title]="n.path"
            >
              <span class="caret" [class.open]="open()">▶</span>
              <span class="icon">{{ open() ? '🍻' : '🍺' }}</span>
              <span class="label">{{ n.name }}</span>
              @if (n.children.length) {
                <span class="count">{{ n.children.length }}</span>
              }
            </button>
          }
        } @else {
          @if (inlineMode() === 'rename') {
            <div class="entry file inline-edit-row">
              <span class="caret placeholder">·</span>
              <span class="icon">📜</span>
              <input
                #inlineInput
                class="inline-input"
                [value]="draft()"
                (input)="draft.set($any($event.target).value)"
                (keydown.enter)="commitInline()"
                (keydown.escape)="cancelInline()"
                (blur)="cancelInline()"
                autofocus
              />
            </div>
          } @else {
            <button
              type="button"
              class="entry file"
              draggable="true"
              (click)="select()"
              (contextmenu)="onContextMenu($event, n)"
              (dragstart)="onDragStart($event, n)"
              (dragend)="onDragEnd()"
              (dragover)="onDragOver($event, n)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event, n)"
              [title]="n.path"
            >
              <span class="caret placeholder">·</span>
              <span class="icon">📜</span>
              <span class="label">{{ n.name }}</span>
            </button>
          }
        }
      </div>

      @if (n.isDir && open()) {
        <ul class="children">
          @for (child of n.children; track child.path) {
            <li><hops-file-tree [node]="child" [depth]="depth() + 1" /></li>
          }
          @if (inlineMode() === 'new-file' || inlineMode() === 'new-folder') {
            <li>
              <div class="entry inline-new-row" [style.--depth-pad.rem]="0.5 + (depth() + 1) * 0.9">
                <span class="caret placeholder">·</span>
                <span class="icon">{{ inlineMode() === 'new-file' ? '📜' : '📁' }}</span>
                <input
                  #inlineInput
                class="inline-input"
                  [value]="draft()"
                  [placeholder]="inlineMode() === 'new-file' ? 'filename.md' : 'folder-name'"
                  (input)="draft.set($any($event.target).value)"
                  (keydown.enter)="commitInline()"
                  (keydown.escape)="cancelInline()"
                  (blur)="cancelInline()"
                  autofocus
                />
              </div>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .row {
        display: block;
      }
      .entry {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        width: 100%;
        text-align: left;
        background: transparent;
        border: 0;
        color: var(--hops-text);
        font: inherit;
        font-size: 0.83rem;
        padding: 0.22rem 0.5rem 0.22rem var(--depth-pad, 0.5rem);
        cursor: pointer;
        border-radius: 3px;
      }
      .entry:hover {
        background: rgba(245, 197, 66, 0.08);
        color: var(--hops-foam);
      }
      .row.is-active .entry.file {
        background: rgba(245, 197, 66, 0.18);
        color: var(--hops-foam);
      }
      .row.drop-target > .entry {
        background: rgba(245, 197, 66, 0.16);
        outline: 1px dashed var(--hops-foam, #f5c542);
        outline-offset: -1px;
      }
      .caret {
        display: inline-block;
        width: 0.9em;
        font-size: 0.65em;
        color: var(--hops-text-dim);
        transition: transform 0.12s ease;
      }
      .caret.open {
        transform: rotate(90deg);
      }
      .caret.placeholder {
        color: transparent;
      }
      .icon {
        font-size: 0.95em;
      }
      .label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .count {
        color: var(--hops-text-dim);
        font-size: 0.72em;
        background: rgba(245, 197, 66, 0.08);
        border-radius: 999px;
        padding: 0 0.45em;
      }
      ul.children {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .inline-edit-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.22rem 0.5rem 0.22rem var(--depth-pad, 0.5rem);
        cursor: default;
      }
      .inline-new-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.22rem 0.5rem 0.22rem var(--depth-pad, 0.5rem);
      }
      .inline-input {
        flex: 1;
        min-width: 0;
        background: var(--hops-stout-2, #1e1e1e);
        border: 1px solid var(--hops-foam, #f5c542);
        border-radius: 3px;
        color: var(--hops-text, #e0e0e0);
        font: inherit;
        font-family: var(--hops-mono, monospace);
        font-size: 0.83rem;
        padding: 0.1rem 0.35rem;
        outline: none;
      }
      .inline-input:focus {
        border-color: var(--hops-foam, #f5c542);
        box-shadow: 0 0 0 2px rgba(245, 197, 66, 0.18);
      }
    `,
  ],
  host: {
    '[style.--depth-pad.rem]': '0.5 + depth() * 0.9',
  },
})
export class FileTreeComponent {
  readonly node = input<RecipeNode | null>(null);
  readonly depth = input<number>(0);

  private readonly state = inject(MarkdownStructureService);
  private readonly contextMenu = inject(ContextMenuService);
  private readonly i18n = inject(I18nService);
  private readonly drag = inject(TreeDragService);

  // Auto-open the root level so the user immediately sees the first layer.
  private readonly _open = signal<boolean>(false);
  protected readonly open = computed(() => this._open() || this.depth() === 0);

  protected readonly isActive = computed(() => {
    const n = this.node();
    const sel = this.state.selectedPath();
    return !!n && !n.isDir && n.path === sel;
  });

  // --- inline editing state ---
  protected readonly inlineMode = signal<'rename' | 'new-file' | 'new-folder' | null>(null);
  protected readonly draft = signal<string>('');
  private readonly inlineInput = viewChild<ElementRef<HTMLInputElement>>('inlineInput');

  // --- drag & drop state ---
  protected readonly dropHover = signal<boolean>(false);
  private springTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Register as an action handler for file operations triggered from the
    // context menu. The service fans out to all registered handlers; each
    // node filters by path so only the matching instance responds.
    const unregister = this.contextMenu.registerActionHandler((node, action) => {
      const myNode = this.node();
      if (!myNode || myNode.path !== node.path) return;
      this.handleAction(node, action);
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(unregister);
    // A node can be destroyed mid-hover (watcher re-scan during a drag) —
    // make sure the spring-load timer never fires on a dead instance.
    destroyRef.onDestroy(() => this.clearDropHover());

    // Focus the inline input once it has been inserted into the DOM. The HTML
    // `autofocus` attribute is ignored for elements Angular inserts dynamically
    // via @if, so focus imperatively after render whenever an inline mode opens.
    afterRenderEffect(() => {
      if (this.inlineMode()) this.inlineInput()?.nativeElement.focus();
    });
  }

  protected toggle(): void {
    this._open.update((v) => !v);
  }

  protected select(): void {
    const n = this.node();
    if (n && !n.isDir) void this.state.selectRecipe(n);
  }

  protected onContextMenu(event: MouseEvent, n: RecipeNode): void {
    this.contextMenu.open(n, event);
  }

  // --- drag & drop (move within the tree) ---

  protected onDragStart(event: DragEvent, n: RecipeNode): void {
    this.drag.start(n);
    event.dataTransfer?.setData('text/plain', n.path);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragEnd(): void {
    this.drag.clear();
    this.clearDropHover();
  }

  protected onDragOver(event: DragEvent, n: RecipeNode): void {
    if (!this.isValidDropTarget(n)) return; // no preventDefault → drop refused
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (!this.dropHover()) {
      this.dropHover.set(true);
      // Spring-loaded folders: dwelling on a closed folder opens it.
      if (n.isDir && !this.open()) {
        this.springTimer = setTimeout(() => this._open.set(true), 700);
      }
    }
  }

  protected onDragLeave(event: DragEvent): void {
    // dragleave also fires when entering a child span; ignore those.
    const related = event.relatedTarget as Node | null;
    if (related && (event.currentTarget as Node).contains(related)) return;
    this.clearDropHover();
  }

  protected async onDrop(event: DragEvent, n: RecipeNode): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const src = this.drag.dragged();
    const valid = this.isValidDropTarget(n);
    this.drag.clear();
    this.clearDropHover();
    if (!src || !valid) return;
    await this.state.moveEntry(src.path, this.targetDirOf(n));
  }

  /** Folder rows accept into themselves; file rows accept into their parent. */
  private targetDirOf(n: RecipeNode): string {
    return n.isDir ? n.path : dirname(n.path);
  }

  private isValidDropTarget(n: RecipeNode): boolean {
    const src = this.drag.dragged();
    if (!src) return false;
    const dir = normalize(this.targetDirOf(n));
    const srcPath = normalize(src.path);
    if (dir === srcPath) return false; // folder onto itself
    if (dir === dirname(srcPath)) return false; // no-op: already there
    if (src.isDir && (dir + '/').startsWith(srcPath + '/')) return false; // own subtree
    return true;
  }

  private clearDropHover(): void {
    this.dropHover.set(false);
    if (this.springTimer !== null) {
      clearTimeout(this.springTimer);
      this.springTimer = null;
    }
  }

  // --- inline input methods ---

  protected startRename(): void {
    const n = this.node();
    if (!n) return;
    this.draft.set(n.name);
    this.inlineMode.set('rename');
  }

  protected startNewFile(): void {
    this.draft.set('');
    this.inlineMode.set('new-file');
    this._open.set(true);
  }

  protected startNewFolder(): void {
    this.draft.set('');
    this.inlineMode.set('new-folder');
    this._open.set(true);
  }

  protected async commitInline(): Promise<void> {
    const n = this.node();
    const name = this.draft().trim();
    const mode = this.inlineMode();
    if (!n || !name || !mode) {
      this.inlineMode.set(null);
      return;
    }
    const dir = n.isDir ? n.path : dirname(n.path);
    if (mode === 'rename') {
      const newPath = await this.state.renameEntry(n.path, name);
      if (newPath && this.state.selectedPath() === n.path) {
        await this.state.openFileByPath(newPath);
      }
    } else if (mode === 'new-file') {
      await this.state.newFile(dir, name);
    } else {
      await this.state.newFolder(dir, name);
    }
    this.inlineMode.set(null);
  }

  protected cancelInline(): void {
    this.inlineMode.set(null);
  }

  protected async deleteNode(): Promise<void> {
    const n = this.node();
    if (!n) return;
    const confirmed = confirm(this.i18n.t('fileops.deleteConfirm', { name: n.name }));
    if (!confirmed) return;
    await this.state.deleteEntry(n.path);
  }

  private handleAction(node: RecipeNode, action: FileOpAction): void {
    switch (action) {
      case 'rename':
        this.startRename();
        break;
      case 'new-file':
        this.startNewFile();
        break;
      case 'new-folder':
        this.startNewFolder();
        break;
      case 'delete':
        void this.deleteNode();
        break;
    }
  }
}
