/**
 * The ONE readable detail frame (owner decision 2026-11-25, round-5 fix).
 *
 * Every detail surface — book, project case, About desktop or climate detail —
 * renders its content through this component. It is a visible, scrollable DOM
 * panel styled as an in-world page/screen: the full verbatim content is here,
 * never a truncated painted copy. The room stays visible around it.
 *
 * Accessibility: role=dialog + aria-modal, trapped Tab, a visible Close button,
 * Escape to dismiss, a polite live announcement from the caller, and focus
 * restored to the 3D pick proxy (`#detail-return`) or the DOM opener. Focus
 * starts in the scrollable body so wheel scrolling works immediately on open.
 */
import { useRef, type ReactNode } from 'react';
import { UI_COPY } from '../content/ui-copy';
import { useModalFrame } from '../lib/dialog-effects';
import { useDetailFocusRestore } from '../lib/use-detail-focus-restore';
import { usePortfolioStore } from '../state/store';

export interface DetailMirrorProps {
  /** Accessible dialog name (the same title the visible dialog carries). */
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
   * Escape guard for nested UI. The About section keeps its own window stack:
   * the first Escape closes the top window, later Escapes close this panel.
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
  closeText = UI_COPY.close,
  blockEscape,
  children,
}: DetailMirrorProps) {
  const setFocused = usePortfolioStore((state) => state.setDetailMirrorFocused);
  const bodyRef = useRef<HTMLDivElement>(null);

  // MUST be called before the modal frame: it remembers the opener while focus
  // is still outside the panel, and restores it after the frame unmounts.
  useDetailFocusRestore();

  // The modal frame owns the scrim, body scroll lock, shell inert state, Escape
  // and the focus trap. Restore is owned by the effect above (it prefers the
  // F2 canvas-trigger proxy), so the trap must not race it with a second one.
  const trapRef = useModalFrame<HTMLElement>({
    active: true,
    onClose,
    blockEscape,
    initialFocus: bodyRef,
    restoreFocus: false,
  });

  return (
    <>
      {/* A click outside dismisses exactly like a conventional backdrop. The
          room stays visible — this is a framed detail, not a full-screen swap. */}
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
              {UI_COPY.detailChip}
            </p>
            <h2 className="p5-display text-lg text-p5-red">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel ?? UI_COPY.closeDetailsLabel(label)}
            className="p5-btn p5-btn--red detail-mirror__close"
          >
            {closeText}
          </button>
        </div>
        <div
          ref={bodyRef}
          tabIndex={0}
          role="region"
          aria-label={`${title} details`}
          className="detail-mirror__body"
        >
          {children}
        </div>
      </section>
    </>
  );
}
