import Phaser from 'phaser';
import { audio } from '../game/audio';
import { WORLDS } from '../game/data/worlds';
import type { Character } from '../game/save';
import { button, overlay, setupCamera, text, viewSize } from '../ui/ui';

export interface BriefData {
  world: number;
  character: Character;
  touch: boolean;
  onGo: () => void;
}

/** Plain-language "mission card" shown before each world: what to do and how to win. */
export class BriefScene extends Phaser.Scene {
  constructor() {
    super('Brief');
  }

  create(data: BriefData): void {
    const { width: W, height: H } = viewSize();
    setupCamera(this);
    overlay(this, 0.9, 0);
    const w = WORLDS[data.world];
    const first = data.world === 0;

    const rows: { icon: () => Phaser.GameObjects.GameObject; text: string }[] = [];
    const icon = (key: string, scale = 2) => () => this.add.sprite(0, 0, key, 0).setScale(scale);
    if (first) {
      rows.push({ icon: icon(`player_${data.character}`), text: data.touch ? 'Drag your finger anywhere to move.' : 'Move with WASD / arrow keys (or drag).' });
      rows.push({ icon: icon('ping', 3), text: 'You shoot all by yourself. Just move and dodge!' });
      rows.push({ icon: icon('bolt'), text: 'Battery = your life. Grab yellow bolts to recharge.' });
      rows.push({ icon: icon('gem'), text: 'Blue gems fill the top bar. Full bar = pick a new power!' });
      rows.push({ icon: icon('chip'), text: `Special: ${w.event.howTo}` });
    } else {
      rows.push({ icon: icon(w.event.kind === 'golden' ? 'friend_gold' : 'fly'), text: `Special: ${w.event.howTo}` });
      rows.push({ icon: icon(w.enemies[w.enemies.length - 1].id === 'note' ? 'glitter' : 'poop'), text: w.tip });
      rows.push({ icon: icon('bolt'), text: 'Remember: yellow bolts recharge your battery.' });
    }

    // Build rows first (heights depend on wrapped text), then centre the whole block.
    const items: { ic: Phaser.GameObjects.Sprite; t: Phaser.GameObjects.Text; h: number }[] = rows.map((r) => {
      const ic = r.icon() as Phaser.GameObjects.Sprite;
      const t = text(this, 40, 0, r.text, { size: 8, maxWidth: W - 50, originY: 0.5 });
      return { ic, t, h: Math.max(26, t.height + 10) };
    });
    const goalH = 56;
    const rowsH = items.reduce((a, it) => a + it.h, 0);
    const blockH = 40 + rowsH + 8 + goalH + 10 + 30;
    let y = Math.max(8, Math.round((H - blockH) / 2));

    text(this, W / 2, y, `WORLD ${data.world + 1} OF ${WORLDS.length}`, { align: 'center', size: 7, color: 'g', bold: true });
    text(this, W / 2, y + 10, w.name, { align: 'center', size: 15, color: 'y', bold: true });
    y += 40;

    for (const it of items) {
      it.ic.setPosition(22, y + it.h / 2);
      it.t.setY(Math.round(y + it.h / 2));
      y += it.h;
    }
    y += 8;

    // Goal box
    const g = this.add.graphics();
    g.fillStyle(0x2a9d55, 0.25).fillRoundedRect(8, y, W - 16, goalH, 5);
    g.lineStyle(1, 0x78e048, 0.8).strokeRoundedRect(8, y, W - 16, goalH, 5);
    text(this, 16, y + 6, 'HOW TO WIN', { size: 7, bold: true, color: 'l' });
    this.add.sprite(W - 30, y + goalH / 2, w.boss.sprite, 0).setScale(w.boss.radius > 10 ? 1 : 1.2);
    text(this, 16, y + 18, `Survive ${w.duration} seconds, then beat ${w.boss.name}!`, {
      size: 8, bold: true, maxWidth: W - 74,
    });
    y += goalH + 10;

    let ready = false;
    this.time.delayedCall(400, () => (ready = true));
    const go = () => {
      if (!ready) return;
      audio.sfx('select');
      this.scene.stop();
      data.onGo();
    };
    button(this, W / 2, y + 14, "LET'S GO!", go, { w: 130, h: 28, color: 0x2a9d55, size: 10 });
    this.input.keyboard?.once('keydown-SPACE', go);
    this.input.keyboard?.once('keydown-ENTER', go);
  }
}
