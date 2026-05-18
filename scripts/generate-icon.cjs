/**
 * Generates a 1024x1024 placeholder app icon for HopsMD using only Node
 * built-ins (no native deps).
 *
 * Design: a stylised pilsner glass on a fully transparent canvas (so the
 * OS can paint it inside a rounded taskbar tile or wherever without black
 * corners showing).
 *
 * Pixel layout:
 *
 *     ~~~~~~     <- creamy foam cap (wavy top, overflows the glass rim)
 *    ╱──────╲    <- glass top rim
 *    │amber │    <- amber body (slight vertical gradient for depth)
 *    │ amber│
 *     ╲────╱     <- narrower bottom (pilsner-style trapezoid)
 *      ───       <- tiny base ellipse so the glass looks like it stands
 *
 * Run:  node scripts/generate-icon.cjs
 * Out:  scripts/source-icon.png  (1024x1024 PNG with alpha)
 * Then: npx tauri icon scripts/source-icon.png
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 1024;
const OUTPUT = path.join(__dirname, 'source-icon.png');

// -- Palette (matches src/styles.scss brewhouse vars) --
const TRANSPARENT  = [0,    0,    0,    0  ];
const AMBER        = [0xe6, 0xa0, 0x35, 0xff];
const AMBER_DEEP   = [0xb0, 0x6c, 0x1e, 0xff];
const FOAM         = [0xfb, 0xf3, 0xdb, 0xff];
const FOAM_SHADOW  = [0xe9, 0xdd, 0xb6, 0xff];
const OUTLINE      = [0x2e, 0x1b, 0x09, 0xff];

// -- Glass geometry (1024 canvas) --
const CX            = SIZE / 2;
const GLASS_TOP_Y   = 250;   // where the glass rim starts
const GLASS_BOT_Y   = 870;   // where the body meets the base
const GLASS_TOP_HW  = 235;   // top half-width
const GLASS_BOT_HW  = 175;   // bottom half-width (slight pilsner taper)
const STROKE        = 16;    // outline thickness on each side

// -- Base (the little ellipse the glass sits on) --
const BASE_Y        = 905;
const BASE_RX       = 215;
const BASE_RY       = 24;

// -- Foam (sits on top of and slightly overflows the rim) --
const FOAM_BASE_Y   = 290;          // foam fades into amber around here
const FOAM_PEAK_Y   = 130;          // tallest crest
const FOAM_LEFT     = CX - GLASS_TOP_HW - 14;
const FOAM_RIGHT    = CX + GLASS_TOP_HW + 14;

function glassHalfWidth(y) {
  if (y < GLASS_TOP_Y || y > GLASS_BOT_Y) return -1;
  const t = (y - GLASS_TOP_Y) / (GLASS_BOT_Y - GLASS_TOP_Y);
  return GLASS_TOP_HW * (1 - t) + GLASS_BOT_HW * t;
}

function inGlassInterior(x, y) {
  const hw = glassHalfWidth(y);
  if (hw < 0) return false;
  return Math.abs(x - CX) <= hw - STROKE * 0.7;
}

function inGlassStroke(x, y) {
  const hw = glassHalfWidth(y);
  if (hw < 0) return false;
  const dist = Math.abs(x - CX);
  return dist >= hw - STROKE * 0.7 && dist <= hw + STROKE * 0.3;
}

function inBase(x, y) {
  const dx = (x - CX) / BASE_RX;
  const dy = (y - BASE_Y) / BASE_RY;
  // Lower half only, so the base looks like the foot the glass stands on.
  return y >= BASE_Y - BASE_RY * 0.5 && dx * dx + dy * dy <= 1;
}

/**
 * Foam profile: returns the y-coordinate of the foam's top surface at a given
 * x (or null if x is outside the foam horizontal range). The profile is two
 * sine humps so it looks like a real head of foam, not a smooth dome.
 */
function foamTopAt(x) {
  if (x < FOAM_LEFT || x > FOAM_RIGHT) return null;
  const u = (x - FOAM_LEFT) / (FOAM_RIGHT - FOAM_LEFT); // 0..1 across foam
  // Two-hump sinusoid, peaks near 0.3 and 0.7, lower at the edges + valley centre.
  const hump = Math.sin(u * Math.PI * 2.0) * 0.4 + Math.sin(u * Math.PI) * 0.7;
  const dipFromPeak = (1 - hump) * 0.5; // 0 at peaks, larger in valleys
  const peakHeight = FOAM_BASE_Y - FOAM_PEAK_Y;
  return FOAM_BASE_Y - peakHeight * (0.55 + 0.45 * (1 - dipFromPeak));
}

function inFoam(x, y) {
  const top = foamTopAt(x);
  if (top === null) return false;
  return y >= top && y <= FOAM_BASE_Y + 18;
}

function inFoamShadow(x, y) {
  const top = foamTopAt(x);
  if (top === null) return false;
  // Thin shadow band along the bottom edge of the foam, where it meets the beer.
  return y > FOAM_BASE_Y - 14 && y <= FOAM_BASE_Y + 18;
}

/**
 * Resolve the single colour at (x, y). Order matters — first match wins.
 */
function colorAt(x, y) {
  // Foam sits in front of the rim and overflows it slightly.
  if (inFoam(x, y)) return inFoamShadow(x, y) ? FOAM_SHADOW : FOAM;
  // Base ellipse below the glass.
  if (inBase(x, y)) return OUTLINE;
  // Glass body — stroke before fill so the outline wins on the boundary.
  if (inGlassStroke(x, y)) return OUTLINE;
  if (inGlassInterior(x, y)) {
    // Vertical amber gradient for a tiny bit of depth.
    const t = (y - GLASS_TOP_Y) / (GLASS_BOT_Y - GLASS_TOP_Y);
    const k = Math.min(1, Math.max(0, t)) * 0.35;
    return [
      Math.round(AMBER[0] * (1 - k) + AMBER_DEEP[0] * k),
      Math.round(AMBER[1] * (1 - k) + AMBER_DEEP[1] * k),
      Math.round(AMBER[2] * (1 - k) + AMBER_DEEP[2] * k),
      0xff,
    ];
  }
  return TRANSPARENT;
}

/** 2×2 super-sample for cheap antialiasing on the curved edges. */
function shadedPixel(x, y) {
  const offsets = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  let r = 0, g = 0, b = 0, a = 0;
  for (const [dx, dy] of offsets) {
    const px = colorAt(x + dx, y + dy);
    // Pre-multiply alpha so partial-coverage averaging is correct.
    const w = px[3] / 255;
    r += px[0] * w;
    g += px[1] * w;
    b += px[2] * w;
    a += px[3];
  }
  const avgA = a / 4;
  if (avgA <= 0) return [0, 0, 0, 0];
  const norm = 255 / a; // un-premultiply against summed alpha
  return [
    Math.round(r * norm * (a / (4 * 255)) * (255 / Math.max(1, avgA / 255 * 255))),
    Math.round(g * norm * (a / (4 * 255)) * (255 / Math.max(1, avgA / 255 * 255))),
    Math.round(b * norm * (a / (4 * 255)) * (255 / Math.max(1, avgA / 255 * 255))),
    Math.round(avgA),
  ];
}

/**
 * Simpler AA: take 4 samples, average each channel straight. Partial-cover
 * pixels end up with partial alpha *and* premultiplied colour, which the OS
 * compositors render fine. (Replaces the over-engineered version above.)
 */
function shadedPixelSimple(x, y) {
  const offsets = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  let r = 0, g = 0, b = 0, a = 0;
  for (const [dx, dy] of offsets) {
    const px = colorAt(x + dx, y + dy);
    const w = px[3] / 255; // premultiplied averaging
    r += px[0] * w;
    g += px[1] * w;
    b += px[2] * w;
    a += px[3];
  }
  return [
    Math.round(r / 4),
    Math.round(g / 4),
    Math.round(b / 4),
    Math.round(a / 4),
  ];
}

function buildRaster() {
  const rowSize = SIZE * 4;
  const raw = Buffer.alloc((rowSize + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const lineStart = y * (rowSize + 1);
    raw[lineStart] = 0; // PNG row filter = None
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = shadedPixelSimple(x, y);
      const off = lineStart + 1 + x * 4;
      raw[off]     = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }
  return raw;
}

// -------- PNG plumbing (unchanged from the previous icon script) --------

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
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

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
fs.writeFileSync(OUTPUT, png);
console.log(`Wrote ${png.length} bytes to ${OUTPUT}`);
