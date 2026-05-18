import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import type { TocItem } from '../../models/toc-item.model';
import { I18nService } from '../../services/i18n.service';

/**
 * Sticky table of contents shown at the top-right of the markdown view.
 * Items are clickable; clicking emits `itemSelected(id)` and the parent
 * scrolls the matching heading into view. Collapsing is fully controlled
 * by the parent so the state can be persisted there.
 */
@Component({
  selector: 'hops-toc',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toc" [class.collapsed]="collapsed()">
      <header class="toc-header">
        <button
          type="button"
          class="toc-toggle"
          (click)="onToggle()"
          [title]="collapsed() ? i18n.t('toc.show') : i18n.t('toc.hide')"
          [attr.aria-expanded]="!collapsed()"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M2 4h12 M2 8h12 M2 12h7"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
          @if (!collapsed()) {
            <span class="toc-title">{{ i18n.t('toc.title') }}</span>
            <span class="toc-count">{{ items().length }}</span>
          }
        </button>
      </header>

      @if (!collapsed()) {
        <nav class="toc-nav" [attr.aria-label]="i18n.t('toc.ariaLabel')">
          <ul>
            @for (item of items(); track item.id) {
              <li
                class="toc-entry"
                [attr.data-level]="item.level"
                [style.padding-left.px]="8 + item.indent * 14"
              >
                <button
                  type="button"
                  class="toc-link"
                  (click)="onSelect(item.id)"
                  [title]="item.text"
                >
                  {{ item.text }}
                </button>
              </li>
            }
          </ul>
        </nav>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .toc {
        width: 260px;
        max-height: calc(100vh - 110px);
        background: var(--hops-stout-2);
        border: 1px solid var(--hops-border);
        border-radius: 6px;
        margin: 1rem 1rem 1rem 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
      }
      .toc.collapsed {
        width: auto;
        max-height: none;
        background: var(--hops-stout-2);
      }
      .toc-header {
        flex-shrink: 0;
      }
      .toc-toggle {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        width: 100%;
        padding: 0.5rem 0.7rem;
        background: transparent;
        border: 0;
        border-bottom: 1px solid var(--hops-border);
        color: var(--hops-text-dim);
        font: inherit;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: color 0.12s, background 0.12s;
      }
      .toc-toggle:hover {
        color: var(--hops-foam);
        background: rgba(245, 197, 66, 0.06);
      }
      .toc.collapsed .toc-toggle {
        border-bottom: 0;
        padding: 0.55rem;
      }
      .toc-title {
        flex: 1;
        text-align: left;
      }
      .toc-count {
        color: var(--hops-text-dim);
        font-size: 0.7rem;
        background: rgba(245, 197, 66, 0.1);
        border-radius: 999px;
        padding: 0 0.45em;
        font-weight: 600;
        letter-spacing: 0;
        text-transform: none;
      }
      .toc-nav {
        overflow-y: auto;
        min-height: 0;
      }
      .toc-nav ul {
        list-style: none;
        margin: 0;
        padding: 0.3rem 0;
      }
      .toc-entry {
        margin: 0;
      }
      .toc-link {
        display: block;
        width: 100%;
        text-align: left;
        background: transparent;
        border: 0;
        color: var(--hops-text);
        font: inherit;
        font-size: 0.8rem;
        line-height: 1.35;
        padding: 0.25rem 0.7rem 0.25rem 0;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-left: 2px solid transparent;
        transition: color 0.12s, background 0.12s, border-color 0.12s;
      }
      .toc-link:hover {
        color: var(--hops-foam);
        background: rgba(245, 197, 66, 0.08);
        border-left-color: var(--hops-pilsner);
      }
      .toc-entry[data-level="1"] .toc-link {
        font-weight: 600;
        color: var(--hops-foam);
      }
      .toc-entry[data-level="2"] .toc-link {
        font-weight: 500;
      }
      .toc-entry[data-level="4"] .toc-link,
      .toc-entry[data-level="5"] .toc-link,
      .toc-entry[data-level="6"] .toc-link {
        color: var(--hops-text-dim);
        font-size: 0.76rem;
      }
    `,
  ],
})
export class TocComponent {
  protected readonly i18n = inject(I18nService);

  readonly items = input.required<readonly TocItem[]>();
  readonly collapsed = input<boolean>(false);

  readonly itemSelected = output<string>();
  readonly collapseToggled = output<void>();

  protected onSelect(id: string): void {
    this.itemSelected.emit(id);
  }

  protected onToggle(): void {
    this.collapseToggled.emit();
  }
}
