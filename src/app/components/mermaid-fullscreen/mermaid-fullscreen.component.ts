import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MermaidFullscreenService } from '../../services/mermaid-fullscreen.service';

/** Zoom clamps — too far out makes the diagram unreadable, too far in is silly. */
const MIN_SCALE = 0.2;
const MAX_SCALE = 12;
const WHEEL_STEP = 1.12; // ~12 % per notch
const KEY_STEP = 1.25;   // chunkier per key press

/**
 * Fullscreen overlay for Mermaid diagrams. The user clicks the 🗗 button in
 * a mermaid code block's toolbar; MarkdownView clones the rendered SVG and
 * hands it to MermaidFullscreenService.open(); this component mounts the
 * clone and provides pan + zoom.
 *
 * Interactions
 *   - Mouse wheel       → zoom around the cursor
 *   - Click + drag      → pan
 *   - +/- keys          → zoom around viewport centre
 *   - 0 key             → fit to viewport (reset transform)
 *   - Escape / X / click on backdrop → close
 *
 * Pan/zoom is implemented as a CSS `transform: translate(…) scale(…)` on a
 * wrapper around the SVG — no extra library, no viewBox math.
 */
@Component({
  selector: 'hops-mermaid-fullscreen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.svg()) {
      <div
        class="overlay"
        (mousedown)="onBackdropMouseDown($event)"
      >
        <div class="toolbar" (mousedown)="$event.stopPropagation()">
          <button type="button" (click)="zoomOut()" title="Verkleinern (−)">−</button>
          <button type="button" class="scale" (click)="reset()" title="Anpassen (0)">
            {{ scaleLabel() }}
          </button>
          <button type="button" (click)="zoomIn()" title="Vergrößern (+)">+</button>
          <span class="hint">Mausrad / Drag · +/− · 0 · Esc</span>
          <button type="button" class="close" (click)="close()" title="Schließen (Esc)">✕</button>
        </div>

        <div
          #host
          class="host"
          (wheel)="onWheel($event)"
          (mousedown)="onPanStart($event)"
        >
          <div
            #content
            class="content"
            [style.transform]="transform()"
          ></div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        background: rgba(15, 10, 6, 0.92);
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(2px);
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 0.85rem;
        background: var(--hops-stout-2);
        border-bottom: 1px solid var(--hops-border);
        font-size: 0.85rem;
        user-select: none;
      }
      .toolbar button {
        min-width: 32px;
        height: 28px;
        padding: 0 0.6rem;
        background: transparent;
        border: 1px solid var(--hops-border);
        border-radius: 4px;
        color: var(--hops-text);
        font: inherit;
        cursor: pointer;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .toolbar button:hover {
        background: rgba(245, 197, 66, 0.1);
        color: var(--hops-foam);
        border-color: var(--hops-pilsner);
      }
      .toolbar .scale {
        min-width: 64px;
        color: var(--hops-pilsner);
        font-variant-numeric: tabular-nums;
      }
      .toolbar .close {
        margin-left: 0.4rem;
      }
      .toolbar .hint {
        margin-left: auto;
        color: var(--hops-text-dim);
        font-size: 0.75rem;
        font-family: var(--hops-mono);
      }
      .host {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        cursor: grab;
        position: relative;
      }
      .host.panning {
        cursor: grabbing;
      }
      .content {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        will-change: transform;
      }
    `,
  ],
})
export class MermaidFullscreenComponent {
  protected readonly service = inject(MermaidFullscreenService);

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  private readonly scale = signal<number>(1);
  private readonly translateX = signal<number>(0);
  private readonly translateY = signal<number>(0);
  private mountedSvg: SVGElement | null = null;
  /** Natural SVG dimensions (from viewBox) — transform-independent. */
  private naturalW = 0;
  private naturalH = 0;

  protected readonly transform = computed(
    () =>
      `translate(${this.translateX()}px, ${this.translateY()}px) scale(${this.scale()})`,
  );
  protected readonly scaleLabel = computed(() => `${Math.round(this.scale() * 100)} %`);

  // --- pan drag state ---
  private dragging = false;
  private dragLastX = 0;
  private dragLastY = 0;

  constructor() {
    // Mount the cloned SVG when the service hands us one, fit to viewport.
    effect(() => {
      const svg = this.service.svg();
      const contentEl = this.content()?.nativeElement;
      if (!svg) {
        this.mountedSvg = null;
        return;
      }
      if (!contentEl) return; // wait until next render fires the viewChild
      if (this.mountedSvg === svg) return;
      contentEl.innerHTML = '';
      // Pin the SVG to explicit pixel dimensions from its viewBox. Mermaid's
      // default `width="100%"` + max-width style would collapse to zero
      // inside our absolute-positioned, sizeless `.content` container, so
      // we substitute concrete dimensions and let CSS transform handle all
      // scaling instead.
      const vb = (svg as SVGSVGElement).viewBox?.baseVal;
      this.naturalW = vb && vb.width > 0 ? vb.width : 800;
      this.naturalH = vb && vb.height > 0 ? vb.height : 600;
      svg.setAttribute('width', String(this.naturalW));
      svg.setAttribute('height', String(this.naturalH));
      svg.style.maxWidth = 'none';
      svg.style.display = 'block';
      contentEl.appendChild(svg);
      this.mountedSvg = svg;
      // Defer the fit until layout settles — host viewport size is needed
      // and the @if-rendered overlay only finishes laying out after CD.
      queueMicrotask(() => this.reset());
    });

    // Global mouse + key listeners while open.
    let cleanup: (() => void) | null = null;
    effect(() => {
      cleanup?.();
      cleanup = null;
      if (!this.service.svg()) return;

      const onMouseMove = (e: MouseEvent) => this.onPanMove(e);
      const onMouseUp = () => this.onPanEnd();
      const onKey = (e: KeyboardEvent) => this.onKey(e);

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('keydown', onKey);
      cleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', onKey);
      };
    });
    inject(DestroyRef).onDestroy(() => cleanup?.());
  }

  // ---------- public actions ----------

  protected close(): void {
    this.service.close();
  }

  protected zoomIn(): void {
    this.zoomAroundCenter(KEY_STEP);
  }

  protected zoomOut(): void {
    this.zoomAroundCenter(1 / KEY_STEP);
  }

  /** Fit the SVG inside the viewport, centred. Uses the viewBox-derived
   *  natural size so the calc is independent of the current transform —
   *  reading getBoundingClientRect after setting signals would return the
   *  pre-CD layout and produce wrong fits on every key press of "0". */
  protected reset(): void {
    const hostEl = this.host()?.nativeElement;
    if (!hostEl || this.naturalW === 0 || this.naturalH === 0) {
      this.scale.set(1);
      this.translateX.set(0);
      this.translateY.set(0);
      return;
    }
    const hostRect = hostEl.getBoundingClientRect();
    if (hostRect.width === 0 || hostRect.height === 0) {
      // Overlay isn't laid out yet (e.g. called before the @if branch
      // finished painting). Retry next frame.
      requestAnimationFrame(() => this.reset());
      return;
    }
    const padding = 32;
    const fit = Math.min(
      (hostRect.width - padding * 2) / this.naturalW,
      (hostRect.height - padding * 2) / this.naturalH,
    );
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
    const scaledW = this.naturalW * newScale;
    const scaledH = this.naturalH * newScale;
    this.scale.set(newScale);
    this.translateX.set((hostRect.width - scaledW) / 2);
    this.translateY.set((hostRect.height - scaledH) / 2);
  }

  // ---------- mouse ----------

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
    this.zoomAroundPoint(factor, event.clientX, event.clientY);
  }

  protected onPanStart(event: MouseEvent): void {
    // Only primary button initiates a drag.
    if (event.button !== 0) return;
    this.dragging = true;
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    this.host()?.nativeElement.classList.add('panning');
  }

  private onPanMove(event: MouseEvent): void {
    if (!this.dragging) return;
    const dx = event.clientX - this.dragLastX;
    const dy = event.clientY - this.dragLastY;
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    this.translateX.update((v) => v + dx);
    this.translateY.update((v) => v + dy);
  }

  private onPanEnd(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.host()?.nativeElement.classList.remove('panning');
  }

  /** Backdrop click (outside the toolbar/host) closes the overlay. */
  protected onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  // ---------- keyboard ----------

  private onKey(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case '+':
      case '=':
        event.preventDefault();
        this.zoomIn();
        break;
      case '-':
      case '_':
        event.preventDefault();
        this.zoomOut();
        break;
      case '0':
        event.preventDefault();
        this.reset();
        break;
    }
  }

  // ---------- zoom math ----------

  private zoomAroundCenter(factor: number): void {
    const hostEl = this.host()?.nativeElement;
    if (!hostEl) return;
    const rect = hostEl.getBoundingClientRect();
    this.zoomAroundPoint(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  /**
   * Multiply the scale by `factor`, keeping the viewport point (cx, cy)
   * stationary in content space — i.e. the spot the cursor is over stays
   * under the cursor while the rest of the diagram scales around it.
   */
  private zoomAroundPoint(factor: number, cx: number, cy: number): void {
    const hostEl = this.host()?.nativeElement;
    if (!hostEl) return;
    const rect = hostEl.getBoundingClientRect();
    const localX = cx - rect.left;
    const localY = cy - rect.top;
    const currentScale = this.scale();
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, currentScale * factor));
    if (newScale === currentScale) return;
    const actual = newScale / currentScale;
    this.translateX.update((tx) => localX - (localX - tx) * actual);
    this.translateY.update((ty) => localY - (localY - ty) * actual);
    this.scale.set(newScale);
  }
}
