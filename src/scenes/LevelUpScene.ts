import Phaser from 'phaser';
import { audio } from '../game/audio';
import { describeChange, type UpgradeDef } from '../game/data/upgrades';
import { button, fitWidth, overlay, setupCamera, text, viewSize } from '../ui/ui';

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

    const blockH = 42 + data.offers.length * (CARD_H + GAP) - GAP + 44;
    const top = Math.round((H - blockH) / 2);
    const title = text(this, W / 2, top, 'LEVEL UP!', { align: 'center', size: 16, bold: true, color: 'y' });
    this.tweens.add({ targets: title, y: title.y - 2, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
    text(this, W / 2, top + 22, `Level ${data.level}: pick a new power`, { align: 'center', color: 'g', size: 8 });

    let ready = false;
    this.time.delayedCall(350, () => (ready = true));

    // Two-step choice: tap a card to select it, then tap CHOOSE to confirm (no accidental picks).
    let selected = -1;
    const redraws: ((state: 'idle' | 'press' | 'selected') => void)[] = [];
    const select = (i: number) => {
      if (!ready || this.picked) return;
      selected = i;
      audio.sfx('tap');
      redraws.forEach((d, j) => d(j === i ? 'selected' : 'idle'));
      confirm.setEnabled(true);
      confirm.label.setText(`CHOOSE: ${data.offers[i].name.toUpperCase()}`);
      fitWidth(confirm.label, CARD_W - 12);
    };
    const choose = () => {
      if (!ready || this.picked || selected < 0) return;
      this.picked = true;
      audio.sfx('select');
      this.scene.stop();
      data.onPick(data.offers[selected].id);
    };
    const confirmY = top + 42 + data.offers.length * (CARD_H + GAP) + 14;
    const confirm = button(this, W / 2, confirmY, 'TAP A POWER ABOVE', choose, { w: CARD_W, h: 28, color: 0x2a9d55, size: 9 });
    confirm.setEnabled(false);
    this.input.keyboard?.on('keydown-ENTER', choose);
    this.input.keyboard?.on('keydown-SPACE', choose);

    data.offers.forEach((u, i) => {
      const cy = top + 42 + CARD_H / 2 + i * (CARD_H + GAP);
      const c = this.add.container(W / 2, cy);
      const g = this.add.graphics();
      const accent = u.instant ? 0x2a9d55 : 0x3868e8;
      let check: Phaser.GameObjects.Container | null = null;
      const draw = (state: 'idle' | 'press' | 'selected') => {
        g.clear();
        const sel = state === 'selected';
        g.fillStyle(0x0b0816, 0.6).fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 2, CARD_W, CARD_H, 4);
        if (sel) g.fillStyle(0x78e048).fillRoundedRect(-CARD_W / 2 - 2, -CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4, 5);
        g.fillStyle(sel ? 0x78e048 : state === 'press' ? 0xf2d680 : 0x6a6690).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 4);
        g.fillStyle(0x1c1838).fillRoundedRect(-CARD_W / 2 + 1, -CARD_H / 2 + 1, CARD_W - 2, CARD_H - 2, 3);
        g.fillStyle(accent).fillRoundedRect(-CARD_W / 2 + 1, -CARD_H / 2 + 1, 4, CARD_H - 2, { tl: 3, bl: 3, tr: 0, br: 0 });
      };
      draw('idle');
      redraws.push((st) => {
        draw(st);
        check?.setVisible(st === 'selected');
        c.setScale(st === 'selected' ? 1.03 : 1);
      });

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
      // Selected check mark over the icon
      const tick = this.add.graphics();
      tick.fillStyle(0x78e048).fillCircle(0, 0, 7);
      tick.lineStyle(2, 0x0b0816).beginPath().moveTo(-3.5, 0).lineTo(-1, 2.5).lineTo(3.5, -2.5).strokePath();
      check = this.add.container(iconX + 10, -18, [tick]).setVisible(false);
      c.add([g, badge, icon, tagBg, tag, name, desc, rowBg, label, from, arrow, to, check]);

      c.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => { if (selected !== i) draw('press'); });
      c.on('pointerout', () => draw(selected === i ? 'selected' : 'idle'));
      c.on('pointerup', () => select(i));
      c.setAlpha(0).setX(W / 2 + 16);
      this.tweens.add({ targets: c, alpha: 1, x: W / 2, delay: i * 70, duration: 220, ease: 'Back.out' });
      this.input.keyboard?.on(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, () => select(i));
    });
  }
}
