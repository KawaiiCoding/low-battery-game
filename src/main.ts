import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import Phaser from 'phaser';
import { BG_COLOR, VIEW, VIEW_W, computeViewHeight, computeZoom } from './game/constants';
import { audio } from './game/audio';
import { loadSave } from './game/save';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { StoryScene } from './scenes/StoryScene';
import { GameScene } from './scenes/GameScene';
import { LevelUpScene } from './scenes/LevelUpScene';
import { PauseScene } from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';
import { BriefScene } from './scenes/BriefScene';

async function start() {
  const parent = document.getElementById('game')!;
  const cssW = parent.clientWidth || window.innerWidth;
  const cssH = parent.clientHeight || window.innerHeight;
  VIEW.h = computeViewHeight(cssW, cssH);
  VIEW.zoom = computeZoom(cssW, cssH, VIEW.h, window.devicePixelRatio || 1);

  // Make sure the font is ready before any text is drawn (it is bundled, so this is fast & offline).
  try {
    await Promise.race([
      Promise.all([document.fonts.load('8px "Pixelify Sans"'), document.fonts.load('bold 8px "Pixelify Sans"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to the system font */
  }

  audio.setMuted(loadSave().muted);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: BG_COLOR,
    pixelArt: true,
    antialias: false,
    audio: { noAudio: true },
    input: { activePointers: 3 },
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: VIEW_W * VIEW.zoom,
      height: VIEW.h * VIEW.zoom,
    },
    scene: [BootScene, TitleScene, StoryScene, GameScene, LevelUpScene, PauseScene, GameOverScene, BriefScene],
  });

  // Browsers only allow audio after a user gesture (iOS needs it inside the handler).
  const unlock = () => audio.unlock();
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.resume()));
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  if (new URLSearchParams(location.search).has('test')) {
    (window as unknown as { __LB: unknown }).__LB = { game, view: VIEW };
  }
}

void start();
