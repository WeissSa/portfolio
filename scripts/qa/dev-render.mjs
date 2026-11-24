#!/usr/bin/env node
/**
 * Dev-path rendering evidence (owner bug 2026-11-24). Loads `npm run dev`
 * under headless Chromium + SwiftShader WebGL2, asserts the room really draws
 * (not a flat purple field), that readiness-gated layout classes are present,
 * and that no disposed-GPU-resource errors were logged. Run with the dev
 * server already listening on 127.0.0.1:5173.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const URL = 'http://127.0.0.1:5173/portfolio/#/';
const SWIFT = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];
const SHOT = resolve('qa-evidence/screenshots/dev_3d_render.png');

// Dev server may still be starting; wait for it without polling from outside.
let serverUp = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(URL);
    if (response.ok) {
      serverUp = true;
      break;
    }
  } catch {
    // retry
  }
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
}
assert.equal(serverUp, true, 'dev server must be reachable');

const browser = await chromium.launch({ args: SWIFT });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.scene-layer--ready').waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);

  const state = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      app3d: document.querySelector('.app-scene-live') !== null,
      canvas: Boolean(canvas),
      overlay: document.querySelector('.scene-grade-overlay') !== null,
      mainLeft:
        document.querySelector('main')?.getBoundingClientRect().left ?? -1,
      layerOpacity: getComputedStyle(document.querySelector('.scene-layer'))
        .opacity,
      glLost: canvas?.getContext('webgl2')?.isContextLost(),
    };
  });
  const shot = await page.locator('.scene-canvas').screenshot({ path: SHOT });
  // Decode the captured PNG in the browser: drawImage() on a WebGL canvas with
  // preserveDrawingBuffer=false returns a blank frame. A flat field has almost
  // no luma range; a lit room has strong light/shadow contrast.
  state.contrast = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: 'image/png' }),
    );
    const small = document.createElement('canvas');
    small.width = 64;
    small.height = 64;
    const ctx = small.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
      min = Math.min(min, luma);
      max = Math.max(max, luma);
    }
    return max - min;
  }, shot.toString('base64'));

  assert.equal(state.canvas, true, 'a WebGL canvas must exist');
  assert.equal(state.app3d, true, 'the shell must mark the scene as live');
  assert.equal(
    state.overlay,
    false,
    'desktop must NOT stack the CSS grade overlay',
  );
  assert.equal(state.glLost, false, 'WebGL2 context must be alive');
  assert.ok(
    state.mainLeft > 600,
    'zone content stays in the clean right column',
  );
  assert.ok(
    state.contrast > 30,
    `room must draw lit geometry (luma range ${state.contrast})`,
  );
  assert.ok(shot.length > 20000, `canvas PNG ${shot.length} B`);
  const gpuErrors = errors.filter((line) =>
    /disposed|Cannot read properties|WebGL context lost/i.test(line),
  );
  assert.deepEqual(
    gpuErrors,
    [],
    `no disposed-resource errors: ${errors.join(' | ')}`,
  );
  console.log(
    JSON.stringify({
      state,
      pngBytes: shot.length,
      consoleErrors: errors.length,
      screenshot: SHOT,
    }),
  );
  await context.close();
} finally {
  await browser.close();
}
