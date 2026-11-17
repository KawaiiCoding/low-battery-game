export interface Stats {
  moveSpeed: number; // px/s
  fireDelay: number; // ms between volleys
  damage: number;
  projectiles: number;
  pierce: number;
  bulletSpeed: number;
  range: number; // auto-aim range in px
  magnet: number; // pickup radius in px
  drainPerSec: number; // battery % per second
  hitDamage: number; // battery % lost per contact hit
  invulnMs: number;
  orbiters: number;
  boltHeal: number; // battery % per bolt pickup
}

export const BASE_STATS: Readonly<Stats> = Object.freeze({
  moveSpeed: 70,
  fireDelay: 420,
  damage: 1.5,
  projectiles: 1,
  pierce: 0,
  bulletSpeed: 180,
  range: 130,
  magnet: 30,
  drainPerSec: 0.4,
  hitDamage: 7,
  invulnMs: 1100,
  orbiters: 0,
  boltHeal: 15,
});

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  /** Instant effect instead of a stat change (e.g. heal). Never counts towards maxLevel. */
  instant?: boolean;
  /** Sprite key used as the card icon. */
  icon: string;
  /** Plain-language name of what changes, plus how to show the value. */
  stat: { label: string; value: (s: Stats) => number; unit?: string; decimals?: number };
  apply: (s: Stats) => void;
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'poly', name: 'Polyphonic Ringtone', desc: 'Fire more pings at once', maxLevel: 4, icon: 'icon_shots', stat: { label: 'Pings per shot', value: (s) => s.projectiles }, apply: (s) => (s.projectiles += 1) },
  { id: 'speeddial', name: 'Speed Dial', desc: 'Shoot faster', maxLevel: 5, icon: 'icon_rate', stat: { label: 'Shots per second', value: (s) => 1000 / s.fireDelay, decimals: 1 }, apply: (s) => (s.fireDelay = Math.round(s.fireDelay * 0.82)) },
  { id: 'bigpixels', name: 'Big Pixels', desc: 'Each ping hits harder', maxLevel: 5, icon: 'icon_damage', stat: { label: 'Damage', value: (s) => s.damage, decimals: 1 }, apply: (s) => (s.damage = +(s.damage * 1.35).toFixed(3)) },
  { id: 't9', name: 'T9 Predictive', desc: 'Pings fly through enemies', maxLevel: 3, icon: 'icon_pierce', stat: { label: 'Enemies per ping', value: (s) => s.pierce + 1 }, apply: (s) => (s.pierce += 1) },
  { id: 'vibrate', name: 'Vibrate Mode', desc: 'Walk faster', maxLevel: 4, icon: 'icon_speed', stat: { label: 'Move speed', value: (s) => s.moveSpeed }, apply: (s) => (s.moveSpeed = Math.round(s.moveSpeed * 1.12)) },
  { id: 'saver', name: 'Power Saver', desc: 'Battery drains slower', maxLevel: 3, icon: 'chip', stat: { label: 'Battery lasts', value: (s) => 100 / s.drainPerSec, unit: 's' }, apply: (s) => (s.drainPerSec = +(s.drainPerSec * 0.8).toFixed(4)) },
  { id: 'signal', name: 'Full Bars', desc: 'Grab gems and bolts from further away', maxLevel: 3, icon: 'gem', stat: { label: 'Pickup reach', value: (s) => s.magnet }, apply: (s) => (s.magnet = Math.round(s.magnet * 1.5)) },
  { id: 'snake', name: 'Snake Mode', desc: 'A snake circles you and hurts enemies', maxLevel: 4, icon: 'orbiter', stat: { label: 'Snakes', value: (s) => s.orbiters }, apply: (s) => (s.orbiters += 1) },
  { id: 'case', name: 'Rubber Case', desc: 'Hits cost less battery', maxLevel: 3, icon: 'icon_shield', stat: { label: 'Battery lost per hit', value: (s) => s.hitDamage, unit: '%', decimals: 1 }, apply: (s) => { s.hitDamage = +(s.hitDamage * 0.8).toFixed(3); s.invulnMs += 150; } },
  { id: 'antenna', name: 'Pull-Out Antenna', desc: 'Shoot enemies from further away', maxLevel: 2, icon: 'icon_range', stat: { label: 'Range', value: (s) => s.range }, apply: (s) => { s.range += 30; s.bulletSpeed += 40; } },
  { id: 'charger', name: 'Car Charger', desc: 'Recharge your battery right now', maxLevel: Infinity, instant: true, icon: 'bolt', stat: { label: 'Battery', value: () => 0, unit: '%' }, apply: () => {} },
];

export const CHARGER_HEAL = 30;

export function getUpgrade(id: string): UpgradeDef {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) throw new Error(`Unknown upgrade ${id}`);
  return u;
}

/** Recomputes stats from scratch based on owned upgrade levels. */
export function computeStats(levels: Readonly<Record<string, number>>): Stats {
  const s: Stats = { ...BASE_STATS };
  for (const u of UPGRADES) {
    if (u.instant) continue;
    const n = Math.min(levels[u.id] ?? 0, u.maxLevel);
    for (let i = 0; i < n; i++) u.apply(s);
  }
  return s;
}

/**
 * Picks up to `count` distinct upgrade offers that are not maxed out.
 * The charger only appears as a filler or when battery is low.
 */
export function rollOffers(
  levels: Readonly<Record<string, number>>,
  battery: number,
  rng: () => number = Math.random,
  count = 3,
): UpgradeDef[] {
  const pool = UPGRADES.filter((u) => !u.instant && (levels[u.id] ?? 0) < u.maxLevel);
  const picks: UpgradeDef[] = [];
  const bag = [...pool];
  const wantCharger = battery < 35;
  const slots = wantCharger ? count - 1 : count;
  while (picks.length < slots && bag.length) {
    const i = Math.floor(rng() * bag.length) % bag.length;
    picks.push(bag.splice(i, 1)[0]);
  }
  const charger = getUpgrade('charger');
  while (picks.length < count && !picks.includes(charger)) picks.push(charger);
  return picks;
}

/** XP required to go from `level` to `level + 1` (level starts at 1). */
export function xpToNext(level: number): number {
  return 3 + level * 3;
}

export interface UpgradeChange {
  label: string;
  from: string;
  to: string;
}

/** Plain before/after numbers for an upgrade card, e.g. "Damage 1.5 -> 2.0". */
export function describeChange(u: UpgradeDef, levels: Readonly<Record<string, number>>, battery: number): UpgradeChange {
  const fmt = (v: number) => `${v.toFixed(u.stat.decimals ?? 0)}${u.stat.unit ?? ''}`;
  if (u.instant) {
    const b = Math.max(0, Math.min(100, battery));
    return { label: u.stat.label, from: fmt(Math.ceil(b)), to: fmt(Math.min(100, Math.ceil(b + CHARGER_HEAL))) };
  }
  const now = computeStats(levels);
  const next = computeStats({ ...levels, [u.id]: (levels[u.id] ?? 0) + 1 });
  return { label: u.stat.label, from: fmt(u.stat.value(now)), to: fmt(u.stat.value(next)) };
}
