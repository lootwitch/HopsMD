/** Singleton lazy loader for the highlight.js common bundle, shared by the
 *  markdown code renderer and the structured viewers (json/http fallbacks). */
let hljsPromise: Promise<typeof import('highlight.js').default> | null = null;

export function loadHljs(): Promise<typeof import('highlight.js').default> {
  if (!hljsPromise) {
    hljsPromise = import('highlight.js/lib/common').then((m) => m.default);
  }
  return hljsPromise;
}
