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
  releaseRoomResources,
  type RoomResources,
} from '../src/scene/art/static-cache';

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
  factory: () => THREE.Texture,
): RoomResources {
  const probeOwner = {};
  const resources = acquireRoomResources(seed, quality, factory, probeOwner);
  releaseRoomResources(resources.key, probeOwner);
  return resources;
}

async function mount(
  seed: string,
  quality: 'desktop' | 'mobile',
  factory: () => THREE.Texture,
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
