import Phaser from 'phaser';
import { audio } from '../game/audio';
import { updateSave } from '../game/save';
import { button, overlay, setupCamera, text, viewSize } from '../ui/ui';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const { width: W, height: H } = viewSize();
    setupCamera(this);
    overlay(this, 0.85, 0);
    text(this, W / 2, H / 2 - 76, 'PAUSED', { align: 'center', size: 16, bold: true, color: 'y' });

    const resume = () => {
      this.scene.stop();
      this.scene.resume('Game');
    };
    button(this, W / 2, H / 2 - 34, 'RESUME', resume, { w: 124, h: 26, color: 0x2a9d55 });
    const snd = button(this, W / 2, H / 2 - 2, audio.isMuted ? 'SOUND: OFF' : 'SOUND: ON', () => {
      audio.setMuted(!audio.isMuted);
      updateSave({ muted: audio.isMuted });
      snd.label.setText(audio.isMuted ? 'SOUND: OFF' : 'SOUND: ON');
    }, { w: 124, h: 22, color: 0x4a4868, size: 7 });
    button(this, W / 2, H / 2 + 26, 'QUIT TO TITLE', () => {
      this.scene.stop('Game');
      this.scene.stop();
      this.scene.start('Title');
    }, { w: 124, h: 22, color: 0xb03048, size: 7 });
    text(this, W / 2, H / 2 + 48, 'Progress saves at the start of each world', {
      align: 'center', color: 'g', size: 6, maxWidth: 150,
    });

    this.input.keyboard?.once('keydown-ESC', resume);
    this.input.keyboard?.once('keydown-P', resume);
  }
}
