import { Injectable, inject } from '@angular/core';
import DOMPurify from 'dompurify';
import { Marked, type Tokens } from 'marked';
import { dirname, resolveRelative } from '../core/path-utils';
import { toAssetUrl } from '../core/tauri-bridge';
import { I18nService } from './i18n.service';

/** Outer wrapper around every fenced code block (mermaid + plain text). */
export const CODE_BLOCK_CLASS = 'hops-code-block';

/** Inner host the MermaidRenderService writes the SVG into. */
export const CODE_BLOCK_RENDERED_CLASS = 'hops-code-rendered';

/** Generate a collision-resistant id per emitted block. */
function blockId(): string {
  return `hops-code-${Math.random().toString(36).slice(2, 10)}`;
}

/** Base64-encode a UTF-8 string (used to round-trip the source through HTML). */
function encodeBase64Utf8(source: string): string {
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

/** Compact inline SVG icons for the toolbar (16×16 stroked, currentColor). */
const ICON_TOGGLE = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M4 5l-2 2 2 2 M12 5l2 2-2 2 M9 3l-2 10"/></svg>`;
const ICON_COPY = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M5 3h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M3 5v8a1 1 0 0 0 1 1h6"/></svg>`;
const ICON_EDITOR = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M11 2l3 3-8 8-4 1 1-4 8-8z M10 3l3 3"/></svg>`;
const ICON_FULLSCREEN = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M2 6V2h4 M14 6V2h-4 M2 10v4h4 M14 10v4h-4"/></svg>`;

/**
 * Wraps `marked` with HopsMD's custom rules:
 *
 *   - Every fenced code block (including ```mermaid) is emitted inside a
 *     unified `.hops-code-block` container with a top-right toolbar:
 *     toggle Renderer ↔ Quelltext (mermaid only), copy, open the parent
 *     .md in the system editor, fullscreen (mermaid only).
 *   - Mermaid blocks carry an empty `.hops-code-rendered` child that the
 *     MermaidRenderService fills with SVG after the HTML is in the DOM.
 *   - Relative image paths are rewritten via Tauri's asset protocol.
 *
 * Output is run through DOMPurify before the view binds it.
 */
@Injectable({ providedIn: 'root' })
export class MarkdownParserService {
  private readonly i18n = inject(I18nService);
  private readonly marked = new Marked({
    gfm: true,
    breaks: false,
    pedantic: false,
  });

  constructor() {
    this.marked.use({
      renderer: {
        code: (token: Tokens.Code): string => this.renderCodeBlock(token),
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

  private renderCodeBlock(token: Tokens.Code): string {
    const lang = (token.lang ?? '').trim().toLowerCase();
    const isMermaid = lang === 'mermaid';
    const id = blockId();
    const payload = encodeBase64Utf8(token.text);
    const escapedSource = escapeHtml(token.text);
    const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    const langLabel = lang ? `<span class="hops-code-lang">${escapeHtml(lang)}</span>` : '';

    const toggleBtn = isMermaid
      ? `<button class="hops-code-action" type="button" data-action="toggle" title="${escapeHtml(this.i18n.t('code.toggleSource'))}">${ICON_TOGGLE}</button>`
      : '';
    const fullscreenBtn = isMermaid
      ? `<button class="hops-code-action" type="button" data-action="fullscreen" title="${escapeHtml(this.i18n.t('code.fullscreen'))}">${ICON_FULLSCREEN}</button>`
      : '';
    const copyBtn = `<button class="hops-code-action" type="button" data-action="copy" title="${escapeHtml(this.i18n.t('code.copy'))}">${ICON_COPY}</button>`;
    const editorBtn = `<button class="hops-code-action" type="button" data-action="open-editor" title="${escapeHtml(this.i18n.t('code.openInEditor'))}">${ICON_EDITOR}</button>`;

    const renderedSlot = isMermaid
      ? `<div class="${CODE_BLOCK_RENDERED_CLASS}"><span class="hops-pending">${escapeHtml(this.i18n.t('code.mermaidPending'))}</span></div>`
      : '';

    return (
      `<div class="${CODE_BLOCK_CLASS}" id="${id}" ` +
      `data-kind="${isMermaid ? 'mermaid' : 'text'}" ` +
      `data-state="${isMermaid ? 'pending' : 'static'}" ` +
      `data-view="${isMermaid ? 'rendered' : 'source'}" ` +
      `data-source="${payload}">` +
      `<div class="hops-code-toolbar">` +
      langLabel +
      toggleBtn +
      fullscreenBtn +
      copyBtn +
      editorBtn +
      `</div>` +
      renderedSlot +
      `<pre class="hops-code-source"><code${langClass}>${escapedSource}</code></pre>` +
      `</div>`
    );
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
