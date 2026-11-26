/**
 * Pure coverage for the perf(ux) fixes that do not need WebGL:
 *  - same-material static family merging (draw-call budget);
 *  - idle texture painting that runs the SAME ops in the SAME order as the
 *    synchronous painter (seeded determinism) and is safely cancellable.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { mergePartsByMaterial, type RoomPart } from '../src/scene/art/geometry';
import {
  createDeferredTextures,
  createTexturePlans,
  type TexturePlan,
} from '../src/scene/art/textures';
import { POSTS, PROJECTS } from '../src/content/index';

const CONTENT = {
  books: POSTS.map((post) => ({ title: post.title, featured: post.featured })),
  cases: PROJECTS.map((project) => project.title),
};

function part(id: string, material: RoomPart['material']): RoomPart {
  return { id, geometry: new THREE.BoxGeometry(1, 1, 1), material };
}

describe('mergePartsByMaterial (draw-call budget)', () => {
  it('collapses same-material siblings into one part per material', () => {
    const merged = mergePartsByMaterial('family', [
      part('a', 'wood'),
      part('b', 'wood'),
      part('c', 'plaster'),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((p) => p.material).sort()).toEqual(['plaster', 'wood']);
    for (const p of merged) {
      expect(p.geometry.getAttribute('position')).toBeDefined();
    }
  });

  it('never merges different baked-attribute signatures (keeps floor AO)', () => {
    const withAo = part('floor', 'floor');
    withAo.geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3),
    );
    const merged = mergePartsByMaterial('shell', [
      withAo,
      part('wall-a', 'floor'),
      part('wall-b', 'floor'),
    ]);
    expect(merged).toHaveLength(2);
    const ao = merged.find((p) => p.id === 'floor')!;
    expect(ao.geometry.getAttribute('color')).toBeDefined();
    const walls = merged.find((p) => p.id !== 'floor')!;
    expect(walls.geometry.getAttribute('color')).toBeUndefined();
  });
});

/** jsdom has no 2D context: record each paintOp via its globalAlpha write. */
function recordingCanvas(log: string[]): HTMLCanvasElement {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  const gradient = { addColorStop: () => undefined };
  const context = new Proxy(
    { canvas, createRadialGradient: () => gradient } as Record<string, unknown>,
    {
      get(target, key: string) {
        if (key in target) return target[key];
        return (...args: unknown[]) => log.push(`${key}:${args.length}`);
      },
      set(target, key: string, value: unknown) {
        if (key === 'globalAlpha') log.push('op');
        target[key] = value;
        return true;
      },
    },
  );
  return canvas;
}

function paintAll(plans: Record<string, TexturePlan>): string[][] {
  const keys = Object.keys(plans);
  const logs = keys.map(() => [] as string[]);
  let next = 0;
  const deferred = createDeferredTextures(
    plans as Parameters<typeof createDeferredTextures>[0],
    () => recordingCanvas(logs[next++]!),
  );
  let slices = 0;
  while (!deferred.paint.done && slices < 1000) {
    deferred.paint.step();
    slices += 1;
  }
  expect(deferred.paint.done).toBe(true);
  expect(slices).toBeGreaterThan(1); // genuinely incremental, not one task
  return logs;
}

describe('createDeferredTextures (first-load freeze fix)', () => {
  const plans = createTexturePlans('perf-seed', CONTENT);

  it('paints every op exactly once, in plan order', () => {
    const logs = paintAll(plans);
    Object.values(plans).forEach((plan, index) => {
      const ops = logs[index]!.filter((entry) => entry === 'op');
      // Base fill at creation + one write for every remaining op, no dupes.
      expect(ops).toHaveLength(plan.ops.length);
    });
  });

  it('is deterministic: the same seed produces the same op stream', () => {
    const a = paintAll(plans);
    const b = paintAll(createTexturePlans('perf-seed', CONTENT));
    expect(a).toEqual(b);
  });

  it('is idempotent to start and cancels without further work', () => {
    const scheduled = vi.fn();
    vi.stubGlobal('requestIdleCallback', scheduled);
    const deferred = createDeferredTextures(plans, () => recordingCanvas([]));
    deferred.paint.start();
    deferred.paint.start();
    expect(scheduled).toHaveBeenCalledTimes(1);
    deferred.paint.cancel();
    expect(deferred.paint.step()).toBe(false);
    vi.unstubAllGlobals();
  });
});
