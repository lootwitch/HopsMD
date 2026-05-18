import { Injectable } from '@angular/core';
import DOMPurify from 'dompurify';
import { Marked, type Tokens } from 'marked';
import { dirname, resolveRelative } from '../core/path-utils';
import { toAssetUrl } from '../core/tauri-bridge';

/** Marker class our Mermaid placeholder DIVs carry — used by the renderer. */
export const MERMAID_PLACEHOLDER_CLASS = 'hops-mermaid';

/** Generate a collision-resistant id for each placeholder. */
function placeholderId(): string {
  return `hops-mermaid-${Math.random().toString(36).slice(2, 10)}`;
}

/** Base64-encode a UTF-8 string. */
function encodeMermaid(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
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
 * Wraps `marked` with HopsMD's custom rules:
 *   - ```mermaid blocks become DIV placeholders (rendered later by
 *     MermaidRenderService).
 *   - Relative image paths are rewritten via the Tauri asset protocol so the
 *     webview can actually load them.
 * Output is run through DOMPurify before being handed back to the view.
 */
@Injectable({ providedIn: 'root' })
export class MarkdownParserService {
  private readonly marked = new Marked({
    gfm: true,
    breaks: false,
    pedantic: false,
  });

  constructor() {
    this.marked.use({
      renderer: {
        code: (token: Tokens.Code): string | false => {
          if ((token.lang ?? '').trim().toLowerCase() === 'mermaid') {
            const id = placeholderId();
            const payload = encodeMermaid(token.text);
            return (
              `<div class="${MERMAID_PLACEHOLDER_CLASS}" id="${id}" ` +
              `data-mermaid="${payload}" data-state="pending">` +
              `<span class="hops-mermaid-pending">🍺 Maischt…</span>` +
              `</div>`
            );
          }
          return false;
        },
      },
    });

    // Permit asset:// and tauri:// URLs through DOMPurify — the asset protocol
    // is how local images are exposed to the webview.
    DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
      if (data.attrName === 'src' || data.attrName === 'href') {
        if (
          data.attrValue.startsWith('asset://') ||
          data.attrValue.startsWith('http://asset.localhost/') ||
          data.attrValue.startsWith('https://asset.localhost/') ||
          data.attrValue.startsWith('tauri://')
        ) {
          (data as { forceKeepAttr?: boolean }).forceKeepAttr = true;
        }
      }
    });
  }

  /**
   * Parse `markdown` to sanitized HTML. When `filePath` is provided, relative
   * image references are resolved against the file's directory and rewritten
   * to Tauri asset URLs the webview can fetch.
   */
  async parse(markdown: string, filePath: string | null): Promise<string> {
    const baseDir = filePath ? dirname(filePath) : null;
    const rawHtml = await this.marked.parse(markdown, { async: true });
    const withAssets = baseDir ? await this.rewriteRelativeImages(rawHtml, baseDir) : rawHtml;
    return DOMPurify.sanitize(withAssets, {
      ADD_ATTR: ['target'],
      ALLOW_DATA_ATTR: true,
    });
  }

  /**
   * Find `<img src="…relative…">` references in the rendered HTML and replace
   * them with absolute Tauri asset URLs. Done after marked.parse so we don't
   * need a renderer hook with async resolution.
   */
  private async rewriteRelativeImages(html: string, baseDir: string): Promise<string> {
    const matches = Array.from(
      html.matchAll(/<img\b([^>]*?)\ssrc=("|')([^"']+)\2([^>]*)>/gi),
    );
    if (matches.length === 0) return html;

    const replacements = await Promise.all(
      matches.map(async (m) => {
        const original = m[0];
        const src = m[3];
        if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('data:')) {
          return { original, replacement: original };
        }
        try {
          const resolved = resolveRelative(baseDir, src);
          const assetUrl = await toAssetUrl(resolved);
          const safeUrl = escapeHtml(assetUrl);
          const replacement = original.replace(
            /src=("|')[^"']+\1/i,
            `src="${safeUrl}"`,
          );
          return { original, replacement };
        } catch {
          return { original, replacement: original };
        }
      }),
    );

    let result = html;
    for (const { original, replacement } of replacements) {
      if (original !== replacement) result = result.replace(original, replacement);
    }
    return result;
  }
}
