/**
 * Canvas-generated painterly textures (REWORK_PLAN §4.3) — zero image
 * downloads. Every texture is a deterministic PAINT PLAN: a plain-data list of
 * ops produced from a seeded RNG, so plans are unit-testable headlessly
 * (node/jsdom) and identical across machines. A thin browser-only renderer
 * (paintPlanToCanvas / createPlanTexture) executes a plan onto a canvas and
 * wraps it in a THREE.CanvasTexture.
 *
 * Style notes (§3.5): brush-stroke noise + edge darkening everywhere for the
 * Dishonored oil-painting feel; sizes stay ≤ 512px for memory/perf.
 */
import * as THREE from 'three';
import { DESIGN_TOKENS } from '../../styles/design-tokens';
import { DIEGETIC_ROWS, PLAQUE } from '../diegetic';
import { createRng, type Rng } from './rng';
import { BOOK_SPINE_COLORS, PALETTE, shadeHex } from './palette';

export type PaintOp =
  | { kind: 'fill'; color: string }
  | {
      kind: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      alpha?: number;
      angle?: number;
    }
  | {
      kind: 'circle';
      x: number;
      y: number;
      r: number;
      color: string;
      alpha?: number;
    }
  | {
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      color: string;
      alpha?: number;
    }
  | {
      /**
       * Curved brush stroke (art-overhaul commit 3a): a quadratic Bézier from
       * (x1,y1) through control (cx1,cy1) to (x2,y2). Supply cx2/cy2 to
       * upgrade it to a cubic Bézier (bezierCurveTo). Round caps keep the ends
       * brush-like. This is the op plans use for painterly curved strokes —
       * sagging cable shadows, worn brass arcs, swirling plaster trowel marks.
       */
      kind: 'curve';
      x1: number;
      y1: number;
      cx1: number;
      cy1: number;
      cx2?: number;
      cy2?: number;
      x2: number;
      y2: number;
      width: number;
      color: string;
      alpha?: number;
    }
  | {
      kind: 'polygon';
      points: [number, number][];
      color: string;
      alpha?: number;
    }
  | {
      kind: 'text';
      text: string;
      x: number;
      y: number;
      font: string;
      color: string;
      align?: 'left' | 'center' | 'right';
      angle?: number;
      alpha?: number;
    }
  | {
      kind: 'frame';
      x: number;
      y: number;
      w: number;
      h: number;
      thickness: number;
      color: string;
      alpha?: number;
    }
  | { kind: 'vignette'; strength: number };

export interface TexturePlan {
  name: string;
  width: number;
  height: number;
  ops: PaintOp[];
}

export type TextureKey =
  | 'wood'
  | 'plaster'
  | 'brass'
  | 'paper'
  | 'rug'
  | 'bookAtlas'
  | 'caseLabels'
  | 'monitor'
  | 'projector'
  | 'plaque';

/** Hard budgets asserted by unit tests (§4.3 "tests assert determinism + budget"). */
export const MAX_TEXTURE_SIZE = 512;
export const MAX_TEXTURE_OPS = 2500;

const DISPLAY_FONT = "'Anton', 'Arial Narrow', Haettenschweiler, sans-serif";
const BODY_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

/** One elongated brush stroke, the atom of the painterly look. */
function stroke(
  rng: Rng,
  x: number,
  y: number,
  len: number,
  width: number,
  color: string,
  alpha: number,
  angleJitter = 0.05,
): PaintOp {
  return {
    kind: 'rect',
    x,
    y,
    w: len,
    h: width,
    color,
    alpha,
    angle: rng.range(-angleJitter, angleJitter),
  };
}

/** Scatter n brush strokes across the surface with per-stroke shade jitter. */
function brushNoise(
  rng: Rng,
  ops: PaintOp[],
  size: { width: number; height: number },
  count: number,
  baseColor: string,
  opts: {
    lenRange: [number, number];
    widthRange: [number, number];
    alphaRange: [number, number];
    shade: number;
  },
): void {
  for (let i = 0; i < count; i += 1) {
    const color = shadeHex(baseColor, rng.range(-opts.shade, opts.shade));
    ops.push(
      stroke(
        rng,
        rng.range(-10, size.width),
        rng.range(0, size.height),
        rng.range(opts.lenRange[0], opts.lenRange[1]),
        rng.range(opts.widthRange[0], opts.widthRange[1]),
        color,
        rng.range(opts.alphaRange[0], opts.alphaRange[1]),
      ),
    );
  }
}

/** Painterly edge darkening — cheap vignette baked into the texture itself. */
function edgeDarken(strength = 0.45): PaintOp {
  return { kind: 'vignette', strength };
}

export function planWood(seed: string | number, size = 512): TexturePlan {
  const rng = createRng(typeof seed === 'string' ? `${seed}:wood` : seed + 101);
  const ops: PaintOp[] = [{ kind: 'fill', color: PALETTE.woodMid }];
  const planks = 4;
  const plankHeight = size / planks;
  for (let p = 0; p < planks; p += 1) {
    const y0 = p * plankHeight;
    const tint = shadeHex(PALETTE.woodMid, rng.range(-0.08, 0.06));
    ops.push({
      kind: 'rect',
      x: 0,
      y: y0,
      w: size,
      h: plankHeight,
      color: tint,
      alpha: 1,
    });
    // Long grain strokes running with the plank.
    for (let i = 0; i < 80; i += 1) {
      ops.push(
        stroke(
          rng,
          rng.range(-20, size),
          y0 + rng.range(2, plankHeight - 2),
          rng.range(size * 0.25, size * 0.8),
          rng.range(1, 2.5),
          rng.chance(0.5) ? PALETTE.woodGrain : PALETTE.woodWarm,
          rng.range(0.05, 0.16),
        ),
      );
    }
    // Plank seam + a subtle highlight above it.
    ops.push({
      kind: 'line',
      x1: 0,
      y1: y0,
      x2: size,
      y2: y0,
      width: 2,
      color: PALETTE.woodDark,
      alpha: 0.8,
    });
    ops.push({
      kind: 'line',
      x1: 0,
      y1: y0 + 2,
      x2: size,
      y2: y0 + 2,
      width: 1,
      color: PALETTE.woodWarm,
      alpha: 0.25,
    });
    // Occasional knot with rings.
    if (rng.chance(0.7)) {
      const kx = rng.range(size * 0.15, size * 0.85);
      const ky = y0 + rng.range(plankHeight * 0.3, plankHeight * 0.7);
      for (let r = 3; r >= 1; r -= 1) {
        ops.push({
          kind: 'circle',
          x: kx,
          y: ky,
          r: r * 4,
          color: PALETTE.woodDark,
          alpha: 0.12,
        });
      }
      ops.push({
        kind: 'circle',
        x: kx,
        y: ky,
        r: 3,
        color: PALETTE.woodDark,
        alpha: 0.5,
      });
    }
    // Curved grain swirls (commit 3b): cubic Bézier strokes bowing across the
    // plank, layered over the straight grain — growth rings, not ruler lines.
    for (let c = 0; c < 3; c += 1) {
      const sx = rng.range(-20, size * 0.6);
      const sy = y0 + rng.range(plankHeight * 0.15, plankHeight * 0.85);
      const len = rng.range(size * 0.25, size * 0.5);
      const bow = rng.range(6, 22) * (rng.chance(0.5) ? 1 : -1);
      ops.push({
        kind: 'curve',
        x1: sx,
        y1: sy,
        cx1: sx + len * 0.33,
        cy1: sy + bow,
        cx2: sx + len * 0.66,
        cy2: sy - bow * 0.6,
        x2: sx + len,
        y2: sy + rng.range(-3, 3),
        width: rng.range(1, 2.4),
        color: rng.chance(0.5) ? PALETTE.woodGrain : PALETTE.woodWarm,
        alpha: rng.range(0.07, 0.16),
      });
    }
  }
  ops.push(edgeDarken(0.4));
  return { name: 'wood', width: size, height: size, ops };
}

export function planPlaster(seed: string | number, size = 512): TexturePlan {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:plaster` : seed + 202,
  );
  const base = PALETTE.plasterTeal;
  const ops: PaintOp[] = [{ kind: 'fill', color: base }];
  // Broad mottled patches: sepia blooms over teal, like aged painted plaster.
  for (let i = 0; i < 60; i += 1) {
    ops.push({
      kind: 'circle',
      x: rng.range(0, size),
      y: rng.range(0, size),
      r: rng.range(size * 0.05, size * 0.22),
      color: rng.chance(0.5) ? PALETTE.plasterSepia : PALETTE.plasterDark,
      alpha: rng.range(0.03, 0.09),
    });
  }
  brushNoise(rng, ops, { width: size, height: size }, 220, base, {
    lenRange: [size * 0.05, size * 0.2],
    widthRange: [2, 7],
    alphaRange: [0.03, 0.1],
    shade: 0.12,
  });
  // Hairline cracks — curved Bézier segments (commit 3b) read as settling
  // plaster, not ruler lines.
  for (let c = 0; c < 4; c += 1) {
    let x = rng.range(0, size);
    let y = rng.range(0, size);
    for (let seg = 0; seg < 6; seg += 1) {
      const nx = x + rng.range(-40, 40);
      const ny = y + rng.range(10, 50);
      ops.push({
        kind: 'curve',
        x1: x,
        y1: y,
        cx1: x + rng.range(-24, 24),
        cy1: y + (ny - y) * 0.5,
        x2: nx,
        y2: ny,
        width: 1,
        color: PALETTE.plasterDark,
        alpha: 0.25,
      });
      x = nx;
      y = ny;
    }
  }
  // Broad curved trowel strokes layered over the mottling (commit 3b): the
  // aged-painted plaster now carries the sweep of the plasterer's float.
  for (let t = 0; t < 12; t += 1) {
    const tx = rng.range(-40, size);
    const ty = rng.range(0, size);
    ops.push({
      kind: 'curve',
      x1: tx,
      y1: ty,
      cx1: tx + rng.range(30, 90),
      cy1: ty + rng.range(-40, 40),
      x2: tx + rng.range(80, 180),
      y2: ty + rng.range(-30, 30),
      width: rng.range(5, 13),
      color: shadeHex(base, rng.range(-0.05, 0.05)),
      alpha: rng.range(0.03, 0.07),
    });
  }
  ops.push(edgeDarken(0.35));
  return { name: 'plaster', width: size, height: size, ops };
}

export function planBrass(seed: string | number, size = 256): TexturePlan {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:brass` : seed + 303,
  );
  const ops: PaintOp[] = [{ kind: 'fill', color: PALETTE.brass }];
  // Brushed-metal horizontal streaks, lighter and darker.
  for (let i = 0; i < 140; i += 1) {
    ops.push(
      stroke(
        rng,
        rng.range(-10, size),
        rng.range(0, size),
        rng.range(size * 0.2, size * 0.9),
        rng.range(0.5, 2),
        rng.chance(0.5) ? PALETTE.brassLight : PALETTE.brassDark,
        rng.range(0.05, 0.18),
        0.01,
      ),
    );
  }
  // Verdigris patina blotches.
  for (let i = 0; i < 12; i += 1) {
    ops.push({
      kind: 'circle',
      x: rng.range(0, size),
      y: rng.range(0, size),
      r: rng.range(4, 18),
      color: PALETTE.plasterDark,
      alpha: rng.range(0.04, 0.1),
    });
  }
  // Edge wear (commit 3b): bright worn arcs hugging the top/bottom edges —
  // brushed brass loses its patina first where hands and frames rub.
  for (let e = 0; e < 10; e += 1) {
    const top = rng.chance(0.5);
    const ey = top ? rng.range(2, 26) : size - rng.range(2, 26);
    const ex = rng.range(-20, size * 0.6);
    const len = rng.range(size * 0.2, size * 0.55);
    ops.push({
      kind: 'curve',
      x1: ex,
      y1: ey,
      cx1: ex + len * 0.5,
      cy1: ey + (top ? 1 : -1) * rng.range(4, 16),
      x2: ex + len,
      y2: ey + rng.range(-4, 4),
      width: rng.range(1, 3),
      color: rng.chance(0.6) ? PALETTE.brassLight : PALETTE.brassDark,
      alpha: rng.range(0.12, 0.32),
    });
  }
  ops.push(edgeDarken(0.3));
  return { name: 'brass', width: size, height: size, ops };
}

export function planPaper(seed: string | number, size = 256): TexturePlan {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:paper` : seed + 404,
  );
  const ops: PaintOp[] = [{ kind: 'fill', color: PALETTE.paper }];
  for (let i = 0; i < 220; i += 1) {
    ops.push({
      kind: 'rect',
      x: rng.range(0, size),
      y: rng.range(0, size),
      w: rng.range(1, 3),
      h: rng.range(0.5, 1.5),
      color: rng.chance(0.5)
        ? PALETTE.paperDark
        : DESIGN_TOKENS.texture.paperLight,
      alpha: rng.range(0.05, 0.15),
      angle: rng.range(-0.4, 0.4),
    });
  }
  // Faint foxing spots.
  for (let i = 0; i < 6; i += 1) {
    ops.push({
      kind: 'circle',
      x: rng.range(0, size),
      y: rng.range(0, size),
      r: rng.range(3, 10),
      color: PALETTE.paperDark,
      alpha: 0.08,
    });
  }
  ops.push(edgeDarken(0.25));
  return { name: 'paper', width: size, height: size, ops };
}

export function planRug(seed: string | number, size = 512): TexturePlan {
  const rng = createRng(typeof seed === 'string' ? `${seed}:rug` : seed + 505);
  const ops: PaintOp[] = [{ kind: 'fill', color: PALETTE.rugIndigo }];
  brushNoise(rng, ops, { width: size, height: size }, 160, PALETTE.rugIndigo, {
    lenRange: [8, 40],
    widthRange: [2, 5],
    alphaRange: [0.04, 0.12],
    shade: 0.14,
  });
  // Woven border bands.
  const band = size * 0.08;
  ops.push({
    kind: 'frame',
    x: band * 0.5,
    y: band * 0.5,
    w: size - band,
    h: size - band,
    thickness: band * 0.5,
    color: PALETTE.rugRust,
    alpha: 0.9,
  });
  ops.push({
    kind: 'frame',
    x: band * 1.4,
    y: band * 1.4,
    w: size - band * 2.8,
    h: size - band * 2.8,
    thickness: 3,
    color: PALETTE.rugCream,
    alpha: 0.6,
  });
  // Central diamond motif field.
  const inner = size * 0.3;
  for (let i = 0; i < 5; i += 1) {
    const r = inner * (1 - i * 0.18);
    const cx = size / 2;
    const cy = size / 2;
    ops.push({
      kind: 'polygon',
      points: [
        [cx, cy - r],
        [cx + r, cy],
        [cx, cy + r],
        [cx - r, cy],
      ],
      color: i % 2 === 0 ? PALETTE.rugRust : PALETTE.rugCream,
      alpha: 0.55,
    });
  }
  // Corner florets.
  const florets: [number, number][] = [
    [size * 0.2, size * 0.2],
    [size * 0.8, size * 0.2],
    [size * 0.2, size * 0.8],
    [size * 0.8, size * 0.8],
  ];
  for (const [fx, fy] of florets) {
    for (let p = 0; p < 6; p += 1) {
      const a = (p / 6) * Math.PI * 2;
      ops.push({
        kind: 'circle',
        x: fx + Math.cos(a) * 12,
        y: fy + Math.sin(a) * 12,
        r: 5,
        color: PALETTE.rugCream,
        alpha: 0.4,
      });
    }
    ops.push({
      kind: 'circle',
      x: fx,
      y: fy,
      r: 6,
      color: PALETTE.rugRust,
      alpha: 0.7,
    });
  }
  ops.push(edgeDarken(0.5));
  return { name: 'rug', width: size, height: size, ops };
}

/** Deterministic approx text wrap (no canvas metrics needed in node). */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // Hard-split words longer than the column.
    let rest = word;
    while (rest.length > maxChars) {
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export interface BookEntry {
  title: string;
  featured: boolean;
}

/**
 * Book-spine ATLAS (§4.3): every library volume's spine in one 512px texture
 * on a 4×4 grid; commit 6 maps per-instance UVs into these cells. Featured
 * titles get a brass band + ★ and a brighter cloth.
 */
export function planBookSpineAtlas(
  seed: string | number,
  books: readonly BookEntry[],
  size = 512,
): TexturePlan {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:atlas` : seed + 606,
  );
  const ops: PaintOp[] = [{ kind: 'fill', color: PALETTE.paperDark }];
  const cols = 4;
  const rows = Math.ceil(books.length / cols);
  const cellW = size / cols;
  const cellH = size / Math.max(rows, 1);
  books.forEach((book, index) => {
    const cx = (index % cols) * cellW;
    const cy = Math.floor(index / cols) * cellH;
    const spineW = cellW * 0.66;
    const spineX = cx + (cellW - spineW) / 2;
    const base = book.featured
      ? shadeHex(rng.pick(BOOK_SPINE_COLORS), 0.14)
      : rng.pick(BOOK_SPINE_COLORS);
    ops.push({
      kind: 'rect',
      x: spineX,
      y: cy + 4,
      w: spineW,
      h: cellH - 8,
      color: base,
      alpha: 1,
    });
    // Cloth grain.
    for (let i = 0; i < 14; i += 1) {
      ops.push(
        stroke(
          rng,
          spineX,
          cy + rng.range(4, cellH - 4),
          spineW,
          rng.range(0.5, 1.5),
          shadeHex(base, rng.range(-0.15, 0.1)),
          rng.range(0.08, 0.2),
          0.02,
        ),
      );
    }
    // Brass bands top/bottom (+ an extra band for featured volumes).
    const bandColor = book.featured ? PALETTE.brassLight : PALETTE.brass;
    ops.push({
      kind: 'rect',
      x: spineX,
      y: cy + 10,
      w: spineW,
      h: 3,
      color: bandColor,
      alpha: 0.9,
    });
    ops.push({
      kind: 'rect',
      x: spineX,
      y: cy + cellH - 14,
      w: spineW,
      h: 3,
      color: bandColor,
      alpha: 0.9,
    });
    // Vertical title, bottom-to-top.
    const label = book.featured
      ? `★ ${truncate(book.title, 26)}`
      : truncate(book.title, 28);
    ops.push({
      kind: 'text',
      text: label,
      x: cx + cellW / 2,
      y: cy + cellH / 2,
      font: `${book.featured ? 15 : 13}px ${DISPLAY_FONT}`,
      color: book.featured ? PALETTE.p5Yellow : PALETTE.paper,
      align: 'center',
      angle: -Math.PI / 2,
    });
    // Page-edge highlight on one side.
    ops.push({
      kind: 'rect',
      x: spineX + spineW - 3,
      y: cy + 6,
      w: 3,
      h: cellH - 12,
      color: PALETTE.paper,
      alpha: 0.25,
    });
  });
  // Fill leftover cells with blank paper stock.
  for (let index = books.length; index < cols * rows; index += 1) {
    const cx = (index % cols) * cellW;
    const cy = Math.floor(index / cols) * cellH;
    ops.push({
      kind: 'rect',
      x: cx,
      y: cy,
      w: cellW,
      h: cellH,
      color: shadeHex(PALETTE.paperDark, -0.2),
      alpha: 1,
    });
  }
  ops.push(edgeDarken(0.2));
  return { name: 'bookAtlas', width: size, height: size, ops };
}

/**
 * Game-case label strip (§3.2.3): one 512×256 texture with n P5-styled
 * cartridge labels side by side; commit 8 maps each case's top face into its
 * cell. Jagged slashes, red/black/white, condensed display type.
 */
export function planCaseLabels(
  seed: string | number,
  titles: readonly string[],
  width = 512,
  height = 256,
): TexturePlan {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:cases` : seed + 707,
  );
  const ops: PaintOp[] = [{ kind: 'fill', color: PALETTE.ink }];
  const n = Math.max(titles.length, 1);
  const cellW = width / n;
  titles.forEach((title, index) => {
    const x0 = index * cellW;
    // White label stock with a black diagonal slash (P5).
    ops.push({
      kind: 'rect',
      x: x0 + 3,
      y: 3,
      w: cellW - 6,
      h: height - 6,
      color: PALETTE.p5White,
      alpha: 1,
    });
    ops.push({
      kind: 'polygon',
      points: [
        [x0 + cellW * 0.55, 3],
        [x0 + cellW - 3, 3],
        [x0 + cellW - 3, height * 0.42],
      ],
      color: PALETTE.ink,
      alpha: 1,
    });
    ops.push({
      kind: 'rect',
      x: x0 + 3,
      y: height - 26,
      w: cellW - 6,
      h: 10,
      color: PALETTE.p5Red,
      alpha: 1,
    });
    // Star motif.
    ops.push({
      kind: 'text',
      text: '★',
      x: x0 + 12,
      y: 22,
      font: `14px ${BODY_FONT}`,
      color: PALETTE.p5Yellow,
      align: 'left',
    });
    // Wrapped title.
    const lines = wrapText(truncate(title, 44), 14).slice(0, 5);
    lines.forEach((line, li) => {
      ops.push({
        kind: 'text',
        text: line,
        x: x0 + 10,
        y: height * 0.34 + li * 16,
        font: `13px ${DISPLAY_FONT}`,
        color: PALETTE.ink,
        align: 'left',
      });
    });
    // Halftone-ish dots along the bottom.
    for (let d = 0; d < 6; d += 1) {
      ops.push({
        kind: 'circle',
        x: x0 + 12 + d * ((cellW - 24) / 6),
        y: height - 34,
        r: 2.5 - d * 0.3,
        color: PALETTE.ink,
        alpha: 0.7,
      });
    }
    // Paper grain.
    for (let g = 0; g < 10; g += 1) {
      ops.push({
        kind: 'rect',
        x: x0 + rng.range(4, cellW - 8),
        y: rng.range(4, height - 8),
        w: rng.range(2, 8),
        h: 1,
        color: PALETTE.ink,
        alpha: rng.range(0.03, 0.08),
      });
    }
  });
  ops.push(edgeDarken(0.25));
  return { name: 'caseLabels', width, height, ops };
}

/**
 * Monitor desktop preview (§3.2.2): a stylized P5-OS desktop rendered as a
 * texture — the visual promise of the full-screen 2D desktop (commit 7).
 */
export function planMonitorDesktop(
  seed: string | number,
  width = 512,
  height = 320,
): TexturePlan {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:monitor` : seed + 808,
  );
  const ops: PaintOp[] = [
    { kind: 'fill', color: DESIGN_TOKENS.texture.monitorFill },
  ];
  // Wallpaper: dark teal wash with painterly strokes.
  brushNoise(
    rng,
    ops,
    { width, height },
    60,
    DESIGN_TOKENS.texture.monitorWash,
    {
      lenRange: [30, 120],
      widthRange: [6, 18],
      alphaRange: [0.05, 0.14],
      shade: 0.1,
    },
  );
  // Top menu bar.
  ops.push({
    kind: 'rect',
    x: 0,
    y: 0,
    w: width,
    h: 20,
    color: PALETTE.ink,
    alpha: 1,
  });
  ops.push({
    kind: 'text',
    text: '★ samOS',
    x: 8,
    y: 14,
    font: `12px ${DISPLAY_FONT}`,
    color: PALETTE.p5Red,
    align: 'left',
  });
  ops.push({
    kind: 'text',
    text: '21:43',
    x: width - 10,
    y: 14,
    font: `11px ${BODY_FONT}`,
    color: PALETTE.p5White,
    align: 'right',
  });
  // Desktop icons (mirror the About desktop windows).
  const icons = ['Bio', 'Now', 'Hobbies', 'Skills', 'Links'];
  icons.forEach((label, i) => {
    const ix = 16;
    const iy = 38 + i * 52;
    ops.push({
      kind: 'rect',
      x: ix,
      y: iy,
      w: 30,
      h: 24,
      color: PALETTE.p5White,
      alpha: 0.92,
    });
    ops.push({
      kind: 'polygon',
      points: [
        [ix, iy],
        [ix + 30, iy],
        [ix + 30, iy + 6],
        [ix, iy + 12],
      ],
      color: PALETTE.p5Red,
      alpha: 0.9,
    });
    ops.push({
      kind: 'text',
      text: label,
      x: ix + 15,
      y: iy + 38,
      font: `9px ${BODY_FONT}`,
      color: PALETTE.p5White,
      align: 'center',
    });
  });
  // One open window: bio.txt.
  const wx = 110;
  const wy = 60;
  const ww = width - wx - 40;
  const wh = height - wy - 70;
  ops.push({
    kind: 'rect',
    x: wx + 4,
    y: wy + 5,
    w: ww,
    h: wh,
    color: PALETTE.ink,
    alpha: 0.8,
  }); // drop shadow
  ops.push({
    kind: 'rect',
    x: wx,
    y: wy,
    w: ww,
    h: wh,
    color: PALETTE.p5White,
    alpha: 1,
  });
  ops.push({
    kind: 'rect',
    x: wx,
    y: wy,
    w: ww,
    h: 22,
    color: PALETTE.ink,
    alpha: 1,
  });
  ops.push({
    kind: 'text',
    text: 'about-me — bio.txt',
    x: wx + 10,
    y: wy + 15,
    font: `11px ${BODY_FONT}`,
    color: PALETTE.p5White,
    align: 'left',
  });
  ops.push({
    kind: 'rect',
    x: wx + ww - 22,
    y: wy + 4,
    w: 14,
    h: 14,
    color: PALETTE.p5Red,
    alpha: 1,
  });
  // Body copy as placeholder rules (real content lives in the DOM overlay).
  for (let l = 0; l < 8; l += 1) {
    ops.push({
      kind: 'rect',
      x: wx + 14,
      y: wy + 36 + l * 16,
      w: (ww - 28) * rng.range(0.55, 0.98),
      h: 5,
      color: DESIGN_TOKENS.texture.monitorText,
      alpha: 0.75,
    });
  }
  // Bottom dock with a jagged P5 accent.
  ops.push({
    kind: 'rect',
    x: 0,
    y: height - 26,
    w: width,
    h: 26,
    color: PALETTE.ink,
    alpha: 1,
  });
  ops.push({
    kind: 'polygon',
    points: [
      [0, height - 26],
      [width * 0.18, height - 26],
      [width * 0.12, height - 12],
      [width * 0.24, height],
      [0, height],
    ],
    color: PALETTE.p5Red,
    alpha: 0.9,
  });
  ops.push(edgeDarken(0.18));
  return { name: 'monitor', width, height, ops };
}

/**
 * Projector screen placeholder (§3.2.4): cloth + title card. Commit 9 swaps
 * in the live heatmap CanvasTexture; until then the screen shows the climate
 * title so the room reads correctly.
 */
export function planProjectorScreen(
  seed: string | number,
  width = 512,
  height = 288,
): TexturePlan {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:screen` : seed + 909,
  );
  const ops: PaintOp[] = [{ kind: 'fill', color: PALETTE.screenCloth }];
  brushNoise(rng, ops, { width, height }, 70, PALETTE.screenCloth, {
    lenRange: [20, 90],
    widthRange: [3, 9],
    alphaRange: [0.03, 0.08],
    shade: 0.06,
  });
  ops.push({
    kind: 'frame',
    x: 8,
    y: 8,
    w: width - 16,
    h: height - 16,
    thickness: 6,
    color: PALETTE.ink,
    alpha: 0.9,
  });
  ops.push({
    kind: 'frame',
    x: 16,
    y: 16,
    w: width - 32,
    h: height - 32,
    thickness: 1.5,
    color: PALETTE.p5Red,
    alpha: 0.85,
  });
  ops.push({
    kind: 'text',
    text: 'OUR CLIMATE,',
    x: width / 2,
    y: height * 0.36,
    font: `34px ${DISPLAY_FONT}`,
    color: PALETTE.ink,
    align: 'center',
  });
  ops.push({
    kind: 'text',
    text: 'OUR FUTURE',
    x: width / 2,
    y: height * 0.52,
    font: `34px ${DISPLAY_FONT}`,
    color: PALETTE.p5Red,
    align: 'center',
  });
  ops.push({
    kind: 'text',
    text: 'historical heatmap · open-meteo.com',
    x: width / 2,
    y: height * 0.72,
    font: `12px ${BODY_FONT}`,
    color: DESIGN_TOKENS.texture.projectorCaption,
    align: 'center',
  });
  ops.push(edgeDarken(0.3));
  return { name: 'projector', width, height, ops };
}

/**
 * CANONICAL DIEGETIC NAV (commit 4): gilt route names on a DARK inlay panel —
 * never gold-on-brass (1.51:1). The board's brass inlay / rosettes / jag
 * motifs are separate geometry; this texture is the lettered face only.
 * 60px Anton on a 320px-tall strip => ~21px caps from HOME_VIEWPOINT.
 */
export function planWallPlaque(
  seed: string | number,
  width = PLAQUE.textureWidth,
  height = PLAQUE.textureHeight,
): TexturePlan {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:plaque` : seed + 1204,
  );
  const ops: PaintOp[] = [{ kind: 'fill', color: DESIGN_TOKENS.p5.black }];
  // Aged varnish on the dark inlay (kept subtle: lettering contrast dominates).
  brushNoise(rng, ops, { width, height }, 36, PALETTE.ink, {
    lenRange: [24, 90],
    widthRange: [2, 7],
    alphaRange: [0.02, 0.06],
    shade: 0.08,
  });
  // Brass inlay frame + the thin purple line under the heading band.
  ops.push(
    {
      kind: 'frame',
      x: 2,
      y: 2,
      w: width - 4,
      h: height - 4,
      thickness: 6,
      color: PALETTE.brassDark,
    },
    {
      kind: 'frame',
      x: 11,
      y: 11,
      w: width - 22,
      h: height - 22,
      thickness: 2,
      color: PALETTE.brassLight,
    },
    {
      kind: 'rect',
      x: 24,
      y: 32,
      w: width - 48,
      h: 3,
      color: DESIGN_TOKENS.p5.link,
      alpha: 0.95,
    },
  );
  // Corner rosettes (painted; the raised brass ones are in createWallPlaque).
  const corners: [number, number][] = [
    [20, 20],
    [width - 20, 20],
    [20, height - 20],
    [width - 20, height - 20],
  ];
  for (const [cx, cy] of corners) {
    ops.push({ kind: 'circle', x: cx, y: cy, r: 9, color: PALETTE.brass });
    ops.push({ kind: 'circle', x: cx, y: cy, r: 4, color: PALETTE.brassDark });
  }
  // P5-inspired slash / jag motifs as brass inlay (generic, not a copied UI).
  for (const side of [0, 1]) {
    const base = side === 0 ? 16 : width - 46;
    ops.push({
      kind: 'polygon',
      points: [
        [base, 62],
        [base + 22, 50],
        [base + 30, 66],
        [base + 12, 80],
      ],
      color: PALETTE.brass,
      alpha: 0.85,
    });
    ops.push({
      kind: 'polygon',
      points: [
        [base + 4, height - 86],
        [base + 26, height - 100],
        [base + 34, height - 84],
        [base + 16, height - 68],
      ],
      color: PALETTE.brass,
      alpha: 0.85,
    });
  }
  // Gilt lettering, one row per route, baseline-aligned with the hit planes.
  DIEGETIC_ROWS.forEach((row, index) => {
    const baseline = PLAQUE.rowBaselines[index] ?? 38 + index * 62;
    ops.push({
      kind: 'rect',
      x: 46,
      y: baseline + 5,
      w: width - 92,
      h: 1,
      color: PALETTE.brassDark,
      alpha: 0.7,
    });
    ops.push({
      kind: 'text',
      text: row.label.toUpperCase(),
      x: 56,
      y: baseline,
      font: `${PLAQUE.fontPx}px ${DISPLAY_FONT}`,
      color: DESIGN_TOKENS.climate.projectorPlaqueText,
      align: 'left',
    });
  });
  ops.push(edgeDarken(0.12));
  return { name: 'plaque', width, height, ops };
}

export interface RoomTextureContent {
  books: readonly BookEntry[];
  cases: readonly string[];
}

/** Every texture the room shell needs, generated from one seed. */
export function createTexturePlans(
  seed: string | number,
  content: RoomTextureContent,
): Record<TextureKey, TexturePlan> {
  return {
    wood: planWood(seed),
    plaster: planPlaster(seed),
    brass: planBrass(seed),
    paper: planPaper(seed),
    rug: planRug(seed),
    bookAtlas: planBookSpineAtlas(seed, content.books),
    caseLabels: planCaseLabels(seed, content.cases),
    monitor: planMonitorDesktop(seed),
    projector: planProjectorScreen(seed),
    plaque: planWallPlaque(seed),
  };
}

/* ------------------------------------------------------------------------ */
/* Browser-only execution layer (never exercised in jsdom; see tests note).  */
/* ------------------------------------------------------------------------ */

function paintOp(ctx: CanvasRenderingContext2D, op: PaintOp): void {
  ctx.save();
  if ('alpha' in op && op.alpha !== undefined) ctx.globalAlpha = op.alpha;
  switch (op.kind) {
    case 'fill':
      ctx.fillStyle = op.color;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      break;
    case 'rect':
      if (op.angle) {
        ctx.translate(op.x + op.w / 2, op.y + op.h / 2);
        ctx.rotate(op.angle);
        ctx.fillStyle = op.color;
        ctx.fillRect(-op.w / 2, -op.h / 2, op.w, op.h);
      } else {
        ctx.fillStyle = op.color;
        ctx.fillRect(op.x, op.y, op.w, op.h);
      }
      break;
    case 'circle':
      ctx.fillStyle = op.color;
      ctx.beginPath();
      ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'line':
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
      break;
    case 'curve':
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      if (op.cx2 !== undefined && op.cy2 !== undefined) {
        ctx.bezierCurveTo(op.cx1, op.cy1, op.cx2, op.cy2, op.x2, op.y2);
      } else {
        ctx.quadraticCurveTo(op.cx1, op.cy1, op.x2, op.y2);
      }
      ctx.stroke();
      break;
    case 'polygon':
      ctx.fillStyle = op.color;
      ctx.beginPath();
      op.points.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      break;
    case 'frame': {
      ctx.fillStyle = op.color;
      const { x, y, w, h, thickness: t } = op;
      ctx.fillRect(x, y, w, t);
      ctx.fillRect(x, y + h - t, w, t);
      ctx.fillRect(x, y, t, h);
      ctx.fillRect(x + w - t, y, t, h);
      break;
    }
    case 'text':
      ctx.fillStyle = op.color;
      ctx.font = op.font;
      ctx.textAlign = op.align ?? 'left';
      ctx.textBaseline = 'alphabetic';
      if (op.angle) {
        ctx.translate(op.x, op.y);
        ctx.rotate(op.angle);
        ctx.fillText(op.text, 0, 0);
      } else {
        ctx.fillText(op.text, op.x, op.y);
      }
      break;
    case 'vignette': {
      const { width: w, height: h } = ctx.canvas;
      const gradient = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.35,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75,
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(0,0,0,${op.strength})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
  ctx.restore();
}

/** Execute a plan onto a canvas (browser only — requires a 2D context). */
export function paintPlanToCanvas(
  plan: TexturePlan,
  canvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const target = canvas ?? document.createElement('canvas');
  target.width = plan.width;
  target.height = plan.height;
  const ctx = target.getContext('2d');
  if (!ctx) {
    throw new Error(
      `paintPlanToCanvas("${plan.name}"): 2D canvas context unavailable`,
    );
  }
  for (const op of plan.ops) paintOp(ctx, op);
  return target;
}

/** A texture factory turns a plan into something THREE can sample. */
export type TextureFactory = (plan: TexturePlan) => THREE.Texture;

/** Default browser factory: paint to canvas, wrap as CanvasTexture. */
export const createPlanTexture: TextureFactory = (plan) => {
  const texture = new THREE.CanvasTexture(paintPlanToCanvas(plan));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
};

/** Build every room texture from plans (browser default; DI-able for tests). */
export function renderTexturePlans(
  plans: Record<TextureKey, TexturePlan>,
  factory: TextureFactory = createPlanTexture,
): Record<TextureKey, THREE.Texture> {
  return {
    wood: factory(plans.wood),
    plaster: factory(plans.plaster),
    brass: factory(plans.brass),
    paper: factory(plans.paper),
    rug: factory(plans.rug),
    bookAtlas: factory(plans.bookAtlas),
    caseLabels: factory(plans.caseLabels),
    monitor: factory(plans.monitor),
    projector: factory(plans.projector),
    plaque: factory(plans.plaque),
  };
}

export function disposeTextures(
  textures: Record<TextureKey, THREE.Texture>,
): void {
  for (const texture of Object.values(textures)) texture.dispose();
}
