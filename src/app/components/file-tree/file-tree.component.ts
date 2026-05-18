import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type { RecipeNode } from '../../models/recipe-node.model';
import { MarkdownStructureService } from '../../services/markdown-structure.service';

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
      <div class="row" [class.is-dir]="n.isDir" [class.is-active]="isActive()">
        @if (n.isDir) {
          <button
            type="button"
            class="entry folder"
            (click)="toggle()"
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
        } @else {
          <button
            type="button"
            class="entry file"
            (click)="select()"
            [title]="n.path"
          >
            <span class="caret placeholder">·</span>
            <span class="icon">📜</span>
            <span class="label">{{ n.name }}</span>
          </button>
        }
      </div>

      @if (n.isDir && open()) {
        <ul class="children">
          @for (child of n.children; track child.path) {
            <li><hops-file-tree [node]="child" [depth]="depth() + 1" /></li>
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

  // Auto-open the root level so the user immediately sees the first layer.
  private readonly _open = signal<boolean>(false);
  protected readonly open = computed(() => this._open() || this.depth() === 0);

  protected readonly isActive = computed(() => {
    const n = this.node();
    const sel = this.state.selectedPath();
    return !!n && !n.isDir && n.path === sel;
  });

  protected toggle(): void {
    this._open.update((v) => !v);
  }

  protected select(): void {
    const n = this.node();
    if (n && !n.isDir) void this.state.selectRecipe(n);
  }
}
