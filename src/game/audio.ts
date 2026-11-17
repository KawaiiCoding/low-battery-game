/**
 * Tiny chiptune synth: procedural SFX + step-sequenced music. No audio files needed.
 * Safe to call before the context exists (calls are no-ops until unlock()).
 */
export type TrackId = 'title' | 'w1' | 'w2' | 'w3' | 'boss' | 'story';

interface Track {
  bpm: number;
  bass: number[]; // MIDI per 8th step, 0 = rest
  lead: number[];
  drums: boolean;
}

const _ = 0;
const TRACKS: Record<TrackId, Track> = {
  title: {
    bpm: 92,
    drums: false,
    bass: [45, _, 45, _, 41, _, 41, _, 48, _, 48, _, 43, _, 43, _],
    lead: [69, 72, 76, 72, 69, 72, 77, 72, 72, 76, 79, 76, 71, 74, 79, 74],
  },
  story: {
    bpm: 80,
    drums: false,
    bass: [48, _, _, _, 45, _, _, _, 41, _, _, _, 43, _, _, _],
    lead: [_, 72, _, 76, _, 72, _, 69, _, 69, _, 72, _, 71, _, 67],
  },
  w1: {
    bpm: 140,
    drums: true,
    bass: [40, 52, 40, 52, 40, 52, 40, 52, 36, 48, 36, 48, 38, 50, 38, 50, 40, 52, 40, 52, 40, 52, 40, 52, 35, 47, 35, 47, 35, 47, 38, 50],
    lead: [76, _, 79, 76, _, 74, 71, _, 72, _, 76, 72, _, 74, 76, _, 76, _, 79, 81, _, 79, 76, _, 74, _, 71, 74, _, 75, _, _],
  },
  w2: {
    bpm: 128,
    drums: true,
    bass: [48, _, 48, 55, 45, _, 45, 52, 41, _, 41, 48, 43, _, 43, 50],
    lead: [79, 76, 72, 76, 81, 76, 72, 76, 77, 72, 69, 72, 79, 74, 71, 74],
  },
  w3: {
    bpm: 132,
    drums: true,
    bass: [41, _, 53, _, 38, _, 50, _, 46, _, 58, _, 48, _, 60, _],
    lead: [77, 81, 84, _, 74, 77, 81, _, 82, 77, 74, _, 79, 76, 72, 76],
  },
  boss: {
    bpm: 160,
    drums: true,
    bass: [40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 43, 43, 46, 47],
    lead: [76, _, 75, _, 76, _, 79, _, 77, _, 76, _, 74, _, 71, _],
  },
};

const MASTER = 0.5;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private muted = false;
  private track: TrackId | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last: Record<string, number> = {};
  private pickupChain = 0;

  get isMuted() {
    return this.muted;
  }

  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER;
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.8;
        this.sfxBus.connect(this.master);
        // Music goes through a low-pass filter so square waves sound warm, not piercing.
        const soft = this.ctx.createBiquadFilter();
        soft.type = 'lowpass';
        soft.frequency.value = 2200;
        soft.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.3;
        this.musicBus.connect(soft);
        const len = Math.floor(this.ctx.sampleRate * 0.5);
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        if (this.track) this.startScheduler();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER, this.ctx.currentTime, 0.02);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ---------- music ----------
  playMusic(id: TrackId | null): void {
    if (this.track === id) return;
    this.track = id;
    this.step = 0;
    if (!id) {
      this.stopScheduler();
      return;
    }
    if (this.ctx) this.startScheduler();
  }

  private startScheduler() {
    this.stopScheduler();
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  private stopScheduler() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.track || ctx.state !== 'running') return;
    const t = TRACKS[this.track];
    const stepDur = 60 / t.bpm / 2;
    // If we fell far behind (tab was hidden), skip ahead instead of bursting notes.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const time = this.nextTime;
      const b = t.bass[this.step % t.bass.length];
      const l = t.lead[this.step % t.lead.length];
      if (b) this.voice(midi(b), time, stepDur * 0.9, 'triangle', 0.22, this.musicBus);
      if (l) this.voice(midi(l), time, stepDur * 0.7, 'square', 0.055, this.musicBus);
      if (t.drums) {
        if (this.step % 4 === 0) this.kick(time);
        if (this.step % 2 === 1) this.hat(time, 0.025);
        if (this.step % 8 === 4) this.hat(time, 0.06, 0.09);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  // ---------- primitives ----------
  private voice(freq: number, time: number, dur: number, type: OscillatorType, vol: number, bus: GainNode, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), time + dur);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g).connect(bus);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  private kick(time: number) {
    this.voice(150, time, 0.12, 'sine', 0.35, this.musicBus, 40);
  }

  private hat(time: number, vol: number, dur = 0.03) {
    this.noise(time, dur, vol, this.musicBus, 6000);
  }

  private noise(time: number, dur: number, vol: number, bus: GainNode, hp = 800) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    if (now - (this.last[key] ?? -1e9) < ms) return false;
    this.last[key] = now;
    return true;
  }

  /** Rising arpeggio for combo milestones: higher combo = higher pitch. */
  combo(level: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const t = ctx.currentTime + 0.005;
    const base = 72 + Math.min(level, 8) * 2;
    [0, 4, 7, 12].forEach((d, i) => this.voice(midi(base + d), t + i * 0.045, 0.09, 'triangle', 0.12, this.sfxBus));
  }

  // ---------- sfx ----------
  sfx(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const t = ctx.currentTime + 0.005;
    const bus = this.sfxBus;
    switch (name) {
      case 'shoot':
        if (!this.throttle(name, 120)) return;
        this.voice(880, t, 0.04, 'triangle', 0.05, bus, 1320);
        break;
      case 'hit':
        if (!this.throttle(name, 40)) return;
        this.voice(260, t, 0.05, 'square', 0.05, bus, 130);
        break;
      case 'kill':
        if (!this.throttle(name, 35)) return;
        this.noise(t, 0.08, 0.08, bus, 1200);
        this.voice(660, t, 0.08, 'square', 0.04, bus, 180);
        break;
      case 'gem': {
        if (!this.throttle(name, 30)) return;
        const now = performance.now();
        this.pickupChain = now - (this.last.gemChain ?? 0) < 350 ? Math.min(this.pickupChain + 1, 12) : 0;
        this.last.gemChain = now;
        this.voice(midi(79 + this.pickupChain), t, 0.06, 'triangle', 0.09, bus);
        break;
      }
      case 'bolt':
        [72, 76, 79, 84].forEach((m, i) => this.voice(midi(m), t + i * 0.05, 0.08, 'triangle', 0.2, bus));
        break;
      case 'hurt':
        this.voice(320, t, 0.2, 'triangle', 0.14, bus, 90);
        this.noise(t, 0.12, 0.1, bus, 400);
        break;
      case 'levelup':
        [72, 76, 79, 84, 88].forEach((m, i) => this.voice(midi(m), t + i * 0.06, 0.12, 'square', 0.06, bus));
        break;
      case 'select':
        this.voice(midi(79), t, 0.05, 'square', 0.06, bus);
        this.voice(midi(86), t + 0.05, 0.08, 'square', 0.06, bus);
        break;
      case 'tap':
        if (!this.throttle(name, 50)) return;
        this.voice(midi(84), t, 0.03, 'square', 0.04, bus);
        break;
      case 'type':
        if (!this.throttle(name, 45)) return;
        this.voice(midi(72 + Math.floor(Math.random() * 3)), t, 0.025, 'triangle', 0.035, bus);
        break;
      case 'warn':
        for (let i = 0; i < 3; i++) this.voice(440, t + i * 0.3, 0.25, 'triangle', 0.12, bus, 660);
        break;
      case 'bosshit':
        if (!this.throttle(name, 60)) return;
        this.voice(180, t, 0.06, 'square', 0.05, bus, 90);
        break;
      case 'bossdie':
        this.noise(t, 1.2, 0.2, bus, 200);
        this.voice(400, t, 1.2, 'triangle', 0.14, bus, 40);
        break;
      case 'lowbat':
        this.voice(988, t, 0.08, 'triangle', 0.08, bus);
        this.voice(784, t + 0.12, 0.1, 'triangle', 0.08, bus);
        break;
      case 'gameover':
        [67, 63, 60, 55].forEach((m, i) => this.voice(midi(m), t + i * 0.18, 0.25, 'square', 0.07, bus));
        break;
      case 'dash':
        this.voice(500, t, 0.15, 'triangle', 0.04, bus, 900);
        break;
      case 'eshoot':
        if (!this.throttle(name, 90)) return;
        this.voice(700, t, 0.06, 'triangle', 0.05, bus, 350);
        break;
      case 'clear':
        [72, 76, 79, 84, 79, 84, 88, 91].forEach((m, i) => this.voice(midi(m), t + i * 0.09, 0.16, 'square', 0.06, bus));
        break;
    }
  }
}

export type Sfx =
  | 'shoot' | 'hit' | 'kill' | 'gem' | 'bolt' | 'hurt' | 'levelup' | 'select' | 'tap' | 'type'
  | 'warn' | 'bosshit' | 'bossdie' | 'lowbat' | 'gameover' | 'dash' | 'eshoot' | 'clear';

export const audio = new AudioEngine();

/** Short vibration on supporting devices (Android / mobile browsers). */
export function buzz(ms: number | number[]): void {
  try {
    if (!audio.isMuted && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
