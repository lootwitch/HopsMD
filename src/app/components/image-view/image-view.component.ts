import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/** Read-only image viewer. Shows the asset-resolved image centered on a
 *  checkerboard backdrop with filename + natural dimensions as a caption. */
@Component({
  selector: 'hops-image-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="image-wrap">
      <img [src]="src()" alt="" (load)="onLoad($event)" />
    </div>
    <figcaption class="caption">
      {{ name() }}
      @if (dims()) { · {{ dims() }} }
    </figcaption>
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; flex: 1; min-height: 0; }
      .image-wrap {
        flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
        overflow: auto; padding: 1rem;
        background-color: var(--hops-stout);
        background-image:
          linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
          linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%),
          linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%);
        background-size: 20px 20px;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0;
      }
      img { max-width: 100%; max-height: 100%; object-fit: contain; }
      .caption {
        flex-shrink: 0; padding: 0.4rem 1rem; border-top: 1px solid var(--hops-border);
        font-family: var(--hops-mono); font-size: 0.74rem; color: var(--hops-text-dim);
        text-align: center;
      }
    `,
  ],
})
export class ImageViewComponent {
  readonly src = input.required<string>();
  readonly name = input<string>('');
  protected readonly dims = signal<string>('');

  protected onLoad(e: Event): void {
    const img = e.target as HTMLImageElement;
    this.dims.set(`${img.naturalWidth}×${img.naturalHeight}`);
  }
}
