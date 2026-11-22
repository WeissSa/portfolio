/**
 * Climate projector info dialog (REWORK_PLAN §3.2.4 / §3.7, commit 9).
 *
 * Clicking the 3D screen sets `climatePanelOpen`; this renders the SAME
 * `<ClimateView>` used by the 2D `#/climate` route — statement, today
 * hot/cold widget, heatmap with year selector, legend, Open-Meteo attribution
 * and the Climate Defense Fund link — as ordinary, keyboard-operable DOM on
 * top of the canvas. Esc, the backdrop and the close button all dismiss; focus
 * is trapped and restored like the other zone dialogs. The `idPrefix` keeps
 * the dialog's label/heading ids unique when the 2D view is also mounted.
 */
import { useEffect } from 'react';
import { CLIMATE_TITLE } from '../content/climate';
import { useFocusTrap } from '../lib/a11y';
import { usePortfolioStore } from '../state/store';
import { ClimateView } from './ClimateView';

export function ClimateProjectorPanel() {
  const open = usePortfolioStore((state) => state.climatePanelOpen);
  const closeClimatePanel = usePortfolioStore(
    (state) => state.closeClimatePanel,
  );
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      closeClimatePanel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeClimatePanel]);

  if (!open) return null;

  return (
    <div className="climate-projector-overlay fixed inset-0 z-30 flex items-center justify-center p-3">
      <div
        className="post-detail-backdrop absolute inset-0 bg-p5-black/70"
        aria-hidden="true"
        onClick={closeClimatePanel}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="projector-panel-climate-heading"
        tabIndex={-1}
        className="p5-panel p5-panel--slashed relative max-h-[90vh] w-[min(96%,64rem)] overflow-y-auto p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="p5-display text-lg text-p5-red">
            {CLIMATE_TITLE} — Projector Feed
          </p>
          <button
            type="button"
            onClick={closeClimatePanel}
            aria-label="Close climate panel"
            className="p5-btn p5-btn--red px-3 text-sm"
          >
            ✕
          </button>
        </div>
        <ClimateView idPrefix="projector-panel" />
        <p role="status" aria-live="polite" className="sr-only">
          Climate projector panel opened
        </p>
      </div>
    </div>
  );
}
