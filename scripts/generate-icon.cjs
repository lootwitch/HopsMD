/**
 * Generates a 1024x1024 placeholder app icon for HopsMD using only Node
 * built-ins (no native deps). It's a flat amber circle on a stout background
 * with a foamy "M" carved out — enough to ship `tauri icon` against.
 *
 * Run:  node scripts/generate-icon.cjs
 * Out:  scripts/source-icon.png
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 1024;
const PATH = path.join(__dirname, 'source-icon.png');

// Palette mirrors src/styles.scss
const STOUT  = [0x0f, 0x0a, 0x06, 0xff]; // background
const AMBER  = [0xc8, 0x7b, 0x1e, 0xff]; // disc
const FOAM   = [0xf6, 0xef, 0xd9, 0xff]; // glyph
const PILS   = [0xf5, 0xc5, 0x42, 0xff]; // accent ring

function inDisc(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inRing(x, y, cx, cy, rOuter, rInner) {
  const dx = x - cx, dy = y - cy;
  const d2 = dx * dx + dy * dy;
  return d2 <= rOuter * rOuter && d2 >= rInner * rInner;
}

function buildRaster() {
  // Row-major RGBA, one filter byte per row (filter=0, "None").
  const rowSize = SIZE * 4;
  const raw = Buffer.alloc((rowSize + 1) * SIZE);

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rDisc  = SIZE * 0.42;
  const rRingO = SIZE * 0.48;
  const rRingI = SIZE * 0.455;

  for (let y = 0; y < SIZE; y++) {
    const lineStart = y * (rowSize + 1);
    raw[lineStart] = 0; // PNG filter byte
    for (let x = 0; x < SIZE; x++) {
      let px = STOUT;
      if (inRing(x, y, cx, cy, rRingO, rRingI)) px = PILS;
      else if (inDisc(x, y, cx, cy, rDisc))    px = AMBER;

      // Stylised "M" glyph on top — three vertical bars + diagonals.
      const innerLeft  = cx - SIZE * 0.22;
      const innerRight = cx + SIZE * 0.22;
      const innerTop   = cy - SIZE * 0.18;
      const innerBot   = cy + SIZE * 0.20;
      const barWidth   = SIZE * 0.06;
      if (inDisc(x, y, cx, cy, rDisc) && y >= innerTop && y <= innerBot) {
        // Left vertical
        if (Math.abs(x - innerLeft) <= barWidth / 2) px = FOAM;
        // Right vertical
        if (Math.abs(x - innerRight) <= barWidth / 2) px = FOAM;
        // Centre dip (\\ then //)
        const mid = cx;
        const span = innerRight - innerLeft;
        const halfSpan = span / 2;
        // line from (innerLeft, innerTop) -> (mid, innerTop + halfSpan)
        const t1 = (x - innerLeft) / halfSpan;
        if (t1 >= 0 && t1 <= 1) {
          const yLine = innerTop + t1 * (innerBot - innerTop) * 0.7;
          if (Math.abs(y - yLine) <= barWidth / 2) px = FOAM;
        }
        const t2 = (x - mid) / halfSpan;
        if (t2 >= 0 && t2 <= 1) {
          const yLine = innerTop + (innerBot - innerTop) * 0.7 - t2 * (innerBot - innerTop) * 0.7;
          if (Math.abs(y - yLine) <= barWidth / 2) px = FOAM;
        }
      }

      const off = lineStart + 1 + x * 4;
      raw[off]     = px[0];
      raw[off + 1] = px[1];
      raw[off + 2] = px[2];
      raw[off + 3] = px[3];
    }
  }
  return raw;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

function buildPng() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8]  = 8;   // bit depth
  ihdr[9]  = 6;   // colour type: RGBA
  ihdr[10] = 0;   // compression
  ihdr[11] = 0;   // filter
  ihdr[12] = 0;   // interlace

  const raw = buildRaster();
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = buildPng();
fs.writeFileSync(PATH, png);
console.log(`Wrote ${png.length} bytes to ${PATH}`);
