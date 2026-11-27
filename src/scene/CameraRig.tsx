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
 * Camera character (owner decision 2026-11-26: SMOOTH, no wobble):
 *  - A sub-pixel sinusoidal drift (camera-motion.ts) is sampled from the SAME
 *    pure clock step PainterlyPass uses (`advancePainterlyTime`), so it is tied
 *    to the existing perf clock and freezes with reduced motion / when paused.
 *  - The old arrival bank (roll) and settle overshoot (pass-past-then-back)
 *    are REMOVED — they read as a wobble on arrival. Only the tiny drift is
 *    applied, to `camera.position` only, ramped by `motionWindow` from zero at
 *    departure to zero at settle. The visible pose therefore approaches the
 *    authored viewpoint monotonically and snaps EXACTLY to it on settle —
 *    frustum/framing gates stay green. No `invalidate()` for drift: idle = 0
 *    frames.
 *
 * Per-frame hygiene: preallocated Vector3s + MathUtils.damp, no allocations in
 * useFrame. `delta` is clamped so a long hidden-tab gap cannot produce a giant
 * jump on the first visible frame.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { DeviceTier } from '../lib/device-tier';
import { useDiegeticDetail } from '../lib/detail-mode';
import { usePortfolioStore } from '../state/store';
import { advancePainterlyTime } from './diegetic';
import {
  IDLE_DRIFT_AMPLITUDE,
  idleDriftOffset,
  motionAllowed,
  motionWindow,
} from './camera-motion';
import {
  getCameraViewpoint,
  HOME_VIEWPOINT,
  type DetailKind,
} from './viewpoints';

const DAMP_LAMBDA = 3.6;
/**
 * Clamp the damp step so a stalled frame cannot teleport the camera. The old
 * 0.1 s cap was tuned for 60 fps, but under software rendering a single frame
 * can take 350–1000 ms: the clamp then stretched one flight into 12+ expensive
 * frames. 0.25 s keeps the same exact motion at 60 fps (delta ~0.017) while
 * letting a genuinely slow frame advance far enough to settle in ~5 frames.
 * No authored pose, envelope or test at 60 fps changes.
 */
export const MAX_DELTA = 0.25;
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
  // One detail state drives the camera close-up: no four flags to disagree.
  const detailKind = usePortfolioStore((state) => state.activeDetail?.kind);
  const desktopOpen = detailKind === 'about';
  // Only fine-pointer live 3D flies to a detail close-up; fallback modes keep
  // the zone viewpoint (the visible DOM dialog does its own thing).
  const diegetic = useDiegeticDetail();
  const detail: DetailKind | null =
    diegetic && detailKind
      ? detailKind === 'post'
        ? 'book'
        : detailKind === 'project'
          ? 'case'
          : detailKind === 'about'
            ? 'monitor'
            : 'projector'
      : null;
  const setCameraSettled = usePortfolioStore((state) => state.setCameraSettled);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const portrait = size.height > size.width;

  // Preallocated scratch — useFrame never allocates. `basePosition` is the
  // damped pose the settle gate measures; `camera.position` is base + drift so
  // the visible wobble can never stall convergence.
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const currentTarget = useMemo(() => new THREE.Vector3(), []);
  const basePosition = useMemo(() => new THREE.Vector3(), []);
  // Preallocated drift output: idleDriftOffset writes here so useFrame never
  // allocates a Vec3 per frame.
  const driftScratch = useMemo<[number, number, number]>(() => [0, 0, 0], []);
  const flying = useRef(false);
  const mounted = useRef(false);
  const clock = useRef(0);

  useEffect(() => {
    const viewpoint = getCameraViewpoint(
      activeZone,
      desktopOpen,
      { portrait, tier },
      detail,
    );
    desiredPosition.set(...viewpoint.position);
    desiredTarget.set(...viewpoint.target);

    if (!mounted.current) {
      // Establish at the home shot on first mount, then fly to the landing
      // zone (a no-op when that zone is home). Deep links land in-zone.
      mounted.current = true;
      camera.position.set(...HOME_VIEWPOINT.position);
      basePosition.set(...HOME_VIEWPOINT.position);
      currentTarget.set(...HOME_VIEWPOINT.target);
      camera.lookAt(currentTarget);
    }

    if (instant) {
      camera.position.copy(desiredPosition);
      basePosition.copy(desiredPosition);
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
    detail,
    instant,
    setCameraSettled,
    portrait,
    tier,
    camera,
    invalidate,
    desiredPosition,
    desiredTarget,
    currentTarget,
    basePosition,
  ]);

  // setFrameloop('never' → 'demand') does not request a frame on its own.
  useEffect(() => {
    if (paused) return;
    const frame = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(frame);
  }, [paused, invalidate]);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, MAX_DELTA);
    // Same clock step as PainterlyPass: frozen for reduced-motion cuts and
    // while paused, so the drift phase cannot advance without a rendered frame.
    clock.current = advancePainterlyTime(clock.current, dt, instant || paused);
    if (!flying.current || paused) return;

    basePosition.x = THREE.MathUtils.damp(
      basePosition.x,
      desiredPosition.x,
      DAMP_LAMBDA,
      dt,
    );
    basePosition.y = THREE.MathUtils.damp(
      basePosition.y,
      desiredPosition.y,
      DAMP_LAMBDA,
      dt,
    );
    basePosition.z = THREE.MathUtils.damp(
      basePosition.z,
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

    const remaining =
      basePosition.distanceTo(desiredPosition) +
      currentTarget.distanceTo(desiredTarget);
    // Gated by the ARRIVAL window: zero on the flight's first frame (no
    // ~2 cm / 0.8° jump at departure) and zero at settle (exact rest pose).
    const envelope =
      motionWindow(remaining) * (motionAllowed(instant, paused) ? 1 : 0);
    const drift = idleDriftOffset(
      clock.current,
      IDLE_DRIFT_AMPLITUDE,
      driftScratch,
    );

    // NO bank, NO overshoot. The rendered pose is the damped base plus a
    // sub-pixel drift that vanishes at settle, so the approach never crosses
    // past the authored viewpoint and the arrival cannot wobble.
    camera.position.set(
      basePosition.x + drift[0] * envelope,
      basePosition.y + drift[1] * envelope,
      basePosition.z + drift[2] * envelope,
    );
    camera.lookAt(currentTarget);

    if (
      basePosition.distanceToSquared(desiredPosition) < SETTLE_EPSILON_SQ &&
      currentTarget.distanceToSquared(desiredTarget) < SETTLE_EPSILON_SQ
    ) {
      // Exact authored pose at rest — no residual drift. This is
      // what keeps the diegetic frustum/focus framing tests valid.
      basePosition.copy(desiredPosition);
      currentTarget.copy(desiredTarget);
      camera.position.copy(desiredPosition);
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
