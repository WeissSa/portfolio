/**
 * polish(e): ambient dust-mote contracts — the shader cloud owns its GPU
 * resources (deferred, StrictMode-safe) and threads the freeze flag into the
 * SAME perf-clock step PainterlyPass uses, so reduced motion freezes it too.
 */
import { StrictMode } from 'react';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DustMotes, DUST_MOTE_COUNT } from '../src/scene/ambient/DustMotes';

const { advanceSpy } = vi.hoisted(() => ({
  advanceSpy: vi.fn((current: number, delta: number, frozen = false) =>
    frozen ? current : current + delta,
  ),
}));

vi.mock('../src/scene/diegetic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/scene/diegetic')>();
  return { ...actual, advancePainterlyTime: advanceSpy };
});

async function flushTimers(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

describe('projector dust motes', () => {
  it('owns one tiny point cloud (no new light or full-size texture)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<DustMotes />, {
      frameloop: 'never',
    });
    const points = renderer.scene.findAll((node) => node.type === 'Points');
    expect(points).toHaveLength(1);
    const cloud = points[0]!.instance as THREE.Points;
    const geometry = cloud.geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(DUST_MOTE_COUNT);
    expect(geometry.getAttribute('aSeed').count).toBe(DUST_MOTE_COUNT);
    expect(DUST_MOTE_COUNT).toBeLessThanOrEqual(32);
    const material = cloud.material as THREE.ShaderMaterial;
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    expect(cloud.frustumCulled).toBe(false);
    await renderer.unmount();
    await flushTimers();
  });

  it('does not dispose across StrictMode remount, then disposes once', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <DustMotes />
      </StrictMode>,
      { frameloop: 'never' },
    );
    const cloud = renderer.scene.find((node) => node.type === 'Points')!
      .instance as THREE.Points;
    const geometry = cloud.geometry as THREE.BufferGeometry;
    const material = cloud.material as THREE.ShaderMaterial;
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');

    await flushTimers();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();

    await renderer.unmount();
    await flushTimers();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
  });

  it('threads freezeTime into the per-frame clock step', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DustMotes freezeTime />,
      { frameloop: 'never' },
    );
    advanceSpy.mockClear();
    await act(async () => {
      await renderer.advanceFrames(2, 0.016);
    });
    expect(advanceSpy).toHaveBeenCalledTimes(2);
    expect(advanceSpy).toHaveBeenNthCalledWith(1, 0, 0.016, true);
    expect(advanceSpy).toHaveBeenNthCalledWith(2, 0, 0.016, true);
    await renderer.unmount();
    await flushTimers();
  });
});
