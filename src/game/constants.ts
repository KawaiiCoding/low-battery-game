/** Shared palette. Every pixel-art grid uses these single-character keys ('.' = transparent). */
export const PALETTE: Record<string, number> = {
  k: 0x1a1028, // outline / near-black
  w: 0xf0ece0, // warm white
  g: 0xa8a8c0, // light gray
  d: 0x5a5a78, // dark gray
  r: 0xe8384f, // red
  o: 0xf89838, // orange
  y: 0xf8e858, // yellow
  l: 0x78e048, // lime
  G: 0x2a9d55, // green
  c: 0x58d8f8, // cyan
  b: 0x3868e8, // blue
  B: 0x24306e, // navy
  p: 0x9850e8, // purple
  P: 0x6a34a8, // dark purple (shading)
  O: 0xc06a20, // dark orange (shading)
  L: 0x4aa830, // dark lime (shading)
  m: 0xf070c0, // pink
  s: 0xf8c8a0, // skin
  h: 0x6a3a2a, // hair
  n: 0xa0582c, // brown
};

export const BG_COLOR = 0x0f0b1e;

/** Logical width is fixed; height adapts to the device aspect ratio (portrait-first). */
export const VIEW_W = 180;
export const VIEW_H_MIN = 320;
export const VIEW_H_MAX = 400;

export function computeViewHeight(winW: number, winH: number): number {
  if (!(winW > 0) || !(winH > 0)) return VIEW_H_MIN;
  const h = Math.round((VIEW_W * winH) / winW / 2) * 2;
  return Math.min(VIEW_H_MAX, Math.max(VIEW_H_MIN, h));
}

/** Text colors are slightly softened versions of the palette so long reading is easy on the eyes. */
export const TEXT_COLORS = {
  w: 0xfbf8f0,
  y: 0xffe27a,
  c: 0x9fe6ff,
  r: 0xff8f9a,
  g: 0xd4d0e4,
  l: 0xb4f08a,
  m: 0xffb3e0,
} as const;
export type TextColor = keyof typeof TEXT_COLORS;

export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/**
 * Logical view (what all layout code uses) and the render zoom.
 * The canvas is VIEW × ZOOM real pixels: pixel art is scaled up crisply, text renders at full resolution.
 */
export const VIEW = { w: VIEW_W, h: VIEW_H_MIN, zoom: 3 };

export function computeZoom(cssW: number, cssH: number, viewH: number, dpr: number): number {
  const fit = Math.min(cssW / VIEW_W, cssH / viewH);
  if (!(fit > 0)) return 3;
  return Math.max(2, Math.min(5, Math.ceil(fit * (dpr || 1))));
}

export const FONT_FAMILY = '"Pixelify Sans", "Trebuchet MS", sans-serif';
