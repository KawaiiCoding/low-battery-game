import Phaser from 'phaser';
import { VIEW } from '../game/constants';

/** Pointer position in logical (un-zoomed) screen coordinates. */
const lx = (p: Phaser.Input.Pointer) => p.x / VIEW.zoom;
const ly = (p: Phaser.Input.Pointer) => p.y / VIEW.zoom;

/**
 * Floating virtual joystick: touch anywhere (outside UI) to place it, drag to steer.
 * Output `vec` has length 0..1. Works with mouse too.
 */
export class Joystick {
  readonly vec = new Phaser.Math.Vector2();
  private pointerId: number | null = null;
  private base = new Phaser.Math.Vector2();
  private knob = new Phaser.Math.Vector2();
  private g: Phaser.GameObjects.Graphics;
  /** Called the first time the player touches the stick. */
  onFirstUse: (() => void) | null = null;

  constructor(
    private scene: Phaser.Scene,
    private radius = 22,
    /** Touches starting above this y (HUD strip) are ignored. */
    private minY = 24,
  ) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(950);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.down, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.move, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.up, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.up, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  private down(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (this.pointerId !== null || over.length > 0 || ly(p) < this.minY) return;
    this.pointerId = p.id;
    this.base.set(lx(p), ly(p));
    this.knob.set(lx(p), ly(p));
    this.vec.set(0, 0);
    if (this.onFirstUse) {
      this.onFirstUse();
      this.onFirstUse = null;
    }
    this.draw();
  }

  private move(p: Phaser.Input.Pointer) {
    if (p.id !== this.pointerId) return;
    if (!p.isDown) {
      this.reset();
      return;
    }
    const dx = lx(p) - this.base.x;
    const dy = ly(p) - this.base.y;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {
      // Drag the base along so the stick never "runs out".
      const k = (d - this.radius) / d;
      this.base.x += dx * k;
      this.base.y += dy * k;
    }
    this.knob.set(lx(p), ly(p));
    const ndx = this.knob.x - this.base.x;
    const ndy = this.knob.y - this.base.y;
    const nd = Math.hypot(ndx, ndy);
    const dead = 3;
    if (nd < dead) this.vec.set(0, 0);
    else {
      const mag = Math.min(1, (nd - dead) / (this.radius * 0.6 - dead));
      this.vec.set((ndx / nd) * mag, (ndy / nd) * mag);
    }
    this.draw();
  }

  private up(p: Phaser.Input.Pointer) {
    if (p.id === this.pointerId) this.reset();
  }

  /** Releases the stick (call after the scene resumes from a pause). */
  reset(): void {
    this.pointerId = null;
    this.vec.set(0, 0);
    this.g.clear();
  }

  private draw() {
    const g = this.g;
    g.clear();
    if (this.pointerId === null) return;
    const bx = this.base.x;
    const by = this.base.y;
    g.lineStyle(1.5, 0xeae4d6, 0.3).strokeCircle(bx, by, this.radius);
    g.fillStyle(0xeae4d6, 0.08).fillCircle(bx, by, this.radius);
    g.fillStyle(0xeae4d6, 0.5).fillCircle(this.knob.x, this.knob.y, 8);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.down, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.move, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.up, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.up, this);
  }
}
