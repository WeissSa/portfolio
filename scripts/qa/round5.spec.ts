/**
 * Round-5 owner bugs, verified in a real browser (SwiftShader WebGL2):
 *  1. ONE surface per content — no duplicate detail/zone heading or body;
 *  2. wheel scroll works on open, before any Tab focus;
 *  3. no developer/internal jargon in rendered text;
 *  4. panels fit 1440x900 and 390x844 without clipping or menu overlap.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { assertPanelContract } from './panel-contract';

const SHOTS = resolve(process.cwd(), 'qa-evidence/screenshots');
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const MODE_KEY = 'portfolio:mode';
const SETTLE_MS = 2400;
mkdirSync(SHOTS, { recursive: true });

async function contextFor(
  browser: Browser,
  viewport: { width: number; height: number },
  mobile = false,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript((key: string) => {
    localStorage.setItem(key, '3d');
  }, MODE_KEY);
  return context;
}

async function settle(page: Page, hash: string): Promise<void> {
  await page.goto(hash);
  await expect(page.locator('#main')).toBeVisible();
  await expect(page.locator('.scene-layer--ready')).toBeAttached();
  await page.waitForTimeout(SETTLE_MS);
}

/** Real pointer pick on the canvas; no store injection, no keyboard shortcut. */
async function pick(
  page: Page,
  x: number,
  y: number,
  surface: string,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(200);
    await page.mouse.click(x, y);
    try {
      await expect(
        page.locator(`.detail-mirror[data-detail-surface="${surface}"]`),
      ).toHaveCount(1, { timeout: 1500 });
      return;
    } catch {
      await page.waitForTimeout(1500);
    }
  }
  throw new Error(`${surface}: pointer pick at (${x},${y}) never landed`);
}

async function assertNoDuplicateZone(
  page: Page,
  attribute: string,
): Promise<void> {
  // The zone behind an open detail is not mounted: the detail's card is the
  // only copy of that content anywhere in the DOM.
  await expect(page.locator(`#main [${attribute}]`)).toHaveCount(0);
}

test('desktop: picked book shows one copy, scrolls on open, no jargon', async ({
  browser,
}) => {
  const context = await contextFor(browser, DESKTOP);
  const page = await context.newPage();
  await settle(page, '#/experience');
  await pick(page, 664, 378, 'book');
  await assertPanelContract(page, page.locator('.detail-mirror'), DESKTOP);
  await assertNoDuplicateZone(page, 'data-post-id');
  await page.screenshot({
    path: resolve(SHOTS, 'desktop_round5_book_one_surface.png'),
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('.detail-mirror')).toHaveCount(0);
  await expect(page.locator('#main [data-post-id]').first()).toBeVisible();
  await context.close();
});

test('desktop: picked case and monitor each use the single frame', async ({
  browser,
}) => {
  const context = await contextFor(browser, DESKTOP);
  const page = await context.newPage();
  await settle(page, '#/projects');
  await pick(page, 900, 440, 'case');
  await assertPanelContract(page, page.locator('.detail-mirror'), DESKTOP);
  await assertNoDuplicateZone(page, 'data-project-id');
  await page.keyboard.press('Escape');

  await settle(page, '#/about');
  await pick(page, 850, 350, 'monitor');
  await assertPanelContract(page, page.locator('.detail-mirror'), DESKTOP);
  await context.close();
});

test('desktop: climate detail replaces the zone view (one ClimateView)', async ({
  browser,
}) => {
  const context = await contextFor(browser, DESKTOP);
  const page = await context.newPage();
  await settle(page, '#/climate');
  await page.getByRole('button', { name: 'View climate details' }).click();
  await assertPanelContract(page, page.locator('.detail-mirror'), DESKTOP);
  // No idPrefix duplicate and no second statement behind the panel.
  await expect(page.locator('#main #climate-heading')).toHaveCount(0);
  await expect(page.locator('.detail-mirror #climate-heading')).toHaveCount(1);
  await context.close();
});

test('mobile 390x844: the same panel fits, scrolls and stays clear', async ({
  browser,
}) => {
  const context = await contextFor(browser, MOBILE, true);
  const page = await context.newPage();
  await settle(page, '#/climate');
  await page.getByRole('button', { name: 'View climate details' }).click();
  await assertPanelContract(page, page.locator('.detail-mirror'), MOBILE);
  // Coarse pointer: no pointer menu strip to overlap the panel.
  await expect(page.locator('.pointer-menu-strip')).toHaveCount(0);
  await page.screenshot({
    path: resolve(SHOTS, 'mobile_round5_detail_panel.png'),
  });
  await context.close();
});
