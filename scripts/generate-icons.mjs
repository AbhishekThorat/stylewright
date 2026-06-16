// Generates the extension icons as PNGs from code — no binary assets checked in
// without provenance, no image-library dependency. Run: `npm run icons`.
//
// Draws a rounded-square brand mark in the accent indigo with a white "{ }"
// glyph, at the sizes Chrome/Brave use for the toolbar and store listing.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ACCENT = [79, 70, 229]; // #4f46e5
const WHITE = [255, 255, 255];
const SIZES = [16, 32, 48, 128];

function main() {
  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icon');
  mkdirSync(outDir, { recursive: true });
  for (const size of SIZES) {
    writeFileSync(resolve(outDir, `${size}.png`), encodePng(drawIcon(size), size, size));
  }
  console.log(`Generated ${SIZES.length} icons in public/icon/`);
}

/** Returns an RGBA pixel buffer for one icon. */
function drawIcon(size) {
  const buf = new Uint8Array(size * size * 4);
  const radius = size * 0.22;
  const stroke = Math.max(1, Math.round(size * 0.09));

  // Brace geometry: two arcs near the left/right thirds.
  const cy = size / 2;
  const braceTop = size * 0.26;
  const braceBot = size * 0.74;
  const leftX = size * 0.34;
  const rightX = size * 0.66;
  const bulge = size * 0.08;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRoundedRect(x, y, size, radius)) continue;

      let color = ACCENT;
      if (y > braceTop && y < braceBot) {
        const t = (y - cy) / (braceBot - braceTop); // -0.5..0.5
        const offset = bulge * (1 - Math.cos(t * Math.PI)); // pinch toward center
        if (Math.abs(x - (leftX + offset)) < stroke / 2) color = WHITE;
        if (Math.abs(x - (rightX - offset)) < stroke / 2) color = WHITE;
      }
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function insideRoundedRect(x, y, size, r) {
  const minX = r;
  const minY = r;
  const maxX = size - r;
  const maxY = size - r;
  const cx = Math.min(Math.max(x + 0.5, minX), maxX);
  const cy = Math.min(Math.max(y + 0.5, minY), maxY);
  return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
}

// --- Minimal PNG encoder (truecolor + alpha, no interlace) -----------------
function encodePng(rgba, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10..12 left as 0 (compression, filter, interlace)

  // Prepend filter byte (0) to each scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

main();
