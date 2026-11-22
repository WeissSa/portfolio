/**
 * The room shell (REWORK_PLAN §3.5, ladder commit 4): a Dishonored-painterly
 * programmer/gamer's den composed ENTIRELY from the procedural art pipeline —
 * seeded canvas textures, low-poly primitive geometry, warm lamp light pools,
 * moonlit night window, and (desktop tier only) the grain+vignette+grade post
 * pass. No model or texture downloads.
 *
 * Commit 4 scope: the shell renders and is exportable; camera rig, zone
 * navigation, lazy streaming and the 2D/3D toggle land in commit 5, which
 * will lazy-load this module (keep the default export cheap to suspend on).
 *
 * Headless testing: texture creation is dependency-injected (textureFactory)
 * so unit tests can render <RoomScene/> with @react-three/test-renderer
 * without a 2D canvas. Visual verification needs a real browser.
 */
import { useEffect, useMemo, type JSX } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { POSTS, PROJECTS } from '../content/index';
import { PainterlyPass } from './effects/PainterlyPass';
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
  ROOM_DIMS,
  type BookInstance,
  type RoomPart,
  type Vec3,
} from './art/geometry';
import {
  createRoomMaterials,
  disposeRoomMaterials,
  type RoomMaterials,
} from './art/materials';
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

/* ------------------------------------------------------------- placement -- */

const DESK_POSITION: Vec3 = [1.9, 0, -2.55];
const SHELF_POSITION: Vec3 = [-3.55, 0, -0.4];
const SHELF_ROTATION: Vec3 = [0, Math.PI / 2, 0];
const LAMP_POSITION: Vec3 = [3.15, 0, 1.7];
const RUG_POSITION: Vec3 = [-0.4, 0.012, 0.7];
const WINDOW_POSITION: Vec3 = [ROOM_DIMS.width / 2 - 0.02, 1.75, -0.5];
const WINDOW_ROTATION: Vec3 = [0, -Math.PI / 2, 0];
/** The projector perches on the bookshelf crown and throws at the screen. */
const PROJECTOR_POSITION: Vec3 = [-3.5, 2.3, -0.4];
const PROJECTOR_ROTATION: Vec3 = [-0.176, -0.624, 0];
const SCREEN_POSITION: Vec3 = [-1.35, 1.7, -ROOM_DIMS.depth / 2 + 0.03];
const FRAME_POSITIONS: [Vec3, number][] = [
  [[-0.1, 2.0, -ROOM_DIMS.depth / 2 + 0.03], 0],
  [[0.65, 1.85, -ROOM_DIMS.depth / 2 + 0.03], 1],
  [[-3.2, 1.9, -ROOM_DIMS.depth / 2 + 0.03], 2],
];

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
      <ambientLight intensity={0.5} color="#93a7bd" />
      <directionalLight
        position={[5.5, 3.2, 1.2]}
        intensity={0.45}
        color="#7d99c9"
      />
      {/* Warm lamp pools (§3.5): floor lamp + desk glow + monitor spill. */}
      <pointLight
        position={lampLight}
        intensity={9}
        distance={7.5}
        decay={2}
        color="#ffb45e"
      />
      <pointLight
        position={deskLampLight}
        intensity={4}
        distance={4}
        decay={2}
        color="#ffc978"
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
        color="#9fd8ff"
      />

      <group name="room-shell">
        <Parts parts={furniture.shell} materials={materials} />
      </group>

      <group name="rug" position={RUG_POSITION}>
        <mesh geometry={furniture.rugGeometry} material={materials.rug} />
      </group>

      <group name="desk" position={DESK_POSITION}>
        <Parts parts={furniture.desk} materials={materials} />
        <group position={[-0.35, DESK_TOP_HEIGHT + 0.035, -0.18]}>
          <Parts parts={furniture.monitor} materials={materials} />
        </group>
        <group position={[-0.15, DESK_TOP_HEIGHT + 0.035, 0.18]}>
          <Parts parts={furniture.cases} materials={materials} />
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
        <Books books={furniture.books} material={materials.book} />
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
        <mesh
          geometry={furniture.screenCloth}
          material={materials.screenFabric}
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
}

/**
 * Full <Canvas> wrapper — exported for commit 5 to lazy-load behind the
 * device-tier gate and the 2D/3D toggle. Nothing imports it yet; the 2D shell
 * remains the default and is unaffected by this module.
 */
export default function Room({
  seed,
  quality = 'desktop',
  textureFactory,
  className,
}: RoomProps): JSX.Element {
  return (
    <Canvas
      className={className}
      camera={{ position: [0, 1.65, 4.8], fov: 50, near: 0.1, far: 60 }}
      dpr={quality === 'desktop' ? [1, 2] : [1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <color attach="background" args={['#0a0c10']} />
      <fog attach="fog" args={['#0a0c10', 8, 16]} />
      <RoomScene
        seed={seed}
        quality={quality}
        textureFactory={textureFactory}
      />
    </Canvas>
  );
}
