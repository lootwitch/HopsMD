// src/app/core/markdown-extensions/definition-list.extension.ts
import { Lexer } from 'marked';
import type { TokenizerAndRendererExtension, Tokens } from 'marked';

interface DefListItem { term: string; definitions: string[]; }
interface DefListToken extends Tokens.Generic {
  type: 'hopsDefList';
  items: DefListItem[];
}

/**
 * Block extension for simple definition lists:
 *
 *   Term
 *   : definition one
 *   : definition two
 *
 * A term is a non-empty line not starting with `:`, immediately followed by
 * one or more lines starting with `: `.
 *
 * NOTE — marked v14 type adaptation: `RendererThis` only exposes `parser`,
 * not `lexer`. The plan's `this.lexer.inlineTokens(text)` call is replaced
 * with the static `Lexer.lexInline(text)`, which is the exported static
 * equivalent and compiles cleanly under marked v14 types.
 */
export const definitionListExtension: TokenizerAndRendererExtension = {
  name: 'hopsDefList',
  level: 'block',
  start(src: string) {
    const m = /^[^\n:][^\n]*\n:[ \t]/m.exec(src);
    return m ? m.index : undefined;
  },
  tokenizer(src: string) {
    const lines = src.split('\n');
    const items: DefListItem[] = [];
    let consumed = 0;
    let i = 0;
    while (i < lines.length) {
      const term = lines[i];
      const next = lines[i + 1];
      if (!term.trim() || term.startsWith(':') || !next || !/^:[ \t]/.test(next)) break;
      const definitions: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^:[ \t]/.test(lines[j])) {
        definitions.push(lines[j].replace(/^:[ \t]+/, ''));
        j++;
      }
      items.push({ term: term.trim(), definitions });
      // +1 per term line and per definition line consumed
      consumed += term.length + 1;
      for (let k = i + 1; k < j; k++) consumed += lines[k].length + 1;
      i = j;
    }
    if (items.length === 0) return undefined;
    return {
      type: 'hopsDefList',
      raw: src.slice(0, consumed),
      items,
    } as DefListToken;
  },
  renderer(token) {
    const t = token as DefListToken;
    const body = t.items
      .map(
        (it) =>
          `<dt>${this.parser.parseInline(Lexer.lexInline(it.term))}</dt>` +
          it.definitions
            .map((d) => `<dd>${this.parser.parseInline(Lexer.lexInline(d))}</dd>`)
            .join(''),
      )
      .join('');
    return `<dl class="hops-deflist">${body}</dl>`;
  },
};
