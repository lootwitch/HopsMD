import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FavoritesService } from '../../services/favorites.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { UpdaterService } from '../../services/updater.service';

@Component({
  selector: 'hops-brewery-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="toolbar">
      <div class="brand" title="HopsMD — a CloudBrew side project">
        <span class="brand-icon">🍺</span>
        <div class="brand-text">
          <strong>HopsMD</strong>
          <small>brewing Markdown · CloudBrew</small>
        </div>
      </div>

      <div class="status">
        @if (state.brewhouse(); as path) {
          <span class="status-label">Sudhaus:</span>
          <span class="status-path" [title]="path">{{ path }}</span>
          <button
            type="button"
            class="pin-btn"
            [class.active]="isPinned()"
            (click)="onTogglePin()"
            [title]="pinTooltip()"
            [attr.aria-pressed]="isPinned()"
            aria-label="Stammsudhaus anstecken"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M8 1.4 C5.2 1.4 3.2 3.4 3.2 6 c0 3.6 4.8 8.4 4.8 8.4 s4.8-4.8 4.8-8.4 c0-2.6-2-4.6-4.8-4.6 z M8 4.4 c0.9 0 1.6 0.7 1.6 1.6 s-0.7 1.6-1.6 1.6 s-1.6-0.7-1.6-1.6 s0.7-1.6 1.6-1.6 z"
                fill="currentColor"
              />
            </svg>
          </button>
        } @else {
          <span class="status-empty">Noch kein Sud im Kessel.</span>
        }
        @if (state.loading()) {
          <span class="status-loading">· Maischen…</span>
        }
      </div>

      <div class="actions">
        @if (updater.availableVersion(); as version) {
          <button
            type="button"
            class="btn update"
            (click)="onInstallUpdate()"
            [disabled]="updater.installing()"
            [title]="updater.availableNotes() ?? 'Neue Version verfügbar'"
          >
            @if (updater.installing()) {
              <span>Maischt das Update…</span>
            } @else {
              <span>🍻 Neuer Sud {{ version }} — jetzt installieren</span>
            }
          </button>
        }
        <button type="button" class="btn primary" (click)="onOpen()" [disabled]="state.loading()">
          Sudhaus auswählen
        </button>
        <button
          type="button"
          class="btn ghost"
          (click)="onRefresh()"
          [disabled]="!state.isOpen() || state.loading()"
          title="Nachschlag — Verzeichnis neu einlesen"
        >
          Nachschlag
        </button>
      </div>
    </header>
  `,
  styles: [
    `
      .toolbar {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 1.25rem;
        height: 52px;
        padding: 0 1rem;
        background: linear-gradient(180deg, #1c130b 0%, #140d07 100%);
        border-bottom: 1px solid var(--hops-border);
        user-select: none;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }
      .brand-icon {
        font-size: 1.4rem;
        filter: drop-shadow(0 0 4px rgba(245, 197, 66, 0.4));
      }
      .brand-text {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }
      .brand-text strong {
        color: var(--hops-foam);
        font-size: 0.95rem;
        letter-spacing: 0.5px;
      }
      .brand-text small {
        color: var(--hops-text-dim);
        font-size: 0.7rem;
      }
      .status {
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
        min-width: 0;
      }
      .status-label {
        color: var(--hops-text-dim);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .status-path {
        color: var(--hops-foam);
        font-family: var(--hops-mono);
        font-size: 0.8rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .status-empty {
        color: var(--hops-text-dim);
        font-style: italic;
      }
      .status-loading {
        color: var(--hops-pilsner);
        font-size: 0.75rem;
        animation: shimmer 1.4s ease-in-out infinite;
      }
      @keyframes shimmer {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      .pin-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 50%;
        color: var(--hops-text-dim);
        cursor: pointer;
        transition: color 0.15s, background 0.15s, transform 0.12s;
      }
      .pin-btn:hover {
        color: var(--hops-foam);
        background: rgba(245, 197, 66, 0.08);
      }
      .pin-btn:active {
        transform: scale(0.92);
      }
      .pin-btn.active {
        color: var(--hops-pilsner);
        filter: drop-shadow(0 0 4px rgba(245, 197, 66, 0.45));
      }
      .pin-btn.active:hover {
        color: #ffd25b;
        background: rgba(245, 197, 66, 0.15);
      }
      .actions {
        display: flex;
        gap: 0.4rem;
      }
      .btn {
        font: inherit;
        font-size: 0.82rem;
        font-weight: 500;
        padding: 0.4rem 0.85rem;
        border-radius: 4px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .btn.primary {
        background: var(--hops-pilsner);
        color: var(--hops-stout);
      }
      .btn.primary:hover:not(:disabled) {
        background: #ffd25b;
      }
      .btn.ghost {
        background: transparent;
        color: var(--hops-text);
        border-color: var(--hops-border);
      }
      .btn.ghost:hover:not(:disabled) {
        border-color: var(--hops-pilsner);
        color: var(--hops-foam);
      }
      .btn.update {
        background: var(--hops-leaf);
        color: var(--hops-stout);
        animation: pulse 2.4s ease-in-out infinite;
      }
      .btn.update:hover:not(:disabled) {
        background: #88c466;
      }
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(110, 168, 79, 0.45); }
        50% { box-shadow: 0 0 0 6px rgba(110, 168, 79, 0); }
      }
    `,
  ],
})
export class BreweryToolbarComponent {
  protected readonly state = inject(MarkdownStructureService);
  protected readonly updater = inject(UpdaterService);
  private readonly favorites = inject(FavoritesService);

  protected readonly isPinned = computed(() =>
    this.favorites.isPinned(this.state.brewhouse()),
  );

  protected readonly pinTooltip = computed(() =>
    this.isPinned()
      ? 'Stammsudhaus — Pin entfernen (kein Auto-Öffnen mehr beim Start)'
      : 'Als Stammsudhaus anstecken (beim Start automatisch öffnen)',
  );

  protected onOpen(): void {
    void this.state.openBrewhouse();
  }

  protected onRefresh(): void {
    void this.state.refresh();
  }

  protected onInstallUpdate(): void {
    void this.updater.install();
  }

  protected onTogglePin(): void {
    this.favorites.toggle(this.state.brewhouse());
  }
}
