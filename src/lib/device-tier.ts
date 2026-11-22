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
 * A persisted manual mode beats the automatic decision ONLY when no capability
 * gate trips. Gates (no WebGL2 / save-data / reduced-motion / low tier) are
 * authoritative: a stale "3d" override can never force a crashing Canvas.
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

/**
 * The first capability gate that forces 2D, or null when 3D is safe.
 * Shared by `resolveMode` (authoritative gate) and the UI (disable 3D).
 */
export function capabilityGate(
  caps: DeviceCapabilities,
  tier: DeviceTier = classifyTier(caps),
): Exclude<ModeReason, 'manual' | 'capable'> | null {
  if (caps.reducedMotion) return 'reduced-motion';
  if (caps.saveData) return 'save-data';
  // three r187 has no WebGL1 fallback: no WebGL2 ⇒ the R3F Canvas throws on
  // mount and (without a boundary) unmounts the whole 2D shell. Hard gate.
  if (!caps.webgl2) return 'no-webgl2';
  if (tier === 'low') return 'low-tier';
  return null;
}

/**
 * Combine hardware classification + manual override into one decision.
 *
 * SAFETY: capability gates win unconditionally. A stored "3d" override is
 * honoured only on a device that can actually render it; otherwise the gate's
 * reason is reported and the mode is forced to 2D (with the override left in
 * storage for the user to clear via the toggle's "Auto" option).
 */
export function resolveMode(caps: DeviceCapabilities): ModeDecision {
  const tier = classifyTier(caps);
  const gate = capabilityGate(caps, tier);
  if (gate) {
    return { mode: '2d', tier, source: 'auto', reason: gate };
  }
  const manual = readManualMode();
  if (manual) {
    return { mode: manual, tier, source: 'manual', reason: 'manual' };
  }
  return { mode: '3d', tier, source: 'auto', reason: 'capable' };
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
      const probe = document.createElement('canvas');
      const context = probe.getContext('webgl2');
      webgl2 = Boolean(context);
      // Release the probe context immediately: browsers cap live WebGL contexts
      // per page (~8-16). Keeping this one alive can make the real R3F Canvas
      // fail later with "too many active WebGL contexts" on starved devices.
      context?.getExtension('WEBGL_lose_context')?.loseContext();
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
