import { describe, expect, it } from 'vitest';
import { PALETTE, computeViewHeight, VIEW_H_MAX, VIEW_H_MIN } from '../../src/game/constants';
import { SPRITES } from '../../src/game/sprites';
import { gridSize, recolor, validateGrid, flipX } from '../../src/game/pixel';
import { paginate } from '../../src/game/textfit';
import { STORIES } from '../../src/game/data/story';
import { ENEMIES, WORLDS } from '../../src/game/data/worlds';

describe('sprites', () => {
  for (const [key, def] of Object.entries(SPRITES)) {
    it(`${key} has valid, equally-sized frames`, () => {
      expect(def.frames.length).toBeGreaterThan(0);
      const { w, h } = gridSize(def.frames[0]);
      def.frames.forEach((f) => {
        expect(validateGrid(f, PALETTE)).toEqual([]);
        expect(gridSize(f)).toEqual({ w, h });
      });
    });
  }

  it('every animated sprite has a frame rate', () => {
    for (const def of Object.values(SPRITES)) if (def.frames.length > 1) expect('fps' in def && def.fps).toBeTruthy();
  });

  it('player variants exist for both characters', () => {
    expect(SPRITES.player_male).toBeDefined();
    expect(SPRITES.player_female).toBeDefined();
    expect(SPRITES.player_male.frames[0]).not.toEqual(SPRITES.player_female.frames[0]);
  });

  it('every selectable character has a sprite and animation frames', () => {
    for (const c of ['male', 'female'] as const) {
      const key = `player_${c}` as keyof typeof SPRITES;
      expect(SPRITES[key], key).toBeDefined();
      expect(SPRITES[key].frames.length).toBe(2);
    }
  });

  it('pixel helpers work', () => {
    expect(recolor(['ab', 'ba'], { a: 'x' })).toEqual(['xb', 'bx']);
    expect(flipX(['abc'])).toEqual(['cba']);
    expect(validateGrid(['k.', 'k'], PALETTE)[0]).toMatch(/width/);
    expect(validateGrid(['kZ'], PALETTE)[0]).toMatch(/unknown color/);
  });
});

describe('paginate', () => {
  it('splits lines into pages of at most N lines', () => {
    expect(paginate(['1', '2', '3', '4', '5'], 2)).toEqual(['1\n2', '3\n4', '5']);
    expect(paginate([], 3)).toEqual(['']);
    expect(paginate(['a', 'b'], 0)).toEqual(['a', 'b']);
  });
});

describe('story', () => {
  it('every story is non-empty and the ending contains the call-mom choice', () => {
    for (const lines of Object.values(STORIES)) expect(lines.length).toBeGreaterThan(2);
    expect(STORIES.ending.some((l) => l.who === 'choice')).toBe(true);
  });

  it('dialogue lines are short enough to read comfortably', () => {
    for (const lines of Object.values(STORIES)) for (const l of lines) expect(l.text.length, l.text).toBeLessThanOrEqual(100);
  });

  it('first line of each story sets a backdrop', () => {
    for (const lines of Object.values(STORIES)) expect(lines[0].backdrop).toBeTruthy();
  });
});

describe('worlds', () => {
  it('reference real enemies and sprites', () => {
    for (const w of WORLDS) {
      for (const e of w.enemies) expect(ENEMIES[e.id]).toBeDefined();
      expect(SPRITES[w.boss.sprite]).toBeDefined();
      expect(SPRITES[w.boss.angrySprite]).toBeDefined();
      expect(SPRITES[w.boss.bullet]).toBeDefined();
      expect(w.enemies.some((e) => e.from === 0)).toBe(true);
      for (const p of w.boss.patterns) if (p.kind === 'summon') expect(ENEMIES[p.enemy]).toBeDefined();
    }
    for (const e of Object.values(ENEMIES)) {
      expect(SPRITES[e.sprite]).toBeDefined();
      if ('bullet' in e) expect(SPRITES[e.bullet]).toBeDefined();
    }
  });

  it('get harder each world', () => {
    for (let i = 1; i < WORLDS.length; i++) expect(WORLDS[i].boss.hp).toBeGreaterThan(WORLDS[i - 1].boss.hp);
  });
});

describe('view', () => {
  it('adapts height to phone aspect ratios within limits', () => {
    expect(computeViewHeight(390, 844)).toBe(390); // iPhone 14 → 389.5 → even 390
    expect(computeViewHeight(360, 640)).toBe(320);
    expect(computeViewHeight(1920, 1080)).toBe(VIEW_H_MIN);
    expect(computeViewHeight(100, 1000)).toBe(VIEW_H_MAX);
    expect(computeViewHeight(0, 0)).toBe(VIEW_H_MIN);
    expect(computeViewHeight(390, 844) % 2).toBe(0);
  });
});
