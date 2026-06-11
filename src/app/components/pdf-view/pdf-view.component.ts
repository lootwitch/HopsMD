import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

/** Read-only PDF viewer: embeds the asset-protocol URL in an iframe so the
 *  platform webview's built-in PDF renderer (Edge toolbar on Windows) takes
 *  over. Requires `frame-src asset: …` in the app CSP. Known limit: Linux
 *  webkit2gtk has no inline PDF renderer — documented trade-off. */
@Component({
  selector: 'hops-pdf-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<iframe [src]="safeSrc()" title="PDF"></iframe>`,
  styles: [
    `
      :host { display: flex; flex: 1; min-height: 0; }
      iframe { flex: 1; width: 100%; height: 100%; border: 0; background: var(--hops-stout); }
    `,
  ],
})
export class PdfViewComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly src = input.required<string>();
  /** Angular blocks raw strings in iframe[src]; the asset URL comes from our
   *  own bridge (convertFileSrc), so trusting it as a resource URL is safe. */
  protected readonly safeSrc = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.src()),
  );
}
