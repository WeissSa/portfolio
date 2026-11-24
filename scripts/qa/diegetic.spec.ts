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
  CLIMATE_VIEWPOINT_DATA,
  HOME_FOV_DEGREES,
  HOME_VIEWPOINT_DATA,
  PLAQUE,
  PROJECTED_PANEL,
  plaqueProjection,
  framingCamera,
  projectCapHeight,
  projectWorldRect,
  advancePainterlyTime,
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

/** Real keyboard Tab (programmatic focus() does not set :focus-visible). */
async function tabIntoMenu(page: Page): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await page.keyboard.press('Tab');
    const route = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const nav = document.querySelector('nav[aria-label="Main menu"]');
      return nav?.contains(active) ? (active?.dataset.route ?? '') : null;
    });
    if (route !== null) return route;
  }
  throw new Error('Tab never reached the sr-only DOM menu');
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

  test('keyboard reveals the diegetic DOM menu; pointer clicks never do', async ({
    browser,
  }) => {
    const context = await contextFor(browser, { viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('#/');
    await ready(page);
    const nav = page.locator('nav[aria-label="Main menu"]');
    const width = () => nav.evaluate((el) => el.getBoundingClientRect().width);
    expect(await width(), 'menu is sr-only in 3D desktop').toBeLessThanOrEqual(
      2,
    );

    // A mouse click focuses links too — the old :focus-within rule floated the
    // menu over the room. The keyboard-only :has(:focus-visible) must not.
    await page.mouse.click(1200, 780);
    expect(
      await width(),
      'pointer click keeps the room clean',
    ).toBeLessThanOrEqual(2);
    await expect(nav.locator('.main-menu__focus-chip')).toBeHidden();

    const route = await tabIntoMenu(page);
    await expect(nav.locator('.main-menu__focus-chip')).toBeVisible();
    expect(await width(), 'keyboard reveals a visible menu').toBeGreaterThan(
      100,
    );
    expect(
      await page.evaluate(
        () => (document.activeElement as HTMLElement)?.dataset.route,
      ),
    ).toBe(route);
    await expect(nav.locator(`a[data-route="${route}"]`)).toHaveClass(
      /p5-btn--diegetic-highlight/,
    );
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_menu-focus.png'),
    });
    await context.close();
  });

  test('768–1023px fine pointers keep the diegetic right column, no gutter', async ({
    browser,
  }) => {
    const context = await contextFor(browser, {
      viewport: { width: 900, height: 800 },
    });
    const page = await context.newPage();
    await page.goto('#/');
    await ready(page);
    const nav = page.locator('nav[aria-label="Main menu"]');
    expect(
      await nav.evaluate((el) => el.getBoundingClientRect().width),
    ).toBeLessThanOrEqual(2);
    const mainLeft = await page
      .locator('main')
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(
      mainLeft,
      'zone content starts at the 50% clean band',
    ).toBeGreaterThan(420);
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_medium-width.png'),
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
    // The demand frameloop + instant cuts render ZERO frames after the first
    // paint, so a DOM clock written inside useFrame never changes and would
    // "prove" freezing even with a broken clock. Assert the shipped FREEZE
    // DECISION (published once by an effect) + the pure step the pass calls.
    await page.waitForFunction(
      () => document.documentElement.dataset.grainFrozen === 'true',
    );
    expect(
      await page.evaluate(() => document.documentElement.dataset.grainFrozen),
      'PainterlyPass received freezeTime=true',
    ).toBe('true');
    const steps = [0.016, 5, 700];
    const frozen = steps.reduce(
      (time, delta) => advancePainterlyTime(time, delta, true),
      12,
    );
    expect(frozen, 'grain clock holds across every tick').toBe(12);
    expect(
      steps.reduce(
        (time, delta) => advancePainterlyTime(time, delta, false),
        12,
      ),
      'control: an unfrozen clock advances',
    ).toBeGreaterThan(12);
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

  test('CRT dock mirrors the routes only in the monitor close-up (4b)', async ({
    browser,
  }) => {
    const context = await contextFor(browser, { viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('#/about');
    await ready(page);
    // The monitor pick opens the shared DOM desktop and flies the camera to
    // MONITOR_VIEWPOINT. Hide the overlay in the CAPTURE only, so the CRT dock
    // painted into the monitor texture can be photographed in close-up.
    await page.mouse.move(850, 350);
    await page.waitForTimeout(200);
    await page.mouse.click(850, 350);
    await expect(
      page.getByRole('dialog', { name: 'About desktop — full screen' }),
    ).toBeVisible();
    await page.addStyleTag({
      content: '.desktop-zoom { display: none !important; }',
    });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: resolve(SHOTS, 'desktop_3d_crt-menu.png') });
    await context.close();
  });

  test('projected climate-local panel is legible and unoccluded (4b)', async ({
    browser,
  }) => {
    const context = await contextFor(browser, { viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('#/climate');
    await ready(page);
    // The projected strip sits at the bottom of the 1.9×1.07 m screen.
    const stripWorldHeight =
      (PROJECTED_PANEL.stripHeight / PROJECTED_PANEL.textureHeight) *
      PROJECTED_PANEL.screenHeight;
    const stripCenter: [number, number, number] = [
      PROJECTED_PANEL.center[0],
      PROJECTED_PANEL.center[1] -
        PROJECTED_PANEL.screenHeight / 2 +
        stripWorldHeight / 2,
      PROJECTED_PANEL.center[2],
    ];
    const glyphWorld =
      (PROJECTED_PANEL.fontPx / PROJECTED_PANEL.textureHeight) *
      PROJECTED_PANEL.screenHeight;
    const camera = framingCamera(
      CLIMATE_VIEWPOINT_DATA,
      DESKTOP,
      HOME_FOV_DEGREES,
    );
    const cap = projectCapHeight(camera, stripCenter, glyphWorld, DESKTOP);
    expect(cap, 'projected local-menu caps >= 16px').toBeGreaterThanOrEqual(
      PROJECTED_PANEL.minCapPx,
    );
    const rect = projectWorldRect(
      camera,
      stripCenter,
      PROJECTED_PANEL.screenWidth * 0.8,
      stripWorldHeight,
      DESKTOP,
    );
    const { overlap, blockers } = await opaqueOverlap(page, rect);
    expect(
      overlap / (rect.width * rect.height),
      `projected panel overlap ${blockers.join(', ')}`,
    ).toBeLessThan(0.3);
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_projected-panel.png'),
    });
    await context.close();
  });
});
