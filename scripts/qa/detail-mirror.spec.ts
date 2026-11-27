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

/**
 * Real-browser contract for the ONE readable detail panel (UX fix pass).
 *  - fine-pointer live 3D: opening a detail shows a VISIBLE, scrollable,
 *    focus-trapped dialog with verbatim content, tag chips and links;
 *  - the SAME panel is authoritative in coarse-pointer / reduced-motion
 *    fallbacks — no second dialog implementation;
 *  - Escape and the close control restore focus to the trigger.
 */
const SHOTS = resolve(process.cwd(), 'qa-evidence/screenshots');
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const MODE_KEY = 'portfolio:mode';
const OPTIN_KEY = 'portfolio:reduced-motion-3d';
const SETTLE_MS = 2400;
mkdirSync(SHOTS, { recursive: true });

interface Options {
  viewport?: { width: number; height: number };
  mobile?: boolean;
  reducedMotion?: 'reduce' | 'no-preference';
  mode?: '2d' | '3d';
  optIn?: boolean;
}

async function contextFor(
  browser: Browser,
  options: Options = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: options.viewport ?? DESKTOP,
    deviceScaleFactor: 1,
    isMobile: options.mobile ?? false,
    hasTouch: options.mobile ?? false,
    reducedMotion: options.reducedMotion ?? 'no-preference',
  });
  await context.addInitScript(
    ([modeKey, optKey, mode, optIn]: [string, string, string, boolean]) => {
      if (mode) localStorage.setItem(modeKey, mode);
      if (optIn) localStorage.setItem(optKey, 'true');
    },
    [MODE_KEY, OPTIN_KEY, options.mode ?? '', options.optIn ?? false] as [
      string,
      string,
      string,
      boolean,
    ],
  );
  return context;
}

async function openProjector(page: Page): Promise<void> {
  await page.goto('#/climate');
  await expect(page.locator('#main')).toBeVisible();
  if (await page.locator('.scene-layer').count()) {
    await expect(page.locator('.scene-layer--ready')).toBeAttached();
    await page.waitForTimeout(SETTLE_MS);
  }
  await page.getByRole('button', { name: 'View climate details' }).click();
}

async function assertReadablePanel(
  page: Page,
  viewport: { width: number; height: number } = DESKTOP,
): Promise<void> {
  // Shared value-level contract (no more 14px vs 15px disagreement).
  await assertPanelContract(page, page.locator('.detail-mirror'), viewport);
  await expect(
    page.locator('.detail-mirror').getByRole('button', { name: /Close/ }),
  ).toBeVisible();
}

test('fine-pointer live 3D: the detail panel is visible and scrollable', async ({
  browser,
}) => {
  const context = await contextFor(browser, { mode: '3d' });
  const page = await context.newPage();
  await openProjector(page);
  const panel = page.locator('.detail-mirror');
  await expect(panel).toHaveAttribute('data-detail-surface', 'projector');
  await assertReadablePanel(page);
  await expect(panel.getByText(/Is Today Weirdly Hot/i)).toBeVisible();
  await expect(
    panel.getByRole('link', { name: 'Climate Defense Fund of Ontario' }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(SHOTS, 'desktop_3d_detail-panel-visible.png'),
  });

  // Scroll to the very bottom: content must remain readable, not truncated.
  await panel
    .locator('.detail-mirror__body')
    .evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.screenshot({
    path: resolve(SHOTS, 'desktop_3d_detail-panel-scrolled.png'),
  });

  // Escape closes and restores focus to the opener.
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  const restored = await page.evaluate(() => ({
    id: document.activeElement?.id ?? '',
    text: document.activeElement?.textContent?.trim() ?? '',
  }));
  expect(
    restored.id === 'detail-return' ||
      /View climate details/.test(restored.text),
    'focus must return to the trigger that opened the detail',
  ).toBe(true);
  await context.close();
});

test('coarse-pointer 3D: the same visible panel is authoritative', async ({
  browser,
}) => {
  const context = await contextFor(browser, {
    mode: '3d',
    mobile: true,
    viewport: MOBILE,
  });
  const page = await context.newPage();
  await openProjector(page);
  await expect(page.locator('.detail-mirror')).toBeVisible();
  await expect(page.locator('.detail-mirror')).toHaveAttribute(
    'aria-modal',
    'true',
  );
  await expect(page.locator('#detail-return')).toHaveCount(0);
  await page.screenshot({
    path: resolve(SHOTS, 'mobile_3d_detail-panel.png'),
  });
  await context.close();
});

test('reduced-motion 3D: the same visible panel is authoritative', async ({
  browser,
}) => {
  const context = await contextFor(browser, {
    mode: '3d',
    reducedMotion: 'reduce',
    optIn: true,
  });
  const page = await context.newPage();
  await openProjector(page);
  await expect(page.locator('.app-static-3d')).toBeAttached();
  await expect(page.locator('.detail-mirror')).toBeVisible();
  await expect(page.locator('#detail-return')).toHaveCount(0);
  await context.close();
});
