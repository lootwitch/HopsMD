import { Injectable, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import { CODE_BLOCK_CLASS, CODE_BLOCK_RENDERED_CLASS } from './markdown-parser.service';

/** Decode base64 → UTF-8 string. */
function decodeMermaid(payload: string): string {
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Initialises Mermaid lazily on first use and renders every pending mermaid
 * block inside a given container. Renders are isolated: a single broken
 * diagram surfaces as a `<pre>` inside its own `.hops-code-rendered` host
 * and never aborts the rest of the document.
 *
 * Container shape (see MarkdownParserService.renderCodeBlock):
 *
 *   <div class="hops-code-block" data-kind="mermaid"
 *        data-state="pending|brewed|spoiled"
 *        data-view="rendered|source"
 *        data-source="<base64 mermaid text>">
 *     <div class="hops-code-toolbar">…</div>
 *     <div class="hops-code-rendered"> ← we write SVG (or error) here </div>
 *     <pre class="hops-code-source"><code>…raw source…</code></pre>
 *   </div>
 */
@Injectable({ providedIn: 'root' })
export class MermaidRenderService {
  private readonly i18n = inject(I18nService);
  private mermaidPromise: Promise<typeof import('mermaid').default> | null = null;
  private counter = 0;

  private async getMermaid(): Promise<typeof import('mermaid').default> {
    if (!this.mermaidPromise) {
      this.mermaidPromise = import('mermaid').then((mod) => {
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily: 'inherit',
          themeVariables: {
            primaryColor: '#322215',
            primaryTextColor: '#f6efd9',
            primaryBorderColor: '#c87b1e',
            lineColor: '#f5c542',
            secondaryColor: '#261a10',
            tertiaryColor: '#1c130b',
          },
        });
        return mermaid;
      });
    }
    return this.mermaidPromise;
  }

  /**
   * Render a Mermaid source string into a fresh, standalone SVG element.
   * Used by the fullscreen overlay so the popped-out diagram doesn't share
   * its internal IDs (markers, gradients, …) with the inline copy — which
   * would otherwise leak `url(#…)` references to the original SVG and make
   * the clone appear blank.
   */
  async renderToSvg(source: string): Promise<SVGElement | null> {
    const mermaid = await this.getMermaid();
    const renderId = `hops-mermaid-fs-${++this.counter}`;
    try {
      const { svg } = await mermaid.render(renderId, source);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = svg;
      const el = wrapper.firstElementChild;
      return el instanceof SVGElement ? el : null;
    } catch {
      return null;
    }
  }

  /** Render every still-pending mermaid block inside `container`. */
  async renderAll(container: HTMLElement | null): Promise<void> {
    if (!container) return;
    const blocks = container.querySelectorAll<HTMLElement>(
      `.${CODE_BLOCK_CLASS}[data-kind="mermaid"][data-state="pending"]`,
    );
    if (blocks.length === 0) return;

    let mermaid: typeof import('mermaid').default;
    try {
      mermaid = await this.getMermaid();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      blocks.forEach((block) =>
        this.markSpoiled(block, this.i18n.t('mermaid.couldntLoad', { detail: message })),
      );
      return;
    }

    await Promise.all(Array.from(blocks).map((block) => this.renderOne(block, mermaid)));
  }

  private async renderOne(
    block: HTMLElement,
    mermaid: typeof import('mermaid').default,
  ): Promise<void> {
    const target = block.querySelector<HTMLElement>(`.${CODE_BLOCK_RENDERED_CLASS}`);
    if (!target) {
      block.setAttribute('data-state', 'spoiled');
      return;
    }

    const payload = block.getAttribute('data-source') ?? '';
    let source: string;
    try {
      source = decodeMermaid(payload);
    } catch (err) {
      this.markSpoiled(
        block,
        this.i18n.t('mermaid.couldntDecode', { detail: String(err) }),
      );
      return;
    }

    const renderId = `${block.id || 'hops-mermaid'}-svg-${++this.counter}`;
    try {
      const { svg } = await mermaid.render(renderId, source);
      target.innerHTML = svg;
      block.setAttribute('data-state', 'brewed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.markSpoiled(block, message, source);
    }
  }

  private markSpoiled(block: HTMLElement, message: string, source?: string): void {
    const target = block.querySelector<HTMLElement>(`.${CODE_BLOCK_RENDERED_CLASS}`);
    const prefix = this.i18n.t('mermaid.errorPrefix');
    const body = source
      ? `${prefix}\n\n${message}\n\n${this.i18n.t('mermaid.sourceSeparator')}\n${source}`
      : `${prefix}\n\n${message}`;
    if (target) {
      target.innerHTML = `<pre class="hops-mermaid-error">${escapeHtml(body)}</pre>`;
    }
    block.setAttribute('data-state', 'spoiled');
  }
}
