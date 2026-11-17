import Phaser from 'phaser';
import { audio, buzz } from '../game/audio';
import { ENEMIES, WORLDS, pickEnemy, spawnRate, type EnemyDef, type EnemyId, type Pattern, type WorldDef } from '../game/data/worlds';
import { CHARGER_HEAL, computeStats, getUpgrade, rollOffers, xpToNext, type Stats } from '../game/data/upgrades';
import { addXp, clampBattery, cloneRun, displayBattery, type RunState } from '../game/logic/run';
import { loadSave, updateSave, type Character } from '../game/save';
import type { SpriteKey } from '../game/sprites';
import { Joystick } from '../ui/joystick';
import { button, drawBattery, fitWidth, setColor, setupCamera, text, viewSize, type Txt } from '../ui/ui';
import type { LevelUpData } from './LevelUpScene';

type Phase = 'waves' | 'boss' | 'clear' | 'dead';
type ESprite = Phaser.Physics.Arcade.Sprite;
type EImage = Phaser.Physics.Arcade.Image;

interface EnemyState {
  uid: number;
  def: EnemyDef;
  id: EnemyId;
  hp: number;
  mode: 'move' | 'wind' | 'dash' | 'rest';
  t: number;
  cd: number;
  seed: number;
  kbx: number;
  kby: number;
  dashX: number;
  dashY: number;
  flashUntil: number;
  orbitHitAt: number;
  shadow: Phaser.GameObjects.Image;
}

interface PingState {
  pierce: number;
  hits: Set<number>;
  born: number;
}

interface Pickup {
  img: Phaser.GameObjects.Image;
  kind: 'gem' | 'bolt';
  value: number;
  pulled: boolean;
  speed: number;
}

interface BossState {
  sprite: ESprite;
  hp: number;
  maxHp: number;
  mode: 'enter' | 'fight' | 'wind' | 'charge' | 'dying';
  t: number;
  patternTimer: number;
  patternIdx: number;
  enraged: boolean;
  flashUntil: number;
  orbitHitAt: number;
  shadow: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
}

/** Thickness of the visible arena wall, and how far sprites overhang their physics body. */
const WALL = 6;
const OVERHANG = 3;
const INSET = WALL + OVERHANG;

const ENEMY_COLOR: Record<EnemyId, string> = {
  spam: 'w', popup: 'b', virus: 'l', glitter: 'y', friend: 'c', note: 'm', blob: 'l', fly: 'g', poop: 'n',
};

export interface GameData {
  run: RunState;
  character: Character;
}

export class GameScene extends Phaser.Scene {
  private run!: RunState;
  private checkpoint!: RunState;
  private character: Character = 'male';
  private world!: WorldDef;
  private stats!: Stats;
  private battery = 100;
  private phase: Phase = 'waves';
  private elapsed = 0;
  private spawnAcc = 0;
  private fireAcc = 0;
  private boltTimer = 0;
  private lowBeep = 0;
  private invulnUntil = 0;
  private uid = 0;
  private now = 0;
  private pendingLevelUps = 0;
  private levelUpOpen = false;
  private clearTimer = -1;
  private WW = 0;
  private WH = 0;

  private player!: ESprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private enemies!: Phaser.Physics.Arcade.Group;
  private pings!: Phaser.Physics.Arcade.Group;
  private ebullets!: Phaser.Physics.Arcade.Group;
  private pickups: Pickup[] = [];
  private orbiters: Phaser.GameObjects.Image[] = [];
  private orbitAngle = 0;
  private boss: BossState | null = null;
  private bossColliders: Phaser.Physics.Arcade.Collider[] = [];
  private emitters: Record<string, Phaser.GameObjects.Particles.ParticleEmitter> = {};
  private estate = new WeakMap<Phaser.GameObjects.GameObject, EnemyState>();
  private pstate = new WeakMap<Phaser.GameObjects.GameObject, PingState>();

  private joy!: Joystick;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};

  // HUD
  private hud!: Phaser.GameObjects.Graphics;
  private batText!: Txt;
  private lvText!: Txt;
  private barLabel!: Txt;
  private lastHud = '';
  private briefPending = true;
  private toastObj: Phaser.GameObjects.Container | null = null;
  private tips = new Set<string>();
  private bossArrow!: Phaser.GameObjects.Triangle;
  private danger!: Phaser.GameObjects.Graphics;
  private hint: Txt | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameData): void {
    this.run = cloneRun(data.run);
    this.checkpoint = cloneRun(data.run);
    this.character = data.character ?? loadSave().character;
    this.world = WORLDS[Math.min(this.run.world, WORLDS.length - 1)];
    this.stats = computeStats(this.run.upgrades);
    this.battery = 100;
    this.phase = 'waves';
    this.elapsed = 0;
    this.spawnAcc = 0;
    this.fireAcc = 0;
    this.boltTimer = 0;
    this.lowBeep = 0;
    this.invulnUntil = 0;
    this.pendingLevelUps = 0;
    this.levelUpOpen = false;
    this.clearTimer = -1;
    this.pickups = [];
    this.orbiters = [];
    this.boss = null;
    this.bossColliders = [];
    this.emitters = {};
    this.estate = new WeakMap();
    this.pstate = new WeakMap();
    this.hint = null;
    this.briefPending = true;
    this.toastObj = null;
    this.tips = new Set();
    updateSave({ checkpoint: cloneRun(this.checkpoint), character: this.character });
  }

  create(): void {
    const { width: W, height: H } = viewSize();
    this.WW = W * 2;
    this.WH = Math.round(H * 1.8);
    this.physics.resume();
    // Physics bounds sit inside the visible wall so sprites can never poke past it.
    this.physics.world.setBounds(INSET, INSET, this.WW - INSET * 2, this.WH - INSET * 2);
    setupCamera(this);
    this.cameras.main.fadeIn(300, 15, 11, 30);
    this.lastHud = '';

    this.add.tileSprite(0, 0, this.WW, this.WH, `bg-${this.world.id}`).setOrigin(0);
    const border = this.add.graphics().setDepth(16);
    border.fillStyle(0x0b0816);
    border.fillRect(0, 0, this.WW, WALL).fillRect(0, this.WH - WALL, this.WW, WALL);
    border.fillRect(0, 0, WALL, this.WH).fillRect(this.WW - WALL, 0, WALL, this.WH);
    border.lineStyle(1, this.world.bg.dot).strokeRect(WALL + 0.5, WALL + 0.5, this.WW - WALL * 2 - 1, this.WH - WALL * 2 - 1);

    const pkey = `player_${this.character}`;
    this.player = this.physics.add.sprite(this.WW / 2, this.WH / 2, pkey, 0).setDepth(50);
    this.player.setCircle(4, 2, 3);
    this.playerShadow = this.add.image(0, 0, 'shadow', 0).setAlpha(0.35).setDepth(15);
    this.player.setCollideWorldBounds(true);
    this.updateCamera(1);

    this.enemies = this.physics.add.group({ maxSize: this.world.maxAlive + 15 });
    this.pings = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 160 });
    this.ebullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 220 });

    this.physics.add.overlap(this.pings, this.enemies, (a, b) => this.onPingHitEnemy(a as EImage, b as ESprite));
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.onTouchEnemy(e as ESprite));
    this.physics.add.overlap(this.player, this.ebullets, (_p, b) => this.onBulletHitPlayer(b as EImage));
    this.physics.add.collider(this.enemies, this.enemies);

    for (const c of new Set([...Object.values(ENEMY_COLOR), 'y', 'w', 'c', 'r', 'o', 'm'])) {
      this.emitters[c] = this.add
        .particles(0, 0, `px-${c}`, {
          speed: { min: 25, max: 90 },
          lifespan: { min: 200, max: 500 },
          scale: { start: 1, end: 0 },
          emitting: false,
        })
        .setDepth(60);
    }

    this.rebuildOrbiters();
    this.joy = new Joystick(this, 22, 24);
    this.joy.onFirstUse = () => this.dismissHint();
    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
      kb.on('keydown-ESC', () => this.openPause());
      kb.on('keydown-P', () => this.openPause());
    }

    this.createHud();
    audio.playMusic(this.world.music);
    void W;
    void H;

    // Mobile: pause when the app goes to the background.
    const onHide = () => this.openPause();
    this.game.events.on(Phaser.Core.Events.BLUR, onHide);
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHide);
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.joy.reset());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, onHide);
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHide);
    });
  }

  /** Shows the mission card (game paused) before the world starts. */
  private showBrief() {
    this.joy.reset();
    this.scene.pause();
    this.scene.launch('Brief', {
      world: this.run.world,
      character: this.character,
      touch: this.sys.game.device.input.touch,
      onGo: () => {
        this.scene.resume();
        this.startIntro();
      },
    });
  }

  private startIntro() {
    const { width: W, height: H } = viewSize();
    this.banner(this.world.name.toUpperCase(), `Survive ${this.world.duration}s, then beat the boss!`);
    const touch = this.sys.game.device.input.touch;
    this.hint = text(this, W / 2, H - 44, touch ? 'Drag anywhere to move' : 'WASD / arrows or drag to move', {
      align: 'center', color: 'c', fixed: true, depth: 1000, size: 9, bold: true,
    });
    this.tweens.add({ targets: this.hint, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
    this.time.delayedCall(6000, () => this.dismissHint());
  }

  /** A friendly one-time tip at the bottom of the screen. */
  private tip(id: string, msg: string, color: 'w' | 'y' | 'c' | 'r' = 'w') {
    if (this.tips.has(id)) return;
    this.tips.add(id);
    this.toast(msg, color);
  }

  private toast(msg: string, color: 'w' | 'y' | 'c' | 'r' = 'w') {
    const { width: W, height: H } = viewSize();
    this.toastObj?.destroy();
    const t = text(this, 0, 0, msg, { align: 'center', size: 8, bold: true, color, maxWidth: W - 28, originY: 0.5 });
    const bg = this.add.rectangle(0, 0, W - 16, t.height + 10, 0x0b0816, 0.85).setStrokeStyle(1, 0x6a6690);
    const c = this.add.container(W / 2, H - 30 - t.height / 2, [bg, t]).setScrollFactor(0).setDepth(1050).setAlpha(0);
    this.toastObj = c;
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.tweens.add({
      targets: c, alpha: 0, delay: 3800, duration: 300,
      onComplete: () => {
        if (this.toastObj === c) this.toastObj = null;
        c.destroy();
      },
    });
  }

  // ===================================================================== update
  update(_time: number, deltaMs: number): void {
    if (this.briefPending) {
      this.briefPending = false;
      this.showBrief();
      return;
    }
    const dt = Math.min(deltaMs, 50) / 1000;
    this.now += dt * 1000;
    if (this.phase === 'waves' || this.phase === 'boss') this.run.timeMs += dt * 1000;

    this.updatePlayer(dt);
    this.updateCamera(dt);
    this.updateEnemies(dt);
    if (this.boss) this.updateBoss(dt);
    this.updateOrbiters(dt);
    this.updatePickups(dt);
    this.updateBullets();

    if (this.phase === 'waves' || this.phase === 'boss') {
      this.battery = clampBattery(this.battery - this.stats.drainPerSec * dt);
      this.updateFiring(dt);
      this.boltTimer += dt;
      if (this.boltTimer >= 11) {
        this.boltTimer = 0;
        const a = Math.random() * Math.PI * 2;
        this.dropPickup(this.player.x + Math.cos(a) * 50, this.player.y + Math.sin(a) * 50, 'bolt', this.stats.boltHeal);
        this.tip('bolt', 'A yellow bolt appeared! Walk over it to recharge ^', 'y');
      }
      if (this.battery <= 35) this.tip('low', 'Battery getting low! Grab yellow bolts to recharge.', 'r');
      if (this.battery <= 20) {
        this.lowBeep -= dt;
        if (this.lowBeep <= 0) {
          audio.sfx('lowbat');
          this.lowBeep = 4;
        }
      }
      if (this.battery <= 0) this.die();
    }

    if (this.phase === 'waves') {
      this.elapsed += dt;
      const t = this.elapsed;
      this.spawnAcc += spawnRate(this.world, t) * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (this.enemies.countActive(true) < this.world.maxAlive) this.spawnEnemy(pickEnemy(this.world, t));
      }
      if (t >= this.world.duration) this.startBoss();
    } else if (this.phase === 'boss') {
      // light trickle of minions so it never feels empty
      this.spawnAcc += 0.35 * dt;
      if (this.spawnAcc >= 1) {
        this.spawnAcc = 0;
        if (this.enemies.countActive(true) < 12) this.spawnEnemy(this.world.enemies[0].id);
      }
    } else if (this.phase === 'clear' && this.clearTimer >= 0) {
      this.clearTimer -= dt;
      if (this.clearTimer < 0 && !this.levelUpOpen && this.pendingLevelUps === 0) this.finishWorld();
      else if (this.clearTimer < 0) this.clearTimer = 0.2;
    }

    this.drawHud();
  }

  // ===================================================================== camera
  /** Smoothly keeps the player centred, clamped to the arena (camera origin is top-left). */
  private updateCamera(dt: number) {
    const { width: W, height: H } = viewSize();
    const cam = this.cameras.main;
    const tx = Phaser.Math.Clamp(this.player.x - W / 2, 0, this.WW - W);
    const ty = Phaser.Math.Clamp(this.player.y - H / 2, 0, this.WH - H);
    const k = 1 - Math.exp(-dt * 12);
    cam.setScroll(cam.scrollX + (tx - cam.scrollX) * k, cam.scrollY + (ty - cam.scrollY) * k);
  }

  /** The part of the arena currently on screen, in world coordinates. */
  private viewRect() {
    const { width: W, height: H } = viewSize();
    return { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY, width: W, height: H };
  }

  // ===================================================================== player
  private readInput(): Phaser.Math.Vector2 {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.A?.isDown || k.LEFT?.isDown) x -= 1;
    if (k.D?.isDown || k.RIGHT?.isDown) x += 1;
    if (k.W?.isDown || k.UP?.isDown) y -= 1;
    if (k.S?.isDown || k.DOWN?.isDown) y += 1;
    if (x || y) {
      this.dismissHint();
      const l = Math.hypot(x, y);
      return new Phaser.Math.Vector2(x / l, y / l);
    }
    return this.joy.vec.clone();
  }

  private updatePlayer(_dt: number) {
    const p = this.player;
    if (this.phase === 'dead') {
      p.setVelocity(0, 0);
      return;
    }
    const v = this.readInput();
    p.setVelocity(v.x * this.stats.moveSpeed, v.y * this.stats.moveSpeed);
    const moving = v.lengthSq() > 0.01;
    if (moving) {
      if (!p.anims.isPlaying) p.play(`player_${this.character}-anim`);
      if (Math.abs(v.x) > 0.1) p.setFlipX(v.x < 0);
    } else if (p.anims.isPlaying) {
      p.anims.stop();
      p.setFrame(0);
    }
    this.playerShadow.setPosition(Math.round(p.x), Math.round(p.y + 7));
    const inv = this.now < this.invulnUntil;
    p.setAlpha(inv ? (Math.floor(this.now / 70) % 2 ? 0.3 : 1) : 1);
  }

  private hurt(amount: number) {
    if (this.phase === 'dead' || this.phase === 'clear' || this.now < this.invulnUntil) return;
    this.battery = clampBattery(this.battery - amount);
    this.invulnUntil = this.now + this.stats.invulnMs;
    this.cameras.main.shake(120, 0.006);
    audio.sfx('hurt');
    buzz(45);
    this.floatText(this.player.x, this.player.y - 10, `-${Math.round(amount)}%`, 'r');
  }

  private die() {
    if (this.phase === 'dead') return;
    this.phase = 'dead';
    this.dismissHint();
    audio.playMusic(null);
    audio.sfx('gameover');
    buzz([80, 60, 160]);
    this.physics.pause();
    this.player.setAlpha(1).setTintFill(0xffffff);
    // CRT "screen off" effect
    const { width: W, height: H } = viewSize();
    const topR = this.add.rectangle(0, 0, W, 0, 0x000000).setOrigin(0).setScrollFactor(0).setDepth(2000);
    const botR = this.add.rectangle(0, H, W, 0, 0x000000).setOrigin(0, 1).setScrollFactor(0).setDepth(2000);
    this.tweens.add({ targets: [topR, botR], height: H / 2 + 1, duration: 500, delay: 500, ease: 'Quad.in' });
    this.time.delayedCall(1500, () => {
      this.scene.stop('LevelUp');
      this.scene.start('GameOver', { checkpoint: this.checkpoint, character: this.character });
    });
  }

  // ===================================================================== firing
  private nearestTarget(): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = this.stats.range * this.stats.range;
    const px = this.player.x;
    const py = this.player.y;
    for (const o of this.enemies.getChildren()) {
      const e = o as ESprite;
      if (!e.active) continue;
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (this.boss && this.boss.mode !== 'dying' && this.boss.mode !== 'enter') {
      const b = this.boss.sprite;
      const d = (b.x - px) ** 2 + (b.y - py) ** 2;
      if (d < bestD * 1.5) best = b;
    }
    return best;
  }

  private updateFiring(dt: number) {
    this.fireAcc += dt * 1000;
    if (this.fireAcc < this.stats.fireDelay) return;
    const target = this.nearestTarget();
    if (!target) {
      this.fireAcc = this.stats.fireDelay;
      return;
    }
    this.fireAcc = 0;
    const base = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const n = this.stats.projectiles;
    const spread = 0.16;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      this.firePing(a);
    }
    audio.sfx('shoot');
  }

  private firePing(angle: number) {
    const b = this.pings.get(this.player.x, this.player.y, 'ping') as EImage | null;
    if (!b) return;
    b.enableBody(true, this.player.x, this.player.y, true, true);
    b.setDepth(40);
    b.setCircle(2);
    (b.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    b.setVelocity(Math.cos(angle) * this.stats.bulletSpeed, Math.sin(angle) * this.stats.bulletSpeed);
    this.pstate.set(b, { pierce: this.stats.pierce, hits: new Set(), born: this.now });
  }

  private onPingHitEnemy(b: EImage, e: ESprite) {
    if (!b.active || !e.active) return;
    const ps = this.pstate.get(b);
    const es = this.estate.get(e);
    if (!ps || !es || ps.hits.has(es.uid)) return;
    ps.hits.add(es.uid);
    const ang = Math.atan2(b.body!.velocity.y, b.body!.velocity.x);
    this.damageEnemy(e, this.stats.damage, Math.cos(ang) * 90, Math.sin(ang) * 90);
    if (ps.pierce-- <= 0) b.disableBody(true, true);
  }

  private onPingHitBoss(b: EImage) {
    if (!b.active || !this.boss) return;
    const ps = this.pstate.get(b);
    if (!ps || ps.hits.has(-1)) return;
    ps.hits.add(-1);
    this.damageBoss(this.stats.damage);
    b.disableBody(true, true);
  }

  // ===================================================================== enemies
  private spawnPoint(): { x: number; y: number } {
    const view = this.viewRect();
    const px = this.player.x;
    const py = this.player.y;
    const r = Math.hypot(view.width, view.height) / 2 + 14;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      if (x > INSET + 6 && y > INSET + 6 && x < this.WW - INSET - 6 && y < this.WH - INSET - 6) return { x, y };
    }
    // Fallback: the world corner furthest from the player.
    const m = INSET + 8;
    return { x: px < this.WW / 2 ? this.WW - m : m, y: py < this.WH / 2 ? this.WH - m : m };
  }

  spawnEnemy(id: EnemyId, at?: { x: number; y: number }): ESprite | null {
    const def = ENEMIES[id];
    const pos = at ?? this.spawnPoint();
    const e = this.enemies.get(pos.x, pos.y, def.sprite) as ESprite | null;
    if (!e) return null;
    e.enableBody(true, pos.x, pos.y, true, true);
    e.setTexture(def.sprite, 0).setDepth(30).setAlpha(1).clearTint();
    if (this.anims.exists(`${def.sprite}-anim`)) e.play({ key: `${def.sprite}-anim`, startFrame: Phaser.Math.Between(0, 1) });
    const body = e.body as Phaser.Physics.Arcade.Body;
    body.setCircle(def.radius, e.width / 2 - def.radius, e.height / 2 - def.radius);
    body.setCollideWorldBounds(true);
    body.setBounce(0);
    const scale = 1 + (this.phase === 'waves' ? (this.elapsed / this.world.duration) * 0.5 : 0.5);
    const shadow = this.estate.get(e)?.shadow ?? this.add.image(0, 0, 'shadow', 0).setAlpha(0.3).setDepth(14);
    shadow.setVisible(true);
    this.estate.set(e, {
      shadow,
      uid: ++this.uid,
      def,
      id,
      hp: def.hp * scale,
      mode: 'move',
      t: 0,
      cd: 1 + Math.random() * 1.5,
      seed: Math.random() * 10,
      kbx: 0,
      kby: 0,
      dashX: 0,
      dashY: 0,
      flashUntil: 0,
      orbitHitAt: 0,
    });
    return e;
  }

  private updateEnemies(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    const decay = Math.exp(-dt * 10);
    for (const o of this.enemies.getChildren()) {
      const e = o as ESprite;
      if (!e.active) continue;
      const s = this.estate.get(e);
      if (!s) continue;
      if (this.phase === 'dead') {
        e.setVelocity(0, 0);
        continue;
      }
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      let vx = 0;
      let vy = 0;
      const sp = s.def.speed;
      switch (s.def.behavior) {
        case 'chase':
          vx = ux * sp;
          vy = uy * sp;
          break;
        case 'zigzag': {
          const w = Math.sin(this.now / 160 + s.seed) * 0.9;
          vx = (ux - uy * w) * sp;
          vy = (uy + ux * w) * sp;
          break;
        }
        case 'dash':
          s.t -= dt;
          s.cd -= dt;
          if (s.mode === 'move') {
            vx = ux * sp;
            vy = uy * sp;
            if (d < 75 && s.cd <= 0) {
              s.mode = 'wind';
              s.t = 0.45;
            }
          } else if (s.mode === 'wind') {
            e.setAlpha(Math.floor(this.now / 50) % 2 ? 0.4 : 1);
            if (s.t <= 0) {
              s.mode = 'dash';
              s.t = 0.4;
              s.dashX = ux;
              s.dashY = uy;
              e.setAlpha(1);
              audio.sfx('dash');
            }
          } else if (s.mode === 'dash') {
            vx = s.dashX * sp * 4.5;
            vy = s.dashY * sp * 4.5;
            if (s.t <= 0) {
              s.mode = 'rest';
              s.t = 0.6;
            }
          } else if (s.t <= 0) {
            s.mode = 'move';
            s.cd = 1.2;
          }
          break;
        case 'shooter': {
          const k = d > 85 ? 1 : d < 60 ? -0.8 : 0;
          const side = Math.sin(this.now / 900 + s.seed) * 0.5;
          vx = (ux * k - uy * side) * sp;
          vy = (uy * k + ux * side) * sp;
          s.cd -= dt;
          if (s.cd <= 0 && d < 150) {
            s.cd = 3.4 + Math.random() * 1.5;
            this.fireEnemyBullet(e.x, e.y, Math.atan2(dy, dx), 50, s.def.bullet ?? 'bullet_r');
          }
          break;
        }
      }
      s.kbx *= decay;
      s.kby *= decay;
      e.setVelocity(vx + s.kbx, vy + s.kby);
      if (Math.abs(vx) > 2) e.setFlipX(vx < 0);
      s.shadow.setPosition(Math.round(e.x), Math.round(e.y + e.height / 2));
      if (s.flashUntil && this.now > s.flashUntil) {
        e.clearTint();
        s.flashUntil = 0;
      }
    }
  }

  private damageEnemy(e: ESprite, dmg: number, kbx: number, kby: number) {
    const s = this.estate.get(e);
    if (!s || !e.active) return;
    s.hp -= dmg;
    s.kbx += kbx;
    s.kby += kby;
    e.setTintFill(0xffffff);
    s.flashUntil = this.now + 60;
    if (s.hp <= 0) this.killEnemy(e, s, true);
    else audio.sfx('hit');
  }

  private killEnemy(e: ESprite, s: EnemyState, drops: boolean) {
    this.burst(e.x, e.y, ENEMY_COLOR[s.id], 8);
    audio.sfx('kill');
    if (drops) {
      this.run.kills++;
      this.dropPickup(e.x, e.y, 'gem', s.def.xp);
      const boltChance = this.battery < 20 ? 0.12 : this.battery < 40 ? 0.08 : 0.04;
      if (Math.random() < boltChance) this.dropPickup(e.x + 4, e.y, 'bolt', this.stats.boltHeal);
    }
    s.shadow.setVisible(false);
    e.disableBody(true, true);
  }

  private onTouchEnemy(e: ESprite) {
    const s = this.estate.get(e);
    if (!s || !e.active) return;
    if (this.now < this.invulnUntil) return;
    this.hurt(this.stats.hitDamage * s.def.contact);
    const a = Math.atan2(e.y - this.player.y, e.x - this.player.x);
    s.kbx += Math.cos(a) * 160;
    s.kby += Math.sin(a) * 160;
    if (s.mode === 'dash') {
      s.mode = 'rest';
      s.t = 0.6;
    }
  }

  // ===================================================================== bullets
  private fireEnemyBullet(x: number, y: number, angle: number, speed: number, tex: SpriteKey) {
    const b = this.ebullets.get(x, y, tex) as EImage | null;
    if (!b) return;
    b.enableBody(true, x, y, true, true);
    b.setTexture(tex).setDepth(45);
    b.setCircle(2, 0.5, 0.5);
    b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    b.setData('born', this.now);
    audio.sfx('eshoot');
  }

  private onBulletHitPlayer(b: EImage) {
    if (!b.active) return;
    if (this.now < this.invulnUntil) return;
    b.disableBody(true, true);
    this.hurt(this.stats.hitDamage * 0.5);
  }

  private updateBullets() {
    const margin = 20;
    for (const grp of [this.pings, this.ebullets]) {
      for (const o of grp.getChildren()) {
        const b = o as EImage;
        if (!b.active) continue;
        const born = grp === this.pings ? this.pstate.get(b)?.born ?? 0 : (b.getData('born') as number);
        if (this.now - born > (grp === this.pings ? 4000 : 3200) || b.x < -margin || b.y < -margin || b.x > this.WW + margin || b.y > this.WH + margin) {
          b.disableBody(true, true);
        }
      }
    }
  }

  // ===================================================================== orbiters
  private rebuildOrbiters() {
    this.orbiters.forEach((o) => o.destroy());
    this.orbiters = [];
    for (let i = 0; i < this.stats.orbiters; i++) this.orbiters.push(this.add.image(0, 0, 'orbiter').setDepth(49));
  }

  private updateOrbiters(dt: number) {
    if (!this.orbiters.length) return;
    this.orbitAngle += dt * 3.2;
    const R = 24;
    const n = this.orbiters.length;
    const dmg = Math.max(1, this.stats.damage * 0.8);
    this.orbiters.forEach((o, i) => {
      const a = this.orbitAngle + (i / n) * Math.PI * 2;
      o.setPosition(Math.round(this.player.x + Math.cos(a) * R), Math.round(this.player.y + Math.sin(a) * R));
      if (this.phase !== 'waves' && this.phase !== 'boss') return;
      for (const c of this.enemies.getChildren()) {
        const e = c as ESprite;
        if (!e.active) continue;
        const s = this.estate.get(e)!;
        if (this.now - s.orbitHitAt < 350) continue;
        if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 < (s.def.radius + 4) ** 2) {
          s.orbitHitAt = this.now;
          this.damageEnemy(e, dmg, Math.cos(a) * 60, Math.sin(a) * 60);
        }
      }
      const b = this.boss;
      if (b && b.mode !== 'enter' && b.mode !== 'dying' && this.now - b.orbitHitAt > 350) {
        const bd = this.world.boss.radius + 4;
        if ((b.sprite.x - o.x) ** 2 + (b.sprite.y - o.y) ** 2 < bd * bd) {
          b.orbitHitAt = this.now;
          this.damageBoss(dmg);
        }
      }
    });
  }

  // ===================================================================== pickups
  private dropPickup(x: number, y: number, kind: 'gem' | 'bolt', value: number) {
    x = Phaser.Math.Clamp(x, INSET + 4, this.WW - INSET - 4);
    y = Phaser.Math.Clamp(y, INSET + 4, this.WH - INSET - 4);
    if (kind === 'gem' && this.pickups.length > 160) {
      // Merge into an existing gem instead of piling up sprites.
      const g = this.pickups.find((p) => p.kind === 'gem');
      if (g) {
        g.value += value;
        return;
      }
    }
    const img = this.add.image(x, y, kind, 0).setDepth(20);
    if (this.anims.exists(`${kind}-anim`)) {
      // Images can't animate; use a tiny bob tween instead.
      this.tweens.add({ targets: img, y: y - 2, yoyo: true, repeat: -1, duration: 400 + Math.random() * 200 });
    }
    this.pickups.push({ img, kind, value, pulled: this.phase === 'clear', speed: 0 });
  }

  private updatePickups(dt: number) {
    if (this.phase === 'dead') return;
    const px = this.player.x;
    const py = this.player.y;
    const mag = this.stats.magnet;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const dx = px - p.img.x;
      const dy = py - p.img.y;
      const d = Math.hypot(dx, dy);
      if (!p.pulled && d < (p.kind === 'bolt' ? mag + 6 : mag)) {
        p.pulled = true;
        this.tweens.killTweensOf(p.img);
      }
      if (p.pulled) {
        p.speed = Math.min(p.speed + 500 * dt, 320);
        const step = Math.min(d, p.speed * dt);
        p.img.x += (dx / (d || 1)) * step;
        p.img.y += (dy / (d || 1)) * step;
      }
      if (d < 7) {
        this.collect(p);
        p.img.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  private collect(p: Pickup) {
    if (p.kind === 'bolt') {
      this.battery = clampBattery(this.battery + p.value);
      audio.sfx('bolt');
      this.floatText(this.player.x, this.player.y - 12, `+${p.value}% ^`, 'y');
      this.burst(this.player.x, this.player.y, 'y', 10);
      return;
    }
    audio.sfx('gem');
    const ups = addXp(this.run, p.value);
    if (ups > 0) {
      this.pendingLevelUps += ups;
      this.maybeOpenLevelUp();
    }
  }

  // ===================================================================== level up
  private maybeOpenLevelUp() {
    if (this.levelUpOpen || this.pendingLevelUps <= 0 || this.phase === 'dead') return;
    if (this.scene.isActive('Pause')) return;
    this.levelUpOpen = true;
    this.joy.reset();
    const data: LevelUpData = {
      offers: rollOffers(this.run.upgrades, this.battery),
      levels: { ...this.run.upgrades },
      level: this.run.level,
      battery: this.battery,
      onPick: (id) => this.applyUpgrade(id),
    };
    this.scene.pause();
    this.scene.launch('LevelUp', data);
  }

  applyUpgrade(id: string) {
    const u = getUpgrade(id);
    if (u.instant) {
      this.battery = clampBattery(this.battery + CHARGER_HEAL);
    } else {
      this.run.upgrades[id] = Math.min((this.run.upgrades[id] ?? 0) + 1, u.maxLevel);
      this.stats = computeStats(this.run.upgrades);
      this.rebuildOrbiters();
    }
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    this.levelUpOpen = false;
    this.scene.resume();
    if (this.pendingLevelUps > 0) this.time.delayedCall(250, () => this.maybeOpenLevelUp());
  }

  private openPause() {
    if (!this.scene.isActive() || this.phase === 'dead' || this.levelUpOpen) return;
    if (this.scene.isActive('Pause')) return;
    this.joy.reset();
    this.scene.pause();
    this.scene.launch('Pause');
  }

  // ===================================================================== boss
  private startBoss() {
    this.phase = 'boss';
    this.spawnAcc = 0;
    audio.sfx('warn');
    audio.playMusic('boss');
    buzz([100, 80, 100]);
    this.banner('BOSS TIME!', this.world.boss.name.toUpperCase(), 'r');
    this.time.delayedCall(2300, () => this.toast('Keep moving and dodge the bullets. You shoot it automatically!', 'w'));
    const def = this.world.boss;
    const view = this.viewRect();
    const x = Phaser.Math.Clamp(this.player.x, WALL + 20, this.WW - WALL - 20);
    const y = Math.max(WALL + 16, view.y - 20);
    const sprite = this.physics.add.sprite(x, y, def.sprite, 0).setDepth(35);
    sprite.play(`${def.sprite}-anim`);
    sprite.setCircle(def.radius, sprite.width / 2 - def.radius, sprite.height / 2 - def.radius);
    sprite.setImmovable(true);
    this.boss = {
      shadow: this.add.image(x, y, 'shadow_big', 0).setAlpha(0.3).setDepth(14),
      sprite, hp: def.hp, maxHp: def.hp, mode: 'enter', t: 1.6, patternTimer: 1.2, patternIdx: 0,
      enraged: false, flashUntil: 0, orbitHitAt: 0, vx: 0, vy: 0,
    };
    this.bossColliders.push(this.physics.add.overlap(this.pings, sprite, (a, b) => this.onPingHitBoss((a === sprite ? b : a) as EImage)));
    this.bossColliders.push(this.physics.add.overlap(this.player, sprite, () => {
      if (this.boss && this.boss.mode !== 'enter' && this.boss.mode !== 'dying') this.hurt(this.stats.hitDamage * 1.3);
    }));
  }

  private updateBoss(dt: number) {
    const b = this.boss!;
    const s = b.sprite;
    const def = this.world.boss;
    if (b.flashUntil && this.now > b.flashUntil) {
      s.clearTint();
      b.flashUntil = 0;
    }
    if (this.phase === 'dead') {
      s.setVelocity(0, 0);
      return;
    }
    b.shadow.setPosition(Math.round(s.x), Math.round(s.y + s.height / 2 + 1));
    const px = this.player.x;
    const py = this.player.y;
    b.t -= dt;
    switch (b.mode) {
      case 'enter': {
        const ty = Phaser.Math.Clamp(py - 80, WALL + 18, this.WH - WALL - 18);
        s.setVelocity((px - s.x) * 1.2, (ty - s.y) * 2);
        if (b.t <= 0) b.mode = 'fight';
        break;
      }
      case 'fight': {
        const tx = Phaser.Math.Clamp(px + Math.sin(this.now / 1200) * 45, WALL + 18, this.WW - WALL - 18);
        const ty = Phaser.Math.Clamp(py - 75, WALL + 18, this.WH - WALL - 18);
        const dx = tx - s.x;
        const dy = ty - s.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = def.speed * (b.enraged ? 1.4 : 1) * Math.min(1, d / 20);
        s.setVelocity((dx / d) * sp, (dy / d) * sp);
        b.patternTimer -= dt;
        if (b.patternTimer <= 0) {
          const p = def.patterns[b.patternIdx % def.patterns.length];
          b.patternIdx++;
          b.patternTimer = def.cadence * (b.enraged ? 0.8 : 1);
          this.runPattern(p);
        }
        break;
      }
      case 'wind':
        s.setVelocity(0, 0);
        s.x += Math.sin(this.now / 20) * 0.6;
        if (b.t <= 0) {
          const a = Math.atan2(py - s.y, px - s.x);
          b.vx = Math.cos(a);
          b.vy = Math.sin(a);
          b.mode = 'charge';
          b.t = 0.75;
          audio.sfx('dash');
        }
        break;
      case 'charge': {
        const p = def.patterns.find((x) => x.kind === 'charge') as Extract<Pattern, { kind: 'charge' }> | undefined;
        const sp = (p?.speed ?? 140) * (b.enraged ? 1.2 : 1);
        s.setVelocity(b.vx * sp, b.vy * sp);
        const m = WALL + 14;
        if (b.t <= 0 || s.x < m || s.y < m || s.x > this.WW - m || s.y > this.WH - m) {
          s.x = Phaser.Math.Clamp(s.x, m, this.WW - m);
          s.y = Phaser.Math.Clamp(s.y, m, this.WH - m);
          this.cameras.main.shake(100, 0.005);
          b.mode = 'fight';
        }
        break;
      }
      case 'dying':
        s.setVelocity(0, 0);
        break;
    }
  }

  private runPattern(p: Pattern) {
    const b = this.boss!;
    const s = b.sprite;
    const tex = this.world.boss.bullet;
    const toPlayer = Math.atan2(this.player.y - s.y, this.player.x - s.x);
    const bonus = b.enraged ? 1.1 : 1;
    switch (p.kind) {
      case 'radial': {
        const n = Math.round(p.count * bonus);
        const off = Math.random() * Math.PI;
        for (let i = 0; i < n; i++) this.fireEnemyBullet(s.x, s.y, off + (i / n) * Math.PI * 2, p.speed, tex);
        break;
      }
      case 'aimed':
        for (let i = 0; i < p.count; i++) this.fireEnemyBullet(s.x, s.y, toPlayer + (i - (p.count - 1) / 2) * p.spread, p.speed * bonus, tex);
        break;
      case 'spiral': {
        let k = 0;
        const start = Math.random() * Math.PI * 2;
        this.time.addEvent({
          delay: 150,
          repeat: p.shots - 1,
          callback: () => {
            if (!this.boss || this.boss.mode === 'dying' || this.phase !== 'boss') return;
            for (let a = 0; a < p.arms; a++) this.fireEnemyBullet(s.x, s.y, start + k * 0.32 + (a / p.arms) * Math.PI * 2, p.speed, tex);
            k++;
          },
        });
        break;
      }
      case 'charge':
        b.mode = 'wind';
        b.t = b.enraged ? 0.4 : 0.6;
        break;
      case 'summon': {
        const n = p.count + (b.enraged ? 1 : 0);
        for (let i = 0; i < n; i++) {
          if (this.enemies.countActive(true) >= this.world.maxAlive) break;
          const a = (i / n) * Math.PI * 2;
          const e = this.spawnEnemy(p.enemy, {
            x: Phaser.Math.Clamp(s.x + Math.cos(a) * 18, INSET + 6, this.WW - INSET - 6),
            y: Phaser.Math.Clamp(s.y + Math.sin(a) * 18, INSET + 6, this.WH - INSET - 6),
          });
          if (e) this.burst(e.x, e.y, 'w', 4);
        }
        break;
      }
    }
  }

  private damageBoss(dmg: number) {
    const b = this.boss;
    if (!b || b.mode === 'enter' || b.mode === 'dying') return;
    b.hp -= dmg;
    b.sprite.setTintFill(0xffffff);
    b.flashUntil = this.now + 50;
    audio.sfx('bosshit');
    if (!b.enraged && b.hp <= b.maxHp / 2) {
      b.enraged = true;
      const key = this.world.boss.angrySprite;
      b.sprite.setTexture(key, 0).play(`${key}-anim`);
      this.cameras.main.shake(200, 0.008);
      this.banner('IT IS ANGRY NOW!', '', 'o', 1200);
      b.patternTimer = 0.8;
    }
    if (b.hp <= 0) this.defeatBoss();
  }

  private defeatBoss() {
    const b = this.boss!;
    b.mode = 'dying';
    this.phase = 'clear';
    audio.playMusic(null);
    audio.sfx('bossdie');
    buzz([120, 50, 200]);
    // Hit-stop for drama
    this.physics.pause();
    this.time.delayedCall(220, () => this.physics.resume());
    this.cameras.main.shake(500, 0.01);
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 110, () => {
        this.burst(b.sprite.x + Phaser.Math.Between(-12, 12), b.sprite.y + Phaser.Math.Between(-10, 10), Phaser.Utils.Array.GetRandom(['y', 'w', 'r', 'o', 'm']), 14);
      });
    }
    this.time.delayedCall(900, () => {
      for (let i = 0; i < 14; i++) this.dropPickup(b.sprite.x + Phaser.Math.Between(-16, 16), b.sprite.y + Phaser.Math.Between(-16, 16), 'gem', 3);
      this.bossColliders.forEach((c) => c.destroy());
      this.bossColliders = [];
      b.sprite.destroy();
      b.shadow.destroy();
      this.boss = null;
    });
    // Clear the arena
    for (const o of [...this.enemies.getChildren()]) {
      const e = o as ESprite;
      const s = this.estate.get(e);
      if (e.active && s) this.killEnemy(e, s, true);
    }
    for (const o of this.ebullets.getChildren()) (o as EImage).disableBody(true, true);
    this.pickups.forEach((p) => (p.pulled = true));
    this.time.delayedCall(1300, () => {
      this.pickups.forEach((p) => (p.pulled = true));
      audio.sfx('clear');
      this.banner('WORLD CLEAR!', `${this.run.world + 1} / ${WORLDS.length}`, 'l', 2200);
      this.clearTimer = 2.8;
    });
  }

  private finishWorld() {
    if (this.clearTimer === -2) return;
    this.clearTimer = -2;
    const next = cloneRun(this.run);
    next.world = this.run.world + 1;
    const storyId = (['after1', 'after2', 'ending'] as const)[this.run.world] ?? 'ending';
    if (next.world >= WORLDS.length) updateSave({ checkpoint: null, cleared: true });
    else updateSave({ checkpoint: cloneRun(next) });
    this.cameras.main.fadeOut(400, 15, 11, 30);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Story', { id: storyId, run: next, character: this.character });
    });
  }

  // ===================================================================== fx
  private burst(x: number, y: number, color: string, n: number) {
    (this.emitters[color] ?? this.emitters.w).explode(n, x, y);
  }

  private floatText(x: number, y: number, str: string, color: 'r' | 'y' | 'w' | 'l') {
    const t = text(this, x, y, str, { align: 'center', color, depth: 70, size: 7, bold: true });
    this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private banner(title: string, sub: string, color: 'y' | 'r' | 'l' | 'o' = 'y', ms = 2000) {
    const { width: W, height: H } = viewSize();
    const c = this.add.container(W / 2, H * 0.32).setScrollFactor(0).setDepth(1100);
    const bg = this.add.rectangle(0, sub ? 11 : 8, W, sub ? 36 : 24, 0x0f0b1e, 0.78);
    const t = fitWidth(text(this, 0, 0, title, { align: 'center', size: 15, bold: true, color: color === 'o' ? 'y' : color }), W - 12);
    c.add([bg, t]);
    if (sub) c.add(fitWidth(text(this, 0, 19, sub, { align: 'center', color: 'w', size: 7 }), W - 12));
    c.setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 300, onComplete: () => c.destroy() });
  }

  private dismissHint() {
    if (!this.hint) return;
    const h = this.hint;
    this.hint = null;
    this.tweens.killTweensOf(h);
    this.tweens.add({ targets: h, alpha: 0, duration: 300, onComplete: () => h.destroy() });
  }

  // ===================================================================== HUD
  private createHud() {
    const { width: W, height: H } = viewSize();
    this.danger = this.add.graphics().setScrollFactor(0).setDepth(990);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.batText = text(this, 25, 10, '100%', { fixed: true, depth: 1001, size: 7, bold: true, originY: 0.5 });
    this.lvText = text(this, 5, 19, 'LV 1', { fixed: true, depth: 1001, color: 'c', size: 6, bold: true });
    this.barLabel = text(this, W / 2, 18, '', { align: 'center', fixed: true, depth: 1001, color: 'w', size: 7, bold: true });
    this.bossArrow = this.add.triangle(0, 0, 0, 0, 10, 5, 0, 10, 0xff8f9a).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setVisible(false);
    button(this, W - 11, 10, 'II', () => this.openPause(), { w: 16, h: 14, color: 0x5a5a78, fixed: true, depth: 1001 });
    const mute = button(this, W - 29, 10, '', () => {
      audio.setMuted(!audio.isMuted);
      updateSave({ muted: audio.isMuted });
      icon.setTexture(audio.isMuted ? 'icon_mute' : 'icon_snd', 0);
    }, { w: 16, h: 14, color: 0x5a5a78, fixed: true, depth: 1001 });
    const icon = this.add.image(0, -1, audio.isMuted ? 'icon_mute' : 'icon_snd', 0);
    mute.container.add(icon);
    void H;
  }

  private drawHud() {
    const { width: W, height: H } = viewSize();
    const g = this.hud;
    g.clear();
    // XP bar (very top)
    const need = xpToNext(this.run.level);
    g.fillStyle(0x1a1028).fillRect(0, 0, W, 3);
    g.fillStyle(0x58d8f8).fillRect(0, 0, Math.round((W * this.run.xp) / need), 2);

    // Battery
    const pct = displayBattery(this.battery);
    const low = this.battery <= 20;
    const blink = !low || Math.floor(this.now / 500) % 2 === 0;
    drawBattery(g, 5, 6, this.battery, blink);
    const left = Math.max(0, Math.ceil(this.world.duration - this.elapsed));
    const label =
      this.boss || this.phase === 'boss'
        ? `Beat ${this.world.boss.name}!`
        : this.phase === 'clear'
          ? 'You did it!'
          : `Survive ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const hudKey = `${pct}|${low}|${this.run.level}|${label}`;
    if (hudKey !== this.lastHud) {
      // Only re-render text when it changes (text re-rasterises on every setText).
      this.lastHud = hudKey;
      this.batText.setText(`${pct}%`);
      setColor(this.batText, low ? 'r' : 'w');
      this.lvText.setText(`LV ${this.run.level}`);
      this.barLabel.setText(label);
    }

    // Progress or boss bar
    const bx = 58;
    const bw = W - bx - 42;
    g.fillStyle(0x1a1028).fillRect(bx - 1, 7, bw + 2, 7);
    if (this.boss || this.phase === 'boss') {
      const frac = this.boss ? Math.max(0, this.boss.hp / this.boss.maxHp) : 0;
      g.fillStyle(0x5a1020).fillRect(bx, 8, bw, 5);
      g.fillStyle(0xe8384f).fillRect(bx, 8, Math.round(bw * frac), 5);

    } else {
      const frac = Math.min(1, this.elapsed / this.world.duration);
      g.fillStyle(0x24306e).fillRect(bx, 8, bw, 5);
      g.fillStyle(0xf8e858).fillRect(bx, 8, Math.round(bw * frac), 5);

    }
    this.barLabel.setX(Math.round(bx + bw / 2));
    fitWidth(this.barLabel, bw + 20);

    // Arrow at the screen edge pointing to an off-screen boss
    const b = this.boss;
    if (b && b.mode !== 'dying' && this.phase !== 'dead') {
      const cam = this.cameras.main;
      const sx = b.sprite.x - cam.scrollX;
      const sy = b.sprite.y - cam.scrollY;
      const off = sx < 0 || sy < 30 || sx > W || sy > H;
      this.bossArrow.setVisible(off);
      if (off) {
        const ang = Math.atan2(sy - H / 2, sx - W / 2);
        this.bossArrow
          .setPosition(Phaser.Math.Clamp(sx, 10, W - 10), Phaser.Math.Clamp(sy, 34, H - 10))
          .setRotation(ang)
          .setAlpha(0.6 + 0.4 * Math.sin(this.now / 150));
      }
    } else this.bossArrow.setVisible(false);

    // Low-battery red edge pulse
    const d = this.danger;
    d.clear();
    if (low && this.phase !== 'dead') {
      const a = 0.18 + 0.1 * Math.sin(this.now / 300);
      d.fillStyle(0xe8384f, a);
      d.fillRect(0, 0, W, 3).fillRect(0, H - 3, W, 3).fillRect(0, 0, 3, H).fillRect(W - 3, 0, 3, H);
    }
  }

  // ===================================================================== test hooks
  debugState() {
    return {
      phase: this.phase,
      battery: this.battery,
      world: this.run.world,
      level: this.run.level,
      kills: this.run.kills,
      enemies: this.enemies?.countActive(true) ?? 0,
      boss: this.boss ? { hp: this.boss.hp, mode: this.boss.mode } : null,
      player: { x: this.player?.x ?? 0, y: this.player?.y ?? 0 },
      levelUpOpen: this.levelUpOpen,
      stats: { ...this.stats },
      upgrades: { ...this.run.upgrades },
      pickups: this.pickups.length,
      arena: { w: this.WW, h: this.WH, wall: WALL },
      playerBounds: (() => {
        const b = this.player.getBounds();
        return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
      })(),
    };
  }
  debugTeleport(x: number, y: number) {
    this.player.setPosition(x, y);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(x, y);
  }
  debugSkipToBoss() {
    this.elapsed = this.world.duration;
  }
  debugDamageBoss(n: number) {
    if (this.boss) {
      if (this.boss.mode === 'enter') this.boss.mode = 'fight';
      this.damageBoss(n);
    }
  }
  debugSetBattery(v: number) {
    this.battery = v;
  }
  debugGod(on: boolean) {
    this.invulnUntil = on ? Number.MAX_SAFE_INTEGER : 0;
  }
  debugAddXp(n: number) {
    this.dropPickup(this.player.x, this.player.y, 'gem', n);
  }
}
