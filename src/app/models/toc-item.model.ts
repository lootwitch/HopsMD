/**
 * One entry in the rendered Markdown's table of contents.
 * Built by scanning the post-render DOM for h1-h6 inside the article host.
 */
export interface TocItem {
  /** DOM id assigned to the heading (slugified + de-duplicated). */
  readonly id: string;
  /** Plain-text content of the heading. */
  readonly text: string;
  /** Heading depth, 1 (h1) through 6 (h6). */
  readonly level: number;
  /** Visual indent depth, 0-based, normalised to the shallowest level present. */
  readonly indent: number;
}
