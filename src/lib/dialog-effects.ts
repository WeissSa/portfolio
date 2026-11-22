/**
 * Side effects shared by the DOM dialogs layered over the 3D canvas (review
 * backlog items 3 and 4):
 *
 *  - while a modal is open, the authoritative 2D `.app-shell` is marked inert
 *    and aria-hidden so AT and pointer input cannot reach the background; the
 *    dialog's focus trap still owns keyboard focus;
 *  - a dialog covering the canvas clears 3D hover ids and the R3F pointer
 *    cursor, both on mount and on unmount, so no stale highlight leaks through.
 */
import { useEffect } from 'react';
import { usePortfolioStore } from '../state/store';

// Dialogs can overlap (e.g. a window opened from the desktop zoom), so the
// shell is only restored when the LAST one closes. Depth is module-scoped
// because every dialog talks about the same single .app-shell in App.
let inertDepth = 0;
let priorInert: string | null = null;
let priorAriaHidden: string | null = null;

function setShellInert(inert: boolean): void {
  if (typeof document === 'undefined') return;
  const shell = document.querySelector<HTMLElement>('.app-shell');
  if (!shell) return;

  if (inert) {
    if (inertDepth === 0) {
      priorInert = shell.getAttribute('inert');
      priorAriaHidden = shell.getAttribute('aria-hidden');
    }
    inertDepth += 1;
    shell.setAttribute('inert', '');
    shell.setAttribute('aria-hidden', 'true');
  } else {
    inertDepth = Math.max(0, inertDepth - 1);
    if (inertDepth === 0) {
      if (priorInert === null) shell.removeAttribute('inert');
      else shell.setAttribute('inert', priorInert);
      if (priorAriaHidden === null) shell.removeAttribute('aria-hidden');
      else shell.setAttribute('aria-hidden', priorAriaHidden);
    }
  }
}

/** Make the background shell inert/aria-hidden while `active`, restore on close. */
export function useInertBackground(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    setShellInert(true);
    return () => setShellInert(false);
  }, [active]);
}

/** Clear 3D hover highlights + cursor when a dialog covers/uncovers the scene. */
export function useClearSceneHover(active: boolean): void {
  const clearSceneHover = usePortfolioStore((state) => state.clearSceneHover);
  useEffect(() => {
    if (!active) return;
    clearSceneHover();
    return () => clearSceneHover();
  }, [active, clearSceneHover]);
}
