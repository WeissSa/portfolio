/**
 * Refcounted, seeded static-resource cache (round-3 lag work, polish(b)).
 *
 * The room's furniture geometry, generated textures and materials are pure
 * functions of (seed, quality). Rebuilding them on every mount — and on every
 * mobile 2D↔3D remount / dev StrictMode remount — repaints ~1.8 M texture
 * pixels and re-uploads the GPU buffers. This module owns ONE immutable set per
 * key and hands every consumer the SAME THREE objects.
 *
 * Ownership is conservative: a release only drops an owner; an idle (zero
 * owner) entry stays cached so a remount reuses the identical objects, which
 * is what makes toggles free. At most TWO IDLE entries are retained — the cap
 * applies to idle entries only, NEVER to live ones. Eviction on a cache miss
 * is insertion-order, NOT LRU (no last-use tracking). Entries are freed by
 * that idle eviction, HMR, or an explicit clear — never while a consumer still
 * references them. Memory is bounded by the two-idle-entry cap and the
 * existing 1.8 M-pixel texture budget (one seed/room in production keeps one
 * entry for the whole session).
 *
 * StrictMode safety lives in Room.tsx: release is scheduled through
 * useDeferredDispose, so the dev double-invoke's simulated unmount cannot drop
 * an owner that the immediately-following remount still needs. There is no
 * synchronous decrement in a component cleanup.
 */
import * as THREE from 'three';
import { POSTS, PROJECTS } from '../../content/index';
import { FRAME_POSITIONS } from '../placement';
import {
  createBookInstances,
  createBookshelf,
  createChair,
  createClutterInstances,
  createDesk,
  createFramedSilhouette,
  createGameCases,
  createLamp,
  createLightCone,
  createMonitor,
  createNarrativeProps,
  createPcTower,
  createProjector,
  createRoomShell,
  createRugGeometry,
  createWallPlaque,
  createWindow,
  disposeParts,
  type BookInstance,
  type ClutterInstance,
  type RoomPart,
  type Vec3,
} from './geometry';
import {
  createRoomMaterials,
  disposeRoomMaterials,
  type RoomMaterials,
} from './materials';
import {
  createPlanTexture,
  createTexturePlans,
  disposeTextures,
  renderTexturePlans,
  type TextureFactory,
} from './textures';

export type CacheQuality = 'desktop' | 'mobile' | 'low';

export interface RoomFurniture {
  shell: RoomPart[];
  desk: RoomPart[];
  monitor: RoomPart[];
  tower: RoomPart[];
  bookshelf: ReturnType<typeof createBookshelf>;
  books: BookInstance[];
  lamp: RoomPart[];
  projector: RoomPart[];
  beam: RoomPart;
  windowParts: RoomPart[];
  chair: RoomPart[];
  props: ReturnType<typeof createNarrativeProps>;
  clutter: ReturnType<typeof createClutterInstances>;
  clutterGeometries: {
    pencil: THREE.CylinderGeometry;
    tin: THREE.CylinderGeometry;
  };
  frames: { position: Vec3; parts: RoomPart[] }[];
  rugGeometry: THREE.BufferGeometry;
  cases: RoomPart[];
  screenCloth: THREE.PlaneGeometry;
  screenBar: THREE.BoxGeometry;
  plaque: RoomPart[];
}

export interface RoomResources {
  /** Cache key; empty for a one-off (non-cached) build. */
  key: string;
  furniture: RoomFurniture;
  textures: ReturnType<typeof renderTexturePlans>;
  materials: RoomMaterials;
}

/**
 * Safety bound: at most two IDLE (zero-owner) resource sets are retained. Live
 * entries are never evicted, so the cache can temporarily hold more than two.
 */
export const MAX_CACHED_ROOMS = 2;

const CACHEABLE = Symbol('cacheableRoomFactory');

/**
 * Opt a headless test factory into the cached path (jsdom has no 2D canvas).
 * Untagged injected stubs still bypass the cache entirely, so every existing
 * per-mount-ownership test keeps its old semantics.
 */
export function asCacheableFactory<T extends TextureFactory>(factory: T): T {
  (factory as T & { [CACHEABLE]?: true })[CACHEABLE] = true;
  return factory;
}

export function factoryUsesCache(factory: TextureFactory): boolean {
  return (
    factory === createPlanTexture ||
    (factory as TextureFactory & { [CACHEABLE]?: true })[CACHEABLE] === true
  );
}

/**
 * Factory identity is part of the key: two different (even tagged) painters
 * must never silently share textures. Production has a single painter, but the
 * DI seam makes distinct stubs legitimate, so id them by function identity.
 */
const factoryIds = new WeakMap<TextureFactory, number>();
let nextFactoryId = 0;
function factoryId(factory: TextureFactory): number {
  let id = factoryIds.get(factory);
  if (id === undefined) {
    id = ++nextFactoryId;
    factoryIds.set(factory, id);
  }
  return id;
}

export function resourceKey(
  seed: string | number,
  quality: CacheQuality,
  factory: TextureFactory = createPlanTexture,
): string {
  return `${String(seed)}|${quality}|f${factoryId(factory)}`;
}

/** Build one resource set. No cache involvement; caller owns disposal. */
export function createRoomResources(
  seed: string | number,
  quality: CacheQuality,
  textureFactory: TextureFactory = createPlanTexture,
  key = '',
): RoomResources {
  const shell = createRoomShell();
  const desk = createDesk(seed);
  const monitor = createMonitor(seed);
  const tower = createPcTower(seed);
  const bookshelf = createBookshelf(seed);
  const books = createBookInstances(seed, bookshelf.cells, {
    featured: [0, 3, 6],
    ...(quality === 'desktop' ? {} : { maxBooks: 80 }),
  });
  const lamp = createLamp(seed);
  const projector = createProjector(seed);
  const beam = createLightCone(3.85, 0.62);
  const windowParts = createWindow();
  const chair = createChair(seed);
  const props = createNarrativeProps(seed);
  const clutter = createClutterInstances(seed);
  const clutterGeometries = {
    pencil: new THREE.CylinderGeometry(1, 1, 1, 6),
    tin: new THREE.CylinderGeometry(1, 0.92, 1, 10),
  };
  const frames = FRAME_POSITIONS.map(([position, variant]) => ({
    position,
    parts: createFramedSilhouette(seed, variant),
  }));
  const rugGeometry = createRugGeometry();
  const cases = createGameCases(seed, PROJECTS.length);
  const screenCloth = new THREE.PlaneGeometry(1.9, 1.07);
  const screenBar = new THREE.BoxGeometry(2.02, 0.05, 0.04);
  const plaque = createWallPlaque(seed);

  const furniture: RoomFurniture = {
    shell,
    desk,
    monitor,
    tower,
    bookshelf,
    books,
    lamp,
    projector,
    beam,
    windowParts,
    chair,
    props,
    clutter,
    clutterGeometries,
    frames,
    rugGeometry,
    cases,
    screenCloth,
    screenBar,
    plaque,
  };
  const plans = createTexturePlans(seed, {
    books: POSTS.map((post) => ({
      title: post.title,
      featured: post.featured,
    })),
    cases: PROJECTS.map((project) => project.title),
  });
  const textures = renderTexturePlans(plans, textureFactory);
  const materials = createRoomMaterials(textures);
  return { key, furniture, textures, materials };
}

/** Full teardown of one resource set (geometry + textures + materials). */
export function disposeRoomResources(resources: RoomResources): void {
  const f = resources.furniture;
  disposeParts([
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
  ]);
  f.rugGeometry.dispose();
  f.screenCloth.dispose();
  f.screenBar.dispose();
  f.clutterGeometries.pencil.dispose();
  f.clutterGeometries.tin.dispose();
  disposeTextures(resources.textures);
  disposeRoomMaterials(resources.materials);
}

interface CacheEntry {
  resources: RoomResources;
  owners: Set<object>;
  order: number;
}

const DEFAULT_OWNER: object = {};
const cache = new Map<string, CacheEntry>();
let insertionOrder = 0;

/**
 * Free the least-recently-INSERTED idle entry (insertion-order, NOT LRU — no
 * last-use tracking). Called only on a cache miss; a live entry is never freed.
 */
function evictIdleIfFull(): void {
  if (cache.size < MAX_CACHED_ROOMS) return;
  let oldest: [string, CacheEntry] | undefined;
  for (const pair of cache) {
    if (
      pair[1].owners.size === 0 &&
      (!oldest || pair[1].order < oldest[1].order)
    ) {
      oldest = pair;
    }
  }
  if (oldest) {
    disposeRoomResources(oldest[1].resources);
    cache.delete(oldest[0]);
  }
}

/**
 * Get (or build) the resource set for a key. `owner` is a stable token (a
 * component's useRef object); acquiring twice with the same owner is
 * idempotent, which is what keeps StrictMode's double-invoked useMemo from
 * counting the same mount twice.
 */
export function acquireRoomResources(
  seed: string | number,
  quality: CacheQuality,
  textureFactory: TextureFactory = createPlanTexture,
  owner: object = DEFAULT_OWNER,
): RoomResources {
  const key = resourceKey(seed, quality, textureFactory);
  const existing = cache.get(key);
  if (existing) {
    existing.owners.add(owner);
    return existing.resources;
  }
  evictIdleIfFull();
  const resources = createRoomResources(seed, quality, textureFactory, key);
  const owners = new Set<object>([owner]);
  cache.set(key, { resources, owners, order: ++insertionOrder });
  return resources;
}

/**
 * Drop one owner. An idle entry stays cached — a same-key remount reuses the
 * exact objects without repainting or re-uploading. Disposal happens only via
 * idle eviction or clearRoomResourceCache(), never while someone still uses it.
 */
export function releaseRoomResources(
  key: string,
  owner: object = DEFAULT_OWNER,
): void {
  cache.get(key)?.owners.delete(owner);
}

/** Free every idle entry; `force` also frees live entries (HMR module swap). */
export function clearRoomResourceCache(force = false): void {
  for (const [key, entry] of cache) {
    if (force || entry.owners.size === 0) {
      disposeRoomResources(entry.resources);
      cache.delete(key);
    }
  }
}

/** Diagnostic for tests / the cache-cap check (never gated at runtime). */
export function cachedRoomCount(): number {
  return cache.size;
}

if (import.meta.hot) {
  // A replaced module's objects can never be reused by the new tree.
  import.meta.hot.dispose(() => clearRoomResourceCache(true));
}
