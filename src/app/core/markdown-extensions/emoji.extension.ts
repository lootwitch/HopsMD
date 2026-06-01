// src/app/core/markdown-extensions/emoji.extension.ts
import type { TokenizerAndRendererExtension } from 'marked';

/**
 * Curated map of common GitHub-style emoji shortcodes. Not exhaustive — covers
 * the everyday set people actually type in docs. Extend as needed.
 */
const EMOJI: Record<string, string> = {
  smile: '😄', smiley: '😃', grin: '😁', laughing: '😆', wink: '😉',
  blush: '😊', heart: '❤️', thumbsup: '👍', '+1': '👍', thumbsdown: '👎',
  '-1': '👎', tada: '🎉', rocket: '🚀', fire: '🔥', star: '⭐',
  sparkles: '✨', check: '✔️', white_check_mark: '✅', x: '❌',
  warning: '⚠️', bulb: '💡', book: '📖', books: '📚', memo: '📝',
  pencil: '✏️', bug: '🐛', wrench: '🔧', hammer: '🔨', gear: '⚙️',
  beer: '🍺', beers: '🍻', coffee: '☕', eyes: '👀', thinking: '🤔',
  zap: '⚡', boom: '💥', clap: '👏', wave: '👋', point_right: '👉',
  arrow_right: '➡️', heavy_check_mark: '✔️', question: '❓',
  exclamation: '❗', information_source: 'ℹ️', lock: '🔒', unlock: '🔓',
  package: '📦', calendar: '📅', clock: '🕐', hourglass: '⏳',
};

/** Inline extension turning `:shortcode:` into its emoji, when known. */
export const emojiExtension: TokenizerAndRendererExtension = {
  name: 'hopsEmoji',
  level: 'inline',
  start(src: string) {
    return src.indexOf(':');
  },
  tokenizer(src: string) {
    const match = /^:([a-z0-9_+-]+):/.exec(src);
    if (!match) return undefined;
    const char = EMOJI[match[1]];
    if (!char) return undefined; // unknown shortcode → leave as literal text
    return { type: 'hopsEmoji', raw: match[0], text: char };
  },
  renderer(token) {
    return (token as unknown as { text: string }).text;
  },
};
