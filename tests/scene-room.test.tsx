/**
 * Room shell smoke tests (ladder commit 4). @react-three/test-renderer
 * stubs WebGL2, so <RoomScene/> can be mounted headlessly with an injected
 * texture factory (jsdom has no 2D canvas). PIXEL-LEVEL visual verification
 * still requires a real browser — deferred to the milestone screenshot review
 * (REWORK_PLAN §6).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { RoomScene } from '../src/scene/Room';
import {
  createRoomMaterials,
  disposeRoomMaterials,
} from '../src/scene/art/materials';
import {
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
    expect(Object.keys(materials).length).toBe(18);
    for (const material of Object.values(materials)) {
      expect(material).toBeInstanceOf(THREE.Material);
    }
    expect(() => disposeRoomMaterials(materials)).not.toThrow();
  });

  it('wires texture maps when provided', () => {
    const wood = new THREE.Texture();
    const materials = createRoomMaterials({ wood });
    const woodMaterial = materials.wood as THREE.MeshStandardMaterial;
    expect(woodMaterial.map).toBe(wood);
    disposeRoomMaterials(materials);
    wood.dispose();
  });
});

describe('painterly post pass (§3.5)', () => {
  it('uniform factory produces stable defaults and honours overrides', () => {
    const defaults = createPainterlyUniforms();
    expect(defaults.uGrain.value).toBe(PAINTERLY_DEFAULTS.grain);
    expect(defaults.uVignette.value).toBe(PAINTERLY_DEFAULTS.vignette);
    expect(defaults.uGrade.value).toBe(PAINTERLY_DEFAULTS.grade);
    expect(defaults.uTime.value).toBe(0);
    const custom = createPainterlyUniforms({ grain: 0.1 });
    expect(custom.uGrain.value).toBe(0.1);
  });

  it('shader sources carry the grain/vignette/grade pass', () => {
    expect(PAINTERLY_VERTEX_SHADER).toContain('gl_Position');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('tDiffuse');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('uVignette');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('uGrain');
    expect(PAINTERLY_FRAGMENT_SHADER).toContain('uGrade');
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
    // frames + cases + screen: comfortably more than 40 meshes.
    expect(meshes.length).toBeGreaterThan(40);

    // THREE.InstancedMesh keeps .type === 'Mesh'; detect via the flag.
    const instanced = renderer.scene.findAll((node) =>
      Boolean(
        (node.instance as THREE.InstancedMesh | undefined)?.isInstancedMesh,
      ),
    );
    expect(instanced).toHaveLength(1);
    expect(
      (instanced[0]?.instance as THREE.InstancedMesh | undefined)?.count,
    ).toBeGreaterThan(0);

    const groups = renderer.scene.findAll(
      (node) => node.type === 'Group' && typeof node.props.name === 'string',
    );
    const names = groups.map((node) => node.props.name as string);
    for (const expected of [
      'room-shell',
      'rug',
      'desk',
      'pc-tower',
      'bookshelf',
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
    await renderer.unmount();
  });
});
