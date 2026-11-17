import { expect, test } from '@playwright/test';
import {
  activeScenes, advanceStoryUntil, boot, callGame, expectNoTextOverflow, gameState, handleOverlays,
  enterGame, shot, tap, tapButton, touchDrag, waitGame, waitScene,
} from './helpers';

test.describe('Low Battery', () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    await boot(page, errors);
  });

  test.afterEach(() => {
    expect(errors, 'no console/page errors').toEqual([]);
  });

  test('full playthrough: character select, story, 3 worlds, bosses, ending', async ({ page }, info) => {
    const touch = !!info.project.use.hasTouch;
    await expectNoTextOverflow(page);
    await shot(page, info, '01-title');

    // New game → character select → female
    await tapButton(page, 'Title', 'NEW GAME', touch);
    await page.waitForTimeout(200);
    await expectNoTextOverflow(page);
    await shot(page, info, '02-character-select');
    await tapButton(page, 'Title', 'FEMALE', touch);
    await waitScene(page, 'Story');
    await page.waitForTimeout(500);
    await shot(page, info, '03-story');

    // Story intro: tap through every line, checking text fits each time
    await advanceStoryUntil(page, 'Game', touch);
    await waitScene(page, 'Brief');
    await page.waitForTimeout(500);
    await expectNoTextOverflow(page);
    await shot(page, info, '03b-mission');
    await enterGame(page, touch);
    await expectNoTextOverflow(page);

    // The chosen character is used
    const texKey = await page.evaluate(() => (window as any).__LB.game.scene.getScene('Game').player.texture.key);
    expect(texKey).toBe('player_female');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('low-battery-save-v1')!).character)).toBe('female');

    // Joystick: drag right → player moves right
    const before = (await gameState(page)).player;
    await touchDrag(page, [60, 200], [110, 200], 700, touch);
    const after = (await gameState(page)).player;
    expect(after.x - before.x).toBeGreaterThan(20);
    // Released → stops moving
    await page.waitForTimeout(200);
    const p1 = (await gameState(page)).player;
    await page.waitForTimeout(300);
    const p2 = (await gameState(page)).player;
    expect(Math.abs(p2.x - p1.x)).toBeLessThan(1);

    // Play a few seconds for real: enemies spawn, auto-aim kills them, battery drains
    await callGame(page, 'debugGod', true);
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500);
      await handleOverlays(page, touch);
    }
    let s = await gameState(page);
    expect(s.phase).toBe('waves');
    expect(s.enemies).toBeGreaterThan(0);
    expect(s.kills).toBeGreaterThan(0);
    expect(s.battery).toBeLessThan(100);
    await expectNoTextOverflow(page);
    await shot(page, info, '04-gameplay');

    // Level-up screen
    await callGame(page, 'debugAddXp', 40);
    await waitScene(page, 'LevelUp');
    await page.waitForTimeout(500);
    await expectNoTextOverflow(page);
    await shot(page, info, '05-levelup');
    const upgradesBefore = Object.values((await gameState(page)).upgrades).reduce((a: number, b) => a + (b as number), 0);
    const batteryBefore = (await gameState(page)).battery;
    await handleOverlays(page, touch);
    for (let i = 0; i < 10 && (await activeScenes(page)).includes('LevelUp'); i++) await handleOverlays(page, touch);
    s = await gameState(page);
    const upgradesAfter = Object.values(s.upgrades).reduce((a: number, b) => a + (b as number), 0);
    expect(upgradesAfter > upgradesBefore || s.battery > batteryBefore).toBe(true);
    expect((await activeScenes(page)).includes('Game')).toBe(true);

    // Clear all three worlds
    for (let w = 0; w < 3; w++) {
      await callGame(page, 'debugGod', true);
      // This world's special twist event
      await callGame(page, 'debugEvent');
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(200);
        await handleOverlays(page, touch);
      }
      await expectNoTextOverflow(page);
      await shot(page, info, `06-event-world${w + 1}`);
      await callGame(page, 'debugSkipToBoss');
      await waitGame(page, "s.boss && s.boss.mode === 'fight'", touch);
      if (w === 0) await shot(page, info, '06-boss');
      s = await gameState(page);
      expect(s.phase).toBe('boss');
      expect(s.world).toBe(w);
      // half HP → enraged, then finish
      await callGame(page, 'debugDamageBoss', s.boss!.hp / 2 + 1);
      await page.waitForTimeout(1500);
      await handleOverlays(page, touch);
      await waitGame(page, "s.boss && s.boss.mode === 'fight'", touch);
      await callGame(page, 'debugDamageBoss', 99999);
      expect((await gameState(page)).phase).toBe('clear');
      // Wait for the clear sequence, picking any level-ups that appear
      for (let i = 0; i < 80 && !(await activeScenes(page)).includes('Story'); i++) {
        await handleOverlays(page, touch);
        await page.waitForTimeout(200);
      }
      await waitScene(page, 'Story');
      await page.waitForTimeout(400);
      if (w < 2) {
        await advanceStoryUntil(page, 'Game', touch);
        await enterGame(page, touch);
        expect((await gameState(page)).world).toBe(w + 1);
        expect((await gameState(page)).battery).toBeGreaterThan(99);
        await shot(page, info, `07-world${w + 2}`);
      }
    }

    // Ending, including the "Call Mom" choice
    let sawChoice = false;
    await advanceStoryUntil(page, '__never__', touch, async () => {
      sawChoice = true;
      await shot(page, info, '08-call-mom');
    });
    expect(sawChoice).toBe(true);
    await page.waitForTimeout(400);
    await expectNoTextOverflow(page);
    await shot(page, info, '09-the-end');
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('low-battery-save-v1')!));
    expect(save.cleared).toBe(true);
    expect(save.checkpoint).toBeNull();
    await tapButton(page, 'Story', 'PLAY AGAIN', touch);
    await waitScene(page, 'Title');
  });

  test('dying shows game over and retry restarts the same world', async ({ page }, info) => {
    const touch = !!info.project.use.hasTouch;
    await tapButton(page, 'Title', 'NEW GAME', touch);
    await page.waitForTimeout(200);
    await tapButton(page, 'Title', 'MALE', touch);
    await waitScene(page, 'Story');
    await tapButton(page, 'Story', 'SKIP', touch);
    await enterGame(page, touch);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).__LB.game.scene.getScene('Game').player.texture.key)).toBe('player_male');
    await callGame(page, 'debugSetBattery', 0.01);
    await waitScene(page, 'GameOver', 10000);
    await page.waitForTimeout(600);
    await expectNoTextOverflow(page);
    await shot(page, info, '10-game-over');
    await tapButton(page, 'GameOver', 'PLUG IN', touch);
    await enterGame(page, touch);
    await page.waitForTimeout(300);
    const s = await gameState(page);
    expect(s.phase).toBe('waves');
    expect(s.world).toBe(0);
    expect(s.battery).toBeGreaterThan(98);
    // physics must be running again after the death pause
    const a = s.player;
    await touchDrag(page, [90, 200], [90, 150], 600, touch);
    expect((await gameState(page)).player.y).toBeLessThan(a.y - 15);
  });

  test('pause, mute and continue work', async ({ page }, info) => {
    const touch = !!info.project.use.hasTouch;
    await tapButton(page, 'Title', 'NEW GAME', touch);
    await page.waitForTimeout(200);
    await tapButton(page, 'Title', 'MALE', touch);
    await waitScene(page, 'Story');
    await tapButton(page, 'Story', 'SKIP', touch);
    await enterGame(page, touch);

    // HUD mute button (left of pause)
    const W = await page.evaluate(() => (window as any).__LB.view.w);
    await tap(page, W - 29, 10, touch);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('low-battery-save-v1')!).muted)).toBe(true);
    await tap(page, W - 29, 10, touch);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('low-battery-save-v1')!).muted)).toBe(false);

    // Pause freezes the game
    await tap(page, W - 11, 10, touch);
    await waitScene(page, 'Pause');
    await expectNoTextOverflow(page);
    await shot(page, info, '11-pause');
    const b1 = (await gameState(page)).battery;
    await page.waitForTimeout(1200);
    expect((await gameState(page)).battery).toBe(b1);
    await tapButton(page, 'Pause', 'SOUND', touch);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('low-battery-save-v1')!).muted)).toBe(true);
    await tapButton(page, 'Pause', 'RESUME', touch);
    await page.waitForTimeout(800);
    expect((await activeScenes(page)).includes('Pause')).toBe(false);
    expect((await gameState(page)).battery).toBeLessThan(b1);

    // Quit → Title shows CONTINUE (checkpoint saved)
    await tap(page, W - 11, 10, touch);
    await waitScene(page, 'Pause');
    await tapButton(page, 'Pause', 'QUIT', touch);
    await waitScene(page, 'Title');
    await page.waitForTimeout(400);
    await expectNoTextOverflow(page);
    await tapButton(page, 'Title', 'CONTINUE', touch);
    await enterGame(page, touch);
    expect((await gameState(page)).world).toBe(0);
  });

  test('the player can never leave the arena walls', async ({ page }, info) => {
    const touch = !!info.project.use.hasTouch;
    await tapButton(page, 'Title', 'NEW GAME', touch);
    await page.waitForTimeout(200);
    await tapButton(page, 'Title', 'MALE', touch);
    await waitScene(page, 'Story');
    await tapButton(page, 'Story', 'SKIP', touch);
    await enterGame(page, touch);
    await callGame(page, 'debugGod', true);
    const { arena } = await gameState(page);
    const cx = arena.w / 2;
    const cy = arena.h / 2;
    const pushes: [number, number, [number, number], [number, number]][] = [
      [arena.wall + 20, cy, [90, 200], [40, 200]], // left
      [arena.w - arena.wall - 20, cy, [90, 200], [140, 200]], // right
      [cx, arena.wall + 20, [90, 200], [90, 150]], // top
      [cx, arena.h - arena.wall - 20, [90, 200], [90, 250]], // bottom
    ];
    for (const [x, y, from, to] of pushes) {
      await callGame(page, 'debugTeleport', x, y);
      await touchDrag(page, from, to, 900, touch);
      await handleOverlays(page, touch);
      const b = (await gameState(page)).playerBounds;
      expect(b.left).toBeGreaterThanOrEqual(arena.wall);
      expect(b.top).toBeGreaterThanOrEqual(arena.wall);
      expect(b.right).toBeLessThanOrEqual(arena.w - arena.wall);
      expect(b.bottom).toBeLessThanOrEqual(arena.h - arena.wall);
      // and it actually reached the wall (within a few px)
      const gap = Math.min(b.left - arena.wall, b.top - arena.wall, arena.w - arena.wall - b.right, arena.h - arena.wall - b.bottom);
      expect(gap).toBeLessThan(4);
    }
    await shot(page, info, '12-wall');
  });
});
