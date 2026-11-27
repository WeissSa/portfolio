/**
 * polish(e): R3F wiring for camera personality. The pure amplitude/envelope
 * contracts live in camera-motion.test.ts; here we pin the behavioural
 * guarantees only the component can provide:
 *   1. reduced motion (instant) never drifts — the camera sits at the exact
 *      authored pose even across extra frames;
 *   2. the flight approaches the authored pose monotonically — no arrival bank
 *      (roll) and no pass-past overshoot — and the final pose is exact;
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

  it('approaches monotonically without bank or pass-past, then snaps exact', async () => {
    const renderer = await mountRig(false, '/about');
    const camera = capturedCamera!;
    const from = new THREE.Vector3(...HOME_VIEWPOINT.position);
    const to = new THREE.Vector3(...ZONE_VIEWPOINTS['/about'].position);
    const direction = to.clone().sub(from).normalize();
    expect(camera.position.toArray()).toEqual([...HOME_VIEWPOINT.position]);

    // A camera posed ONLY by lookAt(worldUp) keeps its local right vector in
    // the horizontal plane (Y≈0). The old arrival bank called rotateZ(), which
    // rolls the right vector out of that plane — a reliable "no wobble" probe.
    const right = new THREE.Vector3();
    const noBank = () => {
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      expect(Math.abs(right.y)).toBeLessThan(1e-3);
    };

    let moved = false;
    let previousDistance = from.distanceTo(to);
    // Step frame-by-frame so per-frame continuity is observable.
    for (let frame = 0; frame < 60; frame += 1) {
      await act(async () => {
        await renderer.advanceFrames(1, 0.05);
      });
      const pos = camera.position.clone();
      if (pos.distanceTo(from) > 0.01 && pos.distanceTo(to) > 0.05) {
        moved = true;
        // No arrival bank: the camera is never rolled off the lookAt pose.
        noBank();
        // No settle overshoot: the camera never travels PAST the authored pose
        // along the flight vector (4 mm drift tolerance).
        expect(pos.clone().sub(from).dot(direction)).toBeLessThanOrEqual(
          from.distanceTo(to) + 0.005,
        );
      }
      // Smooth, monotone approach: distance to target never grows between
      // consecutive frames (sub-pixel drift jitter tolerance).
      const distance = pos.distanceTo(to);
      expect(distance).toBeLessThanOrEqual(previousDistance + 0.005);
      previousDistance = distance;
    }
    expect(moved).toBe(true);
    expect(advanceSpy.mock.calls.some((call) => call[2] === false)).toBe(true);

    await act(async () => {
      await renderer.advanceFrames(160, 0.05);
    });
    const target = ZONE_VIEWPOINTS['/about'].position;
    expect(camera.position.toArray()).toEqual([...target]);
    // No residual bank after settle.
    noBank();
    expect(usePortfolioStore.getState().cameraSettled).toBe(true);

    // No wobble AT settle: many extra frames on a settled rig keep the exact
    // authored pose (the demand loop issues no more frames).
    await act(async () => {
      await renderer.advanceFrames(20, 0.05);
    });
    expect(camera.position.toArray()).toEqual([...target]);
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
