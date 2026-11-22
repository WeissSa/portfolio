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
 * Focus trap for overlay windows (REWORK_PLAN §3.7): focuses the container
 * when activated, cycles Tab within it, and restores focus to the previously
 * focused element on deactivate.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  restoreFocus = true,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusables[0] ?? node).focus();
    };
    // Defer so the node is definitely attached and rendered.
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
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
      if (event.shiftKey && (activeEl === first || !node.contains(activeEl))) {
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
      cancelAnimationFrame(raf);
      node.removeEventListener('keydown', onKeyDown);
      // When another dialog stays open the caller moves focus to that dialog
      // instead; restoring here would pull focus back to a desktop icon.
      if (
        restoreFocus &&
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function'
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, restoreFocus]);

  return ref;
}
