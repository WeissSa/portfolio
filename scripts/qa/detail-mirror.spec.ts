import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

/**
 * polish(c) browser contract (no jsdom inert/focus-visible):
 *  - fine-pointer live 3D: the detail DOM survives as an sr-hidden a11y mirror;
 *    keyboard Tab reveals it with a visible focus chip (F1) and Escape restores
 *    focus to the 3D trigger proxy (F2). Pointer users see NO visible dialog.
 *  - every non-picking mode (coarse pointer / reduced-motion opt-in): the same
 *    detail is the ordinary VISIBLE dialog (the in-world surface is suppressed).
 *
 * The projector's "Open projector info panel" DOM button is used as the trigger
 * because it writes `climatePanelOpen` in every mode — unlike the 2D case-card
 * toggle, which only expands an inline card locally.
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
  await page.getByRole('button', { name: 'Open projector info panel' }).click();
}

test('fine-pointer live 3D: F1 reveal-on-focus + F2 focus restore', async ({
  browser,
}) => {
  const context = await contextFor(browser, { mode: '3d' });
  const page = await context.newPage();
  await openProjector(page);

  // Pointer opening: the a11y mirror exists but is sr-hidden (≤2px box).
  const mirror = page.locator('.detail-mirror');
  await expect(mirror).toHaveAttribute('data-detail-surface', 'projector');
  const hidden = await mirror.boundingBox();
  expect(hidden?.width ?? 0).toBeLessThanOrEqual(2);
  await expect(page.locator('.climate-projector-overlay')).toHaveCount(0);
  await expect(page.locator('.post-detail-backdrop')).toHaveCount(0);

  // NATURAL FORWARD TAB from the F2 trigger proxy. The proxy precedes the
  // overlays in App's DOM, so one Tab reaches the mirror (the old 40× Shift+Tab
  // wrap-around hack is gone). Tab sets :focus-visible on the newly focused
  // close button, which is what reveals the mirror; a bare focus() would not.
  await page.locator('#detail-return').focus();
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!document
            .querySelector('.detail-mirror')
            ?.contains(document.activeElement),
      ),
    )
    .toBe(true);
  await expect(mirror).toHaveCSS('position', 'fixed');
  await expect(mirror.locator('.detail-mirror__chip')).toBeVisible();
  const revealed = await mirror.boundingBox();
  expect(revealed?.width ?? 0).toBeGreaterThan(100);
  await page.screenshot({
    path: resolve(SHOTS, 'desktop_3d_detail-mirror-focus.png'),
  });

  // F2: closing by keyboard returns focus to the in-world trigger proxy.
  await page.keyboard.press('Escape');
  await expect(mirror).toHaveCount(0);
  // The opener was the DOM trigger button (a canvas pick would focus the
  // `#detail-return` proxy instead); either way F2 restores to the opener.
  const restored = await page.evaluate(() => ({
    id: document.activeElement?.id ?? '',
    text: document.activeElement?.textContent?.trim() ?? '',
  }));
  expect(
    restored.id === 'detail-return' ||
      /Open projector info panel/.test(restored.text),
    'focus must return to the trigger that opened the detail',
  ).toBe(true);
  await context.close();
});

test('coarse-pointer 3D: the visible DOM detail is authoritative', async ({
  browser,
}) => {
  const context = await contextFor(browser, {
    mode: '3d',
    mobile: true,
    viewport: MOBILE,
  });
  const page = await context.newPage();
  await openProjector(page);

  await expect(page.locator('.detail-mirror')).toHaveCount(0);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('.post-detail-backdrop')).toBeVisible();
  await page.screenshot({
    path: resolve(SHOTS, 'mobile_3d_climate-detail-fallback.png'),
  });
  await context.close();
});

test('reduced-motion 3D: the visible DOM detail is authoritative', async ({
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
  await expect(page.locator('.detail-mirror')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await context.close();
});
