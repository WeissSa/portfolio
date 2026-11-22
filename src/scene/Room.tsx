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
import {
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
  WINDOW_POSITION,
  WINDOW_ROTATION,
} from './placement';
import {
  createBookInstances,
  createBookshelf,
  createDesk,
  createFramedSilhouette,
  createGameCases,
  createLamp,
  createLightCone,
  createMonitor,
  createPcTower,
  createProjector,
  createRoomShell,
  createRugGeometry,
  createWindow,
  DESK_TOP_HEIGHT,
  disposeParts,
  LAMP_BULB_LOCAL,
  type BookInstance,
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
}: {
  parts: readonly RoomPart[];
  materials: RoomMaterials;
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
      }}
      args={[geometry, material, books.length]}
      frustumCulled={false}
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
    });
    const lamp = createLamp(seed);
    const projector = createProjector(seed);
    const beam = createLightCone(3.85, 0.62);
    const windowParts = createWindow();
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
      frames,
      rugGeometry,
      cases,
      screenCloth,
      screenBar,
    };
  }, [seed]);

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
        ...furniture.frames.flatMap((frame) => frame.parts),
        ...furniture.cases,
      ]);
      furniture.rugGeometry.dispose();
      furniture.screenCloth.dispose();
      furniture.screenBar.dispose();
      disposeTextures(textures);
      disposeRoomMaterials(materials);
    };
  }, [furniture, textures, materials]);

  const lampLight: Vec3 = [
    LAMP_POSITION[0] + LAMP_BULB_LOCAL[0],
    LAMP_BULB_LOCAL[1],
    LAMP_POSITION[2] + LAMP_BULB_LOCAL[2],
  ];
  const deskLampLight: Vec3 = [
    DESK_POSITION[0] - 0.6,
    DESK_TOP_HEIGHT + 0.55,
    DESK_POSITION[2] + 0.1,
  ];

  return (
    <PainterlyPass enabled={quality === 'desktop'}>
      {/* Base ambience: cool night fill + moonlight from the window. */}
      <ambientLight intensity={0.5} color={DESIGN_TOKENS.room.ambient} />
      <directionalLight
        position={[5.5, 3.2, 1.2]}
        intensity={0.45}
        color={DESIGN_TOKENS.room.moonlight}
      />
      {/* Warm lamp pools (§3.5): floor lamp + desk glow + monitor spill. */}
      <pointLight
        position={lampLight}
        intensity={9}
        distance={7.5}
        decay={2}
        color={DESIGN_TOKENS.room.lamp}
      />
      <pointLight
        position={deskLampLight}
        intensity={4}
        distance={4}
        decay={2}
        color={DESIGN_TOKENS.room.deskLamp}
      />
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

      <group name="room-shell">
        <Parts parts={furniture.shell} materials={materials} />
      </group>

      <group name="rug" position={RUG_POSITION}>
        <mesh geometry={furniture.rugGeometry} material={materials.rug} />
      </group>

      <group name="desk" position={DESK_POSITION}>
        <Parts parts={furniture.desk} materials={materials} />
        {/* Pickable monitor (commit 7): offset from the desk via the same
            constant the desktop-zoom camera derives its close-up from. */}
        <group position={MONITOR_DESK_OFFSET}>
          <DeskZone monitor={furniture.monitor} materials={materials} />
        </group>
        {/* Pickable game cases (commit 8): the same RoomParts, now wrapped as
            five individually clickable groups with an open/flip lid animation. */}
        <group position={[-0.15, DESK_TOP_HEIGHT + 0.035, 0.18]}>
          <ProjectCases cases={furniture.cases} materials={materials} />
        </group>
      </group>

      <group name="pc-tower" position={[3.3, 0, -2.9]} rotation={[0, -0.35, 0]}>
        <Parts parts={furniture.tower} materials={materials} />
      </group>

      <group
        name="bookshelf"
        position={SHELF_POSITION}
        rotation={SHELF_ROTATION}
      >
        <Parts parts={furniture.bookshelf.parts} materials={materials} />
        {/* Decorative filler volumes behind the 13 pickable post-books. */}
        <Books books={furniture.books} material={materials.book} />
        <LibraryZone cells={furniture.bookshelf.cells} materials={materials} />
      </group>

      <group name="floor-lamp" position={LAMP_POSITION}>
        <Parts parts={furniture.lamp} materials={materials} />
      </group>

      <group
        name="window"
        position={WINDOW_POSITION}
        rotation={WINDOW_ROTATION}
      >
        <Parts parts={furniture.windowParts} materials={materials} />
      </group>

      <group
        name="projector"
        position={PROJECTOR_POSITION}
        rotation={PROJECTOR_ROTATION}
      >
        <Parts parts={furniture.projector} materials={materials} />
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
          <Parts parts={parts} materials={materials} />
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

  const dpr: number | [number, number] =
    quality === 'desktop' ? [1, 2] : quality === 'mobile' ? [1, 1.5] : 1;

  return (
    <Canvas
      className={className}
      camera={{ position: [0, 1.65, 4.8], fov: 50, near: 0.1, far: 60 }}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      frameloop={hidden ? 'never' : 'demand'}
      aria-hidden="true"
    >
      <color attach="background" args={[DESIGN_TOKENS.room.background]} />
      <fog attach="fog" args={[DESIGN_TOKENS.room.background, 8, 16]} />
      <CameraRig instant={reducedMotion} paused={hidden} tier={quality} />
      <RoomScene
        seed={seed}
        quality={quality}
        textureFactory={textureFactory}
      />
    </Canvas>
  );
}
