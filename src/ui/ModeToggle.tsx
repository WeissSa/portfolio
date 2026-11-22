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
import { clearManualMode, writeManualMode } from '../lib/device-tier';
import { usePortfolioStore, type Mode } from '../state/store';

export function ModeToggle() {
  const mode = usePortfolioStore((state) => state.mode);
  const setMode = usePortfolioStore((state) => state.setMode);
  const autoMode = usePortfolioStore((state) => state.autoMode);
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
    clearManualMode();
    setMode(autoMode);
  }, [autoMode, setMode]);

  return (
    <>
      <div role="group" aria-label="Rendering mode" className="flex gap-2">
        <button
          type="button"
          aria-label="3D room mode"
          aria-pressed={mode === '3d'}
          aria-describedby={canUse3d ? undefined : 'mode-3d-unavailable'}
          disabled={!canUse3d}
          title={
            canUse3d
              ? undefined
              : '3D is unavailable on this device (WebGL2, data-saver or motion restriction)'
          }
          onClick={toggle3d}
          className="p5-btn p5-btn--red px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true">{mode === '3d' ? '3D ON' : '3D'}</span>
        </button>
        <button
          type="button"
          aria-label="Automatic mode"
          onClick={useAuto}
          className="p5-btn p5-btn--red px-3"
        >
          <span aria-hidden="true">Auto</span>
        </button>
      </div>
      {!canUse3d && (
        <span id="mode-3d-unavailable" className="sr-only">
          3D mode is unavailable on this device: WebGL2 is missing or a
          data-saver / reduced-motion / low-power restriction applies.
        </span>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {mode === '3d' ? '3D room mode enabled' : '2D mode enabled'}
      </span>
    </>
  );
}
