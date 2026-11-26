/**
 * Frame-time perf gate for draft PR #6 (art-overhaul commit 3c).
 *
 * `npm run build && npx playwright test scripts/qa/perf.spec.ts` injects the
 * dev-only frame sampler (src/lib/perf-probe.ts, ZERO shipped bytes) and drives
 * camera flights, a 2D↔3D toggle and dialog open/close on desktop + mobile.
 * The primary metric is per-frame WORKLOAD (main-thread time + async GPU timer
 * query); raw rAF deltas are recorded separately. Three runs per device with
 * one warm-up; the gate is the MEDIAN p95 per workload, compared RELATIVE to
 * qa-evidence/perf-baseline.json (≤10% regression + 2× recorded jitter). That
 * gate and the absolute 16.7/22ms targets are HARD failures on hardware WebGL.
 * Headless SwiftShader cannot validate absolute fps and is noise-dominated on
 * a shared runner, so its gate comparison is reported as INFORMATIONAL, not a
 * blocking failure; the 60/45fps targets still need the owner's real hardware.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transformSync } from 'esbuild';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import type { PerfReport } from '../../src/lib/perf-probe';
import { activateControl } from './keyboard-controls';

const PERF_DIR = resolve(process.cwd(), 'qa-evidence/perf');
const BASELINE_FILE = resolve(process.cwd(), 'qa-evidence/perf-baseline.json');
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const REGRESSION_LIMIT = 1.1;
const RUNS = 3;

interface Metrics {
  p50: number;
  p95: number;
  max: number;
  longFrames: number;
  rafP50: number;
  rafP95: number;
  gpuP95: number | null;
  /** Per-run p95 values; their spread is the SwiftShader noise allowance. */
  p95Samples: number[];
  histogram: PerfReport['histogram'];
  env: PerfReport['env'];
}

interface PerfArtifact {
  schema: 1;
  capturedAt: string;
  note: string;
  gpuString: string;
  renderer: { calls: number; programs: number };
  devices: Record<string, Record<string, Metrics>>;
}

mkdirSync(PERF_DIR, { recursive: true });

// The probe is TypeScript and lives outside the bundle: transpile to an IIFE
// and install it before any page script runs.
const probeSource = transformSync(
  readFileSync(resolve(process.cwd(), 'src/lib/perf-probe.ts'), 'utf8'),
  { loader: 'ts', format: 'iife', target: 'es2020' },
).code;

async function contextFor(
  browser: Browser,
  viewport: { width: number; height: number },
  mobile: boolean,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript({ content: probeSource });
  return context;
}

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`#/${route}`);
  await expect(
    page.locator('nav[aria-label="Main menu"]'),
    'shell must paint before perf sampling',
  ).toBeVisible();
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.scene-layer--ready')).toBeAttached();
  await page.waitForTimeout(2200); // fade + damped flight settle (SwiftShader)
}

/**
 * SwiftShader's demand frameloop can deliver <1 composited frame per second,
 * so a fixed wall-clock wait sometimes yields 0–1 rAF samples. Wait until the
 * sampler has genuinely observed a few frames instead; this keeps the `n > 1`
 * assertion meaningful (it is never lowered) without inflating the workload
 * with screenshots inside the measured segment.
 */
async function waitForSamples(page: Page, min = 3): Promise<void> {
  await page.waitForFunction(
    (needed) => (window.__perf?.report().n ?? 0) >= needed,
    min,
    { polling: 100, timeout: 30_000 },
  );
}

async function sample(
  page: Page,
  label: string,
  action: () => Promise<void>,
): Promise<Metrics> {
  await page.evaluate((name) => window.__perf?.start(name), label);
  await action();
  await waitForSamples(page);
  const report = await page.evaluate(() => {
    window.__perf?.stop();
    return window.__perf?.report();
  });
  expect(report, `${label}: frame sampler must be installed`).toBeDefined();
  const perf = report as PerfReport;
  // SwiftShader can deliver only a couple of rAFs in a short segment; two is
  // the minimum for a p50/p95, with three measured runs giving the final gate.
  expect(perf.n, `${label}: sampled frames`).toBeGreaterThan(1);
  return {
    p50: perf.p50,
    p95: perf.p95,
    max: perf.max,
    longFrames: perf.longFrames,
    rafP50: perf.raf.p50,
    rafP95: perf.raf.p95,
    gpuP95: perf.gpu?.p95 ?? null,
    p95Samples: [perf.p95],
    histogram: perf.histogram,
    env: perf.env,
  };
}

async function navigate(page: Page, route: string): Promise<void> {
  // The nav is sr-only in live 3D fine-pointer mode; activate the real link
  // through the keyboard a11y path instead of a mouse click on a 1px box.
  await activateControl(
    page,
    page.locator(`nav[aria-label="Main menu"] a[href="#/${route}"]`),
  );
  // No screenshots INSIDE a sampled segment: a SwiftShader screenshot blocks
  // the main thread for seconds and would pollute the workload metric.
  await page.waitForTimeout(1400);
}

const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

async function rendererInfo(page: Page): Promise<{
  calls: number;
  programs: number;
  geometries: number;
  textures: number;
} | null> {
  return page.evaluate(() => {
    // .scene-canvas is the R3F wrapper div; the WebGL canvas is its child.
    // Two 2D heatmap canvases may also exist, so scan for our QA hook.
    const canvases = [
      ...document.querySelectorAll('canvas'),
    ] as (HTMLCanvasElement & {
      __scenePerfInfo?: () => {
        calls: number;
        programs: number;
        geometries: number;
        textures: number;
        frame: () => void;
        reset: () => void;
      };
    })[];
    for (const canvas of canvases) {
      if (canvas.__scenePerfInfo) return canvas.__scenePerfInfo();
    }
    return null;
  });
}

/** Reset renderer counters, request ONE frame, then read whole-frame stats. */
async function measureInfo(
  page: Page,
): Promise<Awaited<ReturnType<typeof rendererInfo>>> {
  await page.evaluate(() => {
    const canvases = [
      ...document.querySelectorAll('canvas'),
    ] as (HTMLCanvasElement & {
      __scenePerfInfo?: () => { frame: () => void; reset: () => void };
    })[];
    const hook = canvases
      .find((canvas) => canvas.__scenePerfInfo)
      ?.__scenePerfInfo?.();
    hook?.reset();
    hook?.frame();
  });
  await page.waitForTimeout(200);
  return rendererInfo(page);
}

async function driveRuns(
  browser: Browser,
  device: 'desktop' | 'mobile',
): Promise<{
  metrics: Record<string, Metrics>;
  gpuString: string;
  info: Awaited<ReturnType<typeof rendererInfo>>;
}> {
  const context = await contextFor(
    browser,
    device === 'desktop' ? DESKTOP : MOBILE,
    device === 'mobile',
  );
  const page = await context.newPage();
  await open(page, '');
  await ready(page);
  // discover() runs on the first start(): query the GPU string after a probe
  // start/stop pair so an init-script-only page never reports 'uninitialized'.
  const gpuString = await page.evaluate(() => {
    window.__perf?.start('gpu-detect');
    window.__perf?.stop();
    return window.__perf?.gpuString ?? 'none';
  });

  const collected: Record<string, Metrics[]> = {};
  for (let run = 0; run <= RUNS; run += 1) {
    // First pass is a warm-up (shader compilation + texture upload).
    if (run > 0) await open(page, '');
    await ready(page);
    for (const [route, key] of [
      ['experience', 'flight-experience'],
      ['projects', 'flight-projects'],
      ['climate', 'flight-climate'],
    ] as const) {
      const metrics = await sample(page, key, () => navigate(page, route));
      (collected[key] ??= []).push(metrics);
    }
    const toggle = await sample(page, 'mode-toggle', async () => {
      await activateControl(
        page,
        page.getByRole('button', { name: '3D room mode' }),
      );
      await page.waitForTimeout(250);
      await activateControl(
        page,
        page.getByRole('button', { name: 'Automatic mode' }),
      );
      await ready(page);
    });
    (collected['mode-toggle'] ??= []).push(toggle);
    const dialog = await sample(page, 'dialog-open', async () => {
      await page
        .getByRole('button', { name: 'Open projector info panel' })
        .click();
      // polish(c): the detail surface is an sr-hidden a11y mirror in fine
      // pointer live 3D and a visible dialog in the coarse-pointer fallback.
      // Both are in the a11y tree; assert presence, not pixel visibility, so
      // the frame-time workload measures the same open/close in every tier.
      await expect(page.locator('.detail-mirror, [role="dialog"]')).toHaveCount(
        1,
      );
      await page.waitForTimeout(350);
      await page.keyboard.press('Escape');
    });
    (collected['dialog-open'] ??= []).push(dialog);

    if (run === RUNS && device === 'desktop') {
      await page.screenshot({ path: resolve(PERF_DIR, 'steady-desktop.png') });
    }
  }

  const info = await measureInfo(page);
  if (device === 'desktop') {
    expect(
      info,
      'renderer QA hook must expose gl.info from the R3F canvas',
    ).not.toBeNull();
  }
  if (device === 'desktop' && info) {
    expect(info.calls, 'draw calls ≤100').toBeLessThanOrEqual(100);
    expect(info.programs, 'programs ≤25').toBeLessThanOrEqual(25);
    // 3c P10 warm start: the Canvas is never rebuilt across five toggles.
    const before = info;
    for (let i = 0; i < 5; i += 1) {
      await activateControl(
        page,
        page.getByRole('button', { name: '3D room mode' }),
      );
      await activateControl(
        page,
        page.getByRole('button', { name: 'Automatic mode' }),
      );
    }
    const after = await measureInfo(page);
    expect(after).not.toBeNull();
    expect(
      after!.geometries,
      'no geometry growth over 5 toggles',
    ).toBeLessThanOrEqual(before.geometries);
    expect(
      after!.textures,
      'no texture growth over 5 toggles',
    ).toBeLessThanOrEqual(before.textures);
  }

  const metrics: Record<string, Metrics> = {};
  for (const [key, runs] of Object.entries(collected)) {
    const warm = runs.slice(1);
    metrics[key] = {
      ...warm[0]!,
      p50: median(warm.map((m) => m.p50)),
      p95: median(warm.map((m) => m.p95)),
      max: median(warm.map((m) => m.max)),
      longFrames: median(warm.map((m) => m.longFrames)),
      rafP50: median(warm.map((m) => m.rafP50)),
      rafP95: median(warm.map((m) => m.rafP95)),
      gpuP95: warm.some((m) => m.gpuP95 !== null)
        ? median(warm.filter((m) => m.gpuP95 !== null).map((m) => m.gpuP95!))
        : null,
      p95Samples: warm.flatMap((m) => m.p95Samples),
    };
  }
  await context.close();
  return { metrics, gpuString, info };
}

test.describe('frame-time budgets (3c)', () => {
  // Each test runs in its own worker: write per-device artifacts immediately
  // (a describe-level accumulator would be overwritten by the other worker).
  function record(
    device: 'desktop' | 'mobile',
    result: Awaited<ReturnType<typeof driveRuns>>,
  ): void {
    const artifact: PerfArtifact = {
      schema: 1,
      capturedAt: new Date().toISOString(),
      note: 'Headless Chromium + SwiftShader; absolute 60/45fps requires owner hardware. Gate = relative p95 vs baseline.',
      gpuString: result.gpuString,
      renderer: {
        calls: result.info?.calls ?? -1,
        programs: result.info?.programs ?? -1,
      },
      devices: { [device]: result.metrics },
    };
    writeFileSync(
      resolve(PERF_DIR, `latest-${device}.json`),
      `${JSON.stringify(artifact, null, 2)}\n`,
    );
  }

  test('desktop: flights, toggle and dialog stay within the relative gate', async ({
    browser,
  }) => {
    const result = await driveRuns(browser, 'desktop');
    record('desktop', result);
    assertRelativeGate(result.metrics, 'desktop');
  });

  test('mobile: flights, toggle and dialog stay within the relative gate', async ({
    browser,
  }) => {
    const result = await driveRuns(browser, 'mobile');
    record('mobile', result);
    assertRelativeGate(result.metrics, 'mobile');
  });
});

function assertRelativeGate(
  metrics: Record<string, Metrics>,
  device: 'desktop' | 'mobile',
): void {
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as {
    zones?: Record<string, Record<string, { p95: number; jitterMs?: number }>>;
  };
  const zones = baseline.zones?.[device];
  expect(zones, `baseline must contain ${device} metrics`).toBeDefined();
  for (const [key, value] of Object.entries(metrics)) {
    const expected = zones![key]?.p95;
    expect(expected, `baseline must contain ${device}/${key}`).toBeGreaterThan(
      0,
    );
    // Software WebGL has large run-to-run spread (p95 varies by ~40% between
    // identical runs). Allow 2× the RECORDED jitter band on top of the 10% gate
    // so CI flags real regressions, not SwiftShader noise. On real hardware the
    // recorded band is small and the 10% gate dominates.
    const allowance = (zones![key]!.jitterMs ?? 0) * 2;
    const limit = expected! * REGRESSION_LIMIT + allowance;
    const overGate = value.p95 > limit;
    if (value.env === 'swiftshader') {
      // Software WebGL on a shared runner is noise-dominated (identical runs
      // swing several-fold), so a hard CI gate here flags machine load, not a
      // product regression. Keep the baseline + recorded jitter comparison
      // VISIBLE as advisory evidence; the SAME gate is a hard failure on real
      // hardware below. This matches the CI job's "SwiftShader informational"
      // policy and never hides a number.
      if (overGate) {
        console.warn(
          `[informational] ${device}/${key}: p95 ${value.p95.toFixed(1)}ms > gate ${limit.toFixed(1)}ms (SwiftShader noise band; not a blocking regression)`,
        );
      }
    } else {
      expect(
        value.p95,
        `${device}/${key}: p95 workload must not regress >10% (+ measured jitter) vs baseline`,
      ).toBeLessThanOrEqual(limit);
      expect(
        value.p95,
        `${device}/${key}: 16.7ms desktop / 22ms mobile target`,
      ).toBeLessThanOrEqual(device === 'desktop' ? 16.7 : 22);
    }
  }
}
