import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import type { EmailContent } from '../../models/email-content.model';
import { I18nService } from '../../services/i18n.service';

/** Read-only email viewer: header card + sanitised HTML body (or text body
 *  fallback) + attachment names. Remote content never loads (app CSP blocks
 *  it), so HTML mail renders without tracking pixels. */
@Component({
  selector: 'hops-email-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (email(); as m) {
      <div class="email">
        <dl class="headers">
          <dt>{{ i18n.t('email.from') }}</dt><dd>{{ m.from }}</dd>
          <dt>{{ i18n.t('email.to') }}</dt><dd>{{ m.to.join(', ') }}</dd>
          <dt>{{ i18n.t('email.subject') }}</dt><dd class="subject">{{ m.subject }}</dd>
          @if (m.date) { <dt>{{ i18n.t('email.date') }}</dt><dd>{{ m.date }}</dd> }
        </dl>
        @if (m.attachments.length) {
          <div class="attachments">
            📎 {{ i18n.t('email.attachments') }} ({{ m.attachments.length }}):
            @for (a of m.attachments; track a.name) { <span class="att">{{ a.name }}</span> }
          </div>
        }
        @if (safeBody(); as body) {
          <div class="body html" [innerHTML]="body"></div>
        } @else {
          <pre class="body text">{{ m.textBody }}</pre>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; flex: 1; min-height: 0; overflow-y: auto; }
      .email { max-width: 820px; margin: 0 auto; padding: 1rem 1.25rem 3rem; }
      .headers {
        display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.75rem;
        margin: 0 0 1rem; padding-bottom: 0.85rem; border-bottom: 1px solid var(--hops-border);
      }
      .headers dt { color: var(--hops-text-dim); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.4px; }
      .headers dd { margin: 0; color: var(--hops-text); }
      .headers .subject { color: var(--hops-foam); font-weight: 600; }
      .attachments { margin-bottom: 1rem; font-size: 0.8rem; color: var(--hops-text-dim); }
      .att { display: inline-block; margin-left: 0.4rem; padding: 0.05rem 0.45rem; border: 1px solid var(--hops-border); border-radius: 999px; }
      .body.html { line-height: 1.55; }
      .body.html :where(img) { max-width: 100%; }
      .body.text { white-space: pre-wrap; font-family: var(--hops-mono); font-size: 0.85rem; }
    `,
  ],
})
export class EmailViewComponent {
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly i18n = inject(I18nService);
  readonly email = input.required<EmailContent>();

  /** Sanitised HTML body, or null when there is no HTML part (→ text fallback). */
  protected readonly safeBody = computed<SafeHtml | null>(() => {
    const html = this.email().htmlBody;
    if (!html) return null;
    const clean = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });
}
