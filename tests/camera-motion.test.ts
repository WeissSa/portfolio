/**
 * Pure camera-motion contracts (owner decision 2026-11-26: smooth flights, no
 * arrival wobble). These run without a WebGL context; the R3F wiring (clock
 * threading + exact settle) is covered in camera-rig-motion.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import {
  DRIFT_FADE_DISTANCE,
  IDLE_DRIFT_AMPLITUDE,
  idleDriftOffset,
  driftEnvelope,
  motionAllowed,
  motionWindow,
} from '../src/scene/camera-motion';

describe('idle drift (bounded, sub-pixel amplitude)', () => {
  it('never exceeds the per-axis amplitude bound across a long clock range', () => {
    for (let t = 0; t <= 120; t += 0.1) {
      const [x, y, z] = idleDriftOffset(t);
      for (const value of [x, y, z]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThanOrEqual(IDLE_DRIFT_AMPLITUDE);
      }
    }
  });

  it('the amplitude is small enough to be sub-pixel (no visible jitter)', () => {
    // 4 mm at framing distance is far below one rendered pixel. A larger
    // amplitude read as mid-flight jitter under software rendering.
    expect(IDLE_DRIFT_AMPLITUDE).toBeLessThanOrEqual(0.004);
  });

  it('honours a smaller amplitude and is deterministic for a clock value', () => {
    const small = idleDriftOffset(3.3, 0.002);
    for (const value of small)
      expect(Math.abs(value)).toBeLessThanOrEqual(0.002);
    expect(idleDriftOffset(3.3)).toEqual(idleDriftOffset(3.3));
  });

  it('writes into a preallocated output (zero per-frame allocations)', () => {
    const scratch: [number, number, number] = [0, 0, 0];
    const returned = idleDriftOffset(2.5, IDLE_DRIFT_AMPLITUDE, scratch);
    expect(returned).toBe(scratch); // same reference — no new Vec3
    expect(scratch).toEqual(idleDriftOffset(2.5));
    idleDriftOffset(9.1, IDLE_DRIFT_AMPLITUDE, scratch);
    expect(scratch).toEqual(idleDriftOffset(9.1));
  });

  it('has character (not identically zero) but starts inside its bound', () => {
    const samples = Array.from({ length: 50 }, (_, i) =>
      idleDriftOffset(i * 0.7),
    );
    expect(
      samples.some(
        ([x, y, z]) => Math.abs(x) + Math.abs(y) + Math.abs(z) > 0.001,
      ),
    ).toBe(true);
  });

  it('samples smoothly — consecutive clock steps move only a few millimetres', () => {
    // Under SwiftShader a frame can advance the shared clock by up to 0.25 s.
    // Even at that worst-case step the drift must not jump visibly.
    for (let t = 0; t < 40; t += 0.25) {
      const a = idleDriftOffset(t);
      const b = idleDriftOffset(t + 0.25);
      for (let axis = 0; axis < 3; axis += 1) {
        expect(Math.abs(b[axis]! - a[axis]!)).toBeLessThanOrEqual(0.004);
      }
    }
  });
});

describe('smooth motion window (no pose jump at departure or arrival)', () => {
  it('is zero at departure and at settle, and ramps continuously', () => {
    expect(motionWindow(0)).toBe(0);
    expect(motionWindow(-1)).toBe(0);
    expect(motionWindow(DRIFT_FADE_DISTANCE)).toBe(0);
    expect(motionWindow(DRIFT_FADE_DISTANCE + 5)).toBe(0);
    expect(motionWindow(DRIFT_FADE_DISTANCE / 2)).toBeCloseTo(1, 6);
    let previous = 0;
    for (let r = 0; r <= DRIFT_FADE_DISTANCE; r += 0.01) {
      const value = motionWindow(r);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      // A continuous ramp: no step larger than a few percent per 1 cm.
      expect(Math.abs(value - previous)).toBeLessThan(0.06);
      previous = value;
    }
  });

  it('ramp-down mirrors ramp-up without a discontinuity', () => {
    for (let r = 0; r <= DRIFT_FADE_DISTANCE; r += 0.02) {
      const value = motionWindow(r);
      const mirrored = motionWindow(DRIFT_FADE_DISTANCE - r);
      expect(Math.abs(value - mirrored)).toBeLessThan(1e-9);
    }
  });

  it('monotone envelope is bounded and exactly zero at settle', () => {
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
    // The only render-only offset is drift × window; both are zero at rest.
    expect(motionWindow(0)).toBe(0);
    expect(driftEnvelope(0) * motionWindow(0)).toBe(0);
    expect(idleDriftOffset(0, IDLE_DRIFT_AMPLITUDE * motionWindow(0))).toEqual([
      0, 0, 0,
    ]);
  });
});
