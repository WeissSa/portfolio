/**
 * Focus bookkeeping for the single detail frame. Kept in a hook so the
 * DetailMirror component stays presentational.
 */
import { useEffect } from 'react';
import { usePortfolioStore } from '../state/store';

/**
 * Remember the opener while focus is still outside the panel, then restore it
 * on unmount — preferring the in-world pick proxy (`#detail-return`) when the
 * detail was opened from the 3D room.
 */
export function useDetailFocusRestore(): void {
  const setFocused = usePortfolioStore((state) => state.setDetailMirrorFocused);

  useEffect(() => {
    const saved = document.activeElement as HTMLElement | null;
    return () => {
      setFocused(false);
      // Un-mount happens in this commit; restore on the next microtask so the
      // trigger is definitely back in the tab order.
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
}
