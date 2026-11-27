/**
 * Lazy 3D streaming layer implementation (REWORK_PLAN §4.5 step 3).
 * React.lazy keeps three/R3F out of the shell entry; the authoritative 2D DOM
 * menu and zones paint before this import is even requested.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { UI_COPY } from '../content/ui-copy';
import { usePortfolioStore } from '../state/store';
import type { RoomQuality } from '../scene/Room';
import { SceneLoadingCutIn } from './SceneLoadingCutIn';

const Room = lazy(() => import('../scene/Room'));

export function SceneLayerImpl({
  quality,
  active = true,
}: {
  quality: RoomQuality;
  /** False while 2D is showing: keep the Canvas warm but render zero frames. */
  active?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const setSceneReady = usePortfolioStore((state) => state.setSceneReady);
  const onReady = useCallback((live: boolean) => setReady(live), []);
  // The DOM shell must not adopt the 3D layout until the Canvas has drawn a
  // frame — and must fall back to full-width 2D the instant it stops.
  useEffect(() => {
    setSceneReady(ready && active);
    return () => setSceneReady(false);
  }, [ready, active, setSceneReady]);
  // Book picking needs real pointer input. The wrapper stays aria-hidden.
  const pointerFine = usePortfolioStore((state) => state.pointerFine);
  const interactive = ready && pointerFine;
  // Mobile grade parity: the GLSL pass is desktop-only, so a CSS radial
  // gradient approximates the grade on mobile/low tiers.
  const needsCssGrade = quality !== 'desktop';

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {ready ? UI_COPY.roomReady : UI_COPY.loading}
      </p>
      <Suspense fallback={<SceneLoadingCutIn />}>
        <div
          className={`scene-layer${ready ? ' scene-layer--ready' : ''}${
            interactive ? ' scene-layer--interactive' : ''
          }${active ? '' : ' scene-layer--inactive'}`}
          aria-hidden="true"
        >
          <Room
            quality={quality}
            className="scene-canvas"
            onReady={onReady}
            active={active}
          />
        </div>
      </Suspense>
      {needsCssGrade && (
        <div
          data-testid="scene-grade-overlay"
          className={`scene-grade-overlay${
            ready && active ? ' scene-grade-overlay--ready' : ''
          }`}
          aria-hidden="true"
        />
      )}
    </>
  );
}
