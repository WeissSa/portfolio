import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  MODE_STORAGE_KEY,
  SCENE_FAILURE_STORAGE_KEY,
} from '../src/lib/device-tier';
import { usePortfolioStore } from '../src/state/store';

afterEach(() => {
  cleanup();
  window.location.hash = '';
  document.body.style.cursor = '';
  // Mode is a persisted, global concern: keep one test's manual override,
  // crash signal or auto recommendation from leaking into the next App render.
  try {
    localStorage.removeItem(MODE_STORAGE_KEY);
    localStorage.removeItem(SCENE_FAILURE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; nothing to clean.
  }
  usePortfolioStore.setState({ mode: '2d', autoMode: '2d' });
  // Undo per-test `vi.stubGlobal` overrides so the shared fixture below is
  // restored for the next test; individual test files need no afterEach.
  vi.unstubAllGlobals();
});

// jsdom has no real network: without this, tests that navigate to the Climate
// zone would hit the public Open-Meteo API and could settle after the test
// finished. Tests that need a specific response override this with
// `vi.stubGlobal('fetch', ...)`; the global afterEach above restores this
// fixture (the value captured before stubbing).
const FIXTURE_FLAT: Record<string, number> = {
  '2020-01-01': 5,
  '2021-01-01': 7,
};
const fixtureResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

globalThis.fetch = vi.fn(async (input: unknown) => {
  const url = String(input);
  if (url.startsWith('https://api.open-meteo.com')) {
    return fixtureResponse({ current_weather: { temperature: 21 } });
  }
  if (url.startsWith('https://archive-api.open-meteo.com')) {
    return fixtureResponse({
      daily: {
        time: Object.keys(FIXTURE_FLAT),
        temperature_2m_mean: Object.values(FIXTURE_FLAT),
      },
    });
  }
  if (url.includes('climate-snapshot.json')) {
    return fixtureResponse({
      generatedAt: '2026-11-21T00:00:00.000Z',
      flat: FIXTURE_FLAT,
    });
  }
  return { ok: false, status: 404 } as Response;
}) as typeof fetch;

// jsdom does not implement matchMedia listeners fully; provide a stable stub
// that component code (e.g. prefers-reduced-motion checks) can rely on.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof window.ResizeObserver !== 'function') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverStub,
  });
}

// jsdom has no canvas backend; HeatmapCanvas guards on a null context.
// Stub getContext so jsdom does not spam "not implemented" on stderr.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}
