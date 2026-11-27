/**
 * Visible loading card for the lazy 3D layer. It is a sibling of the faded
 * `.scene-layer` wrapper (not a child) so it stays at full opacity while the
 * WebGL chunk downloads. Own file → SceneLayer stays presentational.
 */
import { Paper } from '@mantine/core';
import { UI_COPY } from '../content/ui-copy';

export function SceneLoadingCutIn() {
  return (
    <div className="scene-loading-portal" aria-hidden="true">
      <Paper radius={0} className="p5-panel p5-panel--red scene-loading">
        <p className="p5-display text-lg text-p5-black">{UI_COPY.loading}</p>
      </Paper>
    </div>
  );
}
