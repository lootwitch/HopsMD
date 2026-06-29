/**
 * Locate fenced code blocks inside a markdown source string by their
 * **document order index** — the same numbering the markdown-view's click
 * handler derives from the rendered DOM (Nth `.hops-code-block` from the top).
 *
 * Why a regex doesn't cut it: GFM fences can be ` ``` ` *or* longer, the
 * closing fence must match the opening character and be at least as long,
 * and content can contain stray backticks. We walk line-by-line with the
 * actual fence semantics.
 */

export interface FencedBlock {
  /** Index in document order, 0-based. */
  index: number;
  /** Character offset where the opening fence line starts. */
  start: number;
  /** Character offset just past the closing fence line's trailing newline (or
   *  end-of-string if the block ran to EOF). */
  end: number;
  /** Inclusive char offset of the first content line. */
  contentStart: number;
  /** Exclusive char offset just before the closing fence (no trailing \n). */
  contentEnd: number;
  /** The opening fence string itself — e.g. ``` ``` ``` or `~~~~`. */
  fence: string;
  /** Everything after the opening fence on the same line — usually the
   *  language tag (`ts`, `mermaid`, …) plus optional info string. */
  infoString: string;
  /** Just the block contents, without the fence lines. */
  source: string;
}

/**
 * Enumerate every fenced code block in `markdown` in document order.
 * Does not look inside indented code blocks or HTML — only fenced.
 */
export function listFencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const lines = markdown.split('\n');

  // Pre-compute line-start char offsets so we can map line idx → string offset
  // cheaply. lineStarts[i] is the char offset of the start of line i;
  // lineStarts[lines.length] is the end-of-string offset.
  const lineStarts: number[] = new Array(lines.length + 1);
  lineStarts[0] = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStarts[i + 1] = lineStarts[i] + lines[i].length + 1; // +1 for \n
  }
  // The last lineStarts entry is one past the trailing \n that doesn't exist
  // for a no-newline-at-EOF document; that's fine — we clamp `end` to length.

  let inBlock = false;
  let openChar = '';
  let openLen = 0;
  let openLine = 0;
  let openInfo = '';
  let blockIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      const open = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (open) {
        openChar = open[1][0];
        openLen = open[1].length;
        openLine = i;
        openInfo = open[2];
        inBlock = true;
      }
    } else {
      const closePattern = new RegExp(
        `^[ \\t]{0,3}(\\${openChar}{${openLen},})\\s*$`,
      );
      if (closePattern.test(line)) {
        const start = lineStarts[openLine];
        const contentStart = lineStarts[openLine + 1];
        const contentEnd = lineStarts[i] === 0 ? 0 : lineStarts[i] - 1;
        const endLine = i + 1; // line past the closing fence
        const end = Math.min(lineStarts[endLine] ?? markdown.length, markdown.length);
        blocks.push({
          index: blockIdx++,
          start,
          end,
          contentStart,
          contentEnd: Math.max(contentEnd, contentStart),
          fence: openChar.repeat(openLen),
          infoString: openInfo,
          source: markdown.slice(contentStart, Math.max(contentEnd, contentStart)),
        });
        inBlock = false;
      }
    }
  }
  // Unclosed block at EOF: emit one running to EOF so the editor can repair it.
  if (inBlock) {
    const start = lineStarts[openLine];
    const contentStart = lineStarts[openLine + 1] ?? markdown.length;
    blocks.push({
      index: blockIdx,
      start,
      end: markdown.length,
      contentStart,
      contentEnd: markdown.length,
      fence: openChar.repeat(openLen),
      infoString: openInfo,
      source: markdown.slice(contentStart),
    });
  }
  return blocks;
}

/**
 * Replace the contents (and optionally the language tag) of the Nth fenced
 * code block in `markdown`. Returns the rewritten document, or `null` if the
 * index is out of range. The opening fence (e.g. ` ``` `) is reused so we
 * don't pick a different fence width than the user wrote.
 */
export function replaceNthFencedBlock(
  markdown: string,
  index: number,
  newSource: string,
  newInfoString?: string,
): string | null {
  const blocks = listFencedBlocks(markdown);
  if (index < 0 || index >= blocks.length) return null;
  const b = blocks[index];
  const info = newInfoString ?? b.infoString;
  // Reuse the original opening fence width/character so e.g. `~~~~` stays
  // `~~~~`. Closing fence uses the same character at the same length.
  const closingFence = b.fence;
  // Preserve a trailing newline after the closing fence if the original had
  // one (i.e. it wasn't the last char of the file).
  const trailingNewline = b.end < markdown.length || markdown.endsWith('\n') ? '\n' : '';
  const replacement = `${b.fence}${info}\n${newSource}\n${closingFence}${trailingNewline}`;
  return markdown.slice(0, b.start) + replacement + markdown.slice(b.end);
}
