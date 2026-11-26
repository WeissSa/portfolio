import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

/** Visually hidden but available to screen readers. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/** Live `prefers-reduced-motion` query. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener('change', onChange);
    setReduced(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Focus restore for Mantine-managed dialogs. Mantine's Modal traps Tab and
 * moves focus INTO the dialog on open, but it never restores focus on close —
 * dialogs are unmounted by store state, and the store flip must give focus
 * back to whatever opened the dialog. Declared AFTER `useInertBackground` in
 * the overlay components so the cleanup order is un-inert FIRST, restore
 * SECOND (restoring into a still-inert shell would silently drop focus).
 */
export function useFocusRestore(active: boolean): void {
  const saved = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    saved.current = document.activeElement as HTMLElement | null;
    return () => {
      const node = saved.current;
      saved.current = null;
      if (node && node.isConnected && typeof node.focus === 'function') {
        node.focus({ preventScroll: true });
      }
    };
  }, [active]);
}

/**
 * Focus trap for overlay windows (REWORK_PLAN §3.7): focuses the container
 * when activated, cycles Tab within it, and restores focus to the previously
 * focused element on deactivate.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  restoreFocus = true,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  // Keep the latest value in a ref: putting `restoreFocus` in the effect deps
  // tears down/re-runs the trap when the caller flips `isOnlyWindow`, and the
  // teardown would steal focus back to a desktop icon mid-interaction.
  const restoreFocusRef = useRef(restoreFocus);
  restoreFocusRef.current = restoreFocus;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusables[0] ?? node).focus();
    };
    // Effects run after the commit, so the node (and its focusable children)
    // is already attached. Focusing synchronously avoids a one-frame race in
    // which a late rAF steals focus from the trigger a caller just focused
    // (observed on the heavier climate panel).
    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      // Nested traps (e.g. a window dialog inside the desktop zoom) handle the
      // Tab first; an outer trap must not fight it and yank focus outward.
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const activeEl = document.activeElement;
      if (
        event.shiftKey &&
        (activeEl === first || activeEl === node || !node.contains(activeEl))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    if (
      typeof node.focus === 'function' &&
      document.activeElement === document.body
    ) {
      node.focus({ preventScroll: true });
    }

    return () => {
      node.removeEventListener('keydown', onKeyDown);
      // When another dialog stays open the caller moves focus to that dialog
      // instead; restoring here would pull focus back to a desktop icon.
      if (
        restoreFocusRef.current &&
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function'
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return ref;
}
