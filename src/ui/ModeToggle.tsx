/**
 * Accessible 2D/3D mode toggle (REWORK_PLAN §3.7/§4.5, commit 5).
 *
 * A manual press persists an override in localStorage, which beats the
 * automatic device-tier decision on every subsequent load. The button is
 * keyboard-operable (native button), exposes its state via aria-pressed and
 * announces the result through a polite live region. The canvas itself is
 * aria-hidden, so no focus is ever trapped inside the 3D scene.
 */
import { useCallback } from 'react';
import { writeManualMode } from '../lib/device-tier';
import { usePortfolioStore, type Mode } from '../state/store';

export function ModeToggle() {
  const mode = usePortfolioStore((state) => state.mode);
  const setMode = usePortfolioStore((state) => state.setMode);

  const toggle = useCallback(() => {
    const next: Mode = mode === '3d' ? '2d' : '3d';
    writeManualMode(next);
    setMode(next);
  }, [mode, setMode]);

  return (
    <>
      <button
        type="button"
        aria-label="3D room mode"
        aria-pressed={mode === '3d'}
        onClick={toggle}
        className="p5-btn p5-btn--red px-3"
      >
        <span aria-hidden="true">{mode === '3d' ? '3D ON' : '3D'}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {mode === '3d' ? '3D room mode enabled' : '2D mode enabled'}
      </span>
    </>
  );
}
