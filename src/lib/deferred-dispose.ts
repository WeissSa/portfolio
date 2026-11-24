/**
 * StrictMode-safe GPU resource disposal (2026-11-24 dev-render bug).
 *
 * useEffect cleanup runs TWICE in dev under React StrictMode (mount → simulated
 * unmount → remount) while `useMemo` is NOT recomputed. Disposing memoized
 * geometries/materials/textures in that first cleanup leaves the remounted
 * scene drawing with disposed GPU resources: an empty purple field in dev,
 * while production (no double-invoke) renders fine.
 *
 * `useDeferredDispose` defers cleanup by one macrotask. If the SAME effect is
 * re-established before the timer fires (StrictMode's simulated unmount), the
 * timer is cancelled. A real unmount or a genuine dependency change still
 * disposes exactly once. No StrictMode removal, no resource leaks.
 */
import { useEffect, useRef } from 'react';

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function useDeferredDispose(
  dispose: () => void,
  deps: readonly unknown[],
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeps = useRef<readonly unknown[] | null>(null);

  useEffect(() => {
    if (
      timer.current !== null &&
      lastDeps.current !== null &&
      sameDeps(lastDeps.current, deps)
    ) {
      // StrictMode simulated unmount: the very same generation is re-setting
      // up, so the scheduled disposal must NOT run.
      clearTimeout(timer.current);
      timer.current = null;
    }
    lastDeps.current = deps;

    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        dispose();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
