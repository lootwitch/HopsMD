import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  ContentZoomService,
  MAX_SCALE,
  MIN_SCALE,
  STEP,
} from '../../services/content-zoom.service';
import { FontsService } from '../../services/fonts.service';
import { I18nService, type Locale } from '../../services/i18n.service';
import { ColorThemeService } from '../../services/color-theme.service';
import { ColorSettingsComponent } from './color-settings.component';

@Component({
  selector: 'hops-settings-page',
  standalone: true,
  imports: [ColorSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="settings-header">
      <h1>{{ i18n.t('settings.title') }}</h1>
      <button
        type="button"
        class="close"
        (click)="close()"
        [title]="i18n.t('settings.close')"
        [attr.aria-label]="i18n.t('settings.close')"
      >
        ✕
      </button>
    </header>

    <main class="settings-body">
      <h2 class="section-title">{{ i18n.t('settings.section.appearance') }}</h2>

      <section class="block">
        <h3>{{ i18n.t('settings.theme.presets') }} · {{ i18n.t('settings.colors.heading') }}</h3>
        <hops-color-settings />
        <button type="button" class="reset" (click)="theme.resetAll()" [disabled]="theme.isDefault()">
          {{ i18n.t('settings.resetAll') }}
        </button>
      </section>

      <section class="block">
        <h3>{{ i18n.t('settings.fonts.heading') }}</h3>
        <label class="field">
          <span>{{ i18n.t('settings.fonts.body') }}</span>
          <input
            type="text"
            [value]="fonts.body()"
            (input)="onBodyFont($event)"
            [placeholder]="i18n.t('settings.fonts.placeholder')"
          />
        </label>
        <label class="field">
          <span>{{ i18n.t('settings.fonts.mono') }}</span>
          <input
            type="text"
            [value]="fonts.mono()"
            (input)="onMonoFont($event)"
            [placeholder]="i18n.t('settings.fonts.placeholder')"
          />
        </label>
        <button
          type="button"
          class="reset"
          (click)="fonts.resetToDefaults()"
          [disabled]="fonts.bodyIsDefault() && fonts.monoIsDefault()"
        >
          {{ i18n.t('settings.reset') }}
        </button>
      </section>

      <section class="block">
        <h3>{{ i18n.t('settings.textSize.heading') }}</h3>
        <div class="slider-row">
          <input
            type="range"
            [min]="minScale"
            [max]="maxScale"
            [step]="step"
            [value]="zoom.scale()"
            (input)="onScale($event)"
          />
          <span class="slider-value">{{ scalePercent() }}%</span>
          <button type="button" class="reset" (click)="zoom.reset()" [disabled]="scalePercent() === 100">
            {{ i18n.t('settings.reset') }}
          </button>
        </div>
      </section>

      <section class="block">
        <h3>{{ i18n.t('settings.language.heading') }}</h3>
        <div class="segmented">
          <button type="button" [class.active]="i18n.locale() === 'de'" (click)="setLocale('de')">DE</button>
          <button type="button" [class.active]="i18n.locale() === 'en'" (click)="setLocale('en')">EN</button>
        </div>
      </section>

      <section class="block preview">
        <h3>{{ i18n.t('settings.preview.heading') }}</h3>
        <div class="preview-card">
          <h4>HopsMD</h4>
          <p>
            {{ previewBefore() }}<a href="#" (click)="$event.preventDefault()">{{ i18n.t('settings.preview.link') }}</a>{{ previewAfter() }}
            <code>const sud = true;</code>
          </p>
          <pre><code>flowchart LR
  A[Malz] --> B[Sud]</code></pre>
        </div>
      </section>

      <p class="auto-saved">{{ i18n.t('settings.autoSaved') }}</p>
    </main>
  `,
  styles: [
    `
      :host { display: block; height: 100%; overflow-y: auto; background: var(--hops-stout); color: var(--hops-text); }
      .settings-header {
        position: sticky; top: 0; z-index: 1;
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.6rem 1rem; border-bottom: 1px solid var(--hops-border);
        background: var(--hops-stout-2);
      }
      .settings-header h1 { margin: 0; font-size: 1rem; color: var(--hops-foam); }
      .close {
        background: transparent; border: 1px solid var(--hops-border); color: var(--hops-text);
        border-radius: 4px; cursor: pointer; padding: 0.25rem 0.6rem; font: inherit;
      }
      .close:hover { border-color: var(--hops-pilsner); color: var(--hops-foam); }
      .settings-body { max-width: 640px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
      .section-title {
        margin: 0 0 1rem; font-size: 0.78rem; text-transform: uppercase;
        letter-spacing: 0.6px; color: var(--hops-text-dim);
      }
      .block {
        margin-bottom: 1.75rem; padding-bottom: 1.25rem;
        border-bottom: 1px solid var(--hops-border);
      }
      .block h3 { margin: 0 0 0.75rem; font-size: 0.95rem; color: var(--hops-foam); font-weight: 600; }
      .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem; }
      .field span { font-size: 0.82rem; color: var(--hops-text-dim); }
      .field input {
        font: inherit; font-size: 0.82rem; padding: 0.4rem 0.55rem;
        background: var(--hops-stout-2); color: var(--hops-text);
        border: 1px solid var(--hops-border); border-radius: 4px;
      }
      .field input:focus { outline: 1px solid var(--hops-pilsner); }
      .slider-row { display: flex; align-items: center; gap: 0.75rem; }
      .slider-row input[type='range'] { flex: 1; accent-color: var(--hops-pilsner); }
      .slider-value { font-family: var(--hops-mono); font-size: 0.8rem; color: var(--hops-foam); min-width: 3.5em; }
      .segmented { display: inline-flex; border: 1px solid var(--hops-border); border-radius: 4px; overflow: hidden; }
      .segmented button {
        font: inherit; font-size: 0.8rem; padding: 0.35rem 0.9rem; cursor: pointer;
        background: transparent; color: var(--hops-text-dim); border: 0;
      }
      .segmented button.active { background: var(--hops-pilsner); color: var(--hops-stout); }
      .reset {
        margin-top: 0.5rem; font: inherit; font-size: 0.78rem; cursor: pointer;
        background: transparent; color: var(--hops-text-dim);
        border: 1px solid var(--hops-border); border-radius: 4px; padding: 0.3rem 0.7rem;
      }
      .reset:hover:not(:disabled) { border-color: var(--hops-pilsner); color: var(--hops-foam); }
      .reset:disabled { opacity: 0.4; cursor: not-allowed; }
      .preview-card {
        padding: 1rem; border: 1px solid var(--hops-border); border-radius: 6px;
        background: var(--hops-cellar); font-family: var(--hops-font);
        font-size: calc(0.9rem * var(--hops-content-scale, 1));
      }
      .preview-card h4 { margin: 0 0 0.5rem; color: var(--hops-foam); }
      .preview-card a { color: var(--hops-pilsner); }
      .preview-card code {
        font-family: var(--hops-mono); background: var(--hops-stout-2);
        padding: 0.1em 0.35em; border-radius: 3px; color: var(--hops-foam);
      }
      .preview-card pre {
        margin: 0.75rem 0 0; padding: 0.75rem; border-radius: 6px;
        background: var(--hops-stout-2); border: 1px solid var(--hops-border); overflow-x: auto;
      }
      .preview-card pre code { background: transparent; padding: 0; color: var(--hops-text); }
      .auto-saved { font-size: 0.78rem; color: var(--hops-text-dim); font-style: italic; }
    `,
  ],
})
export class SettingsPageComponent {
  protected readonly theme = inject(ColorThemeService);
  protected readonly fonts = inject(FontsService);
  protected readonly zoom = inject(ContentZoomService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly minScale = MIN_SCALE;
  protected readonly maxScale = MAX_SCALE;
  protected readonly step = STEP;
  protected readonly scalePercent = computed(() => Math.round(this.zoom.scale() * 100));

  // Split the preview body around the {link} placeholder so the anchor can be
  // a real element rather than interpolated HTML.
  protected readonly previewBefore = computed(
    () => this.i18n.t('settings.preview.body').split('{link}')[0] ?? '',
  );
  protected readonly previewAfter = computed(
    () => this.i18n.t('settings.preview.body').split('{link}')[1] ?? '',
  );

  @HostListener('document:keydown.escape')
  protected close(): void {
    void this.router.navigate(['/']);
  }

  protected onBodyFont(event: Event): void {
    this.fonts.setBody((event.target as HTMLInputElement).value);
  }

  protected onMonoFont(event: Event): void {
    this.fonts.setMono((event.target as HTMLInputElement).value);
  }

  protected onScale(event: Event): void {
    this.zoom.setScale(Number((event.target as HTMLInputElement).value));
  }

  protected setLocale(locale: Locale): void {
    this.i18n.set(locale);
  }
}
