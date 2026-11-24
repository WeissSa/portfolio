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

/** Headless stand-in: no 2D canvas in jsdom, textures never get sampled. */
const stubTextureFactory: TextureFactory = () => new THREE.Texture();

describe('room materials', () => {
  it('creates every material key without textures (graceful degradation)', () => {
    const materials = createRoomMaterials({});
    expect(Object.keys(materials).length).toBe(20);
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
    expect(Object.keys(materials)).toHaveLength(20);
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

    await renderer.unmount();
  });
});
