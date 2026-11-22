/**
 * Shared room materials (REWORK_PLAN §3.5/§4.3): MeshStandardMaterial with the
 * canvas-generated painterly maps, muted steampunk palette. Emissive/keyed
 * materials (bulb, LED, monitor, night glass, projector beam) are basic or
 * emissive so they read as light sources without extra shadow cost.
 *
 * Factories take the texture map produced by renderTexturePlans(); callers own
 * disposal (disposeRoomMaterials).
 */
import * as THREE from 'three';
import { PALETTE } from './palette';
import type { TextureKey } from './textures';

export type MaterialKey =
  | 'wood'
  | 'woodDark'
  | 'plaster'
  | 'brass'
  | 'paper'
  | 'rug'
  | 'metalDark'
  | 'monitorScreen'
  | 'nightGlass'
  | 'lampShade'
  | 'bulb'
  | 'led'
  | 'beam'
  | 'screenFabric'
  | 'silhouette'
  | 'book'
  | 'bookAtlas'
  | 'caseLabel';

/**
 * Non-enumerable `textureClones` keeps the material map indexable by
 * MaterialKey (and keeps Object.values() clean) while still owning the two
 * cloned textures created by withRepeat(). They must be disposed alongside the
 * materials: Room.tsx creates/disposes this object on every mode toggle, and
 * a clone holds its own GPU texture (commit 5 review fix).
 */
export type RoomMaterials = Record<MaterialKey, THREE.Material> & {
  readonly textureClones?: readonly THREE.Texture[];
};

function withRepeat(
  texture: THREE.Texture | undefined,
  repeat: [number, number],
  clones: THREE.Texture[],
): THREE.Texture | undefined {
  if (!texture) return undefined;
  const clone = texture.clone();
  clone.repeat.set(repeat[0], repeat[1]);
  clone.needsUpdate = true;
  clones.push(clone);
  return clone;
}

function defined<T extends object>(params: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(params) as (keyof T)[]) {
    if (params[key] !== undefined) out[key] = params[key];
  }
  return out;
}

function standard(
  params: THREE.MeshStandardMaterialParameters,
): THREE.MeshStandardMaterial {
  // Drop undefined keys (e.g. an absent texture map) so three does not warn
  // "parameter 'map' has value of undefined" when the room renders headless
  // without its canvas-generated textures.
  return new THREE.MeshStandardMaterial(defined(params));
}

/**
 * Create one material per MaterialKey. Missing textures degrade gracefully to
 * untextured materials (used by headless tests).
 */
export function createRoomMaterials(
  textures: Partial<Record<TextureKey, THREE.Texture>> = {},
): RoomMaterials {
  const clones: THREE.Texture[] = [];
  const materials: RoomMaterials = {
    wood: standard({
      map: textures.wood,
      color: textures.wood ? '#ffffff' : PALETTE.woodMid,
      roughness: 0.82,
      metalness: 0.04,
    }),
    woodDark: standard({
      map: withRepeat(textures.wood, [2, 2], clones),
      color: textures.wood ? '#9c8a76' : PALETTE.woodDark,
      roughness: 0.85,
      metalness: 0.04,
    }),
    plaster: standard({
      map: withRepeat(textures.plaster, [2.5, 1.5], clones),
      color: textures.plaster ? '#ffffff' : PALETTE.plasterTeal,
      roughness: 0.95,
      metalness: 0,
    }),
    brass: standard({
      map: textures.brass,
      color: textures.brass ? '#ffffff' : PALETTE.brass,
      roughness: 0.38,
      metalness: 0.65,
    }),
    paper: standard({
      map: textures.paper,
      color: textures.paper ? '#ffffff' : PALETTE.paper,
      roughness: 0.92,
      metalness: 0,
    }),
    rug: standard({
      map: textures.rug,
      color: textures.rug ? '#ffffff' : PALETTE.rugIndigo,
      roughness: 1,
      metalness: 0,
    }),
    metalDark: standard({
      color: PALETTE.metalDark,
      roughness: 0.5,
      metalness: 0.6,
    }),
    // Self-lit surfaces: modest emissive so they glow without light probes.
    monitorScreen: standard({
      map: textures.monitor,
      color: textures.monitor ? '#ffffff' : '#141a20',
      emissive: new THREE.Color('#8fb7d9'),
      emissiveMap: textures.monitor,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.1,
    }),
    nightGlass: standard({
      color: PALETTE.nightBlue,
      emissive: new THREE.Color(PALETTE.nightGlow),
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.1,
    }),
    lampShade: standard({
      color: '#c98f4a',
      emissive: new THREE.Color(PALETTE.lampWarm),
      emissiveIntensity: 0.35,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    bulb: new THREE.MeshBasicMaterial({ color: PALETTE.lampWarm }),
    led: new THREE.MeshBasicMaterial({ color: '#39d2c0' }),
    // Projector light cone: additive, unlit, no depth writes (§3.5 light cone).
    beam: new THREE.MeshBasicMaterial({
      color: '#ffd9a0',
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    screenFabric: standard({
      map: textures.projector,
      color: textures.projector ? '#ffffff' : PALETTE.screenCloth,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: textures.projector,
      emissiveIntensity: 0.18,
      roughness: 0.9,
      metalness: 0,
    }),
    silhouette: standard({ color: '#20242c', roughness: 1, metalness: 0 }),
    book: standard({ color: '#ffffff', roughness: 0.85, metalness: 0.02 }),
    // Spine atlas kept ready for commit 6 (instanced per-cell UV books).
    bookAtlas: standard({
      map: textures.bookAtlas,
      color: textures.bookAtlas ? '#ffffff' : PALETTE.bookCloth,
      roughness: 0.85,
      metalness: 0.02,
    }),
    caseLabel: standard({
      map: textures.caseLabels,
      color: textures.caseLabels ? '#ffffff' : PALETTE.p5White,
      roughness: 0.7,
      metalness: 0.05,
    }),
  };
  // Non-enumerable: consumers indexing by MaterialKey and Object.values()
  // loops stay exactly as before, but teardown can reach the clones.
  Object.defineProperty(materials, 'textureClones', {
    value: clones,
    enumerable: false,
  });
  return materials;
}

export function disposeRoomMaterials(materials: RoomMaterials): void {
  // textureClones is non-enumerable, so the runtime values are all materials;
  // the cast only narrows the optional field away for TypeScript.
  for (const material of Object.values(materials) as THREE.Material[]) {
    material.dispose();
  }
  // withRepeat() clones share the source image but own a separate GPU texture;
  // dispose them explicitly so repeated 2D↔3D toggles cannot leak them.
  for (const clone of materials.textureClones ?? []) clone.dispose();
}
