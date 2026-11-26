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
  SCENE_FAILURE_STORAGE_KEY,
  SCENE_FAILURE_VALUE,
} from '../../src/lib/device-tier';
import { activateControl } from './keyboard-controls';

/**
 * Reproducible capture matrix for draft PR #6 (art-overhaul commit 0).
 *
 * Run with `npm run capture:qa` (build + preview + this spec). Every 3D page
 * asserts a live WebGL2 context; the room seed is the app's fixed default
 * (`the-room` in src/scene/Room.tsx), DPR and viewports are pinned below, so
 * successive runs produce comparable evidence. The full matrix has 49 shots
 * and 3 clips; SwiftShader software rendering is slow, so `workers: 1` in the
 * config avoids contention. The fixed-pixel 3D picks (book/case/monitor) are
 * intentional real-pick evidence but a KNOWN FRAGILITY: recalibrate their
 * coordinates after any geometry/layout change (REPORT.md D4).
 */
const SHOTS = resolve(process.cwd(), 'qa-evidence/screenshots');
const CLIPS = resolve(process.cwd(), 'qa-evidence/recordings');
const VIDEO_TMP = resolve(process.cwd(), 'qa-evidence/.artifacts/video');
const SWIFT_SETTLE_MS = 2400; // 520 ms fade + damped camera flight
const MODE_KEY = 'portfolio:mode';

const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 768, height: 1024 };
const MOBILE = { width: 390, height: 844 };

type Viewport = typeof DESKTOP | typeof TABLET | typeof MOBILE;

interface CaptureOptions {
  viewport: Viewport;
  dpr?: number;
  mobile?: boolean;
  mode?: '2d' | '3d';
  webgl2?: boolean;
  saveData?: boolean;
  reducedMotion?: 'reduce' | 'no-preference';
  sceneFailure?: boolean;
  recordVideo?: { width: number; height: number };
}

mkdirSync(SHOTS, { recursive: true });
mkdirSync(CLIPS, { recursive: true });

async function newCaptureContext(
  browser: Browser,
  options: CaptureOptions,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: options.viewport,
    deviceScaleFactor: options.dpr ?? 1,
    isMobile: options.mobile ?? false,
    hasTouch: options.mobile ?? false,
    reducedMotion: options.reducedMotion ?? 'no-preference',
    ...(options.recordVideo
      ? { recordVideo: { dir: VIDEO_TMP, size: options.recordVideo } }
      : {}),
  });
  if (options.mode === '2d') {
    await context.addInitScript(
      ([key, value]: [string, string]) => localStorage.setItem(key, value),
      [MODE_KEY, '2d'] as [string, string],
    );
  }
  if (options.sceneFailure) {
    await context.addInitScript(
      ([key, value]: [string, string]) => localStorage.setItem(key, value),
      [SCENE_FAILURE_STORAGE_KEY, SCENE_FAILURE_VALUE] as [string, string],
    );
  }
  if (options.webgl2 === false) {
    // Keep the 2D canvas API intact; only hardware probes are stubbed out.
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ) {
        if (
          kind === 'webgl' ||
          kind === 'webgl2' ||
          kind === 'experimental-webgl'
        ) {
          return null;
        }
        return original.apply(this, [kind, ...rest] as never);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
  }
  if (options.saveData) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { saveData: true },
      });
    });
  }
  return context;
}

async function expectWebGL2(page: Page): Promise<void> {
  const supported = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    const ok = gl !== null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  });
  expect(supported, 'WebGL2 must be live for genuine 3D evidence').toBe(true);
}

async function capture(
  page: Page,
  name: string,
  expect3d: boolean,
): Promise<void> {
  if (expect3d) {
    await expectWebGL2(page);
    await page.locator('.scene-layer--ready').waitFor({ state: 'attached' });
    await page.waitForTimeout(SWIFT_SETTLE_MS);
  } else {
    await page.waitForTimeout(500);
    // The 2D heatmap itself uses a <canvas>; the absence of the scene layer
    // is the real assertion that 3D never mounted on a fallback path.
    await expect(page.locator('.scene-layer')).toHaveCount(0);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    `${name}: no horizontal page overflow`,
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
}

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`#/${route}`);
  await expect(
    page.locator('nav[aria-label="Main menu"]'),
    'shell must paint before capture',
  ).toBeVisible();
}

/**
 * polish(c): in fine-pointer live 3D the detail DOM survives as an a11y mirror
 * but is sr-hidden (≤2px box, no backdrop/modal). Pointer users see ONLY the
 * in-world object. The `#detail-return` proxy is the F2 focus target.
 */
/**
 * Fixed-pixel picks are calibrated against the settled zone camera. SwiftShader
 * can need more than SWIFT_SETTLE_MS frames after a hash jump, so retry the same
 * pick a couple of times before declaring the coordinate stale.
 */
async function pickDetail(
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
  throw new Error(`${surface}: fixed-pixel pick at (${x},${y}) never landed`);
}

async function expectVisiblePanel(page: Page, surface: string): Promise<void> {
  const mirror = page.locator(
    `.detail-mirror[data-detail-surface="${surface}"]`,
  );
  await expect(mirror).toHaveCount(1);
  await expect(mirror).toBeVisible();
  await expect(mirror).toHaveAttribute('aria-modal', 'true');
  const box = await mirror.boundingBox();
  expect(
    box?.width ?? 0,
    `${surface} panel must be readable, not sr-hidden`,
  ).toBeGreaterThan(300);
  expect(
    box?.height ?? 0,
    `${surface} panel must fit the viewport`,
  ).toBeLessThanOrEqual(900);
  const scroll = await mirror
    .locator('.detail-mirror__body')
    .evaluate((el) => ({
      overflow: getComputedStyle(el).overflowY,
      fontPx: parseFloat(getComputedStyle(el).fontSize),
    }));
  expect(scroll.overflow).toBe('auto');
  expect(scroll.fontPx).toBeGreaterThanOrEqual(14);
  await expect(page.locator('.detail-panel-scrim')).toHaveCount(1);
  await expect(page.locator('#detail-return')).toHaveCount(1);
}

/**
 * D6: detail/desktop dialogs call useInertBackground(true). A hash navigation
 * does NOT unmount them, so the next pick/trigger stays inert and the combined
 * dialog test used to time out at the projector trigger. Close every open
 * dialog (Escape closes the top window first inside DesktopZoom) before moving
 * on; assert it actually closed so a stale inert shell cannot poison the next
 * step silently.
 */
async function closeDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await page.getByRole('dialog').count()) === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('key capture matrix (desktop / tablet / mobile)', () => {
  test('desktop 2D zones', async ({ browser }) => {
    const context = await newCaptureContext(browser, {
      viewport: DESKTOP,
      mode: '2d',
    });
    const page = await context.newPage();
    const routes: Array<[string, string]> = [
      ['', 'desktop_2d_home'],
      ['about', 'desktop_2d_about_windows'],
      ['experience', 'desktop_2d_experience_list'],
      ['projects', 'desktop_2d_projects_list'],
      ['climate', 'desktop_2d_climate_heatmap'],
    ];
    for (const [route, name] of routes) {
      await open(page, route);
      await capture(page, name, false);
    }
    await context.close();
  });

  test('desktop 3D zones', async ({ browser }) => {
    const context = await newCaptureContext(browser, { viewport: DESKTOP });
    const page = await context.newPage();
    for (const [route, name] of [
      ['', 'desktop_3d_home'],
      ['about', 'desktop_3d_about'],
      ['experience', 'desktop_3d_experience'],
      ['projects', 'desktop_3d_projects'],
      ['climate', 'desktop_3d_climate'],
    ] as Array<[string, string]>) {
      await open(page, route);
      await capture(page, name, true);
    }
    await context.close();
  });

  test('desktop 3D details (visible, scrollable DOM panel)', async ({
    browser,
  }) => {
    // Fixed-pixel 3D picks are intentional real-pick evidence, but brittle:
    // recalibrate after geometry/layout changes (REPORT.md defect D4).
    // UX fix: the pick opens the in-world gesture, but the FULL detail is read
    // in a visible, scrollable DOM panel — never truncated painted text.
    const context = await newCaptureContext(browser, { viewport: DESKTOP });
    const page = await context.newPage();

    await open(page, 'experience');
    await capture(page, 'desktop_3d_experience', true);
    await pickDetail(page, 664, 378, 'book');
    await expectVisiblePanel(page, 'book');
    // Camera flies to BOOK_VIEWPOINT and the cover page turns via damp.
    await page.waitForTimeout(2600);
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_book-detail.png'),
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('.detail-mirror')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.activeElement?.id),
      'F2: focus returns to the 3D trigger proxy',
    ).toBe('detail-return');

    await page.goto('#/projects');
    await page.locator('.scene-layer--ready').waitFor({ state: 'attached' });
    await page.waitForTimeout(SWIFT_SETTLE_MS);
    await pickDetail(page, 900, 440, 'case');
    await expectVisiblePanel(page, 'case');
    await page.waitForTimeout(2600);
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_case-detail.png'),
    });
    await closeDialogs(page);

    await page.goto('#/about');
    await page.locator('.scene-layer--ready').waitFor({ state: 'attached' });
    await page.waitForTimeout(SWIFT_SETTLE_MS);
    // Assert the MONITOR mirror specifically (D6: a generic check let a stale
    // pick masquerade as a successful monitor capture).
    await pickDetail(page, 850, 350, 'monitor');
    await expectVisiblePanel(page, 'monitor');
    await page.waitForTimeout(2600);
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_monitor-zoom.png'),
    });
    await closeDialogs(page);

    await page.goto('#/climate');
    await page.locator('.scene-layer--ready').waitFor({ state: 'attached' });
    await page.waitForTimeout(SWIFT_SETTLE_MS);
    await closeDialogs(page);
    await page
      .getByRole('button', { name: 'Open projector info panel' })
      .click();
    await expectVisiblePanel(page, 'projector');
    const projectorMirror = page.locator('.detail-mirror');
    // Wait for CONTENT inside the mirror, not just its shell.
    await expect(
      projectorMirror.getByText(/Is Today Weirdly Hot/i),
    ).toHaveCount(1);
    await page.waitForTimeout(2600);
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_climate-projector-panel.png'),
    });
    await context.close();
  });

  test('desktop delayed-chunk loading state', async ({ browser }) => {
    const context = await newCaptureContext(browser, { viewport: DESKTOP });
    const page = await context.newPage();
    await page.route('**/assets/Room-*.js', async (route) => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
      await route.continue();
    });
    await open(page, '');
    await expect(page.locator('.scene-loading')).toBeVisible();
    await page.screenshot({
      path: resolve(SHOTS, 'desktop_3d_loading.png'),
    });
    await context.close();
  });

  test('desktop auto-2D fallback gates', async ({ browser }) => {
    const fallbacks: Array<[CaptureOptions, string]> = [
      [
        { viewport: DESKTOP, reducedMotion: 'reduce' },
        'desktop_auto2d_reduced-motion_home',
      ],
      [{ viewport: DESKTOP, webgl2: false }, 'desktop_auto2d_no-webgl2_home'],
      [{ viewport: DESKTOP, saveData: true }, 'desktop_auto2d_save-data_home'],
      [
        { viewport: DESKTOP, sceneFailure: true },
        'desktop_auto2d_scene-failed_home',
      ],
    ];
    for (const [options, name] of fallbacks) {
      const context = await newCaptureContext(browser, options);
      const page = await context.newPage();
      await open(page, '');
      await capture(page, name, false);
      await context.close();
    }
  });

  test('tablet 3D zones', async ({ browser }) => {
    const context = await newCaptureContext(browser, { viewport: TABLET });
    const page = await context.newPage();
    for (const [route, name] of [
      ['', 'tablet_3d_home'],
      ['about', 'tablet_3d_about'],
      ['experience', 'tablet_3d_experience'],
      ['projects', 'tablet_3d_projects'],
      ['climate', 'tablet_3d_climate'],
    ] as Array<[string, string]>) {
      await open(page, route);
      await capture(page, name, true);
    }
    await context.close();
  });

  test('mobile 3D zones', async ({ browser }) => {
    const context = await newCaptureContext(browser, {
      viewport: MOBILE,
      dpr: 2,
      mobile: true,
    });
    const page = await context.newPage();
    for (const [route, name] of [
      ['', 'mobile_3d_home'],
      ['about', 'mobile_3d_about'],
      ['experience', 'mobile_3d_experience'],
      ['projects', 'mobile_3d_projects'],
      ['climate', 'mobile_3d_climate'],
    ] as Array<[string, string]>) {
      await open(page, route);
      await capture(page, name, true);
    }
    await context.close();
  });

  test('mobile 2D zones', async ({ browser }) => {
    const context = await newCaptureContext(browser, {
      viewport: MOBILE,
      dpr: 2,
      mobile: true,
      mode: '2d',
    });
    const page = await context.newPage();
    for (const [route, name] of [
      ['', 'mobile_2d_home'],
      ['about', 'mobile_2d_about'],
      ['experience', 'mobile_2d_experience'],
      ['projects', 'mobile_2d_projects'],
      ['climate', 'mobile_2d_climate'],
    ] as Array<[string, string]>) {
      await open(page, route);
      await capture(page, name, false);
    }
    await page.locator('figure').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: resolve(SHOTS, 'mobile_2d_climate_heatmap.png'),
    });
    await context.close();
  });
});

test.describe('recordings', () => {
  test('desktop navigation, mode toggle and mobile zone tap', async ({
    browser,
  }) => {
    mkdirSync(VIDEO_TMP, { recursive: true });

    const desktop = await newCaptureContext(browser, {
      viewport: { width: 960, height: 600 },
      recordVideo: { width: 960, height: 600 },
    });
    const navPage = await desktop.newPage();
    await open(navPage, '');
    await navPage.locator('.scene-layer--ready').waitFor();
    for (const route of ['experience', 'projects', 'climate']) {
      await activateControl(
        navPage,
        navPage.locator(`nav[aria-label="Main menu"] a[href="#/${route}"]`),
      );
      await navPage.waitForTimeout(1200);
      // Force a frame: the R3F demand loop can idle under software rendering.
      await navPage.screenshot();
    }
    const navVideo = navPage.video();
    await desktop.close();
    await navVideo?.saveAs(resolve(CLIPS, 'desktop-3d-navigation.webm'));

    const toggleCtx = await newCaptureContext(browser, {
      viewport: { width: 960, height: 600 },
      recordVideo: { width: 960, height: 600 },
    });
    const togglePage = await toggleCtx.newPage();
    await open(togglePage, '');
    await togglePage.locator('.scene-layer--ready').waitFor();
    await activateControl(
      togglePage,
      togglePage.getByRole('button', { name: '3D room mode' }),
    );
    await togglePage.waitForTimeout(1500);
    await togglePage.screenshot();
    await activateControl(
      togglePage,
      togglePage.getByRole('button', { name: 'Automatic mode' }),
    );
    await togglePage.waitForTimeout(1500);
    await togglePage.screenshot();
    const toggleVideo = togglePage.video();
    await toggleCtx.close();
    await toggleVideo?.saveAs(resolve(CLIPS, 'desktop-mode-toggle.webm'));

    const mobileCtx = await newCaptureContext(browser, {
      viewport: MOBILE,
      dpr: 2,
      mobile: true,
      recordVideo: { width: MOBILE.width, height: MOBILE.height },
    });
    const mobilePage = await mobileCtx.newPage();
    await open(mobilePage, '');
    await mobilePage.locator('.scene-layer--ready').waitFor();
    await mobilePage.waitForTimeout(1000);
    await mobilePage
      .locator('nav[aria-label="Main menu"] a[href="#/experience"]')
      .click();
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot();
    const mobileVideo = mobilePage.video();
    await mobileCtx.close();
    await mobileVideo?.saveAs(resolve(CLIPS, 'mobile-3d-home.webm'));
  });
});
