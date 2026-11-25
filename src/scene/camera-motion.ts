/**
 * polish(e): bounded, pure camera "personality" helpers. No three/R3F import so
 * the amplitude/settle contracts are unit-testable without a WebGL context.
 *
 * DEMAND-FRAMELOOP CONTRACT (authoritative): nothing here requests a frame.
 * These values are sampled INSIDE useFrame, i.e. only on frames that some other
 * invalidation (camera flight, toggle, resize, dialog) already scheduled. At
 * true idle R3F renders ZERO frames, so the drift is frozen at its last value —
 * "idle = 0 frames" is preserved. A low-rate idle timer was explicitly NOT
 * chosen: it would violate that documented contract.
 *
 * Every offset decays to zero as the camera reaches its authored viewpoint, so
 * the establishing shot / zone frusta and the framing tests stay exact at rest.
 */
import type { Vec3 } from './art/geometry';

/** Maximum per-axis idle drift, metres (~1.8 cm — sub-pixel at framing range). */
export const IDLE_DRIFT_AMPLITUDE = 0.018;
/** Primary drift period, seconds (slow parallax, not a visible oscillation). */
export const IDLE_DRIFT_PERIOD_SECONDS = 7.4;
/** Maximum arrival bank/roll, radians (~0.8°). */
export const ARRIVAL_BANK_MAX_RADIANS = 0.014;
/** Peak settle overshoot along the travel direction, metres. */
export const SETTLE_OVERSHOOT_METRES = 0.025;
/** Distance window over which drift/bank/overshoot fade to zero (metres). */
export const DRIFT_FADE_DISTANCE = 0.8;

const TAU = Math.PI * 2;

/**
 * Small sinusoidal offset from the shared perf clock. Three axes use different
 * periods/phases so the result reads as organic parallax rather than a rigid
 * slide. Each component is bounded by `amplitude`; the vector is deterministic
 * for a given clock value.
 *
 * `out` lets the render loop pass a preallocated Vec3 so useFrame allocates
 * ZERO objects per frame (the default still returns a fresh vector for tests).
 */
export function idleDriftOffset(
  seconds: number,
  amplitude = IDLE_DRIFT_AMPLITUDE,
  out: Vec3 = [0, 0, 0],
): Vec3 {
  const w = TAU / IDLE_DRIFT_PERIOD_SECONDS;
  out[0] = amplitude * Math.sin(seconds * w);
  out[1] = amplitude * 0.55 * Math.sin(seconds * w * 0.73 + 1.2);
  out[2] = amplitude * 0.35 * Math.sin(seconds * w * 0.51 + 2.4);
  return out;
}

/** Bounded roll on arrival, derived from the same clock. */
export function arrivalBank(seconds: number): number {
  const w = TAU / (IDLE_DRIFT_PERIOD_SECONDS * 1.3);
  return ARRIVAL_BANK_MAX_RADIANS * Math.sin(seconds * w + 0.6);
}

/**
 * Motion envelope: 1 far from the target, fading linearly to 0 at the target.
 * Zero at settle is what guarantees an exact authored viewpoint at rest.
 */
export function driftEnvelope(remaining: number): number {
  if (remaining <= 0) return 0;
  return Math.min(1, remaining / DRIFT_FADE_DISTANCE);
}

/**
 * Arrival window for the camera "personality". ZERO at departure (large
 * remaining) and at exact settle, peaking mid-arrival. Drift and bank are both
 * gated by this: the old code applied full drift/bank on the flight's first
 * frame (~2 cm / ~0.8° pose jump) and the bank all the way through departure.
 * Zero at both ends means no first-frame discontinuity and an exact rest pose.
 */
export function motionWindow(remaining: number): number {
  if (remaining <= 0 || remaining >= DRIFT_FADE_DISTANCE) return 0;
  return Math.sin((Math.PI * remaining) / DRIFT_FADE_DISTANCE);
}

/**
 * Render-only pass-past along the travel direction, in metres. The camera is
 * drawn from its damped base toward the pose (`remaining * approach`), then a
 * small bump carries it a few centimetres PAST the pose near arrival before it
 * decays to EXACTLY 0 with `remaining` so the settle snap lands on the authored
 * viewpoint. Zero at departure (no first-frame jump). Never participates in
 * the settle check (which measures `basePosition`), so it cannot stall the
 * demand loop.
 */
export function settleOvershoot(remaining: number): number {
  if (remaining <= 0 || remaining >= DRIFT_FADE_DISTANCE) return 0;
  const ratio = remaining / DRIFT_FADE_DISTANCE; // 1 at window edge → 0 at settle
  const approach = 1 - ratio * ratio; // 0 at edge → 1 at settle (early ramp)
  return (
    remaining * approach + SETTLE_OVERSHOOT_METRES * Math.sin(Math.PI * ratio)
  );
}

/** Drift/bank are disabled for reduced-motion cuts and while paused/hidden. */
export function motionAllowed(instant: boolean, paused: boolean): boolean {
  return !instant && !paused;
}
