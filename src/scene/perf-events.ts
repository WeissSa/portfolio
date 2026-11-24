/**
 * Pointer-raycast coalescing (art-overhaul commit 3c, perf audit P2).
 *
 * R3F raycasts on EVERY native pointermove by default. A fast mouse can emit
 * 125-1000 moves/s, so picking competes with the render loop during a camera
 * flight. Keep the latest move and forward at most one per animation frame;
 * clicks/downs/ups stay immediate (picking correctness is unchanged).
 *
 * Coarse pointers never reach this code: SceneLayer only adds
 * `.scene-layer--interactive` (pointer-events:auto) for a fine pointer, so
 * onPointerOver/onPointerOut raycasts are skipped entirely on tap-only devices.
 */
import {
  events as createPointerEvents,
  type CanvasProps,
  type DomEvent,
} from '@react-three/fiber';

type EventsFactory = NonNullable<CanvasProps['events']>;

/** R3F's DOM event listener type (EventListener from the DOM lib). */
type DomEventListener = (event: Event) => void;

export const createCoalescedPointerEvents: EventsFactory = (store) => {
  const manager = createPointerEvents(store);

  // QA-only introspection hook for the Playwright perf spec (no behaviour
  // change, a few bytes): expose renderer.info + invalidate on the canvas so
  // draw-call/program and 5-toggle leak budgets can be measured from the page.
  const state = store.getState();
  const gl = state.gl;
  const qa = typeof window !== 'undefined' && Boolean(window.__perf);
  if (qa) gl.info.autoReset = false; // count a whole frame, not just the quad blit
  const canvas = gl.domElement as HTMLCanvasElement & {
    __scenePerfInfo?: () => {
      calls: number;
      programs: number;
      geometries: number;
      textures: number;
      frame: () => void;
      reset: () => void;
    };
  };
  canvas.__scenePerfInfo = () => ({
    calls: gl.info.render.calls,
    programs: gl.info.programs?.length ?? 0,
    geometries: gl.info.memory.geometries,
    textures: gl.info.memory.textures,
    frame: state.invalidate,
    reset: () => gl.info.reset(),
  });

  const handlers = manager.handlers;
  if (!handlers || typeof window === 'undefined') return manager;
  const original = handlers.onPointerMove;
  let pending: Event | null = null;
  let scheduled = false;
  const coalesced: DomEventListener = (event: Event) => {
    pending = event;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const latest = pending;
      pending = null;
      if (latest) original(latest as DomEvent);
    });
  };
  manager.handlers = { ...handlers, onPointerMove: coalesced };
  return manager;
};
