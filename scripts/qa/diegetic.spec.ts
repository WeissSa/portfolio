import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import {
  HOME_VIEWPOINT_DATA,
  PLAQUE,
  plaqueProjection,
} from '../../src/scene/diegetic';

/**
 * Commit 4/4b objective diegetic framing harness. Runs against the production
 * bundle with the same HOME camera the scene uses. It measures the REAL DOM
 * opacity overlap (not just CSS class assumptions) and the projected letter
 * height, so "framed + legible" is a measurable gate rather than a claim.
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
  optIn?: boolean;
  mode?: '2d' | '3d';
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

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.scene-layer--ready')).toBeAttached();
  await page.waitForTimeout(SETTLE_MS);
  const webgl2 = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ok = gl !== null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  });
  expect(webgl2, 'genuine WebGL2 evidence').toBe(true);
}

/** Sum of opaque DOM rects intersecting the plaque, clipped to the plaque. */
async function opaqueOverlap(
  page: Page,
  rect: ReturnType<typeof plaqueProjection>['rect'],
) {
  return page.evaluate((region) => {
    const isHidden = (el: HTMLElement, style: CSSStyleDeclaration) =>
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) < 0.1 ||
      el.getBoundingClientRect().width <= 2 ||
      style.clipPath === 'inset(50%)';
    const alpha = (color: string) => {
      const match = color.match(/rgba?\([^)]*,\s*([\d.]+)\)/);
      if (!match) return color === 'transparent' ? 0 : 1;
      return Number(match[1]);
    };
    let overlap = 0;
    const blockers: string[] = [];
    for (const el of Array.from(
      document.querySelectorAll('main *, nav *, .zone-title-hud'),
    )) {
      const node = el as HTMLElement;
      const style = getComputedStyle(node);
      if (isHidden(node, style)) continue;
      const ownText = Array.from(node.childNodes).some(
        (child) =>
          child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
      const opaque = alpha(style.backgroundColor) > 0.5 || ownText;
      if (!opaque) continue;
      const box = node.getBoundingClientRect();
      const x = Math.max(box.left, region.left);
      const y = Math.max(box.top, region.top);
      const w = Math.min(box.right, region.right) - x;
      const h = Math.min(box.bottom, region.bottom) - y;
      if (w > 0 && h > 0) {
        overlap += w * h;
        blockers.push(
          `${node.tagName.toLowerCase()}.${node.className}`.slice(0, 80),
        );
      }
    }
    return { overlap, blockers };
  }, rect);
}

test.describe('diegetic plaque framing + reveal-on-focus', () => {
  test('plaque is framed, legible and not occluded by opaque DOM', async ({
    browser,
  }) => {
    const context = await contextFor(browser, { viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('#/');
    await ready(page);
    const { rect, capHeightPx } = plaqueProjection(
      HOME_VIEWPOINT_DATA,
      DESKTOP,
    );
    expect(PLAQUE.width, 'plaque >= 1.5 m').toBeGreaterThanOrEqual(1.5);
    expect(capHeightPx, 'rendered caps >= 20px').toBeGreaterThanOrEqual(20);
    expect(rect.right, 'plaque stays in the clean left band').toBeLessThan(
      DESKTOP.width * 0.5,
    );
    const { overlap, blockers } = await opaqueOverlap(page, rect);
    const plaqueArea = rect.width * rect.height;
    expect(
      overlap / plaqueArea,
      `opaque DOM overlap ${(overlap / plaqueArea) * 100}% (${blockers.join(', ')})`,
    ).toBeLessThan(0.3);
    await page.screenshot({ path: resolve(SHOTS, 'desktop_3d_plaque.png') });
    await context.close();
  });

  test('sr-only DOM menu reveals focus and mirrors the canonical route', async ({
    browser,
  }) => {
    const context = await contextFor(browser, { viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('#/');
    await ready(page);
    const nav = page.locator('nav[aria-label="Main menu"]');
    const hiddenWidth = await nav.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(hiddenWidth, 'menu is sr-only in 3D desktop').toBeLessThanOrEqual(2);

    await nav.locator('a[data-route="/about"]').focus();
    await expect(nav.locator('.main-menu__focus-chip')).toBeVisible();
    const shown = await nav.evaluate((el) => el.getBoundingClientRect().width);
    expect(shown, 'focus reveals a visible menu').toBeGreaterThan(100);
    expect(
      await page.evaluate(
        () => (document.activeElement as HTMLElement)?.dataset.route,
      ),
    ).toBe('/about');
    await expect(nav.locator('a[data-route="/about"]')).toHaveClass(
      /p5-btn--diegetic-highlight/,
    );
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_menu-focus.png'),
    });
    await context.close();
  });

  test('reduced-motion opt-in uses static cuts, HUD and frozen grain', async ({
    browser,
  }) => {
    const context = await contextFor(browser, {
      viewport: DESKTOP,
      reducedMotion: 'reduce',
      optIn: true,
    });
    const page = await context.newPage();
    await page.goto('#/');
    await ready(page);
    await expect(page.locator('.app-static-3d')).toBeAttached();
    const hud = page.locator('.zone-title-hud');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Home');
    // The app publishes the ACTUAL shader clock in reduced-motion 3D; pixel
    // screenshot equality is too brittle under SwiftShader compositing.
    const readTime = () =>
      page.evaluate(() => document.documentElement.dataset.grainTime);
    await page.waitForFunction(() =>
      Boolean(document.documentElement.dataset.grainTime),
    );
    const first = await readTime();
    await page.waitForTimeout(700);
    const second = await readTime();
    expect(first, 'grain uTime must be published').toBeDefined();
    expect(second, 'grain uTime must be frozen').toBe(first);
    // sr-only menu: focus reveals it, Enter follows the same hash link.
    await page.locator('nav a[data-route="/climate"]').focus();
    await page.keyboard.press('Enter');
    await expect(hud).toContainText('Climate');
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_reduced-motion-hud.png'),
    });
    await context.close();
  });

  test('coarse pointers keep the DOM menu opaque with 44px targets', async ({
    browser,
  }) => {
    const context = await contextFor(browser, {
      viewport: MOBILE,
      mobile: true,
    });
    const page = await context.newPage();
    await page.goto('#/');
    await ready(page);
    const nav = page.locator('nav[aria-label="Main menu"]');
    await expect(nav).toBeVisible();
    const style = await nav.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        width: el.getBoundingClientRect().width,
        background: cs.backgroundColor,
      };
    });
    expect(style.width).toBeGreaterThan(100);
    expect(
      style.background,
      'opaque DOM menu on coarse pointers',
    ).not.toContain('rgba(0, 0, 0, 0)');
    for (const link of await nav.locator('a[data-route]').all()) {
      const height = await link.evaluate(
        (el) => el.getBoundingClientRect().height,
      );
      expect(height, '44px minimum target').toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: resolve(SHOTS, 'mobile_3d_menu-opaque.png'),
    });
    await context.close();
  });
});
