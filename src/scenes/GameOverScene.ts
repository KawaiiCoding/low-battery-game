import Phaser from 'phaser';
import { audio } from '../game/audio';
import { WORLDS } from '../game/data/worlds';
import type { RunState } from '../game/logic/run';
import type { Character } from '../game/save';
import { button, drawBattery, setupCamera, text, viewSize } from '../ui/ui';

export interface GameOverData {
  checkpoint: RunState;
  character: Character;
}

const QUIPS = [
  'Should have bought the big power bank.',
  'Your group chat will have to wait.',
  'Have you tried turning it off and on again?',
  'Low Power Mode was not enough.',
  'No signal, no battery, no problem. Try again!',
];

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const { width: W, height: H } = viewSize();
    audio.playMusic(null);
    setupCamera(this).fadeIn(400);
    const top = Math.round(H * 0.16);
    const bat = this.add.graphics().setScale(4).setPosition(W / 2 - 36, top);
    let on = true;
    drawBattery(bat, 0, 0, 0);
    this.time.addEvent({ delay: 700, loop: true, callback: () => { on = !on; bat.setAlpha(on ? 1 : 0.4); } });
    text(this, W / 2, top + 46, '0%', { align: 'center', size: 24, bold: true, color: 'r' });
    text(this, W / 2, top + 80, 'Your phone died.', { align: 'center', size: 10, bold: true });
    text(this, W / 2, top + 98, Phaser.Utils.Array.GetRandom(QUIPS), { align: 'center', color: 'g', size: 8, maxWidth: 156 });

    const by = Math.max(top + 140, H - 96);
    const w = WORLDS[data.checkpoint.world];
    text(this, W / 2, by - 28, `Retry from ${w.name}`, { align: 'center', color: 'c', size: 8 });
    const go = (scene: string, d?: object) => {
      this.input.enabled = false;
      this.cameras.main.fadeOut(200);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene, d));
    };
    button(this, W / 2, by, 'PLUG IN AND RETRY', () => go('Game', { run: data.checkpoint, character: data.character }), {
      w: 140, h: 28, color: 0x2a9d55,
    });
    button(this, W / 2, by + 32, 'TITLE', () => go('Title'), { w: 140, h: 22, color: 0x4a4868, size: 7 });
  }
}
