/**
 * The ONE readable detail panel (owner decision 2026-11-25, UX fix pass).
 *
 * Every detail surface — 3D book/case/monitor/projector pick, 2D route, coarse
 * pointer and reduced-motion fallback — renders this same component. It is a
 * visible, scrollable DOM panel styled as an in-world page/screen: a brass
 * bezel frames the real, verbatim DOM content (full prose, tag chips and repo
 * / demo links) while the 3D room remains visible around it. No truncated
 * painted text is ever the only copy of a detail.
 *
 * Accessibility: role=dialog + aria-modal, a trapped Tab cycle, a visible
 * close control, Escape to dismiss, a polite live announcement (supplied by
 * each caller inside `children`) and focus restored to the 3D trigger proxy
 * (`#detail-return`) or the DOM opener on close. Focus entering the panel also
 * lights the matching in-world object (`detailMirrorFocused`) so the 3D frame
 * and the DOM readout stay in sync.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../lib/a11y';
import { usePortfolioStore } from '../state/store';

export interface DetailMirrorProps {
  /** Accessible dialog name (the same title the visible dialog would carry). */
  label: string;
  /** Visible heading inside the framed panel. */
  title: string;
  /** Which in-world object lights up while the panel is open. */
  surface: 'book' | 'case' | 'monitor' | 'projector';
  onClose: () => void;
  /** Full accessible name of the close control. */
  closeLabel?: string;
  /** Visible text of the close control. */
  closeText?: string;
  /**
   * Escape guard for nested UI. The About desktop keeps its own window stack:
   * the first Escape closes the top window, and only later Escapes close this
   * panel. Every other surface leaves this unset.
   */
  blockEscape?: () => boolean;
  children: ReactNode;
}

export function DetailMirror({
  label,
  title,
  surface,
  onClose,
  closeLabel,
  closeText = 'Close',
  blockEscape,
  children,
}: DetailMirrorProps) {
  const setFocused = usePortfolioStore((state) => state.setDetailMirrorFocused);
  const bodyRef = useRef<HTMLDivElement>(null);
  // This effect MUST run before the focus trap below: it has to remember the
  // opener while focus is still outside the panel. The trap then moves focus
  // into the dialog synchronously on mount.
  useEffect(() => {
    const saved = document.activeElement as HTMLElement | null;
    return () => {
      setFocused(false);
      // Un-mount happens in this commit; restore focus on the next microtask
      // so the trigger is definitely back in the tab order.
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

  // Restore is owned by the effect above (it prefers the F2 canvas-trigger
  // proxy), so the generic trap must not race it with a second restore.
  const trapRef = useFocusTrap<HTMLElement>(true, false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (blockEscape?.()) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, blockEscape]);

  // The panel is the ONLY scroll container. Land focus on its scrollable body
  // immediately on open so a wheel/touch gesture (and PageDown/Space) targets
  // the right element without the visitor first having to Tab to a button.
  // This runs AFTER useFocusTrap's initial focus (declared above), so it wins
  // without fighting the trap's Tab cycle. The body is made focusable below.
  useEffect(() => {
    // Queue AFTER the opener-restore microtask above. React StrictMode's
    // simulated unmount/remount queues that restore during development, and it
    // would otherwise land focus on the sr-only trigger proxy (outside this
    // panel) — which makes wheel/touch scrolling the body a no-op.
    queueMicrotask(() => bodyRef.current?.focus({ preventScroll: true }));
  }, []);

  return (
    <>
      {/* Dim the room just enough to make the page readable; a click outside
          dismisses exactly like the old Mantine backdrop did. The room stays
          visible — this is a framed readout, not an opaque full-screen swap. */}
      <div
        className="detail-panel-scrim"
        aria-hidden="true"
        onClick={onClose}
      />
      <section
        ref={trapRef}
        tabIndex={-1}
        className="detail-mirror p5-panel p5-panel--slashed post-detail-card"
        data-detail-surface={surface}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setFocused(false);
          }
        }}
      >
        <div className="detail-mirror__header">
          <div className="min-w-0">
            <p className="detail-mirror__chip" aria-hidden="true">
              Details
            </p>
            <h2 className="p5-display text-lg text-p5-red">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel ?? `Close details for ${label}`}
            className="p5-btn p5-btn--red detail-mirror__close"
          >
            {closeText}
          </button>
        </div>
        <div
          ref={bodyRef}
          tabIndex={0}
          role="group"
          aria-label="Details content — scroll to read"
          className="detail-mirror__body"
        >
          {children}
        </div>
      </section>
    </>
  );
}
