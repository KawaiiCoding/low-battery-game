import Phaser from 'phaser';
import { audio } from '../game/audio';
import { loadSave, updateSave, type Character } from '../game/save';
import { WORLDS } from '../game/data/worlds';
import { newRun, type RunState } from '../game/logic/run';
import { button, drawBattery, overlay, setupCamera, text, viewSize } from '../ui/ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width: W, height: H } = viewSize();
    const save = loadSave();
    setupCamera(this).fadeIn(300, 15, 11, 30);
    audio.playMusic('title');

    // Background + slowly drifting pixels
    this.add.tileSprite(0, 0, W, H, 'bg-dialup').setOrigin(0).setAlpha(0.5);
    for (let i = 0; i < 20; i++) {
      const s = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), Phaser.Utils.Array.GetRandom(['px-c', 'px-m', 'px-y'])).setAlpha(0.35);
      this.tweens.add({ targets: s, y: s.y - H, duration: Phaser.Math.Between(9000, 16000), repeat: -1, onRepeat: () => (s.y = H + 4) });
    }

    // ---- Header (top)
    const top = Math.round(Math.max(16, H * 0.07));
    text(this, W / 2, top, 'LOW', { align: 'center', size: 24, bold: true });
    text(this, W / 2, top + 28, 'BATTERY', { align: 'center', size: 24, bold: true, color: 'y' });
    text(this, W / 2, top + 60, 'A tiny adventure inside\nyour old phone', { align: 'center', color: 'g', size: 8 });
    const headerBottom = top + 86;

    // ---- Buttons (bottom)
    const footer = 26;
    const btnBlock = (save.checkpoint ? 30 + 6 : 0) + 24 + 6 + 20;
    const btnTop = H - footer - btnBlock;
    let by = btnTop;
    if (save.checkpoint) {
      const cp = save.checkpoint;
      button(this, W / 2, by + 15, 'CONTINUE', () => this.startGame(cp, save.character), {
        w: 140, h: 30, color: 0x2a9d55, sub: `World ${cp.world + 1}: ${WORLDS[cp.world]?.name ?? ''}`,
      });
      by += 36;
    }
    button(this, W / 2, by + 12, 'NEW GAME', () => this.chooseCharacter(), { w: 140, h: 24, color: 0x3868e8 });
    by += 30;
    const sound = button(this, W / 2, by + 10, audio.isMuted ? 'SOUND: OFF' : 'SOUND: ON', () => {
      audio.setMuted(!audio.isMuted);
      updateSave({ muted: audio.isMuted });
      sound.label.setText(audio.isMuted ? 'SOUND: OFF' : 'SOUND: ON');
    }, { w: 140, h: 20, color: 0x4a4868, size: 7 });

    if (save.cleared) text(this, W / 2, H - 22, '~ you called Mom ~', { align: 'center', color: 'm', size: 7 });
    text(this, W / 2, H - 11, 'v0.1', { align: 'center', color: 'g', size: 6 }).setAlpha(0.6);

    // ---- Hero row (centred between header and buttons)
    const rowY = Math.round((headerBottom + btnTop) / 2);
    const hero = this.add.sprite(W / 2 - 40, rowY, `player_${save.character}`, 0).setScale(3).play(`player_${save.character}-anim`);
    const chip = this.add.sprite(W / 2 + 4, rowY - 2, 'chip', 0).setScale(2).play('chip-anim');
    this.tweens.add({ targets: chip, y: chip.y - 4, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.inOut' });
    this.tweens.add({ targets: hero, y: hero.y - 2, yoyo: true, repeat: -1, duration: 400, ease: 'Sine.inOut' });
    const bat = this.add.graphics().setScale(2).setPosition(W / 2 + 26, rowY - 14);
    const pct = text(this, W / 2 + 44, rowY + 4, '1%', { align: 'center', color: 'r', size: 9, bold: true });
    let on = true;
    drawBattery(bat, 0, 0, 1, on);
    this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        on = !on;
        bat.clear();
        drawBattery(bat, 0, 0, 1, on);
        pct.setAlpha(on ? 1 : 0.4);
      },
    });
  }

  private chooseCharacter(): void {
    const { width: W, height: H } = viewSize();
    const layer: Phaser.GameObjects.GameObject[] = [];
    // Hide the title content underneath so nothing shows through.
    const under = this.children.list.filter((o) => o.type !== 'TileSprite' && o.type !== 'Image') as unknown as Phaser.GameObjects.Components.Visible[];
    under.forEach((o) => o.setVisible(false));
    layer.push(overlay(this, 0.6, 100));
    layer.push(text(this, W / 2, H / 2 - 82, 'Who are you?', { align: 'center', size: 14, bold: true, color: 'y', depth: 101 }));

    const pick = (c: Character) => {
      updateSave({ character: c });
      this.startGame(newRun(), c, true);
    };
    const opts: [Character, string, number, number][] = [
      ['male', 'MALE', W / 2 - 40, 0x6a4ab0],
      ['female', 'FEMALE', W / 2 + 40, 0xc06a30],
    ];
    for (const [c, label, x, color] of opts) {
      const card = button(this, x, H / 2, '', () => pick(c), { w: 72, h: 96, color, depth: 101 });
      const s = this.add.sprite(0, -10, `player_${c}`, 0).setScale(4).play(`player_${c}-anim`);
      const l = text(this, 0, 28, label, { align: 'center', bold: true, originY: 0.5 });
      card.container.add([s, l]);
      layer.push(card.container);
    }
    const back = button(this, W / 2, H / 2 + 70, 'BACK', () => {
      layer.forEach((o) => o.destroy());
      under.forEach((o) => o.setVisible(true));
    }, {
      w: 80, h: 20, color: 0x4a4868, depth: 101, size: 7,
    });
    layer.push(back.container);
  }

  private startGame(run: RunState, character: Character, fresh = false): void {
    this.input.enabled = false;
    this.cameras.main.fadeOut(250, 15, 11, 30);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (fresh) this.scene.start('Story', { id: 'intro', run, character });
      else this.scene.start('Game', { run, character });
    });
  }
}
