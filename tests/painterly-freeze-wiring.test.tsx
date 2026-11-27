/**
 * Grain-freeze wiring. diegetic.test.ts pins the PURE clock step; this pins
 * that PainterlyPass actually THREADS `freezeTime` into its useFrame callback
 * (a component can call the right helper with the wrong flag and stay green).
 */
import { useLayoutEffect } from 'react';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { describe, expect, it, vi } from 'vitest';
import { PainterlyPass } from '../src/scene/effects/PainterlyPass';

/**
 * The headless GL mock cannot service a multisampled render target, so neutralize
 * the two draw calls in useFrame. The clock step (what this test pins) still runs.
 */
function NeutralizeGl(): null {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    gl.setRenderTarget = vi.fn();
    gl.render = vi.fn();
  }, [gl]);
  return null;
}

const { advanceSpy } = vi.hoisted(() => ({
  advanceSpy: vi.fn((current: number, delta: number, frozen = false) =>
    frozen ? current : current + delta,
  ),
}));

vi.mock('../src/scene/diegetic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/scene/diegetic')>();
  return {
    ...actual,
    advancePainterlyTime: (...args: [number, number, boolean?]) =>
      advanceSpy(...args),
  };
});

describe('PainterlyPass grain-freeze wiring', () => {
  it('passes freezeTime into the per-frame clock step', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <PainterlyPass enabled freezeTime>
        <mesh />
        <NeutralizeGl />
      </PainterlyPass>,
      { frameloop: 'never' },
    );

    advanceSpy.mockClear();
    await act(async () => {
      await renderer.advanceFrames(2, 0.016);
    });
    expect(advanceSpy).toHaveBeenCalledTimes(2);
    expect(advanceSpy).toHaveBeenNthCalledWith(1, 0, 0.016, true);
    // Frozen means the clock never advances, so the second step also starts at 0.
    expect(advanceSpy).toHaveBeenNthCalledWith(2, 0, 0.016, true);

    await renderer.update(
      <PainterlyPass enabled freezeTime={false}>
        <mesh />
        <NeutralizeGl />
      </PainterlyPass>,
    );
    advanceSpy.mockClear();
    await act(async () => {
      await renderer.advanceFrames(1, 0.016);
    });
    expect(advanceSpy).toHaveBeenCalledTimes(1);
    expect(advanceSpy).toHaveBeenCalledWith(0, 0.016, false);

    await renderer.unmount();
  });
});
