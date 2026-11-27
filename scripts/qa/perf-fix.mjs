/**
 * Real-browser performance measurement for the perf(ux) fix pass.
 *
 * `node scripts/qa/perf-fix.mjs before|after` drives the EXISTING dev server at
 * 127.0.0.1:5173/portfolio/ with headless Chromium + SwiftShader (the same
 * software renderer used by the UX diagnosis), then writes a JSON artifact to
 * qa-evidence/perf-fix/<phase>.json plus a few screenshots.
 *
 * This is a DEV/QA tool: it installs a tiny window.__perf shim before any app
 * script (the app's coalesced-pointer-events hook then exposes the real
 * gl.info counters on the canvas). Nothing here ships in the production build.
 * All timings are wall-clock/performance.now from the browser, not screenshots.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const SWIFT = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];
const URL = 'http://127.0.0.1:5173/portfolio/#/';
const OUT = resolve(process.cwd(), 'qa-evidence/perf-fix');
const DESKTOP = { width: 1440, height: 900 };

const PHASE = process.argv[2] ?? 'before';
if (!['before', 'after'].includes(PHASE)) {
  console.error('usage: node scripts/qa/perf-fix.mjs before|after');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// Minimal probe: rAF deltas + PerformanceObserver long tasks. The app only
// checks for the presence of window.__perf, so this deliberately mirrors the
// shape the diagnosis harness used.
const PROBE = `
(() => {
  const longTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
      }
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}
  let running = false, samples = [], last = 0, rafId = 0, label = null;
  function frame(now) {
    if (!running) return;
    if (last) samples.push(Math.round((now - last) * 100) / 100);
    last = now;
    rafId = requestAnimationFrame(frame);
  }
  window.__perf = {
    start(name) { label = name || 'x'; samples = []; last = 0; running = true; rafId = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(rafId); },
    report() {
      const s = [...samples].sort((a, b) => a - b);
      const q = (p) => s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : 0;
      return { label, n: s.length, p50: q(0.5), p95: q(0.95), max: s[s.length - 1] || 0,
        longFrames: s.filter((v) => v > 34).length };
    },
    get gpuString() { return 'swiftshader'; },
    get env() { return 'swiftshader'; }
  };
  window.__longTasks = longTasks;
})();
`;

const attachLogs = (page, bag) => {
  page.on('console', (m) => bag.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => bag.push(`[pageerror] ${e}`));
  page.on('requestfailed', (r) =>
    bag.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText}`),
  );
};
const snap = (page, name) =>
  page
    .screenshot({ path: `${OUT}/${PHASE}-${name}.png` })
    .catch(() => 'screenshot failed');

const info = (page) =>
  page.evaluate(() => {
    const c = [...document.querySelectorAll('canvas')].find(
      (canvas) => canvas.__scenePerfInfo,
    );
    return c ? c.__scenePerfInfo() : null;
  });
// Count ONE whole frame (gl.info.autoReset is off in QA mode), matching the
// perf.spec budget probe. A raw accumulated counter over a flight is useless:
// it includes every prior frame.
async function frameInfo(page) {
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('canvas')].find(
      (canvas) => canvas.__scenePerfInfo,
    );
    c?.__scenePerfInfo?.().reset();
    c?.__scenePerfInfo?.().frame();
  });
  await page.waitForTimeout(250);
  return info(page);
}

async function state(page) {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    const nav = document.querySelector('nav[aria-label="Main menu"]');
    return {
      t: Math.round(performance.now()),
      mirror: !!root?.querySelector('.static-mirror'),
      nav: !!nav,
      canvas: !!document.querySelector('.scene-layer canvas'),
      layerReady: !!document.querySelector('.scene-layer--ready'),
      fcp: Math.round(
        performance
          .getEntriesByType('paint')
          .find((p) => p.name === 'first-contentful-paint')?.startTime ?? -1,
      ),
    };
  });
}

async function measureLoad(browser, out) {
  const ctx = await browser.newContext({ viewport: DESKTOP });
  await ctx.addInitScript({ content: PROBE });
  const page = await ctx.newPage();
  attachLogs(page, out.logs);
  await page.goto(URL, { waitUntil: 'commit' });
  const t0 = Date.now();
  let mirrorGone = null;
  let canvasMounted = null;
  let layerReady = null;
  const timeline = [];
  for (let i = 0; i < 160; i += 1) {
    const s = await state(page);
    s.wall = Date.now() - t0;
    timeline.push(s);
    if (s.mirror === false && mirrorGone === null) mirrorGone = s.wall;
    if (s.canvas && canvasMounted === null) canvasMounted = s.wall;
    if (s.layerReady && layerReady === null) layerReady = s.wall;
    if (i > 8 && s.layerReady) break;
    await page.waitForTimeout(50);
  }
  out.load = {
    fcp: timeline.find((s) => s.fcp >= 0)?.fcp ?? -1,
    shell: mirrorGone,
    canvasMounted,
    sceneLive: layerReady,
    longTasks: await page.evaluate(() => window.__longTasks ?? []),
    samples: timeline.length,
  };
  await ctx.close();
}

async function waitReady(page, ms = 70000) {
  await page
    .locator('.scene-layer--ready')
    .waitFor({ state: 'attached', timeout: ms });
  await page.waitForTimeout(2600);
}

async function findPointerHits(page, region, step = 12, settleMs = 16) {
  const hits = [];
  for (let y = region.y0; y <= region.y1; y += step) {
    for (let x = region.x0; x <= region.x1; x += step) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(settleMs);
      if (
        (await page.evaluate(() => document.body.style.cursor)) === 'pointer'
      ) {
        hits.push({ x, y });
      }
    }
  }
  return hits;
}

function clusterY(hits, tol = 22) {
  const groups = [];
  for (const hit of hits) {
    const group = groups.find((g) => Math.abs(g.rep - hit.y) <= tol);
    if (group) {
      group.points.push(hit);
      group.rep =
        group.points.reduce((s, p) => s + p.y, 0) / group.points.length;
    } else {
      groups.push({ rep: hit.y, points: [hit] });
    }
  }
  return groups
    .map((g) => ({
      y: Math.round(g.rep),
      x: Math.round(g.points.reduce((s, p) => s + p.x, 0) / g.points.length),
      count: g.points.length,
    }))
    .sort((a, b) => a.y - b.y);
}

async function measureInteraction(browser, out) {
  const ctx = await browser.newContext({ viewport: DESKTOP });
  await ctx.addInitScript({ content: PROBE });
  const page = await ctx.newPage();
  attachLogs(page, out.logs);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  out.idleDrawCalls = await frameInfo(page);
  await snap(page, 'ready');

  // Diegetic plaque rows, discovered by real pointer cursor (not store writes).
  const plaqueHits = await findPointerHits(
    page,
    { x0: 500, y0: 235, x1: 720, y1: 425 },
    10,
    16,
  );
  const rows = clusterY(plaqueHits);
  out.plaqueRows = rows;

  // Camera flight via the EXPERIENCE row.
  const expRow = rows[2] ?? rows[rows.length - 1];
  if (expRow) {
    await page.evaluate(() => window.__perf.start('plaque-flight'));
    const flightStart = await page.evaluate(() => performance.now());
    await page.mouse.click(expRow.x, expRow.y);
    await page.waitForTimeout(2600);
    await page.evaluate(() => window.__perf.stop());
    out.flight = {
      clicked: expRow,
      hash: await page.evaluate(() => location.hash),
      perf: await page.evaluate(() => window.__perf.report()),
      drawCalls: await frameInfo(page),
      longTasks: (await page.evaluate(() => window.__longTasks ?? [])).filter(
        (task) => task.start + task.dur >= flightStart,
      ),
    };
    await snap(page, 'flight');
  }

  // Book pick: hover→cursor latency + click→panel latency, five repetitions.
  const bookHits = await findPointerHits(
    page,
    { x0: 500, y0: 180, x1: 720, y1: 520 },
    12,
    16,
  );
  const book = bookHits[Math.floor(bookHits.length / 2)];
  out.bookHits = bookHits.length;
  if (book) {
    await page.mouse.move(80, 700);
    await page.waitForTimeout(80);
    const t = Date.now();
    await page.mouse.move(book.x, book.y);
    let hoverLatency = -1;
    for (let i = 0; i < 40; i += 1) {
      if (
        (await page.evaluate(() => document.body.style.cursor)) === 'pointer'
      ) {
        hoverLatency = Date.now() - t;
        break;
      }
      await page.waitForTimeout(10);
    }
    out.hoverLatencyMs = hoverLatency;

    // Install a MutationObserver that stamps the exact frame the panel mounts.
    await page.evaluate(() => {
      window.__panelAt = [];
      window.__clickPending = 0;
      new MutationObserver(() => {
        if (window.__clickPending && document.querySelector('.detail-mirror')) {
          window.__panelAt.push(performance.now() - window.__clickPending);
          window.__clickPending = 0;
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.evaluate(() => window.__perf.start('book-click'));
    const clickSamples = [];
    for (let i = 0; i < 5; i += 1) {
      // Reset hover so the next pointer move actually fires a fresh over event.
      await page.mouse.move(80, 700);
      await page.waitForTimeout(60);
      await page.evaluate(() => {
        if (document.querySelector('.detail-mirror')) {
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          );
        }
        window.__clickPending = performance.now();
      });
      await page.mouse.click(book.x, book.y);
      try {
        await page.waitForFunction(
          () => window.__panelAt.length > 0,
          undefined,
          { timeout: 5000 },
        );
      } catch {
        // leave -1 so the report is honest about a missed click
      }
      clickSamples.push(
        await page.evaluate(() => {
          const all = window.__panelAt ?? [];
          const value = all.length ? all[all.length - 1] : -1;
          window.__panelAt = [];
          return Math.round(value * 10) / 10;
        }),
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.__perf.stop());
    const s = clickSamples.filter((v) => v >= 0).sort((a, b) => a - b);
    const q = (p) =>
      s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : -1;
    out.bookClick = {
      samples: clickSamples,
      p50: q(0.5),
      p95: q(0.95),
      max: s.length ? s[s.length - 1] : -1,
      perf: await page.evaluate(() => window.__perf.report()),
    };
    await snap(page, 'book-panel');
  }

  out.longTasksDuringInteraction = await page.evaluate(
    () => window.__longTasks ?? [],
  );
  await ctx.close();
}

const out = {
  phase: PHASE,
  capturedAt: new Date().toISOString(),
  gpu: 'swiftshader',
  logs: [],
};
const browser = await chromium.launch({ args: SWIFT });
try {
  await measureLoad(browser, out);
  await measureInteraction(browser, out);
} finally {
  await browser.close();
}
writeFileSync(
  resolve(OUT, `${PHASE}.json`),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      phase: PHASE,
      load: out.load,
      flight: out.flight?.perf,
      idleDrawCalls: out.idleDrawCalls?.calls,
      zoneDrawCalls: out.flight?.drawCalls?.calls,
      flightLongTasks: out.flight?.longTasks,
      hoverLatencyMs: out.hoverLatencyMs,
      bookClick: out.bookClick && {
        p50: out.bookClick.p50,
        p95: out.bookClick.p95,
        max: out.bookClick.max,
      },
      logCount: out.logs.length,
    },
    null,
    2,
  ),
);
