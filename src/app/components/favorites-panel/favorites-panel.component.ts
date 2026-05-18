import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { basename } from '../../core/path-utils';
import { FavoritesService } from '../../services/favorites.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';

/**
 * Top-of-sidebar "Sudhause"-Liste: every pinned brewhouse the user wants to
 * jump between, plus an "Aktuelles anstecken"-Button when the open brewhouse
 * isn't pinned yet.
 *
 * Clicking a favourite switches the active brewhouse. Clicking the small ✕
 * inside a favourite removes it from the list without switching.
 */
@Component({
  selector: 'hops-favorites-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="panel-header">
        <span>🌾</span>
        <span>Sudhause</span>
        @if (favorites.count(); as n) {
          <span class="panel-count">{{ n }}</span>
        }
      </header>

      <ul class="list">
        @for (path of favorites.favorites(); track path) {
          <li>
            <button
              type="button"
              class="fav"
              [class.active]="path === state.brewhouse()"
              (click)="open(path)"
              [title]="path"
            >
              <span class="fav-icon" aria-hidden="true">📍</span>
              <span class="fav-name">{{ name(path) }}</span>
              <span
                class="fav-unpin"
                role="button"
                tabindex="0"
                title="Vom Stammsudhaus-Pin lösen"
                (click)="unpin(path, $event)"
                (keydown.enter)="unpin(path, $event)"
                (keydown.space)="unpin(path, $event)"
              >×</span>
            </button>
          </li>
        }

        @if (canPinCurrent()) {
          <li>
            <button
              type="button"
              class="fav pin-current"
              (click)="pinCurrent()"
              [title]="state.brewhouse()"
            >
              <span class="fav-icon" aria-hidden="true">＋</span>
              <span class="fav-name">{{ pinCurrentLabel() }}</span>
            </button>
          </li>
        }

        @if (favorites.count() === 0 && !canPinCurrent()) {
          <li class="empty">
            Noch keine Stammsudhause angepinnt. Öffne oben rechts ein Sudhaus,
            dann erscheint hier ein „＋ Anstecken“-Button.
          </li>
        }
      </ul>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        flex-shrink: 0;
        max-height: 45%;
        overflow-y: auto;
        border-bottom: 1px solid var(--hops-border);
        background: rgba(245, 197, 66, 0.03);
      }
      .panel-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.85rem;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--hops-text-dim);
      }
      .panel-count {
        margin-left: auto;
        color: var(--hops-text-dim);
        font-size: 0.7rem;
        background: rgba(245, 197, 66, 0.1);
        border-radius: 999px;
        padding: 0 0.5em;
        font-weight: 600;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0 0.25rem 0.4rem;
      }
      .empty {
        padding: 0.5rem 0.85rem 0.5rem;
        font-size: 0.78rem;
        color: var(--hops-text-dim);
        font-style: italic;
        line-height: 1.4;
      }
      .fav {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        width: 100%;
        text-align: left;
        background: transparent;
        border: 0;
        color: var(--hops-text);
        font: inherit;
        font-size: 0.82rem;
        padding: 0.3rem 0.55rem;
        border-radius: 3px;
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
      }
      .fav:hover {
        background: rgba(245, 197, 66, 0.08);
        color: var(--hops-foam);
      }
      .fav.active {
        background: rgba(245, 197, 66, 0.18);
        color: var(--hops-foam);
      }
      .fav.active .fav-icon {
        filter: drop-shadow(0 0 3px rgba(245, 197, 66, 0.5));
      }
      .fav-icon {
        font-size: 0.95em;
        flex-shrink: 0;
      }
      .fav-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .fav-unpin {
        color: var(--hops-text-dim);
        font-size: 1rem;
        line-height: 1;
        padding: 0 0.3em;
        border-radius: 3px;
        opacity: 0;
        transition: opacity 0.12s, color 0.12s, background 0.12s;
        cursor: pointer;
      }
      .fav:hover .fav-unpin,
      .fav.active .fav-unpin {
        opacity: 0.7;
      }
      .fav-unpin:hover {
        opacity: 1;
        color: var(--hops-cherry);
        background: rgba(179, 64, 54, 0.15);
      }
      .fav.pin-current {
        color: var(--hops-pilsner);
        font-style: italic;
      }
      .fav.pin-current:hover {
        background: rgba(245, 197, 66, 0.12);
      }
    `,
  ],
})
export class FavoritesPanelComponent {
  protected readonly state = inject(MarkdownStructureService);
  protected readonly favorites = inject(FavoritesService);

  protected readonly canPinCurrent = computed(() => {
    const current = this.state.brewhouse();
    return !!current && !this.favorites.isPinned(current);
  });

  protected readonly pinCurrentLabel = computed(() => {
    const current = this.state.brewhouse();
    return current ? `Anstecken: ${basename(current)}` : 'Anstecken';
  });

  protected name(path: string): string {
    return basename(path) || path;
  }

  protected open(path: string): void {
    if (path === this.state.brewhouse()) return;
    void this.state.openByPath(path);
  }

  protected unpin(path: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.favorites.unpin(path);
  }

  protected pinCurrent(): void {
    const current = this.state.brewhouse();
    if (current) this.favorites.pin(current);
  }
}
