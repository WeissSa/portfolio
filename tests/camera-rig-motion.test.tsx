/**
 * polish(e): R3F wiring for camera personality. The pure amplitude/envelope
 * contracts live in camera-motion.test.ts; here we pin the behavioural
 * guarantees only the component can provide:
 *   1. reduced motion (instant) never drifts — the camera sits at the exact
 *      authored pose even across extra frames;
 *   2. drift/bank/overshoot are applied MID-FLIGHT (not just at the snap), the
 *      pass-past crosses the authored pose, and the final pose is exact;
 *   3. the shared perf clock is frozen for instant/paused and advances for a
 *      live flight, and a settled camera requests ZERO more frames (idle).
 */
import { useLayoutEffect } from 'react';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { useStore, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { Route } from '../src/lib/router';
import { CameraRig } from '../src/scene/CameraRig';
import { HOME_VIEWPOINT, ZONE_VIEWPOINTS } from '../src/scene/viewpoints';
import { usePortfolioStore } from '../src/state/store';

let capturedCamera: THREE.Camera | null = null;
let capturedStore: ReturnType<typeof useStore> | null = null;

function CameraProbe(): null {
  const camera = useThree((state) => state.camera);
  const store = useStore();
  useLayoutEffect(() => {
    capturedCamera = camera;
    capturedStore = store;
  }, [camera, store]);
  return null;
}

const { advanceSpy } = vi.hoisted(() => ({
  advanceSpy: vi.fn((current: number, delta: number, frozen = false) =>
    frozen ? current : current + delta,
  ),
}));

vi.mock('../src/scene/diegetic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/scene/diegetic')>();
  return { ...actual, advancePainterlyTime: advanceSpy };
});

async function mountRig(instant: boolean, zone: Route, paused = false) {
  act(() => {
    usePortfolioStore.setState({
      activeZone: zone,
      desktopOpen: false,
      selectedPostId: null,
      selectedProjectId: null,
      climatePanelOpen: false,
    });
  });
  advanceSpy.mockClear();
  return ReactThreeTestRenderer.create(
    <>
      <CameraRig instant={instant} paused={paused} />
      <CameraProbe />
    </>,
    { frameloop: 'never' },
  );
}

describe('CameraRig personality wiring', () => {
  it('snaps to the exact home pose under reduced motion and never drifts', async () => {
    const renderer = await mountRig(true, '/');
    const camera = capturedCamera!;
    expect(camera.position.toArray()).toEqual([...HOME_VIEWPOINT.position]);
    expect(usePortfolioStore.getState().cameraSettled).toBe(true);

    // The shared clock is stepped with frozen=true and never advances.
    await act(async () => {
      await renderer.advanceFrames(8, 0.05);
    });
    expect(advanceSpy).toHaveBeenCalled();
    expect(advanceSpy.mock.calls.every((call) => call[2] === true)).toBe(true);
    expect(advanceSpy.mock.calls[0]![0]).toBe(0);
    expect(camera.position.toArray()).toEqual([...HOME_VIEWPOINT.position]);
    await renderer.unmount();
  });

  it('freezes the clock while paused', async () => {
    const renderer = await mountRig(false, '/about', true);
    advanceSpy.mockClear();
    await act(async () => {
      await renderer.advanceFrames(3, 0.05);
    });
    expect(advanceSpy).toHaveBeenCalledTimes(3);
    expect(advanceSpy.mock.calls.every((call) => call[2] === true)).toBe(true);
    await renderer.unmount();
  });

  it('applies drift/bank/overshoot mid-flight, crosses the pose, then snaps exact', async () => {
    const renderer = await mountRig(false, '/about');
    const camera = capturedCamera!;
    const from = new THREE.Vector3(...HOME_VIEWPOINT.position);
    const to = new THREE.Vector3(...ZONE_VIEWPOINTS['/about'].position);
    const direction = to.clone().sub(from).normalize();
    expect(camera.position.toArray()).toEqual([...HOME_VIEWPOINT.position]);

    let banked = false;
    let drifted = false;
    let crossedPose = false;
    // Step frame-by-frame so the transient behaviour is observable.
    for (let frame = 0; frame < 60; frame += 1) {
      await act(async () => {
        await renderer.advanceFrames(1, 0.05);
      });
      const pos = camera.position.clone();
      if (frame > 2 && frame < 60) {
        // Mid-flight: not the start pose, not yet the final pose.
        if (pos.distanceTo(from) > 0.01 && pos.distanceTo(to) > 0.01)
          drifted = true;
        // Arrival bank is actually rotated onto the camera mid-flight.
        if (Math.abs(camera.rotation.z) > 1e-4) banked = true;
        // Render-only pass-past: projection onto the travel vector exceeds
        // the authored pose at least once (overshoot crosses the target).
        if (pos.clone().sub(from).dot(direction) > from.distanceTo(to) + 1e-4)
          crossedPose = true;
      }
    }
    expect(drifted).toBe(true);
    expect(banked).toBe(true);
    expect(crossedPose).toBe(true);
    expect(advanceSpy.mock.calls.some((call) => call[2] === false)).toBe(true);

    await act(async () => {
      await renderer.advanceFrames(160, 0.05);
    });
    const target = ZONE_VIEWPOINTS['/about'].position;
    expect(camera.position.toArray()).toEqual([...target]);
    // No residual arrival bank: the roll matches a plain lookAt at the pose
    // (Euler z is not necessarily 0 after lookAt, so compare to the reference).
    const reference = new THREE.PerspectiveCamera();
    reference.position.set(...target);
    reference.lookAt(new THREE.Vector3(...ZONE_VIEWPOINTS['/about'].target));
    expect(camera.rotation.z).toBeCloseTo(reference.rotation.z, 6);
    expect(usePortfolioStore.getState().cameraSettled).toBe(true);
    await renderer.unmount();
  });

  it('settles in a handful of frames even when frames are severely delayed', async () => {
    // Software rendering (or a janky device) can spend 350+ ms in one frame.
    // The damp clamp must not stretch one flight into a dozen more expensive
    // frames: at dt=0.25 the authored pose is reached in a few frames, while a
    // 60 fps flight (dt ~0.017) still takes the full authored ~76 frames.
    const renderer = await mountRig(false, '/projects');
    const target = ZONE_VIEWPOINTS['/projects'].position;
    await act(async () => {
      await renderer.advanceFrames(8, 0.25);
    });
    expect(usePortfolioStore.getState().cameraSettled).toBe(true);
    expect(capturedCamera!.position.toArray()).toEqual([...target]);
    await renderer.unmount();
  });

  it('requests zero frames once settled (idle = 0 frames)', async () => {
    const renderer = await mountRig(false, '/about');
    const store = capturedStore!;
    // Replace the store's invalidate with a spy. CameraRig subscribes through
    // useThree, so the state swap re-renders it and it captures the spy.
    const original = store.getState().invalidate;
    const invalidateSpy = vi.fn((...args: Parameters<typeof original>) =>
      original(...args),
    );
    act(() => store.setState({ invalidate: invalidateSpy }));

    await act(async () => {
      await renderer.advanceFrames(120, 0.05);
    });
    expect(usePortfolioStore.getState().cameraSettled).toBe(true);
    // Absorb any RAF/effect invalidation from the spy swap, then prove a
    // settled rig requests NO more frames across further rendered frames.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    invalidateSpy.mockClear();
    await act(async () => {
      await renderer.advanceFrames(20, 0.05);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
    await renderer.unmount();
  });
});
