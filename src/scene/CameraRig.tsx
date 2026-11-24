/**
 * Camera rig (REWORK_PLAN §3.3/§4.2, commit 5): reads `activeZone` from the
 * store and flies the camera to that zone's framed viewpoint. No picking / DOM
 * equivalents here — zones stay visual placeholders until commits 6–9.
 *
 * Demand-loop strategy (documented for reviewers):
 *  - Room uses `frameloop="demand"`, so nothing renders until `invalidate()`.
 *  - CameraRig damps position + look-at target inside useFrame and calls
 *    `invalidate()` again while a flight is in progress, which keeps exactly
 *    one frame per tick alive until the camera settles (then it stops). This
 *    is safe alongside PainterlyPass' priority-1 useFrame: on each invalidated
 *    frame R3F runs subscribers in order and PainterlyPass performs the actual
 *    draw, so the flight is visible and the idle loop costs zero frames.
 *  - A visibility/unpause effect in Room calls invalidate() when the tab
 *    becomes visible again (setFrameloop does not invalidate by itself).
 *  - prefers-reduced-motion (or a low-tier forced 2D) passes `instant`, which
 *    snaps the camera instead of animating.
 *
 * Per-frame hygiene: three preallocated Vector3s + MathUtils.damp, no
 * allocations in useFrame. `delta` is clamped so a long hidden-tab gap cannot
 * produce a giant jump on the first visible frame.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { DeviceTier } from '../lib/device-tier';
import { usePortfolioStore } from '../state/store';
import { getCameraViewpoint, HOME_VIEWPOINT } from './viewpoints';

const DAMP_LAMBDA = 3.6;
const MAX_DELTA = 0.1;
const SETTLE_EPSILON_SQ = 0.0001; // 0.01 units² on both position + target.

export interface CameraRigProps {
  /** Snap to the viewpoint instead of flying (prefers-reduced-motion). */
  instant?: boolean;
  /** Suppress invalidation while the tab is hidden. */
  paused?: boolean;
  /** Render tier; mobile portrait gets a pulled-back framing (§3.6). */
  tier?: DeviceTier;
}

export function CameraRig({
  instant = false,
  paused = false,
  tier,
}: CameraRigProps) {
  const activeZone = usePortfolioStore((state) => state.activeZone);
  // Desktop zoom (commit 7): fly to the monitor close-up while the 2D desktop
  // overlay is open, and back to the zone viewpoint when it closes.
  const desktopOpen = usePortfolioStore((state) => state.desktopOpen);
  const setCameraSettled = usePortfolioStore((state) => state.setCameraSettled);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const portrait = size.height > size.width;

  // Preallocated scratch — useFrame never allocates.
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const currentTarget = useMemo(() => new THREE.Vector3(), []);
  const flying = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    const viewpoint = getCameraViewpoint(activeZone, desktopOpen, {
      portrait,
      tier,
    });
    desiredPosition.set(...viewpoint.position);
    desiredTarget.set(...viewpoint.target);

    if (!mounted.current) {
      // Establish at the home shot on first mount, then fly to the landing
      // zone (a no-op when that zone is home). Deep links land in-zone.
      mounted.current = true;
      camera.position.set(...HOME_VIEWPOINT.position);
      currentTarget.set(...HOME_VIEWPOINT.target);
      camera.lookAt(currentTarget);
    }

    if (instant) {
      camera.position.copy(desiredPosition);
      currentTarget.copy(desiredTarget);
      camera.lookAt(currentTarget);
      flying.current = false;
      // Reduced-motion cut: the viewpoint is reached in this same commit, so
      // zone spotlights can turn on immediately (no animation to wait for).
      setCameraSettled(true);
    } else {
      flying.current = true;
      setCameraSettled(false);
    }
    invalidate();
  }, [
    activeZone,
    desktopOpen,
    instant,
    setCameraSettled,
    portrait,
    tier,
    camera,
    invalidate,
    desiredPosition,
    desiredTarget,
    currentTarget,
  ]);

  // setFrameloop('never' → 'demand') does not request a frame on its own.
  useEffect(() => {
    if (paused) return;
    const frame = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(frame);
  }, [paused, invalidate]);

  useFrame((_state, delta) => {
    if (!flying.current || paused) return;
    const dt = Math.min(delta, MAX_DELTA);

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      desiredPosition.x,
      DAMP_LAMBDA,
      dt,
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      desiredPosition.y,
      DAMP_LAMBDA,
      dt,
    );
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      desiredPosition.z,
      DAMP_LAMBDA,
      dt,
    );
    currentTarget.x = THREE.MathUtils.damp(
      currentTarget.x,
      desiredTarget.x,
      DAMP_LAMBDA,
      dt,
    );
    currentTarget.y = THREE.MathUtils.damp(
      currentTarget.y,
      desiredTarget.y,
      DAMP_LAMBDA,
      dt,
    );
    currentTarget.z = THREE.MathUtils.damp(
      currentTarget.z,
      desiredTarget.z,
      DAMP_LAMBDA,
      dt,
    );
    camera.lookAt(currentTarget);

    if (
      camera.position.distanceToSquared(desiredPosition) < SETTLE_EPSILON_SQ &&
      currentTarget.distanceToSquared(desiredTarget) < SETTLE_EPSILON_SQ
    ) {
      camera.position.copy(desiredPosition);
      currentTarget.copy(desiredTarget);
      camera.lookAt(currentTarget);
      flying.current = false;
      setCameraSettled(true);
      // One final frame is still needed to draw the snapped pose.
      invalidate();
    } else {
      invalidate(); // Keep the demand loop alive until settled.
    }
  });

  return null;
}
