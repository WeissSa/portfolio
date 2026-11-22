/**
 * Muted steampunk palette + tiny color helpers (REWORK_PLAN §3.5).
 *
 * Dishonored-inspired room: dark wood, brass, teal/sepia plaster, warm lamp
 * light, night-window blue. The P5 red/yellow accents are used sparingly
 * (featured book spines, case labels, small UI-in-scene touches).
 * Pure functions — no three, no DOM.
 */

export const PALETTE = {
  woodDark: '#2b1e14',
  woodMid: '#4a3323',
  woodWarm: '#6b4a2e',
  woodGrain: '#3a281a',
  plasterTeal: '#3f5a58',
  plasterSepia: '#6d5b45',
  plasterDark: '#2c3a3a',
  brass: '#b08d4f',
  brassLight: '#d4b06a',
  brassDark: '#7c6234',
  rugIndigo: '#2c3350',
  rugRust: '#7a3b2e',
  rugCream: '#c9b98f',
  paper: '#d9cdb2',
  paperDark: '#b7a98c',
  ink: '#16161a',
  metalDark: '#23262b',
  p5Red: '#ff2a1a',
  p5Yellow: '#ffd400',
  p5White: '#f5f2ea',
  lampWarm: '#ffb45e',
  nightBlue: '#1b2a4a',
  nightGlow: '#2e4a7d',
  screenCloth: '#e8dfc8',
  bookCloth: '#5a3a2a',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Hex colors used for book spines / game cases (muted + rare P5 accent). */
export const BOOK_SPINE_COLORS: readonly string[] = [
  '#4a3323',
  '#2f4a45',
  '#5a3a2a',
  '#3c4a63',
  '#6d5b45',
  '#41324a',
  '#2c3350',
  '#59483a',
  '#37514a',
];

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
