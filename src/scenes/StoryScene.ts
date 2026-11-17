import Phaser from 'phaser';
import { audio, buzz } from '../game/audio';
import { STORIES, SPEAKER_NAMES, type Backdrop, type StoryId, type StoryLine } from '../game/data/story';
import { WORLDS } from '../game/data/worlds';
import type { RunState } from '../game/logic/run';
import type { Character } from '../game/save';
import { paginate } from '../game/textfit';
import { button, drawBattery, setColor, setupCamera, text, viewSize, type Button, type Txt } from '../ui/ui';

export interface StoryData {
  id: StoryId;
  run: RunState;
  character: Character;
}

const CHARS_PER_SEC = 45;
export const BOX_H = 92;
const HINT_ROOM = 14; // keep the ▶ hint clear of the text
const PAD_BOTTOM = 6;

export class StoryScene extends Phaser.Scene {
  private lines: StoryLine[] = [];
  private idx = -1;
  private data_!: StoryData;
  private backdrop!: Phaser.GameObjects.Container;
  private backdropId: Backdrop | null = null;
  private box!: Phaser.GameObjects.Container;
  private portrait!: Phaser.GameObjects.Sprite;
  private nameText!: Txt;
  private bodyText!: Txt;
  private hint!: Phaser.GameObjects.Triangle;
  private full = '';
  private pages: string[] = [];
  private page = 0;
  private shown = 0;
  private typing = false;
  private choice: Button | null = null;
  private finished = false;

  constructor() {
    super('Story');
  }

  init(data: StoryData): void {
    this.data_ = data;
    this.lines = STORIES[data.id];
    this.idx = -1;
    this.backdropId = null;
    this.choice = null;
    this.finished = false;
    this.typing = false;
    this.pages = [];
    this.page = 0;
  }

  create(): void {
    const { width: W, height: H } = viewSize();
    audio.playMusic('story');
    setupCamera(this).fadeIn(300, 15, 11, 30);
    this.backdrop = this.add.container(0, 0);

    // Dialogue box
    const bh = BOX_H;
    this.box = this.add.container(0, H - bh - 6).setDepth(10);
    const g = this.add.graphics();
    g.fillStyle(0x0b0816, 0.5).fillRoundedRect(4, 2, W - 8, bh, 5);
    g.fillStyle(0x6a6690).fillRoundedRect(4, 0, W - 8, bh, 5);
    g.fillStyle(0x1c1838).fillRoundedRect(5, 1, W - 10, bh - 2, 4);
    this.portrait = this.add.sprite(22, 24, 'chip', 0).setScale(2);
    this.nameText = text(this, 40, 5, '', { color: 'y', bold: true, size: 8 });
    this.bodyText = text(this, 40, 18, '', { size: 9 });
    this.hint = this.add.triangle(W - 14, bh - 9, 0, 0, 5, 3, 0, 6, 0xf2d680).setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0.35, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    this.box.add([g, this.portrait, this.nameText, this.bodyText, this.hint]);

    button(this, W - 22, 13, 'SKIP', () => this.finish(), { w: 34, h: 16, color: 0x4a4868, depth: 20, size: 7 });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());

    this.advance();
  }

  update(_t: number, dtMs: number): void {
    if (!this.typing) return;
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.full.length, this.shown + (CHARS_PER_SEC * Math.min(dtMs, 100)) / 1000);
    const now = Math.floor(this.shown);
    if (now !== before) {
      this.bodyText.setText(this.full.slice(0, now));
      if (now % 2 === 0 && /[A-Za-z0-9]/.test(this.full[now - 1] ?? '')) audio.sfx('type');
    }
    if (this.shown >= this.full.length) this.stopTyping();
  }

  private stopTyping() {
    this.typing = false;
    this.bodyText.setText(this.full);
    this.hint.setVisible(true);
  }

  /** Advances: completes the current line, or shows the next one. */
  advance(): void {
    if (this.finished || this.choice) return;
    if (this.typing) {
      this.stopTyping();
      return;
    }
    if (this.page < this.pages.length - 1) {
      this.page++;
      this.startTyping();
      return;
    }
    this.idx++;
    if (this.idx >= this.lines.length) {
      this.finish();
      return;
    }
    this.showLine(this.lines[this.idx]);
  }

  private showLine(line: StoryLine) {
    const { width: W } = viewSize();
    if (line.backdrop && line.backdrop !== this.backdropId) this.drawBackdrop(line.backdrop);

    if (line.who === 'choice') {
      this.box.setVisible(false);
      const { height: H } = viewSize();
      this.choice = button(this, W / 2, H - 50, line.text.toUpperCase(), () => {
        buzz(30);
        this.choice?.destroy();
        this.choice = null;
        this.box.setVisible(true);
        this.advance();
      }, { w: 120, h: 30, color: 0x2a9d55, depth: 30 });
      this.tweens.add({ targets: this.choice.container, scale: 1.08, yoyo: true, repeat: -1, duration: 500 });
      return;
    }

    if ('shake' in line && line.shake) {
      this.cameras.main.shake(300, 0.01);
      buzz([60, 40, 60]);
    }

    const narrator = line.who === 'narrator';
    this.portrait.setVisible(!narrator);
    if (!narrator) {
      const key = line.who === 'you' ? `player_${this.data_.character}` : line.who;
      this.portrait.setTexture(key, 0);
      this.portrait.anims.stop();
      if (this.anims.exists(`${key}-anim`)) this.portrait.play(`${key}-anim`);
    }
    const x = narrator ? 12 : 40;
    const y = narrator ? 9 : 18;
    this.nameText.setX(x);
    this.nameText.setText(SPEAKER_NAMES[line.who]);
    this.bodyText.setX(x).setY(y);
    setColor(this.bodyText, narrator ? 'y' : 'w');
    // Wrap with the real font metrics, then split into pages that fit the box: text never spills out.
    this.bodyText.setLetterSpacing(0);
    this.bodyText.setWordWrapWidth(W - x - HINT_ROOM, true);
    const wrapped = this.bodyText.getWrappedText(line.text);
    this.pages = paginate(wrapped, this.linesThatFit(BOX_H - y - PAD_BOTTOM));
    this.page = 0;
    this.startTyping();
  }

  /** How many lines of body text fit in `avail` logical pixels (measured with the real font). */
  private linesThatFit(avail: number): number {
    const prev = this.bodyText.text;
    this.bodyText.setText('Ag');
    const one = this.bodyText.height;
    this.bodyText.setText('Ag\nAg');
    const step = this.bodyText.height - one;
    this.bodyText.setText(prev);
    return Math.max(1, 1 + Math.floor((avail - one) / step));
  }

  private startTyping() {
    this.full = this.pages[this.page];
    this.shown = 0;
    this.bodyText.setText('');
    this.typing = true;
    this.hint.setVisible(false);
  }

  private drawBackdrop(id: Backdrop) {
    this.backdropId = id;
    this.backdrop.removeAll(true);
    const { width: W, height: H } = viewSize();
    const add = (o: Phaser.GameObjects.GameObject) => this.backdrop.add(o);
    const g = this.add.graphics();
    add(g);
    const areaH = H - BOX_H - 6;

    const worldBg = (wid: string) => add(this.add.tileSprite(0, 0, W, H, `bg-${wid}`).setOrigin(0));

    switch (id) {
      case 'bedroom-night':
      case 'bedroom-morning': {
        const morning = id === 'bedroom-morning';
        g.fillStyle(morning ? 0x6a4a6a : 0x141a3a).fillRect(0, 0, W, H);
        g.fillStyle(morning ? 0x8a5a6a : 0x1c2450).fillRect(0, areaH * 0.62, W, H);
        // window
        const wx = W / 2 - 34, wy = 24;
        g.fillStyle(0x1a1028).fillRect(wx - 2, wy - 2, 72, 56);
        g.fillStyle(morning ? 0xf89838 : 0x0b0f24).fillRect(wx, wy, 68, 52);
        if (morning) {
          g.fillStyle(0xf8e858).fillCircle(wx + 46, wy + 30, 10);
        } else {
          g.fillStyle(0xf4f4f4).fillCircle(wx + 48, wy + 16, 7);
          g.fillStyle(0x0b0f24).fillCircle(wx + 51, wy + 14, 6);
          for (let i = 0; i < 8; i++) g.fillStyle(0xf4f4f4).fillRect(wx + 4 + ((i * 23) % 60), wy + 6 + ((i * 17) % 40), 1, 1);
        }
        g.fillStyle(0x1a1028).fillRect(wx + 33, wy, 2, 52).fillRect(wx, wy + 25, 68, 2);
        // bed
        const by = areaH * 0.62;
        g.fillStyle(0x24306e).fillRect(8, by - 6, 104, 30);
        g.fillStyle(0xf4f4f4).fillRect(10, by - 12, 26, 10);
        g.fillStyle(0x9850e8).fillRect(36, by - 10, 76, 18);
        // nightstand + phone
        g.fillStyle(0x6a3a2a).fillRect(124, by - 2, 34, 26);
        g.fillStyle(0x1a1028).fillRect(134, by - 8, 14, 6);
        const glow = this.add.rectangle(141, by - 5, 12, 4, morning ? 0x78e048 : 0xe8384f);
        add(glow);
        this.tweens.add({ targets: glow, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 });
        const bat = this.add.graphics();
        bat.setScale(2).setPosition(W / 2 - 17, areaH * 0.62 + 34);
        drawBattery(bat, 0, 0, morning ? 100 : 1);
        add(bat);
        add(text(this, W / 2, areaH * 0.62 + 56, morning ? '100%' : '1%', { align: 'center', color: morning ? 'l' : 'r', size: 14, bold: true }));
        break;
      }
      case 'phone': {
        g.fillStyle(0x2a3a1a).fillRect(0, 0, W, H);
        g.fillStyle(0x3a5a22);
        for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
        for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
        const chip = this.add.sprite(W / 2, areaH * 0.42, 'chip', 0).setScale(5).play('chip-anim');
        add(chip);
        this.tweens.add({ targets: chip, y: chip.y - 6, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.inOut' });
        const hero = this.add.sprite(W / 2, areaH * 0.45 + 70, `player_${this.data_.character}`, 0).setScale(3);
        add(hero);
        hero.y = Math.min(hero.y, areaH - 22);
        break;
      }
      case 'dialup':
        worldBg(WORLDS[0].id);
        add(this.add.sprite(W / 2, areaH * 0.4, 'modem', 0).setScale(3).setAlpha(0.5).setAngle(-12));
        break;
      case 'profile':
        worldBg(WORLDS[1].id);
        add(this.add.sprite(W / 2, areaH * 0.4, 'heart', 0).setScale(3).setAlpha(0.5));
        break;
      case 'petsim': {
        worldBg(WORLDS[2].id);
        const pet = this.add.sprite(W / 2, areaH * 0.42, 'pet', 0).setScale(3).play('pet-anim');
        add(pet);
        this.tweens.add({ targets: pet, y: pet.y - 4, yoyo: true, repeat: -1, duration: 600 });
        break;
      }
      case 'voicemail': {
        g.fillStyle(0x0f0b1e).fillRect(0, 0, W, H);
        const env = this.add.sprite(W / 2, areaH * 0.38, 'spam', 0).setScale(5);
        add(env);
        this.tweens.add({ targets: env, scale: 5.5, yoyo: true, repeat: -1, duration: 600 });
        add(text(this, W / 2, areaH * 0.38 + 34, '1 new message', { align: 'center', color: 'c', size: 10, bold: true }));
        add(this.add.sprite(W / 2 + 40, areaH * 0.38 - 26, 'mom', 0).setScale(2));
        break;
      }
    }
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.typing = false;
    const { run, character } = this.data_;
    if (this.data_.id === 'ending') {
      this.showTheEnd();
      return;
    }
    this.cameras.main.fadeOut(250, 15, 11, 30);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game', { run, character }));
  }

  private showTheEnd(): void {
    const { width: W, height: H } = viewSize();
    this.choice?.destroy();
    this.choice = null;
    this.box.setVisible(false);
    this.children.list.filter((o) => o instanceof Phaser.GameObjects.Container && o !== this.box && o !== this.backdrop).forEach((o) => o.destroy());
    this.drawBackdrop('bedroom-morning');
    audio.playMusic('title');
    const panel = this.add.rectangle(0, 0, W, H, 0x0f0b1e, 0.82).setOrigin(0).setDepth(40);
    panel.setInteractive();
    const r = this.data_.run;
    const secs = Math.round(r.timeMs / 1000);
    text(this, W / 2, H * 0.18, 'THE END', { align: 'center', size: 24, bold: true, color: 'y', depth: 41 });
    text(this, W / 2, H * 0.18 + 32, 'Call your mom. ~', { align: 'center', color: 'm', size: 9, depth: 41 });
    text(this, W / 2, H * 0.4, `Time  ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}\nKills  ${r.kills}\nLevel  ${r.level}`, {
      align: 'center', depth: 41, size: 9,
    });
    text(this, W / 2, H * 0.6, 'Thanks for playing!', { align: 'center', color: 'c', size: 9, depth: 41 });
    button(this, W / 2, H * 0.74, 'PLAY AGAIN', () => this.scene.start('Title'), { w: 120, h: 24, color: 0x2a9d55, depth: 42 });
  }
}
