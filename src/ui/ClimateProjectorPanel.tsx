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
 * The background shell is inert while open and 3D hover/cursor state is cleared
 * (shared dialog effects), and Escape defers to any sibling 3D modal.
 */
import { useEffect } from 'react';
import { Modal } from '@mantine/core';
import { CLIMATE_TITLE } from '../content/climate';
import { useFocusRestore } from '../lib/a11y';
import { useDiegeticDetail } from '../lib/detail-mode';
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
import { ClimateView } from './ClimateView';
import { DetailMirror } from './DetailMirror';

export function ClimateProjectorPanel() {
  const open = usePortfolioStore((state) => state.climatePanelOpen);
  const closeClimatePanel = usePortfolioStore(
    (state) => state.closeClimatePanel,
  );
  const diegetic = useDiegeticDetail();
  useInertBackground(open && !diegetic);
  useClearSceneHover(open);
  useFocusRestore(open && !diegetic);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // A sibling 3D dialog (book/case detail or desktop zoom) handles Escape
      // first; do not double-close both overlays with one keypress.
      const state = usePortfolioStore.getState();
      if (
        state.selectedPostId ||
        state.selectedProjectId ||
        state.desktopOpen
      ) {
        return;
      }
      event.preventDefault();
      closeClimatePanel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeClimatePanel]);

  if (!open) return null;

  // The projected panel already lives in-world; INFO paints a fuller text plane
  // beside it in fine-pointer live 3D. This mirror keeps the full ClimateView
  // accessible; fallbacks show it in the ordinary visible dialog below.
  if (diegetic) {
    return (
      <DetailMirror
        label={`${CLIMATE_TITLE} — Projector Feed`}
        surface="projector"
        onClose={closeClimatePanel}
      >
        <ClimateView
          idPrefix="projector-panel"
          regionLabel={`${CLIMATE_TITLE} — Projector Feed`}
        />
        <p role="status" aria-live="polite" className="sr-only">
          Climate projector panel opened
        </p>
      </DetailMirror>
    );
  }

  return (
    <Modal
      opened
      onClose={closeClimatePanel}
      // The document-level handler above owns Escape (sibling-modal deferral);
      // Mantine must not close on its own.
      closeOnEscape={false}
      centered
      size="min(96%, 64rem)"
      // Mantine renders the title inside its OWN <h2> (aria-labelledby target);
      // passing a <p> here nests block content in an h2 (invalid + React warning).
      // The p5 display styling rides on the title via the Styles API instead.
      title={`${CLIMATE_TITLE} — Projector Feed`}
      closeButtonProps={{
        'aria-label': 'Close climate panel',
        className: 'p5-btn p5-btn--red px-3 text-sm',
      }}
      classNames={{
        root: 'climate-projector-overlay',
        overlay: 'post-detail-backdrop',
        content: 'p5-panel p5-panel--slashed',
        title: 'p5-display text-lg text-p5-red',
      }}
      styles={{ content: { maxHeight: '90vh', overflowY: 'auto' } }}
    >
      <ClimateView
        idPrefix="projector-panel"
        regionLabel={`${CLIMATE_TITLE} — Projector Feed`}
      />
      <p role="status" aria-live="polite" className="sr-only">
        Climate projector panel opened
      </p>
    </Modal>
  );
}
