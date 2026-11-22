/**
 * Device tiering + mode resolution (REWORK_PLAN §3.6/§3.7/§4.5, commit 5).
 *
 * Kept dependency-free and side-effect-light so the pure classifiers are
 * unit-testable without a browser. `detectCapabilities()` is the only part
 * that touches the DOM, and every probe is guarded (jsdom / older browsers /
 * privacy modes all degrade safely to the 2D path).
 *
 * Decision order (most conservative wins):
 *   reduced motion | save-data | no WebGL2 | very low-end  → auto 2D
 *   coarse pointer or ≤4 GB / ≤4 cores                    → mobile 3D
 *   otherwise                                             → desktop 3D
 * A persisted manual mode always beats the automatic decision.
 */
import type { Mode } from '../state/store';

export type DeviceTier = 'desktop' | 'mobile' | 'low';
export type PointerType = 'fine' | 'coarse' | 'none';

export interface DeviceCapabilities {
  webgl2: boolean;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  saveData: boolean;
  pointerType: PointerType;
  reducedMotion: boolean;
}

export type ModeReason =
  | 'manual'
  | 'reduced-motion'
  | 'save-data'
  | 'no-webgl2'
  | 'low-tier'
  | 'capable';

export interface ModeDecision {
  mode: Mode;
  tier: DeviceTier;
  source: 'manual' | 'auto';
  reason: ModeReason;
}

export const MODE_STORAGE_KEY = 'portfolio:mode';

/** Classify hardware into a render tier. Pure — no DOM access. */
export function classifyTier(caps: DeviceCapabilities): DeviceTier {
  if (!caps.webgl2 || caps.saveData) return 'low';
  const memory = caps.deviceMemory;
  const cores = caps.hardwareConcurrency;
  if ((memory !== null && memory <= 2) || (cores !== null && cores <= 2)) {
    return 'low';
  }
  // Unknown pointer (TV/kiosk/assistive setup) takes the conservative tier.
  if (caps.pointerType !== 'fine') return 'mobile';
  if ((memory !== null && memory <= 4) || (cores !== null && cores <= 4)) {
    return 'mobile';
  }
  return 'desktop';
}

/** Automatic mode recommendation, ignoring any persisted override. */
export function recommendMode(caps: DeviceCapabilities): Mode {
  if (caps.reducedMotion) return '2d';
  if (caps.saveData) return '2d';
  if (!caps.webgl2) return '2d';
  if (classifyTier(caps) === 'low') return '2d';
  return '3d';
}

/** Read the persisted manual override. Returns null when none/invalid. */
export function readManualMode(): Mode | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    return raw === '2d' || raw === '3d' ? raw : null;
  } catch {
    // Storage can be blocked (Safari private mode, embedding); treat as auto.
    return null;
  }
}

/** Persist a manual override so it survives reloads and beats detection. */
export function writeManualMode(mode: Mode): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Non-fatal: the session still honours the toggle via the store.
  }
}

export function clearManualMode(): void {
  try {
    localStorage.removeItem(MODE_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}

/** Combine hardware classification + manual override into one decision. */
export function resolveMode(caps: DeviceCapabilities): ModeDecision {
  const tier = classifyTier(caps);
  const manual = readManualMode();
  if (manual) {
    return { mode: manual, tier, source: 'manual', reason: 'manual' };
  }
  const reason: ModeReason = caps.reducedMotion
    ? 'reduced-motion'
    : caps.saveData
      ? 'save-data'
      : !caps.webgl2
        ? 'no-webgl2'
        : tier === 'low'
          ? 'low-tier'
          : 'capable';
  return { mode: recommendMode(caps), tier, source: 'auto', reason };
}

function matches(query: string): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches
    );
  } catch {
    return false;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Probe the current browser. Every probe is guarded; failures → 2D tier. */
export function detectCapabilities(): DeviceCapabilities {
  let webgl2 = false;
  try {
    if (typeof document !== 'undefined') {
      webgl2 = Boolean(document.createElement('canvas').getContext('webgl2'));
    }
  } catch {
    webgl2 = false;
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  const pointerType: PointerType = matches('(pointer: coarse)')
    ? 'coarse'
    : matches('(pointer: fine)')
      ? 'fine'
      : 'none';

  return {
    webgl2,
    deviceMemory: numberOrNull(nav.deviceMemory),
    hardwareConcurrency: numberOrNull(nav.hardwareConcurrency),
    saveData: nav.connection?.saveData === true,
    pointerType,
    reducedMotion: matches('(prefers-reduced-motion: reduce)'),
  };
}
