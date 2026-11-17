import Phaser from 'phaser';
import { audio } from '../game/audio';
import { describeChange, type UpgradeDef } from '../game/data/upgrades';
import { fitWidth, overlay, setupCamera, text, viewSize } from '../ui/ui';

export interface LevelUpData {
  offers: UpgradeDef[];
  levels: Record<string, number>;
  level: number;
  battery: number;
  onPick: (id: string) => void;
}

const CARD_W = 164;
const CARD_H = 60;
const GAP = 8;

export class LevelUpScene extends Phaser.Scene {
  private picked = false;

  constructor() {
    super('LevelUp');
  }

  create(data: LevelUpData): void {
    const { width: W, height: H } = viewSize();
    setupCamera(this);
    this.picked = false;
    audio.sfx('levelup');
    overlay(this, 0.82, 0);

    const blockH = 42 + data.offers.length * (CARD_H + GAP) - GAP;
    const top = Math.round((H - blockH) / 2);
    const title = text(this, W / 2, top, 'LEVEL UP!', { align: 'center', size: 16, bold: true, color: 'y' });
    this.tweens.add({ targets: title, y: title.y - 2, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
    text(this, W / 2, top + 22, `Level ${data.level}: pick a new power`, { align: 'center', color: 'g', size: 8 });

    let ready = false;
    this.time.delayedCall(350, () => (ready = true));

    const choose = (u: UpgradeDef) => {
      if (!ready || this.picked) return;
      this.picked = true;
      audio.sfx('select');
      this.scene.stop();
      data.onPick(u.id);
    };

    data.offers.forEach((u, i) => {
      const cy = top + 42 + CARD_H / 2 + i * (CARD_H + GAP);
      const c = this.add.container(W / 2, cy);
      const g = this.add.graphics();
      const accent = u.instant ? 0x2a9d55 : 0x3868e8;
      const draw = (hl: boolean) => {
        g.clear();
        g.fillStyle(0x0b0816, 0.6).fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 2, CARD_W, CARD_H, 4);
        g.fillStyle(hl ? 0xf2d680 : 0x6a6690).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 4);
        g.fillStyle(0x1c1838).fillRoundedRect(-CARD_W / 2 + 1, -CARD_H / 2 + 1, CARD_W - 2, CARD_H - 2, 3);
        g.fillStyle(accent).fillRoundedRect(-CARD_W / 2 + 1, -CARD_H / 2 + 1, 4, CARD_H - 2, { tl: 3, bl: 3, tr: 0, br: 0 });
      };
      draw(false);

      const lvl = data.levels[u.id] ?? 0;
      const tagStr = u.instant ? 'NOW' : lvl === 0 ? 'NEW' : `LV ${lvl + 1}`;
      const tag = text(this, CARD_W / 2 - 7, -CARD_H / 2 + 6, tagStr, {
        align: 'right', size: 7, bold: true, color: lvl === 0 && !u.instant ? 'l' : 'c',
      });
      const tagBg = this.add
        .rectangle(tag.x + 2, tag.y - 1, tag.width + 5, tag.height + 2, 0x0b0816, 0.9)
        .setOrigin(1, 0);

      // Icon badge
      const iconX = -CARD_W / 2 + 22;
      const badge = this.add.circle(iconX, -8, 13, 0x0b0816, 0.8).setStrokeStyle(1, accent);
      const icon = this.add.sprite(iconX, -8, u.icon, 0);
      icon.setScale(Math.min(2, 20 / Math.max(icon.width, icon.height)));

      const left = -CARD_W / 2 + 42;
      const name = text(this, left, -CARD_H / 2 + 5, u.name, { color: 'y', size: 9, bold: true });
      fitWidth(name, CARD_W / 2 - 7 - tagBg.width - 4 - left);
      const desc = fitWidth(text(this, left, -CARD_H / 2 + 19, u.desc, { size: 7, color: 'g' }), CARD_W / 2 - 6 - left);

      // Before -> after, in plain numbers
      const ch = describeChange(u, data.levels, data.battery);
      const rowY = CARD_H / 2 - 13;
      const label = text(this, -CARD_W / 2 + 8, rowY, `${ch.label}:`, { size: 8, bold: true, originY: 0.5 });
      const from = text(this, label.x + label.width + 4, rowY, ch.from, { size: 8, color: 'g', originY: 0.5 });
      const ax = from.x + from.width + 4;
      const arrow = this.add.triangle(ax + 3, rowY, 0, 0, 6, 3.5, 0, 7, 0x78e048).setOrigin(0.5);
      const to = text(this, ax + 9, rowY, ch.to, { size: 9, bold: true, color: 'l', originY: 0.5 });
      const rowBg = this.add.rectangle(0, rowY, CARD_W - 6, 16, 0x0b0816, 0.55);
      // Keep the whole row inside the card on very long labels
      const rowW = to.x + to.width - label.x;
      if (rowW > CARD_W - 14) {
        const k = (CARD_W - 14) / rowW;
        [label, from, to].forEach((t) => t.setFontSize(Math.max(7, parseFloat(String(t.style.fontSize)) * k)));
        from.x = label.x + label.width + 3;
        arrow.x = from.x + from.width + 6;
        to.x = arrow.x + 6;
      }
      c.add([g, badge, icon, tagBg, tag, name, desc, rowBg, label, from, arrow, to]);

      c.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => draw(true));
      c.on('pointerout', () => draw(false));
      c.on('pointerup', () => choose(u));
      c.setAlpha(0).setX(W / 2 + 16);
      this.tweens.add({ targets: c, alpha: 1, x: W / 2, delay: i * 70, duration: 220, ease: 'Back.out' });
      this.input.keyboard?.once(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, () => choose(u));
    });
  }
}
