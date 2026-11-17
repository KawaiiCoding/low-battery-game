import Phaser from 'phaser';
import { PALETTE, hex } from '../game/constants';
import { SPRITES, type SpriteDef } from '../game/sprites';
import { drawGrid, gridSize } from '../game/pixel';
import { WORLDS } from '../game/data/worlds';

/** Small deterministic RNG so generated backgrounds look the same every time. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeSprites();
    this.makeParticles();
    this.makeBackgrounds();
    this.scene.start('Title');
  }

  private canvas(key: string, w: number, h: number): { tex: Phaser.Textures.CanvasTexture; ctx: CanvasRenderingContext2D } {
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) throw new Error(`Could not create texture ${key}`);
    return { tex, ctx: tex.getContext() };
  }

  private makeSprites(): void {
    for (const [key, def] of Object.entries(SPRITES) as [string, SpriteDef][]) {
      const { w, h } = gridSize(def.frames[0]);
      const { tex, ctx } = this.canvas(key, w * def.frames.length, h);
      def.frames.forEach((f, i) => {
        drawGrid(ctx, f, i * w, 0, PALETTE);
        tex.add(i, 0, i * w, 0, w, h);
      });
      tex.refresh();
      if (def.frames.length > 1) {
        this.anims.create({
          key: `${key}-anim`,
          frames: def.frames.map((_, i) => ({ key, frame: i })),
          frameRate: def.fps ?? 4,
          repeat: -1,
        });
      }
    }
  }

  private makeParticles(): void {
    for (const [name, color] of Object.entries(PALETTE)) {
      const { tex, ctx } = this.canvas(`px-${name}`, 2, 2);
      ctx.fillStyle = hex(color);
      ctx.fillRect(0, 0, 2, 2);
      tex.refresh();
    }
  }

  private makeBackgrounds(): void {
    WORLDS.forEach((w, i) => {
      const S = 64;
      const rnd = mulberry(1234 + i * 77);
      const { tex, ctx } = this.canvas(`bg-${w.id}`, S, S);
      ctx.fillStyle = hex(w.bg.base);
      ctx.fillRect(0, 0, S, S);
      if (w.bg.style === 'grid') {
        ctx.fillStyle = hex(w.bg.line);
        for (let k = 0; k < S; k += 16) {
          ctx.fillRect(k, 0, 1, S);
          ctx.fillRect(0, k, S, 1);
        }
        ctx.fillStyle = hex(w.bg.dot);
        for (let n = 0; n < 10; n++) {
          // tiny "0" and "1" bits
          const x = Math.floor(rnd() * 15) * 4 + 2;
          const y = Math.floor(rnd() * 15) * 4 + 2;
          if (rnd() < 0.5) ctx.fillRect(x, y, 1, 3);
          else {
            ctx.fillRect(x, y, 3, 1);
            ctx.fillRect(x, y + 2, 3, 1);
            ctx.fillRect(x, y, 1, 3);
            ctx.fillRect(x + 2, y, 1, 3);
          }
        }
      } else if (w.bg.style === 'sparkle') {
        ctx.fillStyle = hex(w.bg.line);
        for (let k = 0; k < S; k += 8) for (let j = (k / 8) % 2 ? 4 : 0; j < S; j += 8) ctx.fillRect(j, k, 1, 1);
        for (let n = 0; n < 6; n++) {
          const x = Math.floor(rnd() * (S - 4)) + 2;
          const y = Math.floor(rnd() * (S - 4)) + 2;
          ctx.fillStyle = hex(rnd() < 0.5 ? w.bg.dot : 0x8a4ab8);
          ctx.fillRect(x, y - 1, 1, 3);
          ctx.fillRect(x - 1, y, 3, 1);
        }
        // little hearts
        ctx.fillStyle = hex(0x3d1f5e);
        for (let n = 0; n < 3; n++) {
          const x = Math.floor(rnd() * (S - 6));
          const y = Math.floor(rnd() * (S - 6));
          ctx.fillRect(x, y, 2, 1);
          ctx.fillRect(x + 3, y, 2, 1);
          ctx.fillRect(x, y + 1, 5, 1);
          ctx.fillRect(x + 1, y + 2, 3, 1);
          ctx.fillRect(x + 2, y + 3, 1, 1);
        }
      } else {
        for (let n = 0; n < 18; n++) {
          const x = Math.floor(rnd() * (S - 3));
          const y = Math.floor(rnd() * (S - 3)) + 2;
          ctx.fillStyle = hex(rnd() < 0.7 ? w.bg.line : w.bg.dot);
          ctx.fillRect(x, y, 1, 2);
          ctx.fillRect(x + 2, y - 1, 1, 3);
        }
        for (let n = 0; n < 3; n++) {
          const x = Math.floor(rnd() * (S - 3)) + 1;
          const y = Math.floor(rnd() * (S - 3)) + 1;
          ctx.fillStyle = hex(rnd() < 0.5 ? 0xf8e858 : 0xf070c0);
          ctx.fillRect(x, y, 1, 1);
          ctx.fillStyle = hex(0x2a5a36);
          ctx.fillRect(x, y + 1, 1, 2);
        }
      }
      tex.refresh();
    });
  }
}
