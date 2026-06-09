// src/app/core/markdown-extensions/wikilink.extension.ts
import type { TokenizerAndRendererExtension } from 'marked';

interface WikiToken {
  type: 'hopsWikiLink';
  raw: string;
  target: string;
  label: string;
  embed: boolean;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|bmp|avif)$/i;

/**
 * `[[Target]]`, `[[Target|Label]]`, and `![[Target]]` (embed). Markdown targets
 * resolve to `<a href="Target.md">` (the viewer's cross-file handler opens it);
 * image targets become `<img src="Target">` (rewriteRelativeImages resolves the
 * path). A `|Label` overrides the visible text.
 */
export const wikiLinkExtension: TokenizerAndRendererExtension = {
  name: 'hopsWikiLink',
  level: 'inline',
  start(src: string) {
    const i = src.indexOf('[[');
    const j = src.indexOf('![[');
    if (i === -1 && j === -1) return undefined;
    if (j === -1) return i;
    if (i === -1) return j;
    return Math.min(i, j);
  },
  tokenizer(src: string) {
    const match = /^(!?)\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/.exec(src);
    if (!match) return undefined;
    const target = match[2].trim();
    return {
      type: 'hopsWikiLink',
      raw: match[0],
      target,
      label: (match[3] ?? match[2]).trim(),
      embed: match[1] === '!',
    } as WikiToken;
  },
  renderer(token) {
    const t = token as WikiToken;
    const escAttr = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const escText = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (t.embed) {
      return `<img src="${escAttr(t.target)}" alt="${escAttr(t.label)}" />`;
    }
    const href = IMAGE_EXT.test(t.target) || /\.[a-z0-9]+$/i.test(t.target)
      ? t.target
      : `${t.target}.md`;
    return `<a class="hops-wikilink" href="${escAttr(href)}">${escText(t.label)}</a>`;
  },
};
