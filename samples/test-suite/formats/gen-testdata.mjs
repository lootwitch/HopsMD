// One-off generator for large.json and sample.pdf (run: node gen-testdata.mjs)
import { writeFileSync } from 'node:fs';

// --- large.json: > 1 MiB of valid JSON -> json-view must fall back to plain text
const batches = [];
let i = 0;
let size = 0;
const styles = ['Pils', 'Helles', 'Kölsch', 'Weizen', 'IPA', 'Stout', 'Bock'];
while (size < 1024 * 1024 + 64 * 1024) {
  const rec = {
    batchId: `SUD-${String(i).padStart(6, '0')}`,
    style: styles[i % styles.length],
    brewedOn: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    originalGravity: 1.04 + (i % 30) / 1000,
    finalGravity: 1.008 + (i % 10) / 1000,
    fermenter: `FV-${(i % 8) + 1}`,
    notes: `Automatisch erzeugter Eintrag Nr. ${i} für den Größen-Fallback-Test des JSON-Viewers.`,
  };
  const json = JSON.stringify(rec);
  batches.push(json);
  size += json.length + 1;
  i++;
}
const largeJson =
  '{"description":"Absichtlich > 1 MiB groß: der JSON-Viewer muss auf reine Textanzeige zurückfallen.","batches":[\n' +
  batches.join(',\n') +
  '\n]}\n';
writeFileSync('large.json', largeJson);
console.log(`large.json: ${largeJson.length} chars (${(largeJson.length / 1048576).toFixed(2)} MiB), ${i} records`);

// --- sample.pdf: minimal valid one-page PDF, hand-assembled with correct xref offsets
const lines = [
  'BT',
  '/F1 24 Tf',
  '72 720 Td',
  '(HopsMD PDF Smoke Test) Tj',
  '/F1 12 Tf',
  '0 -36 Td',
  '(Wenn du diesen Text siehst, rendert der eingebettete PDF-Viewer korrekt.) Tj',
  '0 -20 Td',
  '(Erwartung: read-only, kein Edit-Button, Anzeige im iframe ueber das Asset-Protokoll.) Tj',
  'ET',
];
const stream = lines.join('\n');
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, idx) => {
  offsets.push(pdf.length);
  pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefPos = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
writeFileSync('sample.pdf', Buffer.from(pdf, 'latin1'));
console.log(`sample.pdf: ${pdf.length} bytes`);
