/**
 * Reduced-motion visitor's opt-in to a still-cut 3D view. Kept in its own file
 * so ModeToggle stays presentational (one component per file).
 */
import { Button } from '@mantine/core';
import { UI_COPY } from '../content/ui-copy';
import { clearManualMode, writeManualMode } from '../lib/device-tier';
import { usePortfolioStore } from '../state/store';

export function ReducedMotionOptIn() {
  const available = usePortfolioStore((s) => s.reducedMotionOptInAvailable);
  const optedIn = usePortfolioStore((s) => s.reducedMotionOptIn);
  const setOptIn = usePortfolioStore((s) => s.setReducedMotionOptIn);
  const setMode = usePortfolioStore((s) => s.setMode);
  if (!available) return null;
  return (
    <Button
      type="button"
      aria-label={UI_COPY.viewReduced}
      aria-pressed={optedIn}
      onClick={() => {
        const next = !optedIn;
        setOptIn(next);
        if (!next) {
          clearManualMode();
          setMode('2d');
        } else {
          writeManualMode('3d');
          setMode('3d');
        }
      }}
      radius={0}
      className="p5-btn p5-btn--red px-3"
    >
      <span aria-hidden="true">Reduced motion</span>
    </Button>
  );
}
