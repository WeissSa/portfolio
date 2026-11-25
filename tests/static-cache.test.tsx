/**
 * polish(b) — seeded static-resource cache regression tests.
 *
 * The cached path is exercised headlessly with an explicitly tagged stub
 * factory (asCacheableFactory): jsdom has no 2D canvas, but the cache contract
 * is about object identity and disposal, not painted pixels. Untagged stubs
 * still bypass the cache, so every pre-existing per-mount-ownership test keeps
 * its original semantics.
 */
import { StrictMode } from 'react';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { RoomScene } from '../src/scene/Room';
import {
  acquireRoomResources,
  asCacheableFactory,
  cachedRoomCount,
  clearRoomResourceCache,
  factoryUsesCache,
  releaseRoomResources,
  resourceKey,
  type RoomResources,
} from '../src/scene/art/static-cache';
import {
  createPlanTexture,
  type TextureFactory,
} from '../src/scene/art/textures';

async function flushTimers(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

function makeFactory(): ReturnType<typeof vi.fn<() => THREE.Texture>> {
  return vi.fn(() => new THREE.Texture());
}

/** Create (or revive) a cache entry, then drop the probe's own ownership. */
function probeResources(
  seed: string,
  quality: 'desktop' | 'mobile',
  factory: TextureFactory,
): RoomResources {
  const probeOwner = {};
  const resources = acquireRoomResources(seed, quality, factory, probeOwner);
  releaseRoomResources(resources.key, probeOwner);
  return resources;
}

async function mount(
  seed: string,
  quality: 'desktop' | 'mobile',
  factory: TextureFactory,
) {
  return ReactThreeTestRenderer.create(
    <RoomScene seed={seed} quality={quality} textureFactory={factory} />,
    { frameloop: 'never' },
  );
}

function firstGeometry(
  renderer: Awaited<ReturnType<typeof mount>>,
): THREE.BufferGeometry {
  const mesh = renderer.scene.findAll((node) => node.type === 'Mesh')[0];
  return (mesh?.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
}

beforeEach(() => clearRoomResourceCache(true));
afterEach(() => clearRoomResourceCache(true));

describe('seeded static cache — remount identity', () => {
  it('reuses identical geometry/textures across unmount→remount with zero disposal', async () => {
    const factory = asCacheableFactory(makeFactory());
    const resources = probeResources('remount-identity', 'desktop', factory);
    const disposeTexture = vi.spyOn(resources.textures.wood, 'dispose');
    const disposePart = vi.spyOn(
      resources.furniture.shell[0]!.geometry,
      'dispose',
    );

    const first = await mount('remount-identity', 'desktop', factory);
    const firstGeometryRef = firstGeometry(first);
    expect(firstGeometryRef).toBe(resources.furniture.shell[0]!.geometry);
    await first.unmount();
    await flushTimers();

    expect(disposeTexture).not.toHaveBeenCalled();
    expect(disposePart).not.toHaveBeenCalled();

    const second = await mount('remount-identity', 'desktop', factory);
    expect(firstGeometry(second)).toBe(firstGeometryRef);
    expect(factory).toHaveBeenCalledTimes(10);
    await second.unmount();
    await flushTimers();

    expect(disposeTexture).not.toHaveBeenCalled();
    expect(disposePart).not.toHaveBeenCalled();

    // Only an explicit clear (HMR / cap eviction) frees an idle entry.
    clearRoomResourceCache(true);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
    expect(disposePart).toHaveBeenCalledTimes(1);
  });

  it('does not regenerate textures across repeated mobile 2D↔3D-style remounts', async () => {
    const factory = asCacheableFactory(makeFactory());
    const resources = probeResources('mobile-toggle', 'mobile', factory);
    const disposeTexture = vi.spyOn(resources.textures.wood, 'dispose');

    for (let toggle = 0; toggle < 3; toggle += 1) {
      const view = await mount('mobile-toggle', 'mobile', factory);
      expect(firstGeometry(view)).toBe(resources.furniture.shell[0]!.geometry);
      await view.unmount();
      await flushTimers();
    }

    // One seed + one quality: textures painted exactly once (10 maps), never
    // repainted by toggling; the cache never grows past a single key.
    expect(factory).toHaveBeenCalledTimes(10);
    expect(disposeTexture).not.toHaveBeenCalled();
    expect(cachedRoomCount()).toBe(1);
  });
});

describe('seeded static cache — StrictMode safety', () => {
  it('survives the dev double-invoke without evicting the remounted resources', async () => {
    const factory = asCacheableFactory(makeFactory());
    const resources = probeResources('strict-cache', 'desktop', factory);
    const disposeTexture = vi.spyOn(resources.textures.wood, 'dispose');

    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <RoomScene
          seed="strict-cache"
          quality="desktop"
          textureFactory={factory}
        />
      </StrictMode>,
      { frameloop: 'never' },
    );
    await flushTimers();
    expect(factory).toHaveBeenCalledTimes(10);
    expect(disposeTexture).not.toHaveBeenCalled();

    await renderer.unmount();
    await flushTimers();
    // The simulated unmount's deferred release was cancelled on re-setup; the
    // real unmount drops exactly one owner, leaving an IDLE (still cached) set.
    expect(disposeTexture).not.toHaveBeenCalled();
    expect(cachedRoomCount()).toBe(1);

    clearRoomResourceCache(true);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
  });
});

describe('seeded static cache — refcount + cap', () => {
  it('disposes only at refcount 0, never while an owner is live', () => {
    const factory = makeFactory();
    const firstOwner = {};
    const secondOwner = {};
    const resources = acquireRoomResources(
      'refcount',
      'mobile',
      factory,
      firstOwner,
    );
    const disposeTexture = vi.spyOn(resources.textures.wood, 'dispose');
    const disposePart = vi.spyOn(
      resources.furniture.shell[0]!.geometry,
      'dispose',
    );

    expect(
      acquireRoomResources('refcount', 'mobile', factory, secondOwner),
    ).toBe(resources);
    expect(factory).toHaveBeenCalledTimes(10);

    releaseRoomResources(resources.key, firstOwner);
    clearRoomResourceCache(); // idle-only — secondOwner still holds the set
    expect(disposeTexture).not.toHaveBeenCalled();
    expect(disposePart).not.toHaveBeenCalled();

    releaseRoomResources(resources.key, secondOwner); // refcount → 0
    clearRoomResourceCache();
    expect(disposeTexture).toHaveBeenCalledTimes(1);
    expect(disposePart).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest IDLE entry at the two-key cap and force-clears on HMR', () => {
    const factory = makeFactory();

    const a = acquireRoomResources('a', 'desktop', factory);
    const disposeA = vi.spyOn(a.textures.wood, 'dispose');
    releaseRoomResources(a.key);

    const b = acquireRoomResources('b', 'desktop', factory);
    const disposeB = vi.spyOn(b.textures.wood, 'dispose');
    releaseRoomResources(b.key);

    const c = acquireRoomResources('c', 'desktop', factory);
    const disposeC = vi.spyOn(c.textures.wood, 'dispose');

    expect(cachedRoomCount()).toBe(2);
    expect(disposeA).toHaveBeenCalledTimes(1); // oldest idle entry evicted
    expect(disposeB).not.toHaveBeenCalled();
    expect(disposeC).not.toHaveBeenCalled();

    // HMR swaps the module: even live entries must be freed (c is still owned).
    clearRoomResourceCache(true);
    expect(disposeB).toHaveBeenCalledTimes(1);
    expect(disposeC).toHaveBeenCalledTimes(1);
    expect(cachedRoomCount()).toBe(0);
  });
});

/** Minimal 2D context for the REAL createPlanTexture production-path test. */
function fakePaintContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  return {
    canvas,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineCap: 'butt',
    clearRect: noop, // climate-draw's heatmap shares this context stub
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    createRadialGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D;
}

interface DisposeSpy {
  mock: { calls: unknown[][] };
}

/** Spy on EVERY cached GPU resource (10 textures + every geometry/material family). */
function spyAllDisposals(resources: RoomResources): DisposeSpy[] {
  const spies: DisposeSpy[] = [];
  const seen = new Set<object>();
  const spy = (resource: { dispose: () => void }) => {
    if (seen.has(resource)) return;
    seen.add(resource);
    spies.push(vi.spyOn(resource, 'dispose'));
  };
  for (const texture of Object.values(resources.textures)) spy(texture);
  // textureClones is non-enumerable at runtime, so Object.values sees only
  // materials (the cast drops the optional array field from the static type).
  for (const material of Object.values(
    resources.materials,
  ) as THREE.Material[]) {
    spy(material);
  }
  const f = resources.furniture;
  const parts = [
    ...f.shell,
    ...f.desk,
    ...f.monitor,
    ...f.tower,
    ...f.bookshelf.parts,
    ...f.lamp,
    ...f.projector,
    f.beam,
    ...f.windowParts,
    ...f.chair,
    ...f.props.desk,
    ...f.props.monitor,
    ...f.props.floor,
    ...f.props.tower,
    ...f.props.shelf,
    ...f.frames.flatMap((frame) => frame.parts),
    ...f.cases,
    ...f.plaque,
  ];
  for (const part of parts) spy(part.geometry);
  for (const geometry of [
    f.rugGeometry,
    f.screenCloth,
    f.screenBar,
    f.clutterGeometries.pencil,
    f.clutterGeometries.tin,
  ]) {
    spy(geometry);
  }
  return spies;
}

describe('seeded static cache — real factory + key identity', () => {
  it('accepts the real production painter but not an untagged injected stub', () => {
    expect(factoryUsesCache(createPlanTexture)).toBe(true);
    expect(factoryUsesCache(makeFactory())).toBe(false);
  });

  it('keys entries by factory identity as well as seed and quality', () => {
    const a = asCacheableFactory(makeFactory());
    const b = asCacheableFactory(makeFactory());
    expect(resourceKey('k', 'desktop', a)).not.toBe(
      resourceKey('k', 'desktop', b),
    );
    expect(acquireRoomResources('k', 'desktop', a)).not.toBe(
      acquireRoomResources('k', 'desktop', b),
    );
    expect(cachedRoomCount()).toBe(2);
    clearRoomResourceCache(true);
  });

  it('routes RoomScene through the cached production path across a remount', async () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function (this: HTMLCanvasElement) {
        return fakePaintContext(this) as unknown as CanvasRenderingContext2D;
      });
    try {
      const first = await mount('prod-path', 'desktop', createPlanTexture);
      const geometryRef = firstGeometry(first);
      // 10 room plans + the climate heatmap share this stubbed 2D context.
      const painted = getContext.mock.calls.filter(
        (args) => args[0] === '2d',
      ).length;
      expect(painted).toBeGreaterThanOrEqual(10);
      await first.unmount();
      await flushTimers();

      const second = await mount('prod-path', 'desktop', createPlanTexture);
      expect(firstGeometry(second)).toBe(geometryRef);
      // Only the zone-local climate heatmap repaints on remount (it is not
      // cached); the 10 room plans are reused, so no second batch of paints.
      const paintedAfter = getContext.mock.calls.filter(
        (args) => args[0] === '2d',
      ).length;
      expect(paintedAfter - painted).toBe(1);
      expect(cachedRoomCount()).toBe(1);
      await second.unmount();
      await flushTimers();
      clearRoomResourceCache(true);
    } finally {
      getContext.mockRestore();
    }
  });
});

describe('seeded static cache — full teardown + genuine key change', () => {
  it('frees all 10 textures and every family on a non-force clear after a real unmount', async () => {
    const factory = asCacheableFactory(makeFactory());
    const resources = probeResources('full-disposal', 'desktop', factory);
    expect(Object.keys(resources.textures)).toHaveLength(10);
    const spies = spyAllDisposals(resources);

    const view = await mount('full-disposal', 'desktop', factory);
    await view.unmount();
    await flushTimers();
    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);

    clearRoomResourceCache(); // non-force: the entry is idle
    expect(spies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(cachedRoomCount()).toBe(0);
  });

  it('deferred-releases the old owner and acquires a new entry on a real seed/quality change', async () => {
    const factory = asCacheableFactory(makeFactory());
    const first = probeResources('key-change', 'desktop', factory);
    const disposeFirst = vi.spyOn(first.textures.wood, 'dispose');
    const view = await mount('key-change', 'desktop', factory);
    const firstGeometryRef = firstGeometry(view);

    await view.update(
      <RoomScene
        seed="key-change-2"
        quality="mobile"
        textureFactory={factory}
      />,
    );
    await flushTimers();
    const probe = {};
    const second = acquireRoomResources(
      'key-change-2',
      'mobile',
      factory,
      probe,
    );
    expect(firstGeometry(view)).toBe(second.furniture.shell[0]!.geometry);
    expect(firstGeometry(view)).not.toBe(firstGeometryRef);
    expect(cachedRoomCount()).toBe(2);
    expect(disposeFirst).not.toHaveBeenCalled(); // old entry only idle, not freed
    releaseRoomResources(second.key, probe);

    await view.unmount();
    await flushTimers();
    clearRoomResourceCache(true);
    expect(disposeFirst).toHaveBeenCalledTimes(1);
  });
});
