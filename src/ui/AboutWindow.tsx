/**
 * One focus-managed About window. Own file so AboutDesktop stays presentational.
 */
import { Button } from '@mantine/core';
import { useFocusTrap } from '../lib/a11y';
import { usePortfolioStore, type AboutWindowId } from '../state/store';
import { AboutWindowBody } from './AboutWindowBody';

export interface WindowSpec {
  id: AboutWindowId;
  label: string;
  glyph: string;
}

/**
 * Focus the dialog still on top after a close; only go back to the icon when
 * no dialog remains. Reads the store after the close so the stack is current.
 */
export function focusAfterClose(closedId: AboutWindowId): void {
  const remaining = usePortfolioStore.getState().openWindows;
  if (remaining.length > 0) {
    const top = remaining[remaining.length - 1]!;
    document.getElementById(`about-window-${top}`)?.focus();
  } else {
    document.getElementById(`about-icon-${closedId}`)?.focus();
  }
}

export function AboutWindow({
  spec,
  index,
  isTop,
  isOnlyWindow,
}: {
  spec: WindowSpec;
  index: number;
  isTop: boolean;
  isOnlyWindow: boolean;
}) {
  const closeWindow = usePortfolioStore((s) => s.closeWindow);
  // Only the last remaining window restores focus itself; when another dialog
  // stays open, focusAfterClose() moves focus to that dialog instead.
  const trapRef = useFocusTrap<HTMLDivElement>(isTop, isOnlyWindow);

  const close = () => {
    closeWindow(spec.id);
    focusAfterClose(spec.id);
  };

  return (
    <div
      ref={trapRef}
      id={`about-window-${spec.id}`}
      role="dialog"
      aria-label={`${spec.label} window`}
      tabIndex={-1}
      className="p5-panel p5-panel--slashed absolute z-10 w-[min(92%,34rem)] p5-cut-in"
      style={{ top: `${16 + index * 28}px`, left: `${16 + index * 28}px` }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="p5-display text-base">
          {spec.glyph} {spec.label}
        </p>
        <Button
          type="button"
          onClick={close}
          aria-label={`Close ${spec.label} window`}
          radius={0}
          className="p5-btn p5-btn--red px-3 text-sm"
        >
          ✕
        </Button>
      </div>
      <AboutWindowBody id={spec.id} />
    </div>
  );
}
