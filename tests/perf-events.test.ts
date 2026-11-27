/**
 * The renderer-internals hook in createCoalescedPointerEvents must never be
 * installed on a production canvas. It is QA-only: the Playwright perf harness
 * installs window.__perf before any page script runs, and that flag is the sole
 * gate for both gl.info.autoReset and canvas.__scenePerfInfo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlerSpies = {
  onPointerMove: vi.fn(),
  onPointerOver: vi.fn(),
  onPointerOut: vi.fn(),
};

vi.mock('@react-three/fiber', async () => {
  const actual =
    await vi.importActual<typeof import('@react-three/fiber')>(
      '@react-three/fiber',
    );
  return {
    ...actual,
    events: vi.fn(() => ({ handlers: { ...handlerSpies } })),
  };
});

import { createCoalescedPointerEvents } from '../src/scene/perf-events';

function fakeStore(canvas: HTMLCanvasElement) {
  return {
    getState: () => ({
      gl: {
        domElement: canvas,
        info: {
          autoReset: true,
          render: { calls: 0 },
          programs: [],
          memory: { geometries: 0, textures: 0 },
          reset: vi.fn(),
        },
      },
      invalidate: vi.fn(),
    }),
  };
}

describe('QA-gated renderer introspection hook', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, '__perf');
  });

  it('does not expose renderer internals without the QA probe', () => {
    const canvas = document.createElement('canvas');
    createCoalescedPointerEvents(fakeStore(canvas) as never);
    expect(
      (canvas as HTMLCanvasElement & { __scenePerfInfo?: unknown })
        .__scenePerfInfo,
    ).toBeUndefined();
  });

  it('installs the hook only when the QA probe is present', () => {
    Object.defineProperty(window, '__perf', {
      configurable: true,
      value: { start: vi.fn(), stop: vi.fn(), report: vi.fn() },
    });
    const canvas = document.createElement('canvas');
    createCoalescedPointerEvents(fakeStore(canvas) as never);
    const hook = (
      canvas as HTMLCanvasElement & {
        __scenePerfInfo?: () => { calls: number; reset: () => void };
      }
    ).__scenePerfInfo;
    expect(typeof hook).toBe('function');
    expect(hook!().calls).toBe(0);
  });
});
