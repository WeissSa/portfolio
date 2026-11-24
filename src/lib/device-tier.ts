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
 *   everything else (desktop OR mobile tier)               → auto 3D (default)
 * A persisted manual mode beats the automatic decision ONLY when no capability
 * gate trips. Gates (no WebGL2 / save-data / reduced-motion / low tier) are
 * authoritative: a stale "3d" override can never force a crashing Canvas. A
 * persisted scene failure is equally authoritative (crash recovery).
 *
 * Pointer type is NOT a gate: a capable touch phone defaults into the lighter
 * mobile 3D tier (DPR cap, no post pass, portrait viewpoints). The store still
 * starts in 2D so the shell can paint from the static mirror first, and App
 * upgrades in a post-paint effect (§4.5) — 2D-first streaming is unchanged.
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
  | 'scene-failed'
  | 'capable';

export interface ModeDecision {
  mode: Mode;
  tier: DeviceTier;
  source: 'manual' | 'auto';
  reason: ModeReason;
}

export const MODE_STORAGE_KEY = 'portfolio:mode';
/**
 * Persisted crash signal. Written by the scene error boundary's onError path;
 * once set, 3D is never auto-selected again (even after "Auto" or a reload) so
 * a device that passes the capability gates but cannot create a Canvas cannot
 * be trapped in a crash loop. Deliberately sticky: only `clearSceneFailure()`
 * removes it, so neither "Auto" nor a page reload can re-arm the crash.
 */
export const SCENE_FAILURE_STORAGE_KEY = 'portfolio:3d-failed';
/**
 * Canonical sentinel value (art-overhaul commit 0, QA defect D1): the sticky
 * crash flag is stored and read as EXACTLY this string. A historical QA pass
 * probed `'1'`, which never tripped the gate because `readSceneFailure()`
 * compares against `'true'`. `'true'` is canonical (matches every shipped
 * write path); tests pin both the stored string and the write→resolve path.
 */
export const SCENE_FAILURE_VALUE = 'true';

/**
 * Commit 4: an INFORMED opt-in for reduced-motion visitors who still want the
 * 3D room. It is deliberately separate from the normal manual mode: the
 * automatic decision remains 2D (the reduced-motion gate is authoritative),
 * and the opt-in is only offered when reduced motion is the ONLY blocker.
 * The session then uses static cuts, a zone-title HUD and a frozen grain clock.
 */
export const REDUCED_MOTION_OPTIN_KEY = 'portfolio:reduced-motion-3d';
export function readReducedMotionOptIn(): boolean {
  try {
    return localStorage.getItem(REDUCED_MOTION_OPTIN_KEY) === 'true';
  } catch {
    return false;
  }
}
export function writeReducedMotionOptIn(value: boolean): void {
  try {
    if (value) localStorage.setItem(REDUCED_MOTION_OPTIN_KEY, 'true');
    else localStorage.removeItem(REDUCED_MOTION_OPTIN_KEY);
  } catch {
    // Storage may be blocked; the in-memory store still honours the toggle.
  }
}
export function canOptIntoReducedMotion3d(
  caps: DeviceCapabilities,
  tier: DeviceTier = classifyTier(caps),
): boolean {
  if (!caps.reducedMotion) return false;
  // Every OTHER gate must pass; scene crashes stay authoritative.
  return (
    capabilityGate({ ...caps, reducedMotion: false }, tier) === null &&
    !readSceneFailure()
  );
}

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

/**
 * Automatic mode recommendation, ignoring any persisted manual override.
 * Delegates to the SAME capabilityGate as resolveMode so the UI toggle and the
 * authoritative decision can never disagree about what this device supports.
 */
export function recommendMode(caps: DeviceCapabilities): Mode {
  return capabilityGate(caps) || readSceneFailure() ? '2d' : '3d';
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

/** True once the optional 3D scene has crashed on this device. */
export function readSceneFailure(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return (
      localStorage.getItem(SCENE_FAILURE_STORAGE_KEY) === SCENE_FAILURE_VALUE
    );
  } catch {
    return false;
  }
}

/** Persist a 3D crash so Auto/reload keep the authoritative 2D shell. */
export function writeSceneFailure(): void {
  try {
    localStorage.setItem(SCENE_FAILURE_STORAGE_KEY, SCENE_FAILURE_VALUE);
  } catch {
    // Non-fatal: the in-memory autoMode is still forced to 2D for this session.
  }
}

/** Test/recovery escape hatch — not used by the normal UI (sticky by design). */
export function clearSceneFailure(): void {
  try {
    localStorage.removeItem(SCENE_FAILURE_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}

/**
 * The first capability gate that forces 2D, or null when 3D is safe.
 * SINGLE SOURCE used by `resolveMode` (authoritative decision), `recommendMode`
 * (the toggle's "can 3D be offered?" flag) and the UI's disabled explanation.
 */
export function capabilityGate(
  caps: DeviceCapabilities,
  tier: DeviceTier = classifyTier(caps),
): Exclude<ModeReason, 'manual' | 'capable' | 'scene-failed'> | null {
  if (caps.reducedMotion) return 'reduced-motion';
  if (caps.saveData) return 'save-data';
  // three r187 has no WebGL1 fallback: no WebGL2 ⇒ the R3F Canvas throws on
  // mount and (without a boundary) unmounts the whole 2D shell. Hard gate.
  if (!caps.webgl2) return 'no-webgl2';
  if (tier === 'low') return 'low-tier';
  // Pointer type intentionally omitted: capable mobile/touch devices get the
  // lighter mobile 3D tier, not an automatic 2D downgrade (owner decision).
  return null;
}

/**
 * Combine hardware classification + manual override into one decision.
 *
 * SAFETY: capability gates and a persisted scene failure win unconditionally.
 * A stored "3d" override is honoured only on a device that can actually render
 * it; otherwise the gate's reason is reported and the mode is forced to 2D
 * (with the override left in storage for the user to clear via "Auto"). With no
 * override, any device that passes every gate defaults to 3D (desktop and
 * capable mobile alike).
 */
export function resolveMode(caps: DeviceCapabilities): ModeDecision {
  const tier = classifyTier(caps);
  const gate = capabilityGate(caps, tier);
  if (gate) {
    return { mode: '2d', tier, source: 'auto', reason: gate };
  }
  // Crash recovery is as authoritative as a hardware gate: a device that
  // passed detection but failed to create a Canvas must not retry on reload.
  if (readSceneFailure()) {
    return { mode: '2d', tier, source: 'auto', reason: 'scene-failed' };
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
