/**
 * polish(e): R3F wiring for camera personality. The pure amplitude/envelope
 * contracts live in camera-motion.test.ts; here we pin the two behavioural
 * guarantees that only the component can provide:
 *   1. reduced motion (instant) never drifts — the camera sits at the exact
 *      authored pose even across extra frames;
 *   2. a normal flight returns to the EXACT viewpoint once settled, so the
 *      diegetic frustum/legibility tests still measure an un-drifted camera.
 */
import { useLayoutEffect } from 'react';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Route } from '../src/lib/router';
import { CameraRig } from '../src/scene/CameraRig';
import { HOME_VIEWPOINT, ZONE_VIEWPOINTS } from '../src/scene/viewpoints';
import { usePortfolioStore } from '../src/state/store';

let capturedCamera: THREE.Camera | null = null;

function CameraProbe(): null {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    capturedCamera = camera;
  }, [camera]);
  return null;
}

async function mountRig(instant: boolean, zone: Route) {
  act(() => {
    usePortfolioStore.setState({
      activeZone: zone,
      desktopOpen: false,
      selectedPostId: null,
      selectedProjectId: null,
      climatePanelOpen: false,
    });
  });
  return ReactThreeTestRenderer.create(
    <>
      <CameraRig instant={instant} />
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

    // Extra frames on an already-settled instant rig must not introduce wobble.
    await act(async () => {
      await renderer.advanceFrames(8, 0.05);
    });
    expect(camera.position.toArray()).toEqual([...HOME_VIEWPOINT.position]);
    await renderer.unmount();
  });

  it('returns to the exact in-zone viewpoint after a drift/bank flight', async () => {
    const renderer = await mountRig(false, '/about');
    const camera = capturedCamera!;
    // Establishes at home first, then flies to the landing zone.
    expect(camera.position.toArray()).toEqual([...HOME_VIEWPOINT.position]);

    await act(async () => {
      await renderer.advanceFrames(200, 0.05);
    });

    const target = ZONE_VIEWPOINTS['/about'].position;
    expect(camera.position.x).toBeCloseTo(target[0], 6);
    expect(camera.position.y).toBeCloseTo(target[1], 6);
    expect(camera.position.z).toBeCloseTo(target[2], 6);
    // Bit-exact authored pose (the snap on settle), not just "near" it.
    expect(camera.position.toArray()).toEqual([...target]);
    expect(usePortfolioStore.getState().cameraSettled).toBe(true);
    await renderer.unmount();
  });
});
