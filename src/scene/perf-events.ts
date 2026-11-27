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
import { usePortfolioStore } from '../state/store';

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
  // QA-only introspection: never expose renderer internals on the production
  // canvas. The perf harness installs window.__perf before any page script, so
  // the hook (and the autoReset override above) exist only during QA runs.
  if (qa) {
    canvas.__scenePerfInfo = () => ({
      calls: gl.info.render.calls,
      programs: gl.info.programs?.length ?? 0,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      frame: state.invalidate,
      reset: () => gl.info.reset(),
    });
  }

  // MINOR 10: R3F does not fire `onPointerOut` when the pointer leaves the
  // canvas (or an object unmounts under a stationary cursor), which left
  // `body.cursor='pointer'` stuck for the rest of the session. Clear our own
  // pointer state at the DOM boundary; each zone's own handler still owns
  // in-world highlights while the pointer is inside.
  const clearCanvasPointer = () => {
    if (
      typeof document !== 'undefined' &&
      document.body.style.cursor === 'pointer'
    ) {
      document.body.style.cursor = '';
    }
    const state = usePortfolioStore.getState();
    if (state.hoveredPostId !== null) state.setHoveredPost(null);
    if (state.hoveredProjectId !== null) state.setHoveredProject(null);
    if (state.menuHoverRoute !== null) state.setMenuHoverRoute(null);
  };
  if (typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('pointerleave', clearCanvasPointer);
    canvas.addEventListener('pointercancel', clearCanvasPointer);
  }

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
