/**
 * Muted steampunk palette + tiny color helpers (REWORK_PLAN §3.5).
 *
 * Dishonored-inspired room: dark wood, brass, teal/sepia plaster, warm lamp
 * light, night-window blue. The P5 red/yellow accents are used sparingly
 * (featured book spines, case labels, small UI-in-scene touches).
 * Pure functions — no three, no DOM.
 */

import { DESIGN_TOKENS } from '../../styles/design-tokens';

/**
 * Named scene roles, all sourced from the canonical token store (commit 1a).
 * The object shape and every value are unchanged from the pre-token palette.
 */
export const PALETTE = {
  woodDark: DESIGN_TOKENS.scene.woodDark,
  woodMid: DESIGN_TOKENS.scene.woodMid,
  woodWarm: DESIGN_TOKENS.scene.woodWarm,
  woodGrain: DESIGN_TOKENS.scene.woodGrain,
  plasterTeal: DESIGN_TOKENS.scene.plasterTeal,
  plasterSepia: DESIGN_TOKENS.scene.plasterSepia,
  plasterDark: DESIGN_TOKENS.scene.plasterDark,
  brass: DESIGN_TOKENS.scene.brass,
  brassLight: DESIGN_TOKENS.scene.brassLight,
  brassDark: DESIGN_TOKENS.scene.brassDark,
  rugIndigo: DESIGN_TOKENS.scene.rugIndigo,
  rugRust: DESIGN_TOKENS.scene.rugRust,
  rugCream: DESIGN_TOKENS.scene.rugCream,
  paper: DESIGN_TOKENS.scene.paper,
  paperDark: DESIGN_TOKENS.scene.paperDark,
  ink: DESIGN_TOKENS.scene.ink,
  metalDark: DESIGN_TOKENS.scene.metalDark,
  p5Red: DESIGN_TOKENS.scene.p5Red,
  p5Yellow: DESIGN_TOKENS.scene.p5Yellow,
  p5White: DESIGN_TOKENS.scene.p5White,
  lampWarm: DESIGN_TOKENS.scene.lampWarm,
  nightBlue: DESIGN_TOKENS.scene.nightBlue,
  nightGlow: DESIGN_TOKENS.scene.nightGlow,
  screenCloth: DESIGN_TOKENS.scene.screenCloth,
  bookCloth: DESIGN_TOKENS.scene.bookCloth,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Hex colors used for book spines / game cases (muted + rare P5 accent). */
export const BOOK_SPINE_COLORS: readonly string[] = DESIGN_TOKENS.bookSpines;

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = Number.parseInt(h, 16);
  if (!Number.isFinite(int) || h.length !== 6) return [0, 0, 0];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => clamp255(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Lighten (amount > 0, toward white) or darken (amount < 0, toward black).
 * |amount| is clamped to 1. Deterministic and allocation-light.
 */
export function shadeHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const a = Math.max(-1, Math.min(1, amount));
  if (a >= 0) {
    return rgbToHex(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a);
  }
  return rgbToHex(r * (1 + a), g * (1 + a), b * (1 + a));
}

/** Linear mix between two hex colors, t in [0, 1]. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}
