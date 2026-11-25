/**
 * Diegetic-detail gate (plan polish(c), owner decision 2026-11-24).
 *
 * In-world detail content (open book / lifted case / painted CRT / projected
 * info plane) is rendered for FINE-POINTER LIVE 3D ONLY. In every non-picking
 * state — 2D, reduced motion, coarse-pointer 3D, a scene that never drew a
 * frame or failed — the ordinary visible DOM detail view is authoritative.
 * This module is dependency-light (store + the reduced-motion hook) so the
 * both the shell and the lazy scene chunk can share ONE definition and never
 * disagree about which surface owns the detail.
 */
import { usePortfolioStore } from '../state/store';
import { usePrefersReducedMotion } from './a11y';

export interface DetailModeInput {
  mode: '2d' | '3d';
  sceneReady: boolean;
  pointerFine: boolean;
  prefersReducedMotion: boolean;
}

/** Pure variant: unit-testable without React or a WebGL context. */
export function isDiegeticDetail({
  mode,
  sceneReady,
  pointerFine,
  prefersReducedMotion,
}: DetailModeInput): boolean {
  return mode === '3d' && sceneReady && pointerFine && !prefersReducedMotion;
}

export function useDiegeticDetail(): boolean {
  const mode = usePortfolioStore((state) => state.mode);
  const sceneReady = usePortfolioStore((state) => state.sceneReady);
  const pointerFine = usePortfolioStore((state) => state.pointerFine);
  const prefersReducedMotion = usePrefersReducedMotion();
  return isDiegeticDetail({
    mode,
    sceneReady,
    pointerFine,
    prefersReducedMotion,
  });
}

/**
 * The DOM proxy of a picked 3D object. The canvas is aria-hidden and not
 * focusable, so picking focuses this sr-only control instead; F2 restores
 * focus here on close (a real browser assertion, jsdom cannot test inert).
 * No-op in fallback modes where the element is not rendered.
 */
export function focusDetailTrigger(): void {
  if (typeof document === 'undefined') return;
  const trigger = document.getElementById('detail-return');
  if (trigger && typeof trigger.focus === 'function') {
    trigger.focus({ preventScroll: true });
  }
}
