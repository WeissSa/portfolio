/**
 * Accessible rendering-mode selector (REWORK_PLAN §3.7/§4.5, commit 5).
 *
 * Capability gates are authoritative: when 3D is unsafe (no WebGL2, save-data,
 * reduced motion, very low tier) the 3D option is disabled with an explanation
 * and no override can be written. "Auto" clears any persisted override so a
 * visitor can always recover from a stuck manual choice. Native buttons keep
 * the control keyboard-operable; a polite live region announces changes.
 */
import { useCallback } from 'react';
import { Button } from '@mantine/core';
import { UI_COPY } from '../content/ui-copy';
import { clearManualMode, writeManualMode } from '../lib/device-tier';
import { usePortfolioStore, type Mode } from '../state/store';
import { ReducedMotionOptIn } from './ReducedMotionOptIn';

export function ModeToggle() {
  const mode = usePortfolioStore((state) => state.mode);
  const setMode = usePortfolioStore((state) => state.setMode);
  const autoMode = usePortfolioStore((state) => state.autoMode);
  const setReducedMotionOptIn = usePortfolioStore(
    (state) => state.setReducedMotionOptIn,
  );
  // detectCapabilities() → recommendMode(): '2d' whenever any gate trips, so
  // this doubles as the "is 3D safe on this device?" flag.
  const canUse3d = autoMode === '3d';

  const toggle3d = useCallback(() => {
    if (!canUse3d) return;
    const next: Mode = mode === '3d' ? '2d' : '3d';
    writeManualMode(next);
    setMode(next);
  }, [canUse3d, mode, setMode]);

  const useAuto = useCallback(() => {
    // Auto is the authoritative recovery: clear BOTH overrides. The reduced-
    // motion static-3D opt-in writes a persisted manual mode AND its own key;
    // clearing only the former would silently re-arm 3D on the next reload and
    // leave Static 3D's aria-pressed stuck true (owner review 2026-11-24).
    setReducedMotionOptIn(false);
    clearManualMode();
    setMode(autoMode);
  }, [autoMode, setMode, setReducedMotionOptIn]);

  return (
    <>
      <div
        role="group"
        aria-label={UI_COPY.viewOptionsLabel}
        className="flex gap-2"
      >
        <ReducedMotionOptIn />
        <Button
          type="button"
          aria-label={UI_COPY.view3d}
          aria-pressed={mode === '3d'}
          aria-describedby={canUse3d ? undefined : 'mode-3d-unavailable'}
          disabled={!canUse3d}
          title={
            canUse3d
              ? undefined
              : '3D is unavailable on this device (WebGL2, data-saver or motion restriction)'
          }
          onClick={toggle3d}
          radius={0}
          className="p5-btn p5-btn--red px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true">3D</span>
        </Button>
        <Button
          type="button"
          aria-label={UI_COPY.viewAuto}
          onClick={useAuto}
          radius={0}
          className="p5-btn p5-btn--red px-3"
        >
          <span aria-hidden="true">Auto</span>
        </Button>
      </div>
      {!canUse3d && (
        <span id="mode-3d-unavailable" className="sr-only">
          The 3D view is not available on this device: WebGL2 is missing or a
          data-saver / reduced-motion / low-power restriction applies.
        </span>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {UI_COPY.modeEnabled(
          mode === '3d' ? UI_COPY.view3d : UI_COPY.viewStandard,
        )}
      </span>
    </>
  );
}
