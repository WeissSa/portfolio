/**
 * polish(e): pure camera-personality contracts. These run without a WebGL
 * context; the R3F wiring (clock threading + exact settle) is covered in
 * camera-rig-motion.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_BANK_MAX_RADIANS,
  DRIFT_FADE_DISTANCE,
  IDLE_DRIFT_AMPLITUDE,
  idleDriftOffset,
  arrivalBank,
  driftEnvelope,
  motionAllowed,
  motionWindow,
  SETTLE_OVERSHOOT_METRES,
  settleOvershoot,
} from '../src/scene/camera-motion';

describe('idle drift (bounded amplitude)', () => {
  it('never exceeds the per-axis amplitude bound across a long clock range', () => {
    for (let t = 0; t <= 120; t += 0.1) {
      const [x, y, z] = idleDriftOffset(t);
      for (const value of [x, y, z]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThanOrEqual(IDLE_DRIFT_AMPLITUDE);
      }
    }
  });

  it('honours a smaller amplitude and is deterministic for a clock value', () => {
    const small = idleDriftOffset(3.3, 0.004);
    for (const value of small)
      expect(Math.abs(value)).toBeLessThanOrEqual(0.004);
    expect(idleDriftOffset(3.3)).toEqual(idleDriftOffset(3.3));
  });

  it('writes into a preallocated output (zero per-frame allocations)', () => {
    const scratch: [number, number, number] = [0, 0, 0];
    const returned = idleDriftOffset(2.5, IDLE_DRIFT_AMPLITUDE, scratch);
    expect(returned).toBe(scratch); // same reference — no new Vec3
    expect(scratch).toEqual(idleDriftOffset(2.5));
    // A second call overwrites in place rather than appending/allocating.
    idleDriftOffset(9.1, IDLE_DRIFT_AMPLITUDE, scratch);
    expect(scratch).toEqual(idleDriftOffset(9.1));
  });

  it('has personality (not identically zero) but starts inside its bound', () => {
    const samples = Array.from({ length: 50 }, (_, i) =>
      idleDriftOffset(i * 0.7),
    );
    expect(
      samples.some(
        ([x, y, z]) => Math.abs(x) + Math.abs(y) + Math.abs(z) > 0.005,
      ),
    ).toBe(true);
  });
});

describe('arrival bank + settle overshoot', () => {
  it('roll stays inside the ~0.8° ceiling', () => {
    for (let t = 0; t <= 60; t += 0.05) {
      expect(Math.abs(arrivalBank(t))).toBeLessThanOrEqual(
        ARRIVAL_BANK_MAX_RADIANS,
      );
    }
  });

  it('overshoot is zero at departure AND at settle, bounded in between', () => {
    expect(settleOvershoot(0)).toBe(0);
    expect(settleOvershoot(-1)).toBe(0);
    expect(settleOvershoot(DRIFT_FADE_DISTANCE)).toBe(0);
    expect(settleOvershoot(DRIFT_FADE_DISTANCE + 5)).toBe(0);
    for (let r = 0; r <= DRIFT_FADE_DISTANCE; r += 0.02) {
      expect(settleOvershoot(r)).toBeGreaterThanOrEqual(0);
      // Render offset may ramp toward the pose but never beyond pose + bump.
      expect(settleOvershoot(r)).toBeLessThanOrEqual(
        r + SETTLE_OVERSHOOT_METRES + 1e-9,
      );
    }
    expect(settleOvershoot(DRIFT_FADE_DISTANCE / 2)).toBeGreaterThan(0);
  });

  it('passes the pose mid-arrival, then decays to an exact settle', () => {
    // The rendered camera crosses the authored pose (offset > remaining) for
    // at least one sampled depth, and the crossing fades to zero at settle.
    const crossings = Array.from({ length: 41 }, (_, i) => {
      const r = (i / 40) * DRIFT_FADE_DISTANCE;
      return settleOvershoot(r) - r;
    });
    expect(crossings.some((delta) => delta > 0)).toBe(true);
    expect(settleOvershoot(0)).toBe(0);
    expect(settleOvershoot(0.001)).toBeLessThan(0.01);
  });

  it('arrival motion window is zero at departure and at settle', () => {
    expect(motionWindow(0)).toBe(0);
    expect(motionWindow(-1)).toBe(0);
    expect(motionWindow(DRIFT_FADE_DISTANCE)).toBe(0);
    expect(motionWindow(DRIFT_FADE_DISTANCE + 5)).toBe(0);
    expect(motionWindow(DRIFT_FADE_DISTANCE / 2)).toBeCloseTo(1, 6);
    for (let r = 0; r <= DRIFT_FADE_DISTANCE; r += 0.02) {
      const value = motionWindow(r);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('motion envelope is monotone, in [0,1] and exactly zero at settle', () => {
    expect(driftEnvelope(0)).toBe(0);
    expect(driftEnvelope(-0.1)).toBe(0);
    let previous = 0;
    for (let r = 0; r <= DRIFT_FADE_DISTANCE * 2; r += 0.05) {
      const value = driftEnvelope(r);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
    expect(driftEnvelope(DRIFT_FADE_DISTANCE)).toBe(1);
  });

  it('disables all motion under reduced motion or while paused', () => {
    expect(motionAllowed(false, false)).toBe(true);
    expect(motionAllowed(true, false)).toBe(false);
    expect(motionAllowed(false, true)).toBe(false);
    expect(motionAllowed(true, true)).toBe(false);
  });

  it('is perfectly still at settle (idle demands 0 frames)', () => {
    // Every render-only offset is exactly zero at rest, so a settled camera
    // cannot move and the demand frameloop correctly issues no new frames.
    expect(motionWindow(0)).toBe(0);
    expect(settleOvershoot(0)).toBe(0);
    expect(driftEnvelope(0) * motionWindow(0)).toBe(0);
  });
});
