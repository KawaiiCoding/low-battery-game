import { test } from '@playwright/test';
import { boot, findButton, tapButton, waitScene } from './helpers';
test('debug brief', async ({ page }, info) => {
  const touch = !!info.project.use.hasTouch;
  const errors: string[] = [];
  await boot(page, errors);
  await tapButton(page, 'Title', 'NEW GAME', touch);
  await page.waitForTimeout(200);
  await tapButton(page, 'Title', 'MALE', touch);
  await waitScene(page, 'Story');
  await tapButton(page, 'Story', 'SKIP', touch);
  const st = () => page.evaluate(() => {
    const g = (window as any).__LB.game;
    return ['Game', 'Brief'].map((k) => `${k}:${g.scene.getScene(k).sys.settings.status}`).join(' ');
  });
  for (let i = 0; i < 6; i++) { console.log('T', i, await st()); await page.waitForTimeout(300); }
  console.log('btn', JSON.stringify(await findButton(page, 'Brief', "LET'S GO")));
  console.log('view', JSON.stringify(await page.evaluate(() => (window as any).__LB.view)));
  await tapButton(page, 'Brief', "LET'S GO", touch);
  for (let i = 0; i < 4; i++) { console.log('U', i, await st()); await page.waitForTimeout(300); }
  console.log('errors', JSON.stringify(errors));
});
