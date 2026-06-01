// src/app/components/settings-page/color-settings.component.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ColorThemeService,
  HOPS_TOKENS,
  type HopsToken,
} from '../../services/color-theme.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'hops-color-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="presets">
      @for (preset of theme.presets; track preset.id) {
        <button
          type="button"
          class="preset"
          [class.active]="theme.presetId() === preset.id"
          (click)="theme.setPreset(preset.id)"
        >
          <span class="swatches">
            <span class="sw" [style.background]="preset.tokens['cellar']"></span>
            <span class="sw" [style.background]="preset.tokens['pilsner']"></span>
            <span class="sw" [style.background]="preset.tokens['foam']"></span>
            <span class="sw" [style.background]="preset.tokens['leaf']"></span>
          </span>
          <span class="preset-name">{{ i18n.t(preset.nameKey) }}</span>
        </button>
      }
    </div>

    <label class="row accent">
      <span class="row-label">{{ i18n.t('settings.colors.accent') }}</span>
      <input
        type="color"
        [value]="theme.token('pilsner')"
        (input)="onColor('pilsner', $event)"
      />
    </label>

    <details class="advanced">
      <summary>{{ i18n.t('settings.colors.advanced') }}</summary>
      <div class="palette">
        @for (token of tokens; track token) {
          <label class="row">
            <span class="row-label mono">--hops-{{ token }}</span>
            <input
              type="color"
              [value]="theme.token(token)"
              (input)="onColor(token, $event)"
            />
          </label>
        }
      </div>
    </details>
  `,
  styles: [
    `
      :host { display: block; }
      .presets { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1rem; }
      .preset {
        display: flex; flex-direction: column; gap: 0.4rem; align-items: stretch;
        padding: 0.5rem; min-width: 120px; cursor: pointer;
        background: var(--hops-stout-2); color: var(--hops-text);
        border: 1px solid var(--hops-border); border-radius: 6px; font: inherit;
      }
      .preset:hover { border-color: var(--hops-pilsner); }
      .preset.active { border-color: var(--hops-pilsner); box-shadow: 0 0 0 1px var(--hops-pilsner); }
      .swatches { display: flex; gap: 3px; }
      .sw { flex: 1; height: 16px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.25); }
      .preset-name { font-size: 0.8rem; color: var(--hops-foam); }
      .row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem; padding: 0.3rem 0;
      }
      .row-label { color: var(--hops-text); font-size: 0.85rem; }
      .row-label.mono { font-family: var(--hops-mono); font-size: 0.78rem; color: var(--hops-text-dim); }
      input[type='color'] {
        width: 44px; height: 26px; padding: 0; border: 1px solid var(--hops-border);
        border-radius: 4px; background: transparent; cursor: pointer;
      }
      .advanced { margin-top: 0.75rem; }
      .advanced summary { cursor: pointer; color: var(--hops-text-dim); font-size: 0.85rem; }
      .palette { margin-top: 0.5rem; padding-left: 0.5rem; border-left: 2px solid var(--hops-border); }
    `,
  ],
})
export class ColorSettingsComponent {
  protected readonly theme = inject(ColorThemeService);
  protected readonly i18n = inject(I18nService);

  /** All themable tokens except `border` (rgba — not representable by a colour input). */
  protected readonly tokens = HOPS_TOKENS.filter(
    (t): t is HopsToken => t !== 'border',
  );

  protected onColor(token: HopsToken, event: Event): void {
    this.theme.setToken(token, (event.target as HTMLInputElement).value);
  }
}
