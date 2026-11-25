/**
 * Full-screen 2D desktop-OS overlay opened by the 3D desk monitor
 * (REWORK_PLAN §3.2.2 / commit 7). It renders the SAME AboutDesktop component
 * used by the 2D `#/about` hash route — content always lives in real DOM,
 * never in the canvas. CameraRig independently flies to the monitor close-up
 * while `desktopOpen` is true and back to the zone viewpoint on close.
 *
 * Focus management: the zoom traps Tab and restores focus on close. Its Esc
 * handler defers to AboutDesktop's window-level Esc handling (`defaultPrevented
 * ` + an open-window check), so the first Esc closes the top window and a
 * later Esc returns to the room. A polite live region announces the transition.
 */
import { useEffect } from 'react';
import { Button } from '@mantine/core';
import { useFocusTrap } from '../lib/a11y';
import { useDiegeticDetail } from '../lib/detail-mode';
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
import { AboutDesktop } from './AboutDesktop';
import { DetailMirror } from './DetailMirror';

export function DesktopZoom() {
  const closeDesktop = usePortfolioStore((state) => state.closeDesktop);
  const diegetic = useDiegeticDetail();
  // The visible desktop keeps its focus trap + inert shell; the in-world CRT
  // mirror is non-modal (the room stays live) and DetailMirror owns focus.
  const trapRef = useFocusTrap<HTMLDivElement>(!diegetic, true);
  useInertBackground(!diegetic);
  useClearSceneHover(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // AboutDesktop closes the top window first (and preventDefaults). Only
      // close the zoom once no windows remain to dismiss.
      if (usePortfolioStore.getState().openWindows.length > 0) return;
      event.preventDefault();
      closeDesktop();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeDesktop]);

  // In-world CRT detail: the About content is painted onto the monitor texture
  // in fine-pointer live 3D (camera already sits at MONITOR_VIEWPOINT); this
  // hidden mirror keeps the SAME AboutDesktop reachable by keyboard/SR.
  if (diegetic) {
    return (
      <DetailMirror
        label="About desktop — full screen"
        surface="monitor"
        onClose={closeDesktop}
      >
        <AboutDesktop />
      </DetailMirror>
    );
  }

  return (
    <div
      ref={trapRef}
      className="desktop-zoom"
      role="dialog"
      aria-modal="true"
      aria-label="About desktop — full screen"
      tabIndex={-1}
    >
      <p role="status" aria-live="polite" className="sr-only">
        About desktop opened. Press Escape to return to the 3D room.
      </p>
      <Button
        type="button"
        onClick={closeDesktop}
        radius={0}
        aria-label="Close desktop and return to the room"
        className="p5-btn p5-btn--red desktop-zoom__close"
      >
        Back to room
      </Button>
      <AboutDesktop />
    </div>
  );
}
