/** Singleton lazy loader for pdf.js. Mirrors `core/highlight-loader.ts`:
 *  the heavy `pdfjs-dist` bundle is only pulled in the first time a PDF is
 *  opened. The worker is referenced via `import.meta.url` so the Angular
 *  bundler emits it as a same-origin asset (satisfies CSP `script-src 'self'`).
 */
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}
