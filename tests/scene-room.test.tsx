/**
 * Room shell smoke tests (ladder commit 4). @react-three/test-renderer
 * stubs WebGL2, so <RoomScene/> can be mounted headlessly with an injected
 * texture factory (jsdom has no 2D canvas). PIXEL-LEVEL visual verification
 * still requires a real browser — deferred to the milestone screenshot review
 * (REWORK_PLAN §6).
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { RoomScene } from '../src/scene/Room';
import {
  createRoomMaterials,
  disposeRoomMaterials,
} from '../src/scene/art/materials';
import {
  choosePainterlyTargetType,
  createPainterlyUniforms,
  PAINTERLY_DEFAULTS,
  PAINTERLY_FRAGMENT_SHADER,
  PAINTERLY_VERTEX_SHADER,
} from '../src/scene/effects/PainterlyPass';
import type { TextureFactory } from '../src/scene/art/textures';
import {
  CHAIR_POSITION,
  CHAIR_ROTATION,
  DESK_POSITION,
  FRAME_POSITIONS,
  LAMP_POSITION,
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
} from '../src/scene/placement';
import { PLAQUE } from '../src/scene/diegetic';
import { PROJECTS, postId } from '../src/content/index';
import { usePortfolioStore } from '../src/state/store';
import { DESK_TOP_HEIGHT, type Vec3 } from '../src/scene/art/geometry';

/** Headless stand-in: no 2D canvas in jsdom, textures never get sampled. */
const stubTextureFactory: TextureFactory = () => new THREE.Texture();

/** Compose the matrix a frozen node must carry for its authored TRS. */
function authoredMatrix(
  position?: Vec3,
  rotation?: Vec3,
  scale?: Vec3,
): THREE.Matrix4 {
  const p = position ?? [0, 0, 0];
  const r = rotation ?? [0, 0, 0];
  const s = scale ?? [1, 1, 1];
  return new THREE.Matrix4().compose(
    new THREE.Vector3(p[0], p[1], p[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])),
    new THREE.Vector3(s[0], s[1], s[2]),
  );
}

/** Element-wise comparison so a stale (unre-baked) matrix cannot slip through. */
function expectMatrixClose(
  actual: THREE.Matrix4,
  expected: THREE.Matrix4,
  precision = 6,
): void {
  actual.elements.forEach((value, i) => {
    expect(value).toBeCloseTo(expected.elements[i]!, precision);
  });
}

describe('room materials', () => {
  it('creates every material key without textures (graceful degradation)', () => {
    const materials = createRoomMaterials({});
    // 20 original keys + the commit-4 plaque face / purple inlay materials.
    expect(Object.keys(materials).length).toBe(22);
    for (const material of Object.values(materials)) {
      expect(material).toBeInstanceOf(THREE.Material);
    }
    expect(() => disposeRoomMaterials(materials)).not.toThrow();
  });

  it('gives the floor vertex-color AO its own material (commit 3b)', () => {
    const materials = createRoomMaterials({});
    const floor = materials.floor as THREE.MeshStandardMaterial;
    expect(floor.vertexColors).toBe(true);
    // The shared wood material must NOT opt into vertex colors: most wood
    // geometry carries no color attribute and would render black.
    expect((materials.wood as THREE.MeshStandardMaterial).vertexColors).toBe(
      false,
    );
    disposeRoomMaterials(materials);
  });

  it('wires texture maps when provided', () => {
    const wood = new THREE.Texture();
    const materials = createRoomMaterials({ wood });
    const woodMaterial = materials.wood as THREE.MeshStandardMaterial;
    expect(woodMaterial.map).toBe(wood);
    disposeRoomMaterials(materials);
    wood.dispose();
  });

  it('tracks and disposes the withRepeat texture clones (review fix B)', () => {
    const wood = new THREE.Texture();
    const plaster = new THREE.Texture();
    const materials = createRoomMaterials({ wood, plaster });

    // Non-enumerable: key count and Object.values() loop stay unchanged.
    expect(Object.keys(materials)).toHaveLength(22);
    const clones = materials.textureClones ?? [];
    expect(clones).toHaveLength(2);
    expect((materials.woodDark as THREE.MeshStandardMaterial).map).toBe(
      clones[0],
    );
    expect((materials.plaster as THREE.MeshStandardMaterial).map).toBe(
      clones[1],
    );

    const disposals = clones.map((clone) => vi.spyOn(clone, 'dispose'));
    disposeRoomMaterials(materials);
    for (const spy of disposals) expect(spy).toHaveBeenCalledTimes(1);

    wood.dispose();
    plaster.dispose();
  });
});

describe('painterly post pass (§3.5)', () => {
  it('uniform factory produces stable defaults and honours overrides', () => {
    const defaults = createPainterlyUniforms();
    expect(defaults.uGrain.value).toBe(PAINTERLY_DEFAULTS.grain);
    expect(defaults.uVignette.value).toBe(PAINTERLY_DEFAULTS.vignette);
    expect(defaults.uGrade.value).toBe(PAINTERLY_DEFAULTS.grade);
    expect(defaults.uEdge.value).toBe(PAINTERLY_DEFAULTS.edge);
    expect(defaults.uStroke.value).toBe(PAINTERLY_DEFAULTS.stroke);
    expect(defaults.uTime.value).toBe(0);
    const custom = createPainterlyUniforms({ grain: 0.1 });
    expect(custom.uGrain.value).toBe(0.1);
  });

  it('ships an 8-bit target, with half-float strictly opt-in and gated', () => {
    // 3c P4: byte is the default even on float-capable contexts (grain/stroke
    // dither away banding); half-float needs BOTH the opt-in and the extension.
    expect(choosePainterlyTargetType(true)).toBe(THREE.UnsignedByteType);
    expect(choosePainterlyTargetType(false)).toBe(THREE.UnsignedByteType);
    expect(choosePainterlyTargetType(true, true)).toBe(THREE.HalfFloatType);
    expect(choosePainterlyTargetType(false, true)).toBe(THREE.UnsignedByteType);
  });

  it('shader sources carry the grain/vignette/grade pass', () => {
    expect(PAINTERLY_VERTEX_SHADER).toContain('gl_Position');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('tDiffuse');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('uVignette');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('uGrain');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('uGrade');
    // Commit 3b grade upgrades: edge darkening + posterized paint-stroke feel.
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('uEdge');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('uStroke');
    // The owner's purple shadow tint (r<b, g lowest) replaces the teal lean.
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('vec3 shadowTint = vec3(');
  });

  it('encodes the final linear color to output space (review fix A)', () => {
    // The render target stays linear; the ShaderMaterial must convert once at
    // the end. three injects linearToOutputTexel() into non-raw ShaderMaterials
    // via colorspace_pars_fragment, so the include resolves at compile time.
    expect(PAINTERLY_FRAGMENT_SHADER).toContain(
      '#include <colorspace_fragment>',
    );
    expect(THREE.ShaderChunk.colorspace_fragment).toContain(
      'linearToOutputTexel',
    );
    expect(THREE.ShaderChunk.colorspace_pars_fragment).toContain(
      'sRGBTransferOETF',
    );
  });
});

describe('RoomScene headless render', () => {
  it('mounts the full room (mobile tier, post pass disabled)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RoomScene
        seed="smoke"
        quality="mobile"
        textureFactory={stubTextureFactory}
      />,
      { frameloop: 'never' },
    );
    const meshes = renderer.scene.findAll((node) => node.type === 'Mesh');
    // Shell + desk + monitor + tower + shelf + lamp + projector + window +
    // frames + cases + screen + chair + narrative props: comfortably more
    // than 40 meshes.
    expect(meshes.length).toBeGreaterThan(40);
    // Upper bound (art-overhaul commit 3a): draw-call discipline — the whole
    // authored room must stay well under 200 meshes.
    expect(meshes.length).toBeLessThan(200);

    // Light budget: ambient + moon + lamp point + monitor spill + the warm
    // key spot = 5, never more. Mobile carries NO shadow-casting light.
    const lights = renderer.scene.findAll((node) =>
      Boolean((node.instance as THREE.Light | undefined)?.isLight),
    );
    expect(lights.length).toBeLessThanOrEqual(5);
    expect(lights.length).toBeGreaterThan(0);
    for (const light of lights) {
      expect((light.instance as THREE.Light).castShadow).toBe(false);
    }

    // THREE.InstancedMesh keeps .type === 'Mesh'; detect via the flag. Four
    // (commit 3b): decorative filler books, the 13 pickable Library
    // post-books, plus the two curated clutter families (pencils, tins).
    const instanced = renderer.scene.findAll((node) =>
      Boolean(
        (node.instance as THREE.InstancedMesh | undefined)?.isInstancedMesh,
      ),
    );
    expect(instanced).toHaveLength(4);
    const heroMesh = instanced.find(
      (node) =>
        (node.instance as THREE.InstancedMesh | undefined)?.count === 13,
    );
    expect(heroMesh).toBeDefined();
    const counts = instanced
      .map((node) => (node.instance as THREE.InstancedMesh).count)
      .sort((a, b) => a - b);
    // filler books (>0), pencils (3), tins (4), hero books (13)
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts).toContain(3);
    expect(counts).toContain(4);

    const groups = renderer.scene.findAll(
      (node) => node.type === 'Group' && typeof node.props.name === 'string',
    );
    const names = groups.map((node) => node.props.name as string);
    for (const expected of [
      'room-shell',
      'rug',
      'desk',
      'chair',
      'pc-tower',
      'floor-props',
      'clutter-tins',
      'bookshelf',
      'library-books',
      'floor-lamp',
      'window',
      'projector',
      'projector-screen',
    ]) {
      expect(names).toContain(expected);
    }

    await renderer.unmount();
  });

  it('mounts with the desktop painterly pass enabled', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RoomScene
        seed="smoke"
        quality="desktop"
        textureFactory={stubTextureFactory}
      />,
      { frameloop: 'never' },
    );
    const meshes = renderer.scene.findAll((node) => node.type === 'Mesh');
    expect(meshes.length).toBeGreaterThan(40);
    expect(meshes.length).toBeLessThan(200);

    // Chiaroscuro contract (commit 3a): EXACTLY ONE shadow-casting light —
    // the warm desk key spot — with a 1024² shadow map, and ≤5 lights total.
    const lights = renderer.scene
      .findAll((node) => Boolean((node.instance as THREE.Light)?.isLight))
      .map((node) => node.instance as THREE.Light);
    expect(lights.length).toBeLessThanOrEqual(5);
    const shadowCasters = lights.filter((light) => light.castShadow);
    expect(shadowCasters).toHaveLength(1);
    expect(shadowCasters[0]?.type).toBe('SpotLight');
    const keySpot = shadowCasters[0] as THREE.SpotLight;
    expect(keySpot.shadow.mapSize.width).toBe(1024);
    expect(keySpot.shadow.mapSize.height).toBe(1024);
    // Review assertion (3a/3b): a SpotLight aims at its target's WORLD pose;
    // a stale/default target silently lights the wrong corner of the room.
    expect(keySpot.target.position.x).toBeCloseTo(DESK_POSITION[0] - 0.45);
    expect(keySpot.target.position.y).toBeCloseTo(DESK_TOP_HEIGHT);
    expect(keySpot.target.position.z).toBeCloseTo(DESK_POSITION[2] + 0.05);

    // Commit 4: the canonical plaque ships inside the same headless tree.
    const plaque = renderer.scene.findAll(
      (node) => node.type === 'Group' && node.props.name === 'wall-plaque',
    );
    expect(plaque).toHaveLength(1);

    await renderer.unmount();
  });

  it('freezes authored-static transforms without moving the furniture', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RoomScene
        seed="static"
        quality="mobile"
        textureFactory={stubTextureFactory}
      />,
      { frameloop: 'never' },
    );

    // The headless renderer never draws a frame, so force one world-matrix
    // pass (the real WebGLRenderer does this on every render).
    renderer.scene.instance.updateMatrixWorld(true);

    // A Parts mesh under the untransformed room-shell group: its world
    // translation must equal the authored RoomPart position exactly.
    const shell = renderer.scene.find(
      (node) => node.type === 'Group' && node.props.name === 'room-shell',
    );
    const sample = shell.children.find((node) => node.type === 'Mesh');
    expect(sample).toBeDefined();
    const mesh = sample!.instance as THREE.Mesh;
    expect(mesh.matrixAutoUpdate).toBe(false);
    const authored = sample!.props.position as [number, number, number];
    const world = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    expect(world.x).toBeCloseTo(authored[0]);
    expect(world.y).toBeCloseTo(authored[1]);
    expect(world.z).toBeCloseTo(authored[2]);

    // The ProjectCases lid groups animate in useFrame and MUST stay live.
    const caseGroups = renderer.scene.findAll(
      (node) =>
        node.type === 'Group' &&
        typeof node.props.name === 'string' &&
        (node.props.name as string).startsWith('game-case-'),
    );
    expect(caseGroups.length).toBeGreaterThan(0);
    const lid = caseGroups[0]!.children.find(
      (node) => node.type === 'Group' && node.props.name === undefined,
    );
    expect(lid).toBeDefined();
    expect((lid!.instance as THREE.Group).matrixAutoUpdate).toBe(true);

    await renderer.unmount();
  });

  it('freezes rotated/translated top-level groups with matrices matching their authored TRS', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RoomScene
        seed="frozen-groups"
        quality="mobile"
        textureFactory={stubTextureFactory}
      />,
      { frameloop: 'never' },
    );
    // The headless renderer never draws a frame; one explicit world-matrix
    // pass stands in for WebGLRenderer's per-frame updateMatrixWorld call.
    renderer.scene.instance.updateMatrixWorld(true);

    const authored: [string, Vec3, Vec3][] = [
      ['desk', DESK_POSITION, [0, 0, 0]],
      ['chair', CHAIR_POSITION, CHAIR_ROTATION],
      ['pc-tower', TOWER_POSITION, TOWER_ROTATION],
      ['bookshelf', SHELF_POSITION, SHELF_ROTATION],
      ['window', WINDOW_POSITION, WINDOW_ROTATION],
      ['projector', PROJECTOR_POSITION, PROJECTOR_ROTATION],
      ['projector-screen', SCREEN_POSITION, [0, 0, 0]],
      ['wall-plaque', PLAQUE.position, [0, 0, 0]],
      ...FRAME_POSITIONS.map(
        ([pos], i) => [`frame-${i}`, pos, [0, 0, 0]] as [string, Vec3, Vec3],
      ),
    ];

    for (const [name, position, rotation] of authored) {
      const node = renderer.scene.find(
        (n) => n.type === 'Group' && n.props.name === name,
      );
      expect(node, `missing group ${name}`).toBeDefined();
      const object = node!.instance as THREE.Group;

      // Frozen at steady state: no per-frame auto-update.
      expect(object.matrixAutoUpdate, `${name} matrixAutoUpdate`).toBe(false);

      // Mobile tier renders groups straight under the identity scene, so the
      // world matrix IS the baked authored TRS. Translation must be exact.
      const world = new THREE.Vector3().setFromMatrixPosition(
        object.matrixWorld,
      );
      expect(world.x, `${name} world x`).toBeCloseTo(position[0], 6);
      expect(world.y, `${name} world y`).toBeCloseTo(position[1], 6);
      expect(world.z, `${name} world z`).toBeCloseTo(position[2], 6);

      // Rotation: decompose the frozen world matrix and compare as a
      // quaternion (handles the >π chair yaw and -π/2 window/shelf yaws).
      const worldQuat = new THREE.Quaternion();
      object.matrixWorld.decompose(
        new THREE.Vector3(),
        worldQuat,
        new THREE.Vector3(),
      );
      const expectedQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation[0], rotation[1], rotation[2]),
      );
      expect(
        worldQuat.angleTo(expectedQuat),
        `${name} world rotation`,
      ).toBeLessThan(1e-5);
    }

    await renderer.unmount();
  });

  it('re-bakes frozen matrices when the seed changes (keyed meshes are reused)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RoomScene
        seed="seed-a"
        quality="mobile"
        textureFactory={stubTextureFactory}
      />,
      { frameloop: 'never' },
    );

    // A chair leg carries a seeded rotation wobble, so a new seed lands a new
    // authored transform on the SAME keyed mesh instance.
    const legNode = () => {
      const chair = renderer.scene.find(
        (n) => n.type === 'Group' && n.props.name === 'chair',
      )!;
      return chair.children.find(
        (n) => n.type === 'Mesh' && Array.isArray(n.props.rotation),
      )!;
    };
    const before = legNode();
    const beforeRotation = before.props.rotation as Vec3;
    const beforeMatrix = (before.instance as THREE.Mesh).matrix.clone();

    await renderer.update(
      <RoomScene
        seed="seed-b"
        quality="mobile"
        textureFactory={stubTextureFactory}
      />,
    );
    renderer.scene.instance.updateMatrixWorld(true);

    const after = legNode();
    const afterRotation = after.props.rotation as Vec3;
    const mesh = after.instance as THREE.Mesh;

    // The seed genuinely changed the authored transform (otherwise this
    // would not exercise the stale-matrix bug).
    expect(afterRotation).not.toEqual(beforeRotation);
    expect(mesh.matrixAutoUpdate).toBe(false);

    // The frozen matrix must now match the NEW props — a mount-only ref would
    // leave it at `beforeMatrix`, failing this precise comparison.
    expectMatrixClose(
      mesh.matrix,
      authoredMatrix(
        after.props.position as Vec3 | undefined,
        after.props.rotation as Vec3 | undefined,
        after.props.scale as Vec3 | undefined,
      ),
    );
    expect(mesh.matrix.elements).not.toEqual(beforeMatrix.elements);

    await renderer.unmount();
  });

  it('still raycasts a frozen mesh (frozen matrix keeps geometry pickable)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RoomScene
        seed="pick"
        quality="mobile"
        textureFactory={stubTextureFactory}
      />,
      { frameloop: 'never' },
    );
    renderer.scene.instance.updateMatrixWorld(true);

    // The room floor is a frozen, -π/2-X-rotated plane at world origin.
    const shell = renderer.scene.find(
      (n) => n.type === 'Group' && n.props.name === 'room-shell',
    )!;
    const floor = shell.children.find((n) => n.type === 'Mesh')!;
    const floorMesh = floor.instance as THREE.Mesh;
    expect(floorMesh.matrixAutoUpdate).toBe(false);

    // Cast straight down from above the baked world position; the frozen
    // matrix must still place the geometry where a ray can hit it.
    const center = new THREE.Vector3().setFromMatrixPosition(
      floorMesh.matrixWorld,
    );
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(center.x, center.y + 3, center.z),
      new THREE.Vector3(0, -1, 0),
    );
    expect(raycaster.intersectObject(floorMesh, false).length).toBeGreaterThan(
      0,
    );

    await renderer.unmount();
  });

  it('actually animates a ProjectCases lid in useFrame when selected', async () => {
    const projectId = postId(PROJECTS[0]!);
    usePortfolioStore.getState().selectProject(projectId);
    try {
      const renderer = await ReactThreeTestRenderer.create(
        <RoomScene
          seed="lid"
          quality="mobile"
          textureFactory={stubTextureFactory}
        />,
        { frameloop: 'never' },
      );

      const caseGroup = renderer.scene.find(
        (n) => n.type === 'Group' && n.props.name === `game-case-${projectId}`,
      )!;
      // The anonymous group child is the hinged lid; its mesh holds the part.
      const lid = caseGroup.children.find(
        (n) => n.type === 'Group' && n.props.name === undefined,
      )!;
      const lidObject = lid.instance as THREE.Group;
      const startY = lidObject.position.y;
      expect(lidObject.rotation.x).toBe(0);

      // Drive the useFrame damper directly — no renderer loop in jsdom.
      await renderer.advanceFrames(20, 0.05);

      expect(lidObject.position.y).toBeGreaterThan(startY);
      expect(lidObject.rotation.x).toBeLessThan(0); // OPEN_TILT is negative

      await renderer.unmount();
    } finally {
      usePortfolioStore.getState().selectProject(null);
    }
  });
});
