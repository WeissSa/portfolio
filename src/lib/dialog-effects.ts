/**
 * The one modal frame shared by every detail surface. It owns the side effects
 * that used to be repeated in four overlay wrappers:
 *
 *  - the `.app-shell` is inert + aria-hidden while a detail is open, and
 *    restored when the LAST one closes;
 *  - the document cannot scroll behind the dialog (the panel body is the sole
 *    scroll container — this is the round-5 "wheel does nothing until Tab"
 *    fix: focus also starts inside the scroll body);
 *  - 3D hover ids / the R3F pointer cursor are cleared on open and close;
 *  - Escape dismisses the detail unless a nested UI (About's window stack)
 *    consumes it;
 *  - focus is trapped and restored by `useFocusTrap`.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { usePortfolioStore } from '../state/store';
import { useFocusTrap } from './a11y';

// Dialogs can overlap (an About window opened from the desktop), so the shell
// and body lock are only released when the LAST one closes. Module-scoped
// because every frame talks about the same .app-shell and document body.
let inertDepth = 0;
let priorInert: string | null = null;
let priorAriaHidden: string | null = null;
let scrollLockDepth = 0;
let priorBodyOverflow = '';

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

/** Lock document scroll while `active`; the dialog body becomes the scroller. */
function setBodyScrollLocked(locked: boolean): void {
  if (typeof document === 'undefined') return;
  if (locked) {
    if (scrollLockDepth === 0) {
      priorBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockDepth += 1;
  } else {
    scrollLockDepth = Math.max(0, scrollLockDepth - 1);
    if (scrollLockDepth === 0) {
      document.body.style.overflow = priorBodyOverflow;
    }
  }
}

/** Clear 3D hover highlights + cursor when a detail covers/uncovers the scene. */
function useClearSceneHover(active: boolean): void {
  const clearSceneHover = usePortfolioStore((state) => state.clearSceneHover);
  useEffect(() => {
    if (!active) return;
    clearSceneHover();
    return () => clearSceneHover();
  }, [active, clearSceneHover]);
}

export interface ModalFrameOptions {
  active: boolean;
  onClose: () => void;
  /** Return true to let a nested UI consume the Escape key. */
  blockEscape?: () => boolean;
  /** Element focused on open — the scrollable detail body, not the close button. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Let the caller own focus restore (e.g. prefer the in-world pick proxy). */
  restoreFocus?: boolean;
}

/**
 * Install every modal side effect and return the ref to put on the dialog
 * container. `active` is always true for the single mounted DetailOverlay.
 */
export function useModalFrame<T extends HTMLElement>({
  active,
  onClose,
  blockEscape,
  initialFocus,
  restoreFocus = false,
}: ModalFrameOptions): RefObject<T | null> {
  const frameRef = useFocusTrap<T>(active, restoreFocus, initialFocus);

  useEffect(() => {
    if (!active) return;
    setShellInert(true);
    setBodyScrollLocked(true);
    return () => {
      setShellInert(false);
      setBodyScrollLocked(false);
    };
  }, [active]);

  useClearSceneHover(active);

  // Refs keep the Escape handler stable: a re-render of the detail body must
  // never tear down and reinstall the listener mid-interaction.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const blockEscapeRef = useRef(blockEscape);
  blockEscapeRef.current = blockEscape;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (blockEscapeRef.current?.()) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);

  return frameRef;
}
