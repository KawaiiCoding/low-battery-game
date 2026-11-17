import { describe, expect, it } from 'vitest';
import { BASE_STATS, UPGRADES, computeStats, rollOffers, xpToNext, getUpgrade } from '../../src/game/data/upgrades';
import { WORLDS, pickEnemy, spawnRate } from '../../src/game/data/worlds';
import { addXp, clampBattery, displayBattery, isRunState, newRun, cloneRun } from '../../src/game/logic/run';
import { loadSave, updateSave, writeSave, defaultSave, type KV } from '../../src/game/save';

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('upgrades', () => {
  it('base stats unchanged with no upgrades', () => {
    expect(computeStats({})).toEqual(BASE_STATS);
  });

  it('stacks and caps at max level', () => {
    const s = computeStats({ poly: 99, speeddial: 2 });
    expect(s.projectiles).toBe(1 + getUpgrade('poly').maxLevel);
    expect(s.fireDelay).toBe(Math.round(Math.round(BASE_STATS.fireDelay * 0.82) * 0.82));
  });

  it('computeStats does not mutate base stats', () => {
    computeStats({ vibrate: 3, case: 3 });
    expect(BASE_STATS.moveSpeed).toBe(70);
  });

  it('every upgrade improves something', () => {
    for (const u of UPGRADES) {
      if (u.instant) continue;
      expect(computeStats({ [u.id]: 1 }), u.id).not.toEqual(BASE_STATS);
    }
  });

  it('offers are distinct and never maxed', () => {
    for (let t = 0; t < 200; t++) {
      const levels = { poly: 4, t9: 3 };
      const offers = rollOffers(levels, 80);
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map((o) => o.id)).size).toBe(3);
      expect(offers.find((o) => o.id === 'poly' || o.id === 't9')).toBeUndefined();
      expect(offers.find((o) => o.id === 'charger')).toBeUndefined();
    }
  });

  it('offers a charger when battery is low', () => {
    const offers = rollOffers({}, 20, seq([0.1, 0.5, 0.9]));
    expect(offers.map((o) => o.id)).toContain('charger');
    expect(offers).toHaveLength(3);
  });

  it('falls back to charger when everything is maxed', () => {
    const all = Object.fromEntries(UPGRADES.filter((u) => !u.instant).map((u) => [u.id, u.maxLevel]));
    const offers = rollOffers(all, 90);
    expect(offers.map((o) => o.id)).toEqual(['charger']);
  });

  it('rng returning ~1 does not break', () => {
    expect(rollOffers({}, 90, () => 0.9999999)).toHaveLength(3);
  });

  it('fire delay never reaches zero', () => {
    expect(computeStats({ speeddial: 99 }).fireDelay).toBeGreaterThan(100);
  });
});

describe('run / xp', () => {
  it('xp curve increases', () => {
    for (let l = 1; l < 30; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('addXp handles multi-level jumps and carries remainder', () => {
    const r = newRun();
    const ups = addXp(r, xpToNext(1) + xpToNext(2) + 2);
    expect(ups).toBe(2);
    expect(r.level).toBe(3);
    expect(r.xp).toBe(2);
  });

  it('battery clamps and displays sensibly', () => {
    expect(clampBattery(-5)).toBe(0);
    expect(clampBattery(130)).toBe(100);
    expect(displayBattery(0.2)).toBe(1);
    expect(displayBattery(0)).toBe(0);
    expect(displayBattery(99.1)).toBe(100);
  });

  it('cloneRun deep-copies upgrades', () => {
    const a = newRun();
    const b = cloneRun(a);
    b.upgrades.poly = 1;
    expect(a.upgrades.poly).toBeUndefined();
  });

  it('validates run state shape', () => {
    expect(isRunState(newRun())).toBe(true);
    expect(isRunState({ world: -1 })).toBe(false);
    expect(isRunState(null)).toBe(false);
    expect(isRunState({ ...newRun(), upgrades: { a: 1.5 } })).toBe(false);
  });
});

describe('worlds spawn logic', () => {
  it('spawn rate ramps from start to end and clamps', () => {
    const w = WORLDS[0];
    expect(spawnRate(w, 0)).toBe(w.spawnStart);
    expect(spawnRate(w, w.duration)).toBe(w.spawnEnd);
    expect(spawnRate(w, w.duration * 5)).toBe(w.spawnEnd);
    expect(spawnRate(w, -10)).toBe(w.spawnStart);
  });

  it('only picks unlocked enemies', () => {
    const w = WORLDS[0];
    for (let i = 0; i < 100; i++) expect(pickEnemy(w, 0)).toBe('spam');
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(pickEnemy(w, 999));
    expect(seen).toEqual(new Set(w.enemies.map((e) => e.id)));
    expect(pickEnemy(w, 999, () => 0.99999999)).toBeTruthy();
  });
});

describe('save', () => {
  const mem = (): KV & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
  };

  it('round-trips', () => {
    const s = mem();
    const run = { ...newRun(), world: 2, upgrades: { poly: 2 } };
    writeSave({ muted: true, character: 'female', checkpoint: run, cleared: true }, s);
    expect(loadSave(s)).toEqual({ muted: true, character: 'female', checkpoint: run, cleared: true });
  });

  it('survives corrupt / hostile data', () => {
    const s = mem();
    s.setItem('low-battery-save-v1', '{nope');
    expect(loadSave(s)).toEqual(defaultSave());
    s.setItem('low-battery-save-v1', JSON.stringify({ muted: 'yes', character: 'robot', checkpoint: { world: 'x' } }));
    expect(loadSave(s)).toEqual(defaultSave());
  });

  it('works without storage and when storage throws', () => {
    expect(loadSave(null)).toEqual(defaultSave());
    const broken: KV = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(loadSave(broken)).toEqual(defaultSave());
    expect(() => updateSave({ muted: true }, broken)).not.toThrow();
  });

  it('updateSave merges', () => {
    const s = mem();
    updateSave({ character: 'female' }, s);
    updateSave({ muted: true }, s);
    expect(loadSave(s)).toMatchObject({ character: 'female', muted: true });
  });
});

describe('upgrade descriptions', () => {
  it('every upgrade shows an increasing (or, for damage taken, decreasing) value', async () => {
    const { describeChange } = await import('../../src/game/data/upgrades');
    for (const u of UPGRADES) {
      const ch = describeChange(u, {}, 50);
      expect(ch.label.length, u.id).toBeGreaterThan(2);
      expect(ch.from, u.id).not.toBe(ch.to);
    }
  });

  it('formats numbers plainly', async () => {
    const { describeChange } = await import('../../src/game/data/upgrades');
    expect(describeChange(getUpgrade('poly'), {}, 50)).toEqual({ label: 'Pings per shot', from: '1', to: '2' });
    expect(describeChange(getUpgrade('charger'), {}, 90)).toEqual({ label: 'Battery', from: '90%', to: '100%' });
    expect(describeChange(getUpgrade('saver'), {}, 50).to).toMatch(/s$/);
  });

  it('descriptions are short enough to fit the card on one line', () => {
    for (const u of UPGRADES) expect(u.desc.length, u.desc).toBeLessThanOrEqual(24);
  });

  it('every upgrade icon exists', async () => {
    const { SPRITES } = await import('../../src/game/sprites');
    for (const u of UPGRADES) expect(SPRITES[u.icon as keyof typeof SPRITES], u.icon).toBeDefined();
  });
});
