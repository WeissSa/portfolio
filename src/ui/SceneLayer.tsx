/**
 * Lazy 3D streaming layer (REWORK_PLAN §4.5 step 3, commit 5).
 *
 * React.lazy keeps three/R3F entirely out of the shell entry: the 2D shell,
 * menu and every content panel are mounted and usable before this import is
 * even requested. The Canvas renders behind the DOM shell and fades in once
 * the lazy chunk has mounted. The loading cut-in is a SIBLING of the faded
 * `.scene-layer` wrapper (not a child), so it stays visible at opacity 1 while
 * the chunk downloads instead of being hidden by the wrapper's opacity:0.
 */
import { lazy, Suspense, useCallback, useState } from 'react';
import { Paper } from '@mantine/core';
import { usePortfolioStore } from '../state/store';
import type { RoomQuality } from '../scene/Room';

const Room = lazy(() => import('../scene/Room'));

function LoadingCutIn() {
  return (
    <div className="scene-loading-portal" aria-hidden="true">
      <Paper radius={0} className="p5-panel p5-panel--red scene-loading">
        <p className="p5-display text-lg text-p5-black">Loading the room…</p>
      </Paper>
    </div>
  );
}

export function SceneLayer({ quality }: { quality: RoomQuality }) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // Book picking needs real pointer input. The wrapper stays aria-hidden and
  // the canvas is never focusable; keyboard/SR users use the DOM list + overlay.
  const pointerFine = usePortfolioStore((state) => state.pointerFine);
  const interactive = ready && pointerFine;
  // Mobile grade parity (art-overhaul commit 3b): the GLSL painterly pass is
  // desktop-only, so mobile/low tiers used to show RAW ungraded primitives.
  // A zero-GPU CSS radial-gradient vignette + warm/purple hue overlay (p5.css
  // `.scene-grade-overlay`) approximates the desktop grade mood. It renders
  // AFTER the Suspense block so it stacks above the canvas at equal z-index,
  // stays pointer-transparent, aria-hidden, and fades in with the room.
  const needsCssGrade = quality !== 'desktop';

  return (
    <>
      {/* Screen readers hear the load state; the visual indicator is the
          Suspense fallback rendered OUTSIDE the opacity-faded layer below. */}
      <p role="status" aria-live="polite" className="sr-only">
        {ready ? '3D room ready' : 'Loading the 3D room'}
      </p>
      <Suspense fallback={<LoadingCutIn />}>
        <div
          className={`scene-layer${ready ? ' scene-layer--ready' : ''}${
            interactive ? ' scene-layer--interactive' : ''
          }`}
          aria-hidden="true"
        >
          <Room quality={quality} className="scene-canvas" onReady={onReady} />
        </div>
      </Suspense>
      {needsCssGrade && (
        <div
          data-testid="scene-grade-overlay"
          className={`scene-grade-overlay${
            ready ? ' scene-grade-overlay--ready' : ''
          }`}
          aria-hidden="true"
        />
      )}
    </>
  );
}
