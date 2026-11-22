/**
 * Device-tier classification + mode persistence (REWORK_PLAN §3.6/§3.7,
 * commit 5). All classifiers are pure; the storage helpers run against jsdom's
 * localStorage and are cleaned up by the shared afterEach in tests/setup.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  capabilityGate,
  classifyTier,
  clearManualMode,
  clearSceneFailure,
  detectCapabilities,
  MODE_STORAGE_KEY,
  readManualMode,
  readSceneFailure,
  recommendMode,
  resolveMode,
  SCENE_FAILURE_STORAGE_KEY,
  SCENE_FAILURE_VALUE,
  writeManualMode,
  writeSceneFailure,
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

  it('defaults capable MOBILE (touch/coarse pointer) to 3D too', () => {
    const mobile = withOverrides({
      pointerType: 'coarse',
      deviceMemory: 4,
      hardwareConcurrency: 4,
    });
    expect(classifyTier(mobile)).toBe('mobile');
    expect(recommendMode(mobile)).toBe('3d');
    expect(resolveMode(mobile)).toMatchObject({
      mode: '3d',
      tier: 'mobile',
      source: 'auto',
      reason: 'capable',
    });
  });

  it('defaults a capable fine-pointer desktop to 3D with no stored override', () => {
    expect(readManualMode()).toBeNull();
    expect(resolveMode(capable)).toMatchObject({
      mode: '3d',
      tier: 'desktop',
      source: 'auto',
      reason: 'capable',
    });
  });

  it('keeps static gates authoritative on mobile (2D on constraint)', () => {
    const mobile = { pointerType: 'coarse' as const };
    expect(recommendMode(withOverrides({ ...mobile, deviceMemory: 2 }))).toBe(
      '2d',
    );
    expect(recommendMode(withOverrides({ ...mobile, saveData: true }))).toBe(
      '2d',
    );
    expect(
      recommendMode(withOverrides({ ...mobile, reducedMotion: true })),
    ).toBe('2d');
    expect(recommendMode(withOverrides({ ...mobile, webgl2: false }))).toBe(
      '2d',
    );
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

  it('honours a persisted override only when 3D is safe', () => {
    writeManualMode('3d');
    expect(resolveMode(capable)).toMatchObject({
      mode: '3d',
      source: 'manual',
      reason: 'manual',
    });

    writeManualMode('2d');
    expect(resolveMode(capable)).toMatchObject({
      mode: '2d',
      source: 'manual',
      reason: 'manual',
    });
  });

  // CRASH-ON-LOAD FIX: a stale "3d" override must never beat a capability gate.
  it('forces 2D for webgl2:false + stored 3d', () => {
    writeManualMode('3d');
    expect(resolveMode(withOverrides({ webgl2: false }))).toMatchObject({
      mode: '2d',
      source: 'auto',
      reason: 'no-webgl2',
      tier: 'low',
    });
  });

  it('forces 2D for saveData:true + stored 3d', () => {
    writeManualMode('3d');
    expect(resolveMode(withOverrides({ saveData: true }))).toMatchObject({
      mode: '2d',
      source: 'auto',
      reason: 'save-data',
    });
  });

  it('forces 2D for reduced-motion and very-low tier + stored 3d', () => {
    writeManualMode('3d');
    expect(resolveMode(withOverrides({ reducedMotion: true })).reason).toBe(
      'reduced-motion',
    );
    expect(resolveMode(withOverrides({ reducedMotion: true })).mode).toBe('2d');
    const low = withOverrides({ deviceMemory: 2 });
    expect(resolveMode(low)).toMatchObject({ mode: '2d', reason: 'low-tier' });
  });

  it('exposes the first gate so the UI can disable the 3D option', () => {
    expect(capabilityGate(capable)).toBeNull();
    expect(capabilityGate(withOverrides({ webgl2: false }))).toBe('no-webgl2');
    expect(capabilityGate(withOverrides({ saveData: true }))).toBe('save-data');
    expect(capabilityGate(withOverrides({ reducedMotion: true }))).toBe(
      'reduced-motion',
    );
    expect(capabilityGate(withOverrides({ deviceMemory: 2 }))).toBe('low-tier');
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

describe('persisted scene failure (crash recovery)', () => {
  beforeEach(() => {
    clearManualMode();
    clearSceneFailure();
  });

  it('pins the canonical sentinel: write stores exactly SCENE_FAILURE_VALUE and resolveMode forces 2d', () => {
    // Path 1 — the exact stored string (QA defect D1: writer and reader must
    // agree on ONE canonical value; 'true' is canonical, '1' never was).
    writeSceneFailure();
    expect(SCENE_FAILURE_VALUE).toBe('true');
    expect(localStorage.getItem(SCENE_FAILURE_STORAGE_KEY)).toBe(
      SCENE_FAILURE_VALUE,
    );

    // Path 2 — writeSceneFailure() then resolveMode() forces the 2D shell.
    expect(resolveMode(capable)).toMatchObject({
      mode: '2d',
      source: 'auto',
      reason: 'scene-failed',
    });
  });

  it('ignores non-canonical sentinel values such as the legacy QA probe "1"', () => {
    localStorage.setItem(SCENE_FAILURE_STORAGE_KEY, '1');
    expect(readSceneFailure()).toBe(false);
    expect(resolveMode(capable)).toMatchObject({
      mode: '3d',
      reason: 'capable',
    });
  });

  it('forces 2D on Auto and reload, beating even a stored 3d override', () => {
    writeSceneFailure();
    expect(readSceneFailure()).toBe(true);
    expect(localStorage.getItem(SCENE_FAILURE_STORAGE_KEY)).toBe('true');
    expect(recommendMode(capable)).toBe('2d');
    expect(resolveMode(capable)).toMatchObject({
      mode: '2d',
      source: 'auto',
      reason: 'scene-failed',
    });

    writeManualMode('3d');
    expect(resolveMode(capable)).toMatchObject({
      mode: '2d',
      reason: 'scene-failed',
    });

    clearSceneFailure();
    expect(readSceneFailure()).toBe(false);
    expect(resolveMode(capable)).toMatchObject({
      mode: '3d',
      reason: 'manual',
    });
  });

  it('keeps recommendMode and the authoritative gate on the same source', () => {
    const profiles = [
      capable,
      withOverrides({ pointerType: 'coarse', deviceMemory: 4 }),
      withOverrides({ reducedMotion: true }),
      withOverrides({ saveData: true }),
      withOverrides({ webgl2: false }),
    ];
    for (const profile of profiles) {
      expect(recommendMode(profile)).toBe(
        capabilityGate(profile) ? '2d' : '3d',
      );
    }
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

  it('releases the WebGL2 probe context so the real Canvas is not context-starved', () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    const fakeContext = { getExtension };
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(fakeContext as unknown as WebGL2RenderingContext);
    try {
      expect(detectCapabilities().webgl2).toBe(true);
      expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
      expect(loseContext).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
