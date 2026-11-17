import Phaser from 'phaser';
import { FONT_FAMILY, TEXT_COLORS, VIEW, hex, type TextColor } from '../game/constants';
import { audio } from '../game/audio';

/** Logical screen size used by all layout code. */
export function viewSize(): { width: number; height: number } {
  return { width: VIEW.w, height: VIEW.h };
}

/** Every scene calls this first: renders the logical view at full device resolution. */
export function setupCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0).setZoom(VIEW.zoom).setScroll(0, 0);
  return cam;
}

export interface TextOpts {
  color?: TextColor;
  /** Font size in logical pixels (default 8, never below MIN_SIZE). */
  size?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  depth?: number;
  fixed?: boolean;
  /** Vertical origin (default 0 = top). */
  originY?: number;
}

export type Txt = Phaser.GameObjects.Text;

/** Accessibility: smallest allowed text (~15 CSS px on a phone) and a touch of letter spacing. */
export const MIN_SIZE = 7;
const LETTER_SPACING = 0.3;

/** Crisp text using the bundled Pixelify Sans font, rendered at device resolution. */
export function text(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}): Txt {
  const align = o.align ?? 'left';
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT_FAMILY,
    fontSize: `${Math.max(MIN_SIZE, o.size ?? 8)}px`,
    fontStyle: o.bold ? 'bold' : 'normal',
    color: hex(TEXT_COLORS[o.color ?? 'w']),
    align,
    lineSpacing: 3,
    resolution: VIEW.zoom,
    // A crisp dark outline keeps text readable over any background (better than a soft shadow).
    stroke: '#0b0816',
    strokeThickness: 1.5,
    // Wrap a little early to leave room for letter spacing.
    wordWrap: o.maxWidth ? { width: o.maxWidth * 0.94, useAdvancedWrap: true } : undefined,
  });
  t.setLetterSpacing(LETTER_SPACING);
  t.setOrigin(align === 'center' ? 0.5 : align === 'right' ? 1 : 0, o.originY ?? 0);
  if (o.depth !== undefined) t.setDepth(o.depth);
  if (o.fixed) t.setScrollFactor(0);
  return t;
}

export function setColor(t: Txt, c: TextColor): void {
  t.setColor(hex(TEXT_COLORS[c]));
}

/** Shrinks a text's font until it fits `maxWidth` (for labels that must stay on one line). */
export function fitWidth(t: Txt, maxWidth: number, minSize = MIN_SIZE): Txt {
  let size = parseFloat(String(t.style.fontSize));
  while (t.width > maxWidth && size > minSize) {
    size -= 0.5;
    t.setFontSize(size);
  }
  return t;
}

export interface ButtonOpts {
  w: number;
  h: number;
  color?: number;
  textColor?: TextColor;
  depth?: number;
  fixed?: boolean;
  size?: number;
  /** Optional sub-label drawn smaller under the main label. */
  sub?: string;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  label: Txt;
  setEnabled(on: boolean): void;
  destroy(): void;
}

/** Rounded pixel-style button that triggers on release (dragging off cancels). */
export function button(scene: Phaser.Scene, x: number, y: number, label: string, onTap: () => void, o: ButtonOpts): Button {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const color = o.color ?? 0x3868e8;
  const dark = Phaser.Display.Color.ValueToColor(color).darken(25).color;
  const t = text(scene, 0, 0, label, { align: 'center', color: o.textColor ?? 'w', size: o.size ?? 8, bold: true, originY: 0.5 });
  fitWidth(t, o.w - 8);
  const sub = o.sub ? fitWidth(text(scene, 0, 0, o.sub, { align: 'center', color: 'g', size: 7, originY: 0.5 }), o.w - 8) : null;
  const draw = (pressed: boolean) => {
    g.clear();
    const oy = pressed ? 1 : 0;
    const left = -o.w / 2;
    const top = -o.h / 2;
    g.fillStyle(0x0b0816, 0.6).fillRoundedRect(left, top + 1.5, o.w, o.h, 3);
    g.fillStyle(dark).fillRoundedRect(left, top + oy, o.w, o.h, 3);
    g.fillStyle(color).fillRoundedRect(left, top + oy, o.w, o.h - 1.5, 3);
    g.fillStyle(0xffffff, 0.14).fillRoundedRect(left + 2, top + oy + 1, o.w - 4, 2, 1);
    t.y = (sub ? -5 : -0.5) + oy;
    if (sub) sub.y = 6 + oy;
  };
  c.add([g, t, ...(sub ? [sub] : [])]);
  draw(false);
  c.setSize(o.w, o.h);
  c.setInteractive({ useHandCursor: true });
  let pressed = false;
  let enabled = true;
  c.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    draw(true);
  });
  c.on('pointerout', () => {
    pressed = false;
    draw(false);
  });
  c.on('pointerup', () => {
    if (!enabled || !pressed) return;
    pressed = false;
    draw(false);
    audio.sfx('tap');
    onTap();
  });
  if (o.depth !== undefined) c.setDepth(o.depth);
  if (o.fixed) c.setScrollFactor(0);
  return {
    container: c,
    label: t,
    setEnabled(on: boolean) {
      enabled = on;
      c.setAlpha(on ? 1 : 0.5);
    },
    destroy() {
      c.destroy();
    },
  };
}

/** Full-screen dim overlay that swallows input. */
export function overlay(scene: Phaser.Scene, alpha = 0.7, depth = 900): Phaser.GameObjects.Rectangle {
  const { width, height } = viewSize();
  return scene.add
    .rectangle(0, 0, width, height, 0x0f0b1e, alpha)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(depth)
    .setInteractive();
}

/** Draws a battery icon (17x8) with a given fill fraction. */
export function drawBattery(g: Phaser.GameObjects.Graphics, x: number, y: number, pct: number, blinkOn = true): void {
  const color = pct > 50 ? 0x78e048 : pct > 20 ? 0xf8e858 : 0xe8384f;
  g.fillStyle(0x0b0816).fillRect(x - 1, y - 1, 18, 10);
  g.fillStyle(0xeae4d6).fillRect(x, y, 15, 8);
  g.fillRect(x + 15, y + 2, 2, 4);
  g.fillStyle(0x1a1028).fillRect(x + 1, y + 1, 13, 6);
  const fill = Math.max(pct > 0 ? 1 : 0, Math.round((13 * pct) / 100));
  if (blinkOn) g.fillStyle(color).fillRect(x + 1, y + 1, fill, 6);
}
