/**
 * Lazy 3D streaming layer (REWORK_PLAN §4.5 step 3, commit 5).
 *
 * React.lazy keeps three/R3F entirely out of the shell entry: the 2D shell,
 * menu and every content panel are mounted and usable before this import is
 * even requested. The Canvas renders behind the DOM shell (pointer-events:
 * none — zones are visual placeholders until commits 6–9) and fades in once
 * the lazy chunk has mounted.
 */
import { lazy, Suspense, useCallback, useState } from 'react';
import type { RoomQuality } from '../scene/Room';

const Room = lazy(() => import('../scene/Room'));

function LoadingCutIn() {
  return (
    <div className="p5-panel p5-panel--red scene-loading">
      <p className="p5-display text-lg text-p5-black">Loading the room…</p>
    </div>
  );
}

export function SceneLayer({ quality }: { quality: RoomQuality }) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <>
      {/* Screen readers hear the load state; the visual indicator is inside
          the aria-hidden layer below. */}
      <p role="status" aria-live="polite" className="sr-only">
        {ready ? '3D room ready' : 'Loading the 3D room'}
      </p>
      <div
        className={`scene-layer${ready ? ' scene-layer--ready' : ''}`}
        aria-hidden="true"
      >
        <Suspense fallback={<LoadingCutIn />}>
          <Room quality={quality} className="scene-canvas" onReady={onReady} />
        </Suspense>
      </div>
    </>
  );
}
