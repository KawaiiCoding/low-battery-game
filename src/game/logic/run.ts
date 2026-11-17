import { xpToNext } from '../data/upgrades';

export interface RunState {
  world: number;
  level: number;
  xp: number;
  upgrades: Record<string, number>;
  kills: number;
  timeMs: number;
}

export function newRun(): RunState {
  return { world: 0, level: 1, xp: 0, upgrades: {}, kills: 0, timeMs: 0 };
}

export function cloneRun(r: RunState): RunState {
  return { ...r, upgrades: { ...r.upgrades } };
}

/** Adds xp and returns how many level-ups happened. */
export function addXp(r: RunState, amount: number): number {
  r.xp += amount;
  let ups = 0;
  while (r.xp >= xpToNext(r.level)) {
    r.xp -= xpToNext(r.level);
    r.level++;
    ups++;
  }
  return ups;
}

export function clampBattery(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Battery % shown on the HUD: never shows 0 while still alive. */
export function displayBattery(v: number): number {
  if (v <= 0) return 0;
  return Math.max(1, Math.ceil(v));
}

export function isRunState(x: unknown): x is RunState {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return (
    Number.isInteger(r.world) && (r.world as number) >= 0 &&
    Number.isInteger(r.level) && (r.level as number) >= 1 &&
    typeof r.xp === 'number' && typeof r.kills === 'number' && typeof r.timeMs === 'number' &&
    !!r.upgrades && typeof r.upgrades === 'object' &&
    Object.values(r.upgrades as object).every((v) => Number.isInteger(v) && v >= 0)
  );
}
