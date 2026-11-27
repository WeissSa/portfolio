/**
 * Bounded, pure camera "personality" helpers. No three/R3F import so the
 * amplitude/settle contracts are unit-testable without a WebGL context.
 *
 * DEMAND-FRAMELOOP CONTRACT (authoritative): nothing here requests a frame.
 * These values are sampled INSIDE useFrame, i.e. only on frames that some other
 * invalidation (camera flight, toggle, resize, dialog) already scheduled. At
 * true idle R3F renders ZERO frames, so the drift is frozen at its last value —
 * "idle = 0 frames" is preserved. A low-rate idle timer was explicitly NOT
 * chosen: it would violate that documented contract.
 *
 * OWNER DECISION (2026-11-26): the camera must be SMOOTH. The old arrival bank
 * (roll) and settle overshoot (pass-past-then-back) read as a wobble on arrival,
 * and a rotating drift read as mid-flight jitter. Both render-only effects are
 * GONE; the only remaining offset is a sub-pixel drift that ramps smoothly from
 * zero at departure to zero at settle. Every offset is exactly zero at rest so
 * the authored viewpoint/frusta stay exact and the demand loop can idle.
 */
import type { Vec3 } from './art/geometry';

/**
 * Maximum per-axis drift, metres (4 mm — well below one pixel at framing
 * distance). Kept only so the flight still feels hand-drawn, never shaky.
 */
export const IDLE_DRIFT_AMPLITUDE = 0.004;
/** Primary drift period, seconds (slow parallax, not a visible oscillation). */
export const IDLE_DRIFT_PERIOD_SECONDS = 7.4;
/** Distance window over which the drift ramps from/to zero (metres). */
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

/**
 * Smooth motion envelope: ZERO at departure (large remaining) and at exact
 * settle, peaking mid-flight. A sinusoid ramps continuously from/to zero, so a
 * flight never starts or ends with a pose jump. This is the ONLY gate on the
 * render-only drift; the base damped approach itself is already smooth.
 */
export function motionWindow(remaining: number): number {
  if (remaining <= 0 || remaining >= DRIFT_FADE_DISTANCE) return 0;
  return Math.sin((Math.PI * remaining) / DRIFT_FADE_DISTANCE);
}

/** Drift is disabled for reduced-motion cuts and while paused/hidden. */
export function motionAllowed(instant: boolean, paused: boolean): boolean {
  return !instant && !paused;
}
