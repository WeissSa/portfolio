/**
 * Canonical design tokens — the ONE place raw palette hex values live.
 *
 * Commit 1a moved every color value here; commit 2 recolored them onto the
 * unified Dishonored+purple palette (the ONLY commit that changed hex
 * strings — a future palette change is likewise one small, reviewable diff
 * in the sibling JSON). Every layer (Tailwind, CSS :root, scene palette,
 * materials, textures, lights and UI classes) derives from these roles. The
 * raw values live in the sibling JSON file so this module can be consumed by
 * TS/TSX *and* by the CJS Tailwind config and the Node lint guards without a
 * transpiler.
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
  /** Active / focus / visited semantic UI states. */
  state: tokens.state,
  /** Panel/card border color and its 1–2px width bounds. */
  border: tokens.border,
  /** Display/body stacks and the font-size scale. */
  type: tokens.type,
  /** Layout spacing scale. */
  spacing: tokens.spacing,
} as const;

/**
 * Semantic, Mantine-ready palette seed (owner decision 2026-11-22).
 *
 * Plain named hex values only — deliberately NO Mantine import here — so the
 * later Mantine-first commit can do:
 *
 *   const theme = createTheme({
 *     colors: MANTINE_THEME_ROLES,
 *     primaryColor: MANTINE_PRIMARY_COLOR,
 *     // defaultRadius / fontFamily / other tokens come from the same module
 *   });
 *
 * Every value below is an EXISTING token value: this export adds no new
 * color. Commit 2 retargeted the canonical values onto the unified palette;
 * the Mantine theme follows automatically.
 */
export const MANTINE_THEME_ROLES = {
  background: DESIGN_TOKENS.p5.black,
  panel: DESIGN_TOKENS.p5.ink,
  text: DESIGN_TOKENS.p5.white,
  accent: DESIGN_TOKENS.p5.red,
  teal: DESIGN_TOKENS.scene.plasterTeal,
  brass: DESIGN_TOKENS.scene.brass,
  gold: DESIGN_TOKENS.scene.brassLight,
  purple: DESIGN_TOKENS.p5.linkVisited,
  danger: DESIGN_TOKENS.p5.redDeep,
  focus: DESIGN_TOKENS.p5.yellow,
} as const;

export type MantineThemeRole = keyof typeof MANTINE_THEME_ROLES;

/** Mantine's `primaryColor` key — the P5 red accent in today's palette. */
export const MANTINE_PRIMARY_COLOR: MantineThemeRole = 'accent';

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
