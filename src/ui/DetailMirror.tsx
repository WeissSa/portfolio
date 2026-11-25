/**
 * A11y-only DOM mirror for diegetic in-world detail (plan polish(c)).
 *
 * In fine-pointer live 3D the detail content is painted onto 3D objects in the
 * room (book pages / case card / CRT / projected info). This component keeps
 * the SAME verbatim accessible DOM content in the a11y tree and tab order, but
 * visually hidden — pointer users never see a [role=dialog] over the canvas.
 * CSS (`.app-scene-live.app-fine-pointer .detail-mirror`) reveals it ONLY for
 * genuine keyboard focus (`:has(:focus-visible)`, never `:focus-within`, which
 * mouse clicks also trigger), together with a floating focus chip.
 *
 * F1: focus entering the mirror writes `detailMirrorFocused` so the scene can
 * light the corresponding in-world object (bidirectional DOM ↔ world sync).
 * F2: on close, focus is restored to the DOM proxy of the 3D trigger
 * (`#detail-return`), after the mirror has left the DOM (queueMicrotask).
 */
import { useEffect, type ReactNode } from 'react';
import { usePortfolioStore } from '../state/store';

export interface DetailMirrorProps {
  /** Accessible dialog name (the same title the visible dialog would carry). */
  label: string;
  /** Which in-world object lights up when focus enters the mirror. */
  surface: 'book' | 'case' | 'monitor' | 'projector';
  onClose: () => void;
  children: ReactNode;
}

export function DetailMirror({
  label,
  surface,
  onClose,
  children,
}: DetailMirrorProps) {
  const setFocused = usePortfolioStore((state) => state.setDetailMirrorFocused);

  useEffect(() => {
    const saved = document.activeElement as HTMLElement | null;
    return () => {
      setFocused(false);
      // Un-inert / unmount happens in this commit; restore focus on the next
      // microtask so the trigger is definitely back in the tab order.
      queueMicrotask(() => {
        const trigger = document.getElementById('detail-return');
        const target =
          saved &&
          saved.isConnected &&
          saved !== document.body &&
          trigger !== saved
            ? saved
            : (trigger ?? saved);
        if (target && typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      });
    };
  }, [setFocused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section
      className="detail-mirror p5-panel p5-panel--slashed"
      data-detail-surface={surface}
      role="dialog"
      aria-label={label}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <p className="detail-mirror__chip" aria-hidden="true">
        Keyboard detail view — {label}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close details for ${label}`}
        className="p5-btn p5-btn--red detail-mirror__close"
      >
        Back to the room
      </button>
      {children}
    </section>
  );
}
