/**
 * Device-tier classification + mode persistence (REWORK_PLAN §3.6/§3.7,
 * commit 5). All classifiers are pure; the storage helpers run against jsdom's
 * localStorage and are cleaned up by the shared afterEach in tests/setup.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  classifyTier,
  clearManualMode,
  detectCapabilities,
  MODE_STORAGE_KEY,
  readManualMode,
  recommendMode,
  resolveMode,
  writeManualMode,
  type DeviceCapabilities,
} from '../src/lib/device-tier';

const capable: DeviceCapabilities = {
  webgl2: true,
  deviceMemory: 8,
  hardwareConcurrency: 8,
  saveData: false,
  pointerType: 'fine',
  reducedMotion: false,
};

const withOverrides = (
  overrides: Partial<DeviceCapabilities>,
): DeviceCapabilities => ({ ...capable, ...overrides });

describe('classifyTier', () => {
  beforeEach(() => clearManualMode());

  it('classifies a capable fine-pointer desktop as desktop', () => {
    expect(classifyTier(capable)).toBe('desktop');
  });

  it('treats no WebGL2, save-data and very low-end hardware as low', () => {
    expect(classifyTier(withOverrides({ webgl2: false }))).toBe('low');
    expect(classifyTier(withOverrides({ saveData: true }))).toBe('low');
    expect(classifyTier(withOverrides({ deviceMemory: 2 }))).toBe('low');
    expect(classifyTier(withOverrides({ hardwareConcurrency: 2 }))).toBe('low');
  });

  it('treats coarse/unknown pointers and mid hardware as mobile', () => {
    expect(classifyTier(withOverrides({ pointerType: 'coarse' }))).toBe(
      'mobile',
    );
    expect(classifyTier(withOverrides({ pointerType: 'none' }))).toBe('mobile');
    expect(classifyTier(withOverrides({ deviceMemory: 4 }))).toBe('mobile');
    expect(classifyTier(withOverrides({ hardwareConcurrency: 4 }))).toBe(
      'mobile',
    );
  });

  it('tolerates unknown memory/core counts (mobile on coarse pointer)', () => {
    expect(
      classifyTier(
        withOverrides({ deviceMemory: null, hardwareConcurrency: null }),
      ),
    ).toBe('desktop');
    expect(
      classifyTier(
        withOverrides({
          deviceMemory: null,
          hardwareConcurrency: null,
          pointerType: 'coarse',
        }),
      ),
    ).toBe('mobile');
  });
});

describe('recommendMode', () => {
  it('auto-drops to 2D for reduced motion, save-data, no WebGL2 or low tier', () => {
    expect(recommendMode(capable)).toBe('3d');
    expect(recommendMode(withOverrides({ reducedMotion: true }))).toBe('2d');
    expect(recommendMode(withOverrides({ saveData: true }))).toBe('2d');
    expect(recommendMode(withOverrides({ webgl2: false }))).toBe('2d');
    expect(recommendMode(withOverrides({ deviceMemory: 2 }))).toBe('2d');
  });

  it('recommends 3D for an unproblematic mobile tier', () => {
    expect(recommendMode(withOverrides({ pointerType: 'coarse' }))).toBe('3d');
  });
});

describe('manual mode persistence', () => {
  beforeEach(() => clearManualMode());

  it('round-trips 2d/3d and ignores invalid or absent values', () => {
    expect(readManualMode()).toBeNull();
    writeManualMode('3d');
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('3d');
    expect(readManualMode()).toBe('3d');
    writeManualMode('2d');
    expect(readManualMode()).toBe('2d');
    localStorage.setItem(MODE_STORAGE_KEY, 'auto');
    expect(readManualMode()).toBeNull();
    clearManualMode();
    expect(readManualMode()).toBeNull();
  });

  it('persisted manual mode beats the automatic decision', () => {
    writeManualMode('3d');
    const decision = resolveMode(
      withOverrides({ reducedMotion: true, webgl2: false }),
    );
    expect(decision).toMatchObject({
      mode: '3d',
      source: 'manual',
      reason: 'manual',
      tier: 'low',
    });

    writeManualMode('2d');
    expect(resolveMode(capable).mode).toBe('2d');
  });

  it('reports the reason for automatic decisions', () => {
    expect(resolveMode(capable)).toMatchObject({
      mode: '3d',
      source: 'auto',
      reason: 'capable',
    });
    expect(resolveMode(withOverrides({ reducedMotion: true })).reason).toBe(
      'reduced-motion',
    );
    expect(resolveMode(withOverrides({ saveData: true })).reason).toBe(
      'save-data',
    );
    expect(resolveMode(withOverrides({ webgl2: false })).reason).toBe(
      'no-webgl2',
    );
  });
});

describe('detectCapabilities', () => {
  it('returns a fully-formed capability record in a headless DOM', () => {
    const caps = detectCapabilities();
    expect(typeof caps.webgl2).toBe('boolean');
    expect(typeof caps.saveData).toBe('boolean');
    expect(typeof caps.reducedMotion).toBe('boolean');
    expect(['fine', 'coarse', 'none']).toContain(caps.pointerType);
    expect(
      caps.deviceMemory === null || typeof caps.deviceMemory === 'number',
    ).toBe(true);
    expect(
      caps.hardwareConcurrency === null ||
        typeof caps.hardwareConcurrency === 'number',
    ).toBe(true);
    // jsdom's getContext returns null → conservative 2D default.
    expect(recommendMode(caps)).toBe('2d');
  });
});
