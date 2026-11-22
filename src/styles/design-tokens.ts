/**
 * Canonical design tokens — the ONE place raw palette hex values live.
 *
 * Commit 1a moves every existing color value here WITHOUT changing any value;
 * every layer (Tailwind, CSS :root, scene palette, materials, textures, lights
 * and UI classes) derives from these roles. The raw values live in the sibling
 * JSON file so this module can be consumed by TS/TSX *and* by the CJS Tailwind
 * config and the Node lint guards without a transpiler.
 *
 * Commit 2 is the ONLY commit allowed to change a hex string: a rejected
 * palette then costs one small, reviewable diff here.
 *
 * LEVEL_COLORS (src/lib/climate.ts) are a DATA SCALE, intentionally not design
 * tokens: a test asserts this module's values never intersect them.
 */
import tokens from './design-tokens.json';

export const DESIGN_TOKENS = {
  /** P5 design-system variables mirrored in p5.css / index.html :root. */
  p5: tokens.p5,
  /** 3D room scene palette (the old `PALETTE` in scene/art/palette.ts). */
  scene: tokens.scene,
  /** Deterministic book-spine / case-label tint set. */
  bookSpines: tokens.bookSpines,
  /** Scene material tints/emissives not already covered by `scene`. */
  material: tokens.material,
  /** Procedural canvas paint-plan literal colors. */
  texture: tokens.texture,
  /** Projector texture + heatmap label colors. */
  climate: tokens.climate,
  /** Light and fog colors in Room.tsx. */
  room: tokens.room,
  /** Miscellaneous UI-in-scene colors. */
  library: tokens.library,
} as const;

/** Every canonical hex value (lowercase), for drift/disjointness guards. */
export const ALL_TOKEN_VALUES: readonly string[] = [
  ...Object.values(DESIGN_TOKENS.p5),
  ...Object.values(DESIGN_TOKENS.scene),
  ...DESIGN_TOKENS.bookSpines,
  ...Object.values(DESIGN_TOKENS.material),
  ...Object.values(DESIGN_TOKENS.texture),
  ...Object.values(DESIGN_TOKENS.climate),
  ...Object.values(DESIGN_TOKENS.room),
  ...Object.values(DESIGN_TOKENS.library),
].map((value) => value.toLowerCase());

/** Expand `#abc` to `#aabbcc` and lowercase, so mirror variants compare equal. */
export function normalizeHex(value: string): string {
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    return `#${hex
      .slice(1)
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  return hex;
}
