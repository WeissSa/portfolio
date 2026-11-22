/**
 * Pure calendar-heatmap drawing shared by the 2D `<HeatmapCanvas>` and the 3D
 * projector CanvasTexture (REWORK_PLAN §4.4: "same canvas becomes a CanvasTexture
 * on the projector screen"). No React, no three, no DOM access — it only talks
 * to the CanvasRenderingContext2D it is given, so it is unit-testable headlessly
 * with a recording context and both surfaces render byte-identical cells.
 *
 * The palette seam lets the DOM canvas keep white-on-transparent labels while
 * the projector paints ink-on-cloth (and adds a background fill), without
 * duplicating a single layout/color decision.
 */
import { DESIGN_TOKENS } from '../styles/design-tokens';
import { LEVEL_COLORS, type HeatmapCell } from './climate';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const HEATMAP_CELL = 12;
export const HEATMAP_GAP = 3;
export const HEATMAP_STEP = HEATMAP_CELL + HEATMAP_GAP;
export const HEATMAP_TOP_LABELS = 16;
export const HEATMAP_LEFT_LABELS = 22;

export interface HeatmapPalette {
  /** Level → color, indexed no-data (0) → hottest-on-record (6). */
  colors: readonly string[];
  /** Color for the month / weekday labels. */
  text: string;
  /** Optional background fill (projector cloth); omitted in the DOM canvas. */
  background?: string;
}

/** The 2D widget's white-on-transparent palette (previous hard-coded look). */
export const DEFAULT_HEATMAP_PALETTE: HeatmapPalette = {
  colors: LEVEL_COLORS,
  text: DESIGN_TOKENS.climate.heatmapLabelText,
};

/** Jan 1's weekday drives the GitHub-style column layout. */
export function heatmapFirstWeekday(year: number): number {
  return new Date(year, 0, 1).getDay();
}

/** Native pixel size of a full heatmap for `cells` in `year`. */
export function heatmapSize(
  cells: readonly HeatmapCell[],
  year: number,
): { width: number; height: number } {
  const weeks = Math.ceil((cells.length + heatmapFirstWeekday(year)) / 7);
  return {
    width: HEATMAP_LEFT_LABELS + weeks * HEATMAP_STEP,
    height: HEATMAP_TOP_LABELS + 7 * HEATMAP_STEP,
  };
}

/**
 * Draw the whole heatmap (labels + colored day cells) into `ctx` at native
 * coordinates starting at (0, 0). Deterministic: identical `cells` + `year` +
 * `palette` always emit the identical draw-call sequence.
 */
export function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  cells: readonly HeatmapCell[],
  year: number,
  palette: HeatmapPalette = DEFAULT_HEATMAP_PALETTE,
): void {
  const { width, height } = heatmapSize(cells, year);
  const firstWeekday = heatmapFirstWeekday(year);

  ctx.clearRect(0, 0, width, height);
  if (palette.background) {
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.font = '10px sans-serif';
  ctx.fillStyle = palette.text;
  ctx.textBaseline = 'top';
  // Self-contained: a caller (e.g. the projector title) may have centered its
  // text — reset so these labels can never inherit that alignment.
  ctx.textAlign = 'left';

  // Month labels along the top (one per month, at that month's first column).
  let lastMonth = -1;
  cells.forEach((cell, index) => {
    const month = Number(cell.date.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      const column = Math.floor((index + firstWeekday) / 7);
      ctx.fillText(
        MONTH_LABELS[month] ?? '',
        HEATMAP_LEFT_LABELS + column * HEATMAP_STEP,
        2,
      );
      lastMonth = month;
    }
  });

  // Weekday labels (Mon/Wed/Fri).
  [1, 3, 5].forEach((weekday) => {
    ctx.fillText(
      WEEKDAY_LABELS[weekday]!,
      0,
      HEATMAP_TOP_LABELS + weekday * HEATMAP_STEP + 1,
    );
  });

  // Colored day cells.
  cells.forEach((cell, index) => {
    const column = Math.floor((index + firstWeekday) / 7);
    const row = (index + firstWeekday) % 7;
    ctx.fillStyle =
      palette.colors[cell.level] ?? palette.colors[0] ?? LEVEL_COLORS[0]!;
    ctx.fillRect(
      HEATMAP_LEFT_LABELS + column * HEATMAP_STEP,
      HEATMAP_TOP_LABELS + row * HEATMAP_STEP,
      HEATMAP_CELL,
      HEATMAP_CELL,
    );
  });
}
