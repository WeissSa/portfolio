/**
 * Climate projector detail panel (REWORK_PLAN §3.2.4/§3.7, UX fix pass).
 *
 * Clicking the 3D screen (or the DOM trigger button) sets `climatePanelOpen`;
 * this renders the SAME accessible `<ClimateView>` used by the 2D `#/climate`
 * route through the shared, visible, scrollable `DetailMirror` dialog — the
 * statement, today's hot/cold widget, year heatmap, legend, attribution and the
 * Climate Defense Fund link all stay reachable as ordinary DOM. One code path
 * for every mode and pointer type.
 */
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
import { ClimateView } from './ClimateView';
import { DetailMirror } from './DetailMirror';

export function ClimateProjectorPanel() {
  const open = usePortfolioStore((state) => state.climatePanelOpen);
  const closeClimatePanel = usePortfolioStore(
    (state) => state.closeClimatePanel,
  );
  useInertBackground(open);
  useClearSceneHover(open);

  if (!open) return null;

  return (
    <DetailMirror
      label="Climate details"
      title="Climate details"
      surface="projector"
      onClose={closeClimatePanel}
      blockEscape={() => {
        const state = usePortfolioStore.getState();
        return Boolean(
          state.selectedPostId || state.selectedProjectId || state.desktopOpen,
        );
      }}
      closeLabel="Close climate details"
      closeText="Close"
    >
      <ClimateView idPrefix="projector-panel" regionLabel="Climate details" />
      <p role="status" aria-live="polite" className="sr-only">
        Climate projector panel opened
      </p>
    </DetailMirror>
  );
}
