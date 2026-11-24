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
import { useEffect, useMemo, useState, type JSX } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { POSTS, PROJECTS } from '../content/index';
import { usePrefersReducedMotion } from '../lib/a11y';
import { DESIGN_TOKENS } from '../styles/design-tokens';
import { CameraRig } from './CameraRig';
import { PainterlyPass } from './effects/PainterlyPass';
import { createCoalescedPointerEvents } from './perf-events';
import {
  CHAIR_POSITION,
  CHAIR_ROTATION,
  DESK_POSITION,
  FRAME_POSITIONS,
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
  createWindow,
  DESK_TOP_HEIGHT,
  disposeParts,
  LAMP_BULB_LOCAL,
  type BookInstance,
  type ClutterInstance,
  type RoomPart,
  type Vec3,
} from './art/geometry';
import {
  createRoomMaterials,
  disposeRoomMaterials,
  type RoomMaterials,
} from './art/materials';
import { LibraryZone } from './zones/Library';
import { DeskZone } from './zones/Desk';
import { ProjectCases } from './zones/ProjectCases';
import { ClimateProjector } from './zones/ClimateProjector';
import {
  createPlanTexture,
  createTexturePlans,
  disposeTextures,
  renderTexturePlans,
  type TextureFactory,
} from './art/textures';

/** Rendering tier; commit 5 derives this from the device-tier check. */
export type RoomQuality = 'desktop' | 'mobile' | 'low';

export interface RoomSceneProps {
  /** Seed for the whole room — same seed, byte-identical room. */
  seed?: string | number;
  quality?: RoomQuality;
  /** DI seam for headless tests (defaults to the browser canvas painter). */
  textureFactory?: TextureFactory;
}

/* Placement constants live in ./placement so the camera viewpoints can
 * derive from the same source without a circular Room ↔ CameraRig import. */

function Parts({
  parts,
  materials,
  shadows = false,
}: {
  parts: readonly RoomPart[];
  materials: RoomMaterials;
  /** Desktop tier only: meshes cast/receive the one shadow-map key light. */
  shadows?: boolean;
}): JSX.Element {
  return (
    <>
      {parts.map((part) => (
        <mesh
          key={part.id}
          geometry={part.geometry}
          material={materials[part.material]}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
          castShadow={shadows}
          receiveShadow={shadows}
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
  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);
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
}: RoomSceneProps): JSX.Element {
  const furniture = useMemo(() => {
    const shell = createRoomShell();
    const desk = createDesk(seed);
    const monitor = createMonitor(seed);
    const tower = createPcTower(seed);
    const bookshelf = createBookshelf(seed);
    const books = createBookInstances(seed, bookshelf.cells, {
      // Feature the shelf cells of ★ posts (rough mapping; commit 6 refines).
      featured: [0, 3, 6],
      // 3c mobile: half the filler volumes, same shelf silhouette/anchor posts.
      ...(quality === 'desktop' ? {} : { maxBooks: 80 }),
    });
    const lamp = createLamp(seed);
    const projector = createProjector(seed);
    const beam = createLightCone(3.85, 0.62);
    const windowParts = createWindow();
    const chair = createChair(seed);
    const props = createNarrativeProps(seed);
    const clutter = createClutterInstances(seed);
    // Unit geometries for the instanced clutter families (commit 3b):
    // hexagonal pencils + slightly tapered tins; instances carry scale/euler.
    const clutterGeometries = {
      pencil: new THREE.CylinderGeometry(1, 1, 1, 6),
      tin: new THREE.CylinderGeometry(1, 0.92, 1, 10),
    };
    const frames = FRAME_POSITIONS.map(([pos, variant]) => ({
      position: pos,
      parts: createFramedSilhouette(seed, variant),
    }));
    const rugGeometry = createRugGeometry();
    const cases = createGameCases(seed, PROJECTS.length);
    const screenCloth = new THREE.PlaneGeometry(1.9, 1.07);
    const screenBar = new THREE.BoxGeometry(2.02, 0.05, 0.04);
    return {
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
    };
  }, [seed, quality]);

  const textures = useMemo(() => {
    const plans = createTexturePlans(seed, {
      books: POSTS.map((post) => ({
        title: post.title,
        featured: post.featured,
      })),
      cases: PROJECTS.map((project) => project.title),
    });
    return renderTexturePlans(plans, textureFactory);
  }, [seed, textureFactory]);

  const materials = useMemo(() => createRoomMaterials(textures), [textures]);

  // Full teardown on unmount (or seed/factory change): geometries, textures,
  // materials. The lazy chunk may mount/unmount as the visitor toggles modes.
  useEffect(() => {
    return () => {
      disposeParts([
        ...furniture.shell,
        ...furniture.desk,
        ...furniture.monitor,
        ...furniture.tower,
        ...furniture.bookshelf.parts,
        ...furniture.lamp,
        ...furniture.projector,
        furniture.beam,
        ...furniture.windowParts,
        ...furniture.chair,
        ...furniture.props.desk,
        ...furniture.props.monitor,
        ...furniture.props.floor,
        ...furniture.props.tower,
        ...furniture.props.shelf,
        ...furniture.frames.flatMap((frame) => frame.parts),
        ...furniture.cases,
      ]);
      furniture.rugGeometry.dispose();
      furniture.screenCloth.dispose();
      furniture.screenBar.dispose();
      furniture.clutterGeometries.pencil.dispose();
      furniture.clutterGeometries.tin.dispose();
      disposeTextures(textures);
      disposeRoomMaterials(materials);
    };
  }, [furniture, textures, materials]);

  const lampLight: Vec3 = [
    LAMP_POSITION[0] + LAMP_BULB_LOCAL[0],
    LAMP_BULB_LOCAL[1],
    LAMP_POSITION[2] + LAMP_BULB_LOCAL[2],
  ];

  // Chiaroscuro key light (commit 3a): ONE warm shadow-casting spot over the
  // desk replaces the old shadowless desk-lamp point light, so the total light
  // count stays ≤5. Desktop tier only — mobile gets the same warm pool without
  // a shadow map (castShadow=false, Canvas shadows disabled).
  const keyLight = quality === 'desktop';
  const keyLightTarget: Vec3 = [
    DESK_POSITION[0] - 0.45,
    DESK_TOP_HEIGHT,
    DESK_POSITION[2] + 0.05,
  ];

  return (
    <PainterlyPass enabled={quality === 'desktop'}>
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

      <group name="room-shell">
        <Parts
          parts={furniture.shell}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      <group name="rug" position={RUG_POSITION}>
        <mesh
          geometry={furniture.rugGeometry}
          material={materials.rug}
          receiveShadow={keyLight}
        />
      </group>

      <group name="desk" position={DESK_POSITION}>
        <Parts
          parts={furniture.desk}
          materials={materials}
          shadows={keyLight}
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
        <group position={MONITOR_DESK_OFFSET}>
          <DeskZone monitor={furniture.monitor} materials={materials} />
        </group>
        {/* Headphones draped on the bezel — sibling of the pickable monitor
            group so the prop never swallows the About-desktop pick. */}
        <group name="prop-headphones" position={MONITOR_DESK_OFFSET}>
          <Parts
            parts={furniture.props.monitor}
            materials={materials}
            shadows={keyLight}
          />
        </group>
        {/* Pickable game cases (commit 8): the same RoomParts, now wrapped as
            five individually clickable groups with an open/flip lid animation. */}
        <group position={[-0.15, DESK_TOP_HEIGHT + 0.035, 0.18]}>
          <ProjectCases cases={furniture.cases} materials={materials} />
        </group>
      </group>

      <group name="chair" position={CHAIR_POSITION} rotation={CHAIR_ROTATION}>
        <Parts
          parts={furniture.chair}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      <group
        name="pc-tower"
        position={TOWER_POSITION}
        rotation={TOWER_ROTATION}
      >
        <Parts
          parts={furniture.tower}
          materials={materials}
          shadows={keyLight}
        />
        {/* Sticky notes live in tower-local space so they ride the yaw. */}
        <Parts
          parts={furniture.props.tower}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      {/* Floor-level narrative props (world space): paper stack + cable coil. */}
      <group name="floor-props">
        <Parts
          parts={furniture.props.floor}
          materials={materials}
          shadows={keyLight}
        />
      </group>

      {/* Instanced tins/jars (3b clutter family, world space): shelf crown,
          tower top, window sill. */}
      <group name="clutter-tins">
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
      >
        <Parts
          parts={furniture.bookshelf.parts}
          materials={materials}
          shadows={keyLight}
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

      <group name="floor-lamp" position={LAMP_POSITION}>
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
      >
        <Parts
          parts={furniture.projector}
          materials={materials}
          shadows={keyLight}
        />
        {/* Additive light cone from the lens toward the screen. */}
        <group position={[0, 0.075, -0.2]}>
          <mesh
            geometry={furniture.beam.geometry}
            material={materials[furniture.beam.material]}
          />
        </group>
      </group>

      <group name="projector-screen" position={SCREEN_POSITION}>
        {/* Commit 9: the static cloth is replaced by the live climate
            CanvasTexture (heatmap + today widget + attribution) with a year
            dial; the room-owned projector body + light cone above stay put. */}
        <ClimateProjector
          screenGeometry={furniture.screenCloth}
          materials={materials}
          deferUntilZone={quality !== 'desktop'}
        />
        <mesh
          geometry={furniture.screenBar}
          material={materials.woodDark}
          position={[0, 0.62, -0.01]}
        />
      </group>

      {furniture.frames.map(({ position, parts }, index) => (
        <group
          key={`frame-${index}`}
          name={`frame-${index}`}
          position={position}
        >
          <Parts parts={parts} materials={materials} shadows={keyLight} />
        </group>
      ))}
    </PainterlyPass>
  );
}

/* ---------------------------------------------------------------- canvas -- */

export interface RoomProps extends RoomSceneProps {
  className?: string;
  /** Called once the lazy chunk has mounted the Canvas (drives the fade-in). */
  onReady?: () => void;
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

  useEffect(() => {
    onReady?.();
  }, [onReady]);

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
      shadows={quality === 'desktop'}
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
      <RoomScene
        seed={seed}
        quality={quality}
        textureFactory={textureFactory}
      />
    </Canvas>
  );
}
