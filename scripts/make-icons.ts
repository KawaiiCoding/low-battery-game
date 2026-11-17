/**
 * Generates PWA icons from the game's own pixel art (Chip, the battery mascot).
 * Run: npx vite-node scripts/make-icons.ts
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PALETTE } from '../src/game/constants';
import { SPRITES } from '../src/game/sprites';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size: number, px: (x: number, y: number) => [number, number, number, number]): Buffer {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = px(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const rgb = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const BG = rgb(0x1c1838);
const grid = SPRITES.chip.frames[0];
const gw = grid[0].length;
const gh = grid.length;

/** `fill` = fraction of the icon the sprite occupies (maskable icons need a safe zone). */
function icon(size: number, fill: number, rounded: boolean) {
  const scale = Math.floor((size * fill) / Math.max(gw, gh));
  const ox = Math.floor((size - gw * scale) / 2);
  const oy = Math.floor((size - gh * scale) / 2);
  const rad = rounded ? size * 0.2 : 0;
  return png(size, (x, y) => {
    // rounded-square background
    if (rounded) {
      const cx = Math.min(Math.max(x, rad), size - 1 - rad);
      const cy = Math.min(Math.max(y, rad), size - 1 - rad);
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) return [0, 0, 0, 0];
    }
    const gx = Math.floor((x - ox) / scale);
    const gy = Math.floor((y - oy) / scale);
    if (gx >= 0 && gy >= 0 && gx < gw && gy < gh) {
      const ch = grid[gy][gx];
      if (ch !== '.') return [...rgb(PALETTE[ch]), 255];
    }
    return [...BG, 255];
  });
}

const out = 'public/icons';
writeFileSync(`${out}/icon-192.png`, icon(192, 0.7, true));
writeFileSync(`${out}/icon-512.png`, icon(512, 0.7, true));
writeFileSync(`${out}/maskable-512.png`, icon(512, 0.5, false));
writeFileSync(`${out}/apple-touch-icon.png`, icon(180, 0.65, false));
writeFileSync(`${out}/favicon-32.png`, icon(32, 0.9, false));
console.log('icons written to', out);
