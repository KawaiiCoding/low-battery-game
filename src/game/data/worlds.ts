import type { SpriteKey } from '../sprites';

export type Behavior = 'chase' | 'zigzag' | 'dash' | 'shooter';

export interface EnemyDef {
  sprite: SpriteKey;
  hp: number;
  speed: number;
  behavior: Behavior;
  xp: number;
  /** Multiplier on the player's hit damage on contact. */
  contact: number;
  radius: number;
  bullet?: SpriteKey;
}

export const ENEMIES = {
  spam: { sprite: 'spam', hp: 2, speed: 30, behavior: 'chase', xp: 1, contact: 1, radius: 5 },
  popup: { sprite: 'popup', hp: 7, speed: 18, behavior: 'chase', xp: 3, contact: 1.4, radius: 6 },
  virus: { sprite: 'virus', hp: 2, speed: 44, behavior: 'zigzag', xp: 1, contact: 0.8, radius: 4 },
  glitter: { sprite: 'glitter', hp: 4, speed: 28, behavior: 'dash', xp: 2, contact: 1, radius: 4 },
  friend: { sprite: 'friend', hp: 6, speed: 32, behavior: 'chase', xp: 2, contact: 1.1, radius: 5 },
  note: { sprite: 'note', hp: 5, speed: 26, behavior: 'shooter', xp: 3, contact: 0.8, radius: 4, bullet: 'bullet_m' },
  blob: { sprite: 'blob', hp: 9, speed: 34, behavior: 'chase', xp: 2, contact: 1.1, radius: 5 },
  fly: { sprite: 'fly', hp: 4, speed: 56, behavior: 'zigzag', xp: 1, contact: 0.8, radius: 3 },
  poop: { sprite: 'poop', hp: 10, speed: 22, behavior: 'shooter', xp: 3, contact: 1, radius: 4, bullet: 'bullet_o' },
} satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;

export type Pattern =
  | { kind: 'radial'; count: number; speed: number }
  | { kind: 'spiral'; arms: number; shots: number; speed: number }
  | { kind: 'aimed'; count: number; spread: number; speed: number }
  | { kind: 'charge'; speed: number }
  | { kind: 'summon'; enemy: EnemyId; count: number };

export interface BossDef {
  name: string;
  sprite: SpriteKey;
  angrySprite: SpriteKey;
  hp: number;
  speed: number;
  radius: number;
  bullet: SpriteKey;
  patterns: Pattern[];
  /** Seconds between patterns (scaled down in phase 2). */
  cadence: number;
}

export interface WorldDef {
  id: string;
  name: string;
  subtitle: string;
  /** Seconds of waves before the boss shows up. */
  duration: number;
  spawnStart: number; // enemies / second
  spawnEnd: number;
  maxAlive: number;
  enemies: { id: EnemyId; weight: number; from: number }[];
  boss: BossDef;
  bg: { base: number; line: number; dot: number; style: 'grid' | 'sparkle' | 'grass' };
  music: 'w1' | 'w2' | 'w3';
  /** One plain-language tip shown on the mission card. */
  tip: string;
}

export const WORLDS: readonly WorldDef[] = [
  {
    id: 'dialup',
    name: 'Dial-Up Maze',
    subtitle: 'World 1: 56K of pure pain',
    duration: 60,
    spawnStart: 0.9,
    spawnEnd: 2.6,
    maxAlive: 45,
    enemies: [
      { id: 'spam', weight: 6, from: 0 },
      { id: 'virus', weight: 3, from: 12 },
      { id: 'popup', weight: 2, from: 25 },
    ],
    boss: {
      name: 'The Modem',
      sprite: 'modem',
      angrySprite: 'modem_angry',
      hp: 130,
      speed: 22,
      radius: 11,
      bullet: 'bullet_c',
      cadence: 2.8,
      patterns: [
        { kind: 'radial', count: 8, speed: 47 },
        { kind: 'summon', enemy: 'spam', count: 4 },
        { kind: 'aimed', count: 2, spread: 0.35, speed: 64 },
        { kind: 'spiral', arms: 2, shots: 6, speed: 42 },
      ],
    },
    bg: { base: 0x101833, line: 0x1c2a52, dot: 0x2b4a8a, style: 'grid' },
    music: 'w1',
    tip: 'Popup windows are tough. Keep moving and let your pings do the work.',
  },
  {
    id: 'profile',
    name: 'Profile Dungeon',
    subtitle: 'World 2: Glitter. Everywhere.',
    duration: 65,
    spawnStart: 1.1,
    spawnEnd: 3.0,
    maxAlive: 50,
    enemies: [
      { id: 'friend', weight: 5, from: 0 },
      { id: 'glitter', weight: 3, from: 8 },
      { id: 'note', weight: 2, from: 20 },
    ],
    boss: {
      name: 'Your Top Friend',
      sprite: 'heart',
      angrySprite: 'heart_angry',
      hp: 210,
      speed: 30,
      radius: 10,
      bullet: 'bullet_m',
      cadence: 2.5,
      patterns: [
        { kind: 'spiral', arms: 3, shots: 7, speed: 44 },
        { kind: 'charge', speed: 130 },
        { kind: 'radial', count: 11, speed: 42 },
        { kind: 'summon', enemy: 'friend', count: 4 },
        { kind: 'aimed', count: 4, spread: 0.25, speed: 68 },
      ],
    },
    bg: { base: 0x22103a, line: 0x341a55, dot: 0x6a3a9a, style: 'sparkle' },
    music: 'w2',
    tip: 'Glitter blinks, then dashes at you. When it blinks, step aside!',
  },
  {
    id: 'petsim',
    name: 'Pet Sim Meadow',
    subtitle: 'World 3: You forgot to feed it',
    duration: 70,
    spawnStart: 1.2,
    spawnEnd: 3.4,
    maxAlive: 55,
    enemies: [
      { id: 'blob', weight: 5, from: 0 },
      { id: 'fly', weight: 4, from: 6 },
      { id: 'poop', weight: 2, from: 18 },
    ],
    boss: {
      name: 'Pixel, Your Pet',
      sprite: 'pet',
      angrySprite: 'pet_angry',
      hp: 300,
      speed: 26,
      radius: 11,
      bullet: 'bullet_c',
      cadence: 2.3,
      patterns: [
        { kind: 'aimed', count: 4, spread: 0.3, speed: 60 },
        { kind: 'charge', speed: 125 },
        { kind: 'radial', count: 13, speed: 41 },
        { kind: 'summon', enemy: 'blob', count: 4 },
        { kind: 'spiral', arms: 4, shots: 7, speed: 42 },
        { kind: 'charge', speed: 145 },
      ],
    },
    bg: { base: 0x0e2418, line: 0x163522, dot: 0x2a5a36, style: 'grass' },
    music: 'w3',
    tip: 'Poop shoots stinky blobs. Keep moving and you will be fine.',
  },
];

/** Enemies/second at a given time into the wave phase. */
export function spawnRate(world: WorldDef, t: number): number {
  const k = Math.min(1, Math.max(0, t / world.duration));
  return world.spawnStart + (world.spawnEnd - world.spawnStart) * k;
}

/** Weighted pick among enemies unlocked at time t. */
export function pickEnemy(world: WorldDef, t: number, rng: () => number = Math.random): EnemyId {
  const avail = world.enemies.filter((e) => e.from <= t);
  const list = avail.length ? avail : [world.enemies[0]];
  const total = list.reduce((a, e) => a + e.weight, 0);
  let r = rng() * total;
  for (const e of list) {
    r -= e.weight;
    if (r < 0) return e.id;
  }
  return list[list.length - 1].id;
}
