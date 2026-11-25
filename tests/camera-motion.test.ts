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

  it('overshoot is zero at both ends of the window and bounded in between', () => {
    expect(settleOvershoot(0)).toBe(0);
    expect(settleOvershoot(-1)).toBe(0);
    expect(settleOvershoot(DRIFT_FADE_DISTANCE)).toBe(0);
    expect(settleOvershoot(DRIFT_FADE_DISTANCE + 5)).toBe(0);
    for (let r = 0; r <= DRIFT_FADE_DISTANCE; r += 0.02) {
      expect(settleOvershoot(r)).toBeLessThanOrEqual(SETTLE_OVERSHOOT_METRES);
      expect(settleOvershoot(r)).toBeGreaterThanOrEqual(0);
    }
    expect(settleOvershoot(DRIFT_FADE_DISTANCE / 2)).toBeGreaterThan(0);
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
});
