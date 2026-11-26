import { defineConfig } from '@playwright/test';

/**
 * Reproducible visual capture for draft PR #6 (art-overhaul commit 0).
 *
 * `npm run capture:qa` builds the site first, then this config starts
 * `vite preview` on a fixed port and runs scripts/qa/capture.spec.ts against
 * the production bundle. SwiftShader/ANGLE makes the WebGL2 renders
 * deterministic on headless Linux (no physical GPU required).
 */
export const SWIFTSHADER_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
] as const;

export default defineConfig({
  testDir: './scripts/qa',
  outputDir: 'qa-evidence/.artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // SwiftShader screenshots can take tens of seconds each under load; the
  // multi-zone capture tests need headroom without weakening any assertion.
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/portfolio/',
    launchOptions: { args: [...SWIFTSHADER_ARGS] },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/portfolio/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
