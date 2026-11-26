/**
 * About-desktop detail panel, opened by the 3D desk monitor (commit 7, UX fix
 * pass 2026-11-25). It renders the SAME AboutDesktop component used by the 2D
 * `#/about` route inside the shared, visible, scrollable `DetailMirror` dialog;
 * the 3D camera independently flies to the monitor close-up while it is open.
 *
 * Escape model: AboutDesktop's own window stack closes the top window first.
 * `blockEscape` lets that stack consume the first Escape(s); only when no
 * windows remain does DetailMirror's Escape close the panel and return to the
 * room. Focus is trapped inside the panel and restored on close.
 */
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
import { AboutDesktop } from './AboutDesktop';
import { DetailMirror } from './DetailMirror';

export function DesktopZoom() {
  const closeDesktop = usePortfolioStore((state) => state.closeDesktop);
  useInertBackground(true);
  useClearSceneHover(true);

  return (
    <DetailMirror
      label="About desktop — full screen"
      title="About desktop"
      surface="monitor"
      onClose={closeDesktop}
      closeLabel="Close desktop and return to the room"
      closeText="Back to room"
      blockEscape={() => usePortfolioStore.getState().openWindows.length > 0}
    >
      <AboutDesktop />
      <p role="status" aria-live="polite" className="sr-only">
        About desktop opened. Press Escape to return to the 3D room.
      </p>
    </DetailMirror>
  );
}
