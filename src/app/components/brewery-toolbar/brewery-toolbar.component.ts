import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { UpdaterService } from '../../services/updater.service';

@Component({
  selector: 'hops-brewery-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="toolbar">
      <div class="brand" [title]="i18n.t('toolbar.brandTitle')">
        <span class="brand-icon">🍺</span>
        <div class="brand-text">
          <strong>HopsMD</strong>
          <small>{{ i18n.t('toolbar.brandTagline') }}</small>
        </div>
      </div>

      <div class="status">
        @if (state.selectedPath(); as path) {
          <span class="status-label">{{ i18n.t('toolbar.fileLabel') }}</span>
          <span class="status-path" [title]="path">{{ path }}</span>
        } @else if (state.isOpen()) {
          <span class="status-empty">{{ i18n.t('toolbar.noFileOpen') }}</span>
        } @else {
          <span class="status-empty">{{ i18n.t('toolbar.noSudhaus') }}</span>
        }
        @if (state.loading()) {
          <span class="status-loading">{{ i18n.t('toolbar.loading') }}</span>
        }
      </div>

      <div class="actions">
        @if (updater.availableVersion(); as version) {
          <button
            type="button"
            class="btn update"
            (click)="onInstallUpdate()"
            [disabled]="updater.installing()"
            [title]="updater.availableNotes() ?? i18n.t('toolbar.updateTooltip')"
          >
            @if (updater.installing()) {
              <span>{{ i18n.t('toolbar.updateInstalling') }}</span>
            } @else {
              <span>{{ i18n.t('toolbar.updateAvailable', { version: version }) }}</span>
            }
          </button>
        }
        <button
          type="button"
          class="btn locale"
          (click)="onToggleLocale()"
          [title]="i18n.t('toolbar.toggleLocale')"
        >
          {{ i18n.localeLabel() }}
        </button>
        <button type="button" class="btn primary" (click)="onOpen()" [disabled]="state.loading()">
          {{ i18n.t('toolbar.pickBrewhouse') }}
        </button>
        <button
          type="button"
          class="btn ghost"
          (click)="onRefresh()"
          [disabled]="!state.isOpen() || state.loading()"
          [title]="i18n.t('toolbar.refreshTooltip')"
        >
          {{ i18n.t('toolbar.refresh') }}
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
        flex-shrink: 0;
      }
      .status-path {
        color: var(--hops-foam);
        font-family: var(--hops-mono);
        font-size: 0.8rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
      .status-empty {
        color: var(--hops-text-dim);
        font-style: italic;
      }
      .status-loading {
        color: var(--hops-pilsner);
        font-size: 0.75rem;
        animation: shimmer 1.4s ease-in-out infinite;
        flex-shrink: 0;
      }
      @keyframes shimmer {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
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
      .btn.locale {
        background: transparent;
        color: var(--hops-text-dim);
        border-color: var(--hops-border);
        font-family: var(--hops-mono);
        font-size: 0.72rem;
        letter-spacing: 0.5px;
        min-width: 38px;
        padding: 0.4rem 0.55rem;
      }
      .btn.locale:hover {
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
  protected readonly i18n = inject(I18nService);

  protected onOpen(): void {
    void this.state.openBrewhouse();
  }

  protected onRefresh(): void {
    void this.state.refresh();
  }

  protected onInstallUpdate(): void {
    void this.updater.install();
  }

  protected onToggleLocale(): void {
    this.i18n.toggle();
  }
}
