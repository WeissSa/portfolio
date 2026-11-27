/**
 * The room shell (REWORK_PLAN §3.5, ladder commit 4): a Dishonored-painterly
 * programmer/gamer's den composed ENTIRELY from the procedural art pipeline —
 * seeded canvas textures, low-poly primitive geometry, warm lamp light pools,
 * moonlit night window, and (desktop tier only) the grain+vignette+grade post
 * pass. No model or texture downloads.
 *
 * Commit 5: this module is the lazy 3D chunk; CameraRig drives zone flights
 * and the shell lazy-loads the default export behind the device-tier gate.
 *
 * Headless testing: texture creation is dependency-injected (textureFactory)
 * so unit tests can render <RoomScene/> with @react-three/test-renderer
 * without a 2D canvas. Visual verification needs a real browser.
 */
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { usePrefersReducedMotion } from '../lib/a11y';
import { useDeferredDispose } from '../lib/deferred-dispose';
import { DESIGN_TOKENS } from '../styles/design-tokens';
import {
  acquireRoomResources,
  createRoomResources,
  disposeRoomResources,
  factoryUsesCache,
  releaseRoomResources,
  type RoomResources,
} from './art/static-cache';
import { DustMotes } from './ambient/DustMotes';
import { CameraRig } from './CameraRig';
import { HomeControl } from './HomeControl';
import { PLAQUE } from './diegetic';
import { PainterlyPass } from './effects/PainterlyPass';
import { createCoalescedPointerEvents } from './perf-events';
import {
  CHAIR_POSITION,
  CHAIR_ROTATION,
  DESK_POSITION,
  LAMP_POSITION,
  MONITOR_DESK_OFFSET,
  PROJECTOR_POSITION,
  PROJECTOR_ROTATION,
  RUG_POSITION,
  SCREEN_POSITION,
  SHELF_POSITION,
  SHELF_ROTATION,
  TOWER_POSITION,
  TOWER_ROTATION,
  WINDOW_POSITION,
  WINDOW_ROTATION,
} from './placement';
import {
  beamEnvelope,
  DESK_TOP_HEIGHT,
  LAMP_BULB_LOCAL,
  type BookInstance,
  type ClutterInstance,
  type RoomPart,
  type Vec3,
} from './art/geometry';
import type { RoomMaterials } from './art/materials';
import { LibraryZone } from './zones/Library';
import { WallPlaque } from './zones/WallPlaque';
import { DeskZone } from './zones/Desk';
import { ProjectCases } from './zones/ProjectCases';
import { ClimateProjector } from './zones/ClimateProjector';
import { createPlanTexture, type TextureFactory } from './art/textures';

/** Rendering tier; commit 5 derives this from the device-tier check. */
export type RoomQuality = 'desktop' | 'mobile' | 'low';

export interface RoomSceneProps {
  /** Seed for the whole room — same seed, byte-identical room. */
  seed?: string | number;
  quality?: RoomQuality;
  /** DI seam for headless tests (defaults to the browser canvas painter). */
  textureFactory?: TextureFactory;
  /** Reduced-motion 3D: freeze the grain clock (static-cut mode, commit 4). */
  freezeTime?: boolean;
}

/**
 * Single source for the shadow contract the review asked to assert: only a
 * desktop Canvas allocates a shadow map, and only its one warm key spot casts.
 */
export function roomShadowSettings(quality: RoomQuality): {
  // R3F maps the string 'percentage' to THREE.PCFShadowMap. Passing boolean
  // `true` makes it choose PCFSoftShadowMap, which three r187 removed (console
  // warning + silent fallback) — be explicit about the supported map type.
  canvasShadows: 'percentage' | false;
  keyLight: boolean;
} {
  const desktop = quality === 'desktop';
  return { canvasShadows: desktop ? 'percentage' : false, keyLight: desktop };
}

/* Placement constants live in ./placement so the camera viewpoints can
 * derive from the same source without a circular Room ↔ CameraRig import. */

/**
 * Bake a static node's authored TRS into its local matrix, then keep it frozen
 * (matrixAutoUpdate stays false at steady state). R3F 9's applyProps writes
 * position/rotation/scale but NEVER calls updateMatrix(), so a mount-only ref
 * leaves the matrix stuck at the first pose: on a seed change React reuses the
 * same mesh instances (stable keys) and lands new transform props, but the
 * frozen `object.matrix` still holds the old transform.
 *
 * Passed via `onUpdate` (not `ref`): R3F invokes onUpdate at the end of every
 * applyProps — mount AND any props commit — after the new TRS has been written,
 * so the matrix is re-baked in place whenever a transform prop changes without
 * ever re-enabling per-frame auto-update. Stable module-scope identity also
 * keeps it out of R3F's prop diff.
 */
const bakeStaticMatrix = (object: THREE.Object3D): void => {
  object.updateMatrix();
};

function Parts({
  parts,
  materials,
  shadows = false,
  castShadow = false,
  receiveShadow = shadows,
}: {
  parts: readonly RoomPart[];
  materials: RoomMaterials;
  /** Desktop tier only: meshes cast/receive the one shadow-map key light. */
  shadows?: boolean;
  /** Shadow casting is reserved for the few large pieces near the key light;
   *  every other mesh still RECEIVES the shadow but skips the shadow-map draw. */
  castShadow?: boolean;
  receiveShadow?: boolean;
}): JSX.Element {
  return (
    <>
      {parts.map((part) => (
        <mesh
          key={part.id}
          onUpdate={bakeStaticMatrix}
          geometry={part.geometry}
          material={materials[part.material]}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          matrixAutoUpdate={false}
        />
      ))}
    </>
  );
}

/** All shelf books in a single InstancedMesh with per-instance color (§3.8). */
function Books({
  books,
  material,
}: {
  books: readonly BookInstance[];
  material: THREE.Material;
}): JSX.Element | null {
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useDeferredDispose(() => geometry.dispose(), [geometry]);
  if (books.length === 0) return null;
  return (
    <instancedMesh
      ref={(mesh) => {
        if (!mesh) return;
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const color = new THREE.Color();
        books.forEach((book, i) => {
          position.set(...book.position);
          scale.set(...book.scale);
          euler.set(0, 0, book.tilt);
          quaternion.setFromEuler(euler);
          matrix.compose(position, quaternion, scale);
          mesh.setMatrixAt(i, matrix);
          color.set(book.color);
          mesh.setColorAt(i, color);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        // 3c P5: cull the filler books against their real instance bounds.
        mesh.computeBoundingSphere();
      }}
      args={[geometry, material, books.length]}
    />
  );
}

/**
 * One InstancedMesh per repeated small-item family (art-overhaul commit 3b):
 * the caller passes a UNIT geometry (instances carry their own scale/euler)
 * and owns its disposal — Room.tsx memoizes one geometry per family.
 */
function ClutterFamily({
  instances,
  geometry,
  material,
  shadows = false,
}: {
  instances: readonly ClutterInstance[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  shadows?: boolean;
}): JSX.Element | null {
  if (instances.length === 0) return null;
  return (
    <instancedMesh
      ref={(mesh) => {
        if (!mesh) return;
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const color = new THREE.Color();
        instances.forEach((instance, i) => {
          position.set(...instance.position);
          scale.set(...instance.scale);
          euler.set(...(instance.rotation ?? [0, 0, 0]));
          quaternion.setFromEuler(euler);
          matrix.compose(position, quaternion, scale);
          mesh.setMatrixAt(i, matrix);
          color.set(instance.color);
          mesh.setColorAt(i, color);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        // 3c P5: bounds follow the authored instances, not the unit geometry.
        mesh.computeBoundingSphere();
      }}
      args={[geometry, material, instances.length]}
      castShadow={shadows}
      receiveShadow={shadows}
    />
  );
}

/* ----------------------------------------------------------------- scene -- */

/**
 * Room contents (inside a Canvas / test renderer). Everything is memoized off
 * the seed; no per-frame allocations.
 */
export function RoomScene({
  seed = 'the-room',
  quality = 'desktop',
  textureFactory = createPlanTexture,
  freezeTime = false,
}: RoomSceneProps): JSX.Element {
  // Seeded static cache (polish/b): the default browser painter produces
  // deterministic resources, so every mount shares one immutable set. An
  // injected stub factory (headless tests) bypasses the cache entirely and
  // keeps the old per-mount ownership + teardown contract.
  const owner = useRef<object>({});
  const usesCache = factoryUsesCache(textureFactory);
  const invalidate = useThree((state) => state.invalidate);
  const resources = useMemo<RoomResources>(
    () =>
      usesCache
        ? acquireRoomResources(
            seed,
            quality,
            textureFactory,
            owner.current,
            true, // deferred texture paint — no single first-load stall
          )
        : createRoomResources(seed, quality, textureFactory),
    [seed, quality, textureFactory, usesCache],
  );
  const { furniture, materials } = resources;

  // Idle painter is idempotent and lives with the cached resources, so a
  // StrictMode remount / 2D↔3D toggle cannot double-schedule it. Each slice
  // marks its CanvasTexture dirty; one invalidate() draws the newly painted
  // detail. The seeded op order is unchanged (see createDeferredTextures).
  useEffect(() => {
    resources.progressivePaint?.start(() => invalidate());
  }, [resources, invalidate]);

  // polish(e): the mote cloud lives INSIDE the light cone. Derive its envelope
  // from the beam geometry actually used (production calls
  // createLightCone(3.85, 0.62)), so the two can never hardcode-drift apart.
  const beam = useMemo(
    () => beamEnvelope(furniture.beam.geometry),
    [furniture.beam.geometry],
  );

  // Deferred release (NOT a synchronous refcount decrement): StrictMode's dev
  // simulated unmount cancels this on same-generation re-setup, so the remount
  // never receives disposed/cached GPU objects. A real unmount drops one owner;
  // idle entries stay cached for a zero-work remount (see static-cache.ts).
  useDeferredDispose(() => {
    if (usesCache) releaseRoomResources(resources.key, owner.current);
    else disposeRoomResources(resources);
  }, [resources, usesCache]);

  const lampLight: Vec3 = [
    LAMP_POSITION[0] + LAMP_BULB_LOCAL[0],
    LAMP_BULB_LOCAL[1],
    LAMP_POSITION[2] + LAMP_BULB_LOCAL[2],
  ];

  // Chiaroscuro key light (commit 3a): ONE warm shadow-casting spot over the
  // desk replaces the old shadowless desk-lamp point light, so the total light
  // count stays ≤5. Desktop tier only — mobile gets the same warm pool without
  // a shadow map (castShadow=false, Canvas shadows disabled).
  const keyLight = roomShadowSettings(quality).keyLight;
  const keyLightTarget: Vec3 = [
    DESK_POSITION[0] - 0.45,
    DESK_TOP_HEIGHT,
    DESK_POSITION[2] + 0.05,
  ];

  return (
    <PainterlyPass enabled={quality === 'desktop'} freezeTime={freezeTime}>
      {/* Base ambience: cool night fill + moonlight from the window. The
          ambient is dimmed (0.5 → 0.36) so the warm key light reads. */}
      <ambientLight intensity={0.36} color={DESIGN_TOKENS.room.ambient} />
      <directionalLight
        position={[5.5, 3.2, 1.2]}
        intensity={0.45}
        color={DESIGN_TOKENS.room.moonlight}
      />
      {/* 3c mobile light budget: exactly ONE dynamic point light (the floor
          lamp). The shadow key spot and monitor spill are desktop-only; the
          bulb/shade, LED, monitor screen and night glass already carry their
          own emissive material, so folding the removed lights into emissive
          costs no extra shader or material. */}
      <pointLight
        position={lampLight}
        intensity={9}
        distance={7.5}
        decay={2}
        color={DESIGN_TOKENS.room.lamp}
      />
      {keyLight && (
        <spotLight
          position={[
            DESK_POSITION[0] - 0.2,
            DESK_TOP_HEIGHT + 1.85,
            DESK_POSITION[2] + 0.85,
          ]}
          angle={0.85}
          penumbra={0.55}
          intensity={24}
          distance={6.5}
          decay={2}
          color={DESIGN_TOKENS.room.deskLamp}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0006}
          shadow-camera-near={0.4}
          shadow-camera-far={7}
          ref={(light) => {
            if (!light) return;
            // A SpotLight aims at its target's WORLD matrix; the default target
            // is not in the scene graph, so position + refresh it directly.
            light.target.position.set(...keyLightTarget);
            light.target.updateMatrixWorld();
          }}
        />
      )}
      {quality === 'desktop' && (
        <pointLight
          position={[
            DESK_POSITION[0],
            DESK_TOP_HEIGHT + 0.6,
            DESK_POSITION[2] + 0.2,
          ]}
          intensity={1.6}
          distance={2.6}
          decay={2}
          color={DESIGN_TOKENS.room.monitorSpill}
        />
      )}

      <group
        name="room-shell"
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.shell}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      <group
        name="rug"
        position={RUG_POSITION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <mesh
          onUpdate={bakeStaticMatrix}
          geometry={furniture.rugGeometry}
          material={materials.rug}
          receiveShadow={keyLight}
          matrixAutoUpdate={false}
        />
      </group>

      <group
        name="desk"
        position={DESK_POSITION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.desk}
          materials={materials}
          shadows={keyLight}
          castShadow={keyLight}
        />
        {/* Narrative props (3a): mug in the lamp pool + the askew keyboard. */}
        <Parts
          parts={furniture.props.desk}
          materials={materials}
          shadows={keyLight}
        />
        {/* Instanced pencils leaning in the mug (3b clutter family). */}
        <ClutterFamily
          instances={furniture.clutter.pencils}
          geometry={furniture.clutterGeometries.pencil}
          material={materials.book}
          shadows={keyLight}
        />
        {/* Pickable monitor (commit 7): offset from the desk via the same
            constant the desktop-zoom camera derives its close-up from. */}
        <group
          position={MONITOR_DESK_OFFSET}
          onUpdate={bakeStaticMatrix}
          matrixAutoUpdate={false}
        >
          <DeskZone monitor={furniture.monitor} materials={materials} />
        </group>
        {/* Headphones draped on the bezel — sibling of the pickable monitor
            group so the prop never swallows the About-desktop pick. */}
        <group
          name="prop-headphones"
          position={MONITOR_DESK_OFFSET}
          onUpdate={bakeStaticMatrix}
          matrixAutoUpdate={false}
        >
          <Parts
            parts={furniture.props.monitor}
            materials={materials}
            shadows={keyLight}
          />
        </group>
        {/* Pickable game cases (commit 8): the same RoomParts, now wrapped as
            five individually clickable groups with an open/flip lid animation. */}
        <group
          position={[-0.15, DESK_TOP_HEIGHT + 0.035, 0.18]}
          onUpdate={bakeStaticMatrix}
          matrixAutoUpdate={false}
        >
          <ProjectCases cases={furniture.cases} materials={materials} />
        </group>
      </group>

      <group
        name="chair"
        position={CHAIR_POSITION}
        rotation={CHAIR_ROTATION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.chair}
          materials={materials}
          shadows={keyLight}
          castShadow={keyLight}
        />
      </group>

      <group
        name="pc-tower"
        position={TOWER_POSITION}
        rotation={TOWER_ROTATION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.tower}
          materials={materials}
          shadows={keyLight}
          castShadow={keyLight}
        />
        {/* Sticky notes live in tower-local space so they ride the yaw. */}
        <Parts
          parts={furniture.props.tower}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      {/* Floor-level narrative props (world space): paper stack + cable coil. */}
      <group
        name="floor-props"
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.props.floor}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      {/* Instanced tins/jars (3b clutter family, world space): shelf crown,
          tower top, window sill. */}
      <group
        name="clutter-tins"
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <ClutterFamily
          instances={furniture.clutter.tins}
          geometry={furniture.clutterGeometries.tin}
          material={materials.book}
          shadows={keyLight}
        />
      </group>

      <group
        name="bookshelf"
        position={SHELF_POSITION}
        rotation={SHELF_ROTATION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.bookshelf.parts}
          materials={materials}
          shadows={keyLight}
          castShadow={keyLight}
        />
        {/* Decorative filler volumes behind the 13 pickable post-books. */}
        <Books books={furniture.books} material={materials.book} />
        <LibraryZone cells={furniture.bookshelf.cells} materials={materials} />
        {/* The elixir flask on the crown, left of the projector. */}
        <Parts
          parts={furniture.props.shelf}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      <group
        name="floor-lamp"
        position={LAMP_POSITION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.lamp}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      <group
        name="window"
        position={WINDOW_POSITION}
        rotation={WINDOW_ROTATION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.windowParts}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      <group
        name="projector"
        position={PROJECTOR_POSITION}
        rotation={PROJECTOR_ROTATION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <Parts
          parts={furniture.projector}
          materials={materials}
          shadows={keyLight}
        />
        {/* Additive light cone from the lens toward the screen. */}
        <group
          position={[0, 0.075, -0.2]}
          onUpdate={bakeStaticMatrix}
          matrixAutoUpdate={false}
        >
          <mesh
            onUpdate={bakeStaticMatrix}
            geometry={furniture.beam.geometry}
            material={materials[furniture.beam.material]}
            matrixAutoUpdate={false}
          />
          {/* polish(e): GPU-animated motes in the beam. Zero extra frames,
              zero new lights/textures; frozen with reduced motion. Length and
              radius come from the cone above, not duplicated constants. */}
          <DustMotes
            freezeTime={freezeTime}
            beamLength={beam.length}
            beamRadius={beam.radius}
          />
        </group>
      </group>

      <group
        name="projector-screen"
        position={SCREEN_POSITION}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        {/* The static cloth is replaced by the live climate CanvasTexture
            (title + year + heatmap + "OPEN DETAILS"); verdict, statement and
            attributions stay only in the readable DOM panel. The room-owned
            projector body + light cone above stay put. */}
        <ClimateProjector
          screenGeometry={furniture.screenCloth}
          materials={materials}
          deferUntilZone={quality !== 'desktop'}
        />
        <mesh
          onUpdate={bakeStaticMatrix}
          geometry={furniture.screenBar}
          material={materials.woodDark}
          position={[0, 0.62, -0.01]}
          matrixAutoUpdate={false}
        />
      </group>

      {furniture.frames.map(({ position, parts }, index) => (
        <group
          key={`frame-${index}`}
          name={`frame-${index}`}
          position={position}
          onUpdate={bakeStaticMatrix}
          matrixAutoUpdate={false}
        >
          <Parts parts={parts} materials={materials} shadows={keyLight} />
        </group>
      ))}

      {/* CANONICAL diegetic nav (commit 4): framed, lettered and pickable. */}
      <group
        name="wall-plaque"
        position={PLAQUE.position}
        onUpdate={bakeStaticMatrix}
        matrixAutoUpdate={false}
      >
        <WallPlaque parts={furniture.plaque} materials={materials} />
      </group>
    </PainterlyPass>
  );
}

/**
 * Reports a genuinely rendering scene. A WebGL2 probe passing is NOT enough:
 * a context can be created and then fail to draw, leaving the DOM shell in a
 * 3D layout over an empty canvas (owner bug 2026-11-24). The first useFrame
 * tick proves at least one frame was issued; context loss revokes the signal.
 */
function SceneReadySignal({ onReady }: { onReady?: (ready: boolean) => void }) {
  const gl = useThree((state) => state.gl);
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    onReady?.(true);
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      fired.current = false;
      onReady?.(false);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [gl, onReady]);
  return null;
}

/* ---------------------------------------------------------------- canvas -- */

export interface RoomProps extends RoomSceneProps {
  className?: string;
  /**
   * Called after the FIRST DRAWN FRAME (not merely after Canvas mount) and
   * again with false on WebGL context loss. The shell gates its 3D-only layout
   * on this so a blank/failed Canvas always falls back to full-width 2D.
   */
  onReady?: (ready: boolean) => void;
  /**
   * 3c warm start: when false (2D mode after a first 3D visit) the desktop
   * Canvas stays mounted but renders ZERO frames (frameloop='never'), avoiding
   * the WebGL context/render-target rebuild stall on the next toggle.
   */
  active?: boolean;
}

/**
 * Full <Canvas> wrapper, lazy-loaded by the shell behind the device-tier gate
 * and the 2D/3D toggle. The 2D DOM shell remains authoritative and unaffected.
 *
 * Demand frameloop: the scene renders only when invalidated (camera flights,
 * resize, unpause); idle and hidden-tab modes cost zero frames. PainterlyPass
 * owns the draw at priority 1, CameraRig keeps invalidating until settled.
 */
export default function Room({
  seed,
  quality = 'desktop',
  textureFactory,
  className,
  onReady,
  active = true,
}: RoomProps): JSX.Element {
  const reducedMotion = usePrefersReducedMotion();
  const [hidden, setHidden] = useState(() =>
    typeof document === 'undefined' ? false : document.hidden,
  );

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // 3c P1: pixel ratio caps. The scene is deliberately soft/painterly, so
  // rendering 4× the pixels on a 2× phone buys nothing and costs ~3× fill.
  const dpr: number | [number, number] =
    quality === 'desktop' ? [1, 1.5] : quality === 'mobile' ? [1, 1.25] : 1;
  const mobile = quality !== 'desktop';

  return (
    <Canvas
      className={className}
      // 3c mobile: tighter far plane (room depth 7, fog ends at 16).
      camera={{
        position: [0, 1.65, 4.8],
        fov: 50,
        near: 0.1,
        far: mobile ? 24 : 60,
      }}
      dpr={dpr}
      // One 1024² shadow map for the warm desk key light — DESKTOP tier only;
      // mobile/low never allocate a shadow map (art-overhaul commit 3a).
      shadows={roomShadowSettings(quality).canvasShadows}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      // 3c P2: at most one raycast per frame during pointer movement.
      events={createCoalescedPointerEvents}
      frameloop={hidden || !active ? 'never' : 'demand'}
      aria-hidden="true"
    >
      <color attach="background" args={[DESIGN_TOKENS.room.background]} />
      <fog attach="fog" args={[DESIGN_TOKENS.room.background, 8, 16]} />
      <CameraRig
        instant={reducedMotion}
        paused={hidden || !active}
        tier={quality}
      />
      <SceneReadySignal onReady={onReady} />
      {/* Round-3 review: diegetic HOME control in every zone (fine pointer). */}
      <HomeControl />
      <RoomScene
        seed={seed}
        quality={quality}
        textureFactory={textureFactory}
        freezeTime={reducedMotion}
      />
    </Canvas>
  );
}
