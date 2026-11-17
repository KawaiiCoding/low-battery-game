import { expect, type Page, type TestInfo } from '@playwright/test';

type Win = { __LB: { game: any; view: { w: number; h: number; zoom: number } } };

export async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto('/?test');
  await page.waitForFunction(() => (window as unknown as Win).__LB?.game?.scene?.isActive('Title'));
  await page.waitForTimeout(400);
}

export async function activeScenes(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as unknown as Win).__LB.game.scene.getScenes(true).map((s: any) => s.scene.key),
  );
}

export async function waitScene(page: Page, key: string, timeout = 15000) {
  await page.waitForFunction((k) => (window as unknown as Win).__LB.game.scene.isActive(k), key, { timeout });
}

/** Converts game coordinates to page coordinates. */
async function toPage(page: Page, gx: number, gy: number) {
  return page.evaluate(
    ([x, y]) => {
      const { game: g, view } = (window as unknown as Win).__LB;
      const r = g.canvas.getBoundingClientRect();
      return { x: r.left + (x * r.width) / view.w, y: r.top + (y * r.height) / view.h };
    },
    [gx, gy],
  );
}

export async function tap(page: Page, gx: number, gy: number, touch: boolean) {
  const p = await toPage(page, gx, gy);
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(60);
}

/** Real multi-step touch drag via CDP (so the joystick sees touchstart/move/end). */
export async function touchDrag(page: Page, from: [number, number], to: [number, number], holdMs: number, touch: boolean) {
  const a = await toPage(page, ...from);
  const b = await toPage(page, ...to);
  if (!touch) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
    await page.waitForTimeout(holdMs);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8) });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Finds an interactive container in `sceneKey` whose text starts with `label`; returns its screen position. */
export async function findButton(page: Page, sceneKey: string, label: string) {
  return page.evaluate(
    ([key, lab]) => {
      const scene = (window as unknown as Win).__LB.game.scene.getScene(key);
      const texts = (c: any): string[] =>
        (c.list ?? []).flatMap((o: any) => (o.type === 'Text' ? [o.text] : o.list ? texts(o) : []));
      for (const o of scene.children.list) {
        if (o.type !== 'Container' || !o.input?.enabled || !o.visible) continue;
        if (texts(o).some((t: string) => t.startsWith(lab))) return { x: o.x, y: o.y };
      }
      return null;
    },
    [sceneKey, label],
  );
}

export async function tapButton(page: Page, sceneKey: string, label: string, touch: boolean) {
  const b = await findButton(page, sceneKey, label);
  expect(b, `button "${label}" in ${sceneKey}`).not.toBeNull();
  await tap(page, b!.x, b!.y, touch);
}

/**
 * Asserts every visible screen-space text in active scenes is fully on screen,
 * and that dialogue text stays inside the dialogue box.
 */
export async function expectNoTextOverflow(page: Page) {
  const problems = await page.evaluate(() => {
    const { game: g, view } = (window as unknown as Win).__LB;
    const W = view.w;
    const H = view.h;
    const out: string[] = [];
    const placed: { scene: string; text: string; b: any }[] = [];
    const visit = (o: any, scene: string, inFixed: boolean) => {
      if (!o.visible || o.alpha === 0) return;
      const fixed = inFixed || o.scrollFactorX === 0 || scene !== 'Game';
      if (o.type === 'Container') {
        o.list.forEach((c: any) => visit(c, scene, fixed));
        return;
      }
      if (o.type !== 'Text' || !o.text || !fixed) return;
      const b = o.getBounds();
      if (o.alpha > 0.5) placed.push({ scene, text: o.text, b });
      if (b.x < -0.5 || b.y < -0.5 || b.right > W + 0.5 || b.bottom > H + 0.5) {
        out.push(`${scene}: "${o.text.replace(/\n/g, ' / ')}" bounds ${b.x.toFixed(1)},${b.y.toFixed(1)}-${b.right.toFixed(1)},${b.bottom.toFixed(1)} outside ${W}x${H}`);
      }
    };
    for (const s of g.scene.getScenes(true)) s.children.list.forEach((o: any) => visit(o, s.scene.key, false));
    // No two texts in the same scene may overlap
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const c = placed[j];
        if (a.scene !== c.scene) continue;
        const ix = Math.min(a.b.right, c.b.right) - Math.max(a.b.x, c.b.x);
        const iy = Math.min(a.b.bottom, c.b.bottom) - Math.max(a.b.y, c.b.y);
        if (ix > 1 && iy > 1) out.push(`${a.scene}: "${a.text.replace(/\n/g, ' / ')}" overlaps "${c.text.replace(/\n/g, ' / ')}"`);
      }
    }
    const missing = (o: any, scene: string) => {
      if (o.type === 'Container') return o.list.forEach((c: any) => missing(c, scene));
      if (o.visible && o.texture?.key === '__MISSING') out.push(`${scene}: object uses a missing texture`);
    };
    for (const s of g.scene.getScenes(true)) s.children.list.forEach((o: any) => missing(o, s.scene.key));
    const story = g.scene.getScene('Story');
    if (g.scene.isActive('Story') && story.box?.visible) {
      const body = story.bodyText.getBounds();
      const boxTop = story.box.y;
      const boxBottom = boxTop + 92;
      if (body.bottom > boxBottom - 2 || body.right > W - 6) out.push(`Story: dialogue text overflows box (${body.bottom} > ${boxBottom - 2})`);
    }
    return out;
  });
  expect(problems).toEqual([]);
}

export async function gameState(page: Page) {
  return page.evaluate(() => (window as unknown as Win).__LB.game.scene.getScene('Game').debugState());
}

export async function callGame(page: Page, method: string, ...args: unknown[]) {
  await page.evaluate(
    ([m, a]) => (window as unknown as Win).__LB.game.scene.getScene('Game')[m as string](...(a as unknown[])),
    [method, args] as const,
  );
}

/** Picks the first card whenever the level-up screen shows, resumes if paused by focus loss. */
export async function handleOverlays(page: Page, touch: boolean) {
  const scenes = await activeScenes(page);
  if (scenes.includes('Brief')) {
    await page.waitForTimeout(450);
    await expectNoTextOverflow(page);
    await tapButton(page, 'Brief', "LET'S GO", touch);
    await page.waitForTimeout(100);
  } else if (scenes.includes('LevelUp')) {
    await page.waitForTimeout(450);
    await expectNoTextOverflow(page);
    // Two-step: the CHOOSE button is disabled until a card is selected
    expect(await page.evaluate(() => (window as any).__LB.game.scene.getScene('LevelUp').children.list.some((o: any) => o.type === 'Container' && o.alpha < 1 && o.list?.some((t: any) => t.text === 'TAP A POWER ABOVE')))).toBe(true);
    const card = await findButton(page, 'LevelUp', '');
    await tap(page, card!.x, card!.y, touch);
    await page.waitForTimeout(150);
    await expectNoTextOverflow(page);
    await tapButton(page, 'LevelUp', 'CHOOSE', touch);
  } else if (scenes.includes('Pause')) {
    await tapButton(page, 'Pause', 'RESUME', touch);
  }
}

export async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
}

export async function advanceStoryUntil(page: Page, until: string, touch: boolean, onChoice?: () => Promise<void>) {
  const { height: H } = await page.evaluate(() => ({ height: (window as unknown as Win).__LB.view.h }));
  for (let i = 0; i < 120; i++) {
    const scenes = await activeScenes(page);
    if (scenes.includes(until)) return;
    if (scenes.includes('Story')) {
      const choice = await findButton(page, 'Story', 'CALL MOM');
      if (choice) {
        if (onChoice) await onChoice();
        await page.waitForTimeout(200);
        await tap(page, choice.x, choice.y, touch);
        continue;
      }
      if (await findButton(page, 'Story', 'PLAY AGAIN')) return;
      await expectNoTextOverflow(page);
      await tap(page, 90, H * 0.35, touch); // tap empty area: completes line
      await tap(page, 90, H * 0.35, touch); // tap again: next line/page
    } else {
      await page.waitForTimeout(150);
    }
  }
  throw new Error(`story never reached ${until}`);
}

/** Polls the Game scene state until `pred` is true, dismissing level-ups/pauses along the way. */
export async function waitGame(page: Page, pred: string, touch: boolean, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const ok = await page.evaluate((p) => {
      const s = (window as any).__LB.game.scene.getScene('Game').debugState();
      return new Function('s', `return (${p});`)(s);
    }, pred);
    if (ok) return;
    await handleOverlays(page, touch);
    await page.waitForTimeout(150);
  }
  throw new Error(`timed out waiting for game state: ${pred}`);
}

/** Waits for the Game scene, then dismisses the mission card. */
export async function enterGame(page: Page, touch: boolean) {
  await waitScene(page, 'Game');
  await waitScene(page, 'Brief');
  await handleOverlays(page, touch);
  await page.waitForTimeout(300);
}
