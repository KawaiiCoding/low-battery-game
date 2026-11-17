import { expect, test } from '@playwright/test';
import { boot, enterGame, gameState, tapButton, touchDrag, waitScene } from './helpers';

test('PWA: installable manifest, and the game is fully playable offline after the first visit', async ({ page, context }, info) => {
  const touch = !!info.project.use.hasTouch;
  const errors: string[] = [];
  await boot(page, errors);

  // Manifest is linked and valid
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) return null;
    return (await fetch(link.href)).json();
  });
  expect(manifest?.name).toBe('Low Battery');
  expect(manifest?.display).toBe('fullscreen');
  expect(manifest?.icons?.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);

  // Service worker installed, everything precached, and the page is controlled
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await waitScene(page, 'Title');

  // Go fully offline and reload: the game must still start and play
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__LB?.game?.scene?.isActive('Title'), null, { timeout: 15000 });
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  // The bundled font loaded from the cache (no network)
  expect(await page.evaluate(() => document.fonts.check('8px "Pixelify Sans"'))).toBe(true);

  await page.waitForTimeout(400);
  await tapButton(page, 'Title', 'NEW GAME', touch);
  await page.waitForTimeout(200);
  await tapButton(page, 'Title', 'FEMALE', touch);
  await waitScene(page, 'Story');
  await tapButton(page, 'Story', 'SKIP', touch);
  await enterGame(page, touch);
  const before = (await gameState(page)).player;
  await touchDrag(page, [90, 200], [40, 200], 600, touch);
  expect((await gameState(page)).player.x).toBeLessThan(before.x - 15);
  await page.waitForTimeout(1500);
  expect((await gameState(page)).phase).toBe('waves');

  await context.setOffline(false);
  // Offline means requests fail; only real script errors count
  expect(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e))).toEqual([]);
});
