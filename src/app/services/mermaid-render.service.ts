import { Injectable } from '@angular/core';
import { MERMAID_PLACEHOLDER_CLASS } from './markdown-parser.service';

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
 * Initialises Mermaid lazily on first use and renders every pending
 * `.hops-mermaid` placeholder inside a given container. Renders are
 * isolated: a single broken diagram surfaces as a `<pre>` inside its own
 * placeholder and never aborts the rest of the document.
 */
@Injectable({ providedIn: 'root' })
export class MermaidRenderService {
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
            // Brewhouse palette — warm amber on stout.
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

  /** Render every still-pending placeholder inside `container`. */
  async renderAll(container: HTMLElement | null): Promise<void> {
    if (!container) return;
    const nodes = container.querySelectorAll<HTMLElement>(
      `.${MERMAID_PLACEHOLDER_CLASS}[data-state="pending"]`,
    );
    if (nodes.length === 0) return;
    const mermaid = await this.getMermaid();

    await Promise.all(
      Array.from(nodes).map((node) => this.renderOne(node, mermaid)),
    );
  }

  private async renderOne(
    node: HTMLElement,
    mermaid: typeof import('mermaid').default,
  ): Promise<void> {
    const payload = node.getAttribute('data-mermaid') ?? '';
    let source = '';
    try {
      source = decodeMermaid(payload);
    } catch (err) {
      this.markSpoiled(node, `Konnte Diagramm nicht dekodieren: ${err}`);
      return;
    }

    const renderId = `${node.id || 'hops-mermaid'}-svg-${++this.counter}`;
    try {
      const { svg } = await mermaid.render(renderId, source);
      node.innerHTML = svg;
      node.setAttribute('data-state', 'brewed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.markSpoiled(node, message, source);
    }
  }

  private markSpoiled(node: HTMLElement, message: string, source?: string): void {
    const body = source
      ? `Trübung im Diagramm:\n\n${message}\n\n--- source ---\n${source}`
      : `Trübung im Diagramm:\n\n${message}`;
    node.innerHTML = `<pre class="hops-mermaid-error">${escapeHtml(body)}</pre>`;
    node.classList.add('spoiled');
    node.setAttribute('data-state', 'spoiled');
  }
}
