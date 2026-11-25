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
 */
export function idleDriftOffset(
  seconds: number,
  amplitude = IDLE_DRIFT_AMPLITUDE,
): Vec3 {
  const w = TAU / IDLE_DRIFT_PERIOD_SECONDS;
  return [
    amplitude * Math.sin(seconds * w),
    amplitude * 0.55 * Math.sin(seconds * w * 0.73 + 1.2),
    amplitude * 0.35 * Math.sin(seconds * w * 0.51 + 2.4),
  ];
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
 * Brief, render-only overshoot along the travel direction. Zero far away AND
 * at the target, peaking mid-window; never participates in the settle check, so
 * it cannot extend settle time or stall the demand loop.
 */
export function settleOvershoot(remaining: number): number {
  if (remaining <= 0 || remaining >= DRIFT_FADE_DISTANCE) return 0;
  return (
    SETTLE_OVERSHOOT_METRES *
    Math.sin((Math.PI * remaining) / DRIFT_FADE_DISTANCE)
  );
}

/** Drift/bank are disabled for reduced-motion cuts and while paused/hidden. */
export function motionAllowed(instant: boolean, paused: boolean): boolean {
  return !instant && !paused;
}
