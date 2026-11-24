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
 * re-established before the timer fires (StrictMode's simulated unmount), that
 * generation's disposal is cancelled. Every OTHER generation stays queued, so
 * rapid dependency changes in a single macrotask cannot drop an earlier
 * generation's disposal. A real unmount or a genuine dependency change still
 * disposes exactly once per replaced generation. No StrictMode removal, no
 * resource leaks.
 */
import { useEffect, useRef } from 'react';

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

interface PendingDisposal {
  deps: readonly unknown[];
  dispose: () => void;
}

export function useDeferredDispose(
  dispose: () => void,
  deps: readonly unknown[],
): void {
  /** generation id → the outgoing resource's dispose closure. */
  const pending = useRef<Map<number, PendingDisposal>>(new Map());
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFlush = () => {
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      const due = Array.from(pending.current.values());
      pending.current.clear();
      for (const entry of due) entry.dispose();
    }, 0);
  };

  useEffect(() => {
    // The Map identity is stable; capture it so the cleanup closes over the
    // queue, not over a ref read that React's lint warns can change by then.
    const queue = pending.current;
    // StrictMode simulated unmount: the very same generation is re-setting up
    // and reuses the memoized resource, so drop ONLY its pending disposal.
    // Other queued generations are genuine replacements and must still run.
    for (const [id, entry] of queue) {
      if (sameDeps(entry.deps, deps)) queue.delete(id);
    }
    const id = ++generation.current;

    return () => {
      // Never cancel the whole queue: a second dep change in the same macrotask
      // would otherwise lose the resource that this generation replaced.
      queue.set(id, { deps, dispose });
      scheduleFlush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
