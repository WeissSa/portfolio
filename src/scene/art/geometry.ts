/**
 * Low-poly procedural furniture (REWORK_PLAN §3.5/§4.3): everything is built
 * from three primitives (box/plane/cylinder/cone/sphere), LatheGeometry
 * (lamp, projector lens) and ExtrudeGeometry (rounded rug). No model files.
 *
 * Factories return RoomPart[] — plain geometry + placement + a MaterialKey —
 * so they are fully testable headlessly (pure CPU math, no WebGL) and trivial
 * to render from React (`<mesh geometry material position …>`). Seeded jitter
 * keeps surfaces hand-made without breaking determinism.
 *
 * Local space convention: each factory builds around its own origin (usually
 * floor level, center); Room.tsx places the groups.
 */
import * as THREE from 'three';
import { createRng } from './rng';
import { BOOK_SPINE_COLORS, PALETTE } from './palette';
import type { MaterialKey } from './materials';

export type Vec3 = [number, number, number];

export interface RoomPart {
  id: string;
  geometry: THREE.BufferGeometry;
  material: MaterialKey;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}

export interface RoomDims {
  width: number;
  depth: number;
  height: number;
}

export const ROOM_DIMS: RoomDims = { width: 8, depth: 7, height: 3.2 };

function box(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

function part(
  id: string,
  geometry: THREE.BufferGeometry,
  material: MaterialKey,
  position?: Vec3,
  rotation?: Vec3,
): RoomPart {
  return { id, geometry, material, position, rotation };
}

/* ---------------------------------------------------------------- shell -- */

/** Floor, three walls (front stays open for the camera), ceiling, skirting. */
export function createRoomShell(dims: RoomDims = ROOM_DIMS): RoomPart[] {
  const { width: w, depth: d, height: h } = dims;
  const parts: RoomPart[] = [
    part(
      'floor',
      new THREE.PlaneGeometry(w, d),
      'wood',
      [0, 0, 0],
      [-Math.PI / 2, 0, 0],
    ),
    part(
      'ceiling',
      new THREE.PlaneGeometry(w, d),
      'plaster',
      [0, h, 0],
      [Math.PI / 2, 0, 0],
    ),
    part('wall-back', new THREE.PlaneGeometry(w, h), 'plaster', [
      0,
      h / 2,
      -d / 2,
    ]),
    part(
      'wall-left',
      new THREE.PlaneGeometry(d, h),
      'plaster',
      [-w / 2, h / 2, 0],
      [0, Math.PI / 2, 0],
    ),
    part(
      'wall-right',
      new THREE.PlaneGeometry(d, h),
      'plaster',
      [w / 2, h / 2, 0],
      [0, -Math.PI / 2, 0],
    ),
  ];
  // Skirting boards along the three walls.
  const skirtH = 0.12;
  parts.push(
    part('skirt-back', box(w, skirtH, 0.03), 'woodDark', [
      0,
      skirtH / 2,
      -d / 2 + 0.015,
    ]),
    part('skirt-left', box(0.03, skirtH, d), 'woodDark', [
      -w / 2 + 0.015,
      skirtH / 2,
      0,
    ]),
    part('skirt-right', box(0.03, skirtH, d), 'woodDark', [
      w / 2 - 0.015,
      skirtH / 2,
      0,
    ]),
  );
  return parts;
}

/* ----------------------------------------------------------------- desk -- */

export const DESK_TOP_HEIGHT = 0.76;

/** Writing desk: top, apron, four slightly uneven legs, drawer unit, brass pulls. */
export function createDesk(seed: string | number): RoomPart[] {
  const rng = createRng(typeof seed === 'string' ? `${seed}:desk` : seed + 11);
  const topW = 2.4;
  const topD = 1.05;
  const parts: RoomPart[] = [
    part('desk-top', box(topW, 0.07, topD), 'wood', [0, DESK_TOP_HEIGHT, 0]),
    part('desk-apron', box(topW - 0.14, 0.1, 0.04), 'woodDark', [
      0,
      DESK_TOP_HEIGHT - 0.09,
      -topD / 2 + 0.08,
    ]),
  ];
  const legInset = 0.1;
  const legPositions: [number, number][] = [
    [-topW / 2 + legInset, -topD / 2 + legInset],
    [topW / 2 - legInset, -topD / 2 + legInset],
    [-topW / 2 + legInset, topD / 2 - legInset],
  ];
  legPositions.forEach(([lx, lz], i) => {
    // Hand-made wobble: legs differ by a millimeter or two.
    const legH = DESK_TOP_HEIGHT - 0.035 + rng.range(-0.004, 0.004);
    parts.push(
      part(`desk-leg-${i}`, box(0.09, legH, 0.09), 'woodDark', [
        lx,
        legH / 2,
        lz,
      ]),
    );
  });
  // Drawer pedestal (right side, doubles as the fourth support).
  const pedW = 0.55;
  const pedH = DESK_TOP_HEIGHT - 0.07;
  const pedX = topW / 2 - legInset - pedW / 2 + 0.05;
  const pedZ = topD / 2 - legInset - 0.14;
  parts.push(
    part('desk-pedestal', box(pedW, pedH, 0.8), 'woodDark', [
      pedX,
      pedH / 2,
      pedZ - 0.1,
    ]),
  );
  for (let d = 0; d < 2; d += 1) {
    const dy = pedH * (0.3 + d * 0.4);
    parts.push(
      part(`desk-drawer-${d}`, box(pedW - 0.06, pedH * 0.3, 0.02), 'wood', [
        pedX,
        dy,
        pedZ + 0.31,
      ]),
    );
    parts.push(
      part(`desk-pull-${d}`, box(0.12, 0.02, 0.03), 'brass', [
        pedX,
        dy - 0.06,
        pedZ + 0.33,
      ]),
    );
  }
  return parts;
}

/* -------------------------------------------------------------- monitor -- */

/** CRT-ish flat monitor: bezel, emissive screen, stand. Origin at desk top. */
export function createMonitor(seed: string | number): RoomPart[] {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:monitor` : seed + 22,
  );
  const yaw = rng.range(-0.12, 0.12);
  const bezelW = 0.98;
  const bezelH = 0.6;
  const parts: RoomPart[] = [
    part(
      'monitor-base',
      new THREE.CylinderGeometry(0.17, 0.2, 0.03, 12),
      'metalDark',
      [0, 0.015, 0],
    ),
    part('monitor-neck', box(0.07, 0.24, 0.07), 'metalDark', [0, 0.14, 0]),
    part(
      'monitor-bezel',
      box(bezelW, bezelH, 0.05),
      'metalDark',
      [0, 0.56, 0],
      [0, yaw, 0],
    ),
    part(
      'monitor-screen',
      new THREE.PlaneGeometry(bezelW - 0.08, bezelH - 0.09),
      'monitorScreen',
      [Math.sin(yaw) * 0.027, 0.565, Math.cos(yaw) * 0.027],
      [0, yaw, 0],
    ),
    // Chin brand dot.
    part(
      'monitor-led',
      new THREE.CircleGeometry(0.008, 8),
      'led',
      [0, 0.3, 0.026],
    ),
  ];
  return parts;
}

/* -------------------------------------------------------------- tower ---- */

/** PC tower with side vents and a glowing power LED. Origin at floor. */
export function createPcTower(seed: string | number): RoomPart[] {
  const rng = createRng(typeof seed === 'string' ? `${seed}:tower` : seed + 33);
  const w = 0.24;
  const h = 0.52;
  const d = 0.48;
  const parts: RoomPart[] = [
    part('tower-case', box(w, h, d), 'metalDark', [0, h / 2, 0]),
    part('tower-front', box(w - 0.05, h - 0.06, 0.012), 'woodDark', [
      0,
      h / 2,
      d / 2 + 0.001,
    ]),
    part('tower-led', new THREE.CircleGeometry(0.012, 10), 'led', [
      rng.range(-0.07, -0.03),
      h - 0.1,
      d / 2 + 0.008,
    ]),
  ];
  for (let v = 0; v < 4; v += 1) {
    parts.push(
      part(
        `tower-vent-${v}`,
        box(0.01, 0.014, d - 0.14),
        'metalDark',
        [w / 2 + 0.001, h * 0.35 + v * 0.03, 0],
        [0, 0, 0],
      ),
    );
  }
  return parts;
}

/* ------------------------------------------------------------ bookshelf -- */

export interface ShelfCell {
  /** Cell center x (shelf-local). */
  x: number;
  /** Shelf board TOP surface y (books stand on this). */
  y: number;
  /** Cell center z. */
  z: number;
  /** Usable width / height / depth for books. */
  w: number;
  h: number;
  d: number;
}

export interface Bookshelf {
  parts: RoomPart[];
  cells: ShelfCell[];
}

export interface BookshelfOptions {
  bays?: number;
  shelves?: number;
  width?: number;
  height?: number;
  depth?: number;
}

/** Library bookshelf: sides, back, shelf boards, brass crown trim + cells. */
export function createBookshelf(
  seed: string | number,
  options: BookshelfOptions = {},
): Bookshelf {
  const rng = createRng(typeof seed === 'string' ? `${seed}:shelf` : seed + 44);
  const bays = options.bays ?? 3;
  const shelves = options.shelves ?? 4;
  const width = options.width ?? 2.7;
  const height = options.height ?? 2.2;
  const depth = options.depth ?? 0.32;
  const sideT = 0.05;
  const boardT = 0.035;
  const parts: RoomPart[] = [
    part('shelf-back', box(width, height, 0.02), 'woodDark', [
      0,
      height / 2,
      -depth / 2 + 0.01,
    ]),
    part('shelf-crown', box(width + 0.08, 0.07, depth + 0.06), 'wood', [
      0,
      height + 0.02,
      0,
    ]),
    part('shelf-crown-trim', box(width + 0.1, 0.015, depth + 0.08), 'brass', [
      0,
      height + 0.06,
      0,
    ]),
  ];
  for (let s = 0; s <= bays; s += 1) {
    const x = -width / 2 + (s * width) / bays;
    parts.push(
      part(`shelf-side-${s}`, box(sideT, height, depth), 'wood', [
        x,
        height / 2,
        0,
      ]),
    );
  }
  const bayW = width / bays - sideT;
  const shelfSpacing = height / (shelves + 1);
  const cells: ShelfCell[] = [];
  for (let shelf = 0; shelf <= shelves; shelf += 1) {
    const y = shelf * shelfSpacing;
    if (shelf > 0) {
      parts.push(
        part(
          `shelf-board-${shelf}`,
          box(width - sideT, boardT, depth - 0.02),
          'wood',
          [0, y + boardT / 2, 0],
        ),
      );
    }
    if (shelf === shelves) continue; // top board is the crown; no cell above it
    for (let bay = 0; bay < bays; bay += 1) {
      const cx = -width / 2 + (bay + 0.5) * (width / bays);
      cells.push({
        x: cx,
        y: y + boardT + rng.range(0, 0.002),
        z: rng.range(-0.02, 0.02),
        w: bayW - 0.06,
        h: shelfSpacing - boardT - 0.06,
        d: depth - 0.1,
      });
    }
  }
  // Base plinth.
  parts.push(
    part(
      'shelf-plinth',
      box(width + 0.04, 0.08, depth + 0.04),
      'woodDark',
      [0, 0.04, 0],
    ),
  );
  return { parts, cells };
}

/* ---------------------------------------------------------------- books -- */

export interface BookInstance {
  position: Vec3;
  scale: Vec3;
  /** Small z-axis lean, radians. */
  tilt: number;
  color: string;
}

export const MAX_BOOK_INSTANCES = 160;

/**
 * Deterministic book scatter across shelf cells: varied widths/heights,
 * occasional lean, gaps and bookends, rare P5-red accent spine, slightly
 * brighter cloth for featured titles. Rendered as ONE InstancedMesh (§3.8).
 */
export function createBookInstances(
  seed: string | number,
  cells: readonly ShelfCell[],
  options: {
    fill?: number;
    maxBooks?: number;
    featured?: readonly number[];
  } = {},
): BookInstance[] {
  const rng = createRng(typeof seed === 'string' ? `${seed}:books` : seed + 55);
  const fill = options.fill ?? 0.85;
  const maxBooks = Math.min(
    options.maxBooks ?? MAX_BOOK_INSTANCES,
    MAX_BOOK_INSTANCES,
  );
  const featured = new Set(options.featured ?? []);
  const books: BookInstance[] = [];
  cells.forEach((cell, cellIndex) => {
    if (books.length >= maxBooks) return;
    let cursor = -cell.w / 2;
    while (cursor < cell.w / 2 - 0.035 && books.length < maxBooks) {
      if (rng.chance(0.12)) {
        // Breathing room / a lying stack.
        cursor += rng.range(0.02, 0.06);
        continue;
      }
      const bookW = rng.range(0.028, 0.055);
      const isFeatured = featured.has(cellIndex) && rng.chance(0.5);
      const bookH =
        cell.h * (isFeatured ? rng.range(0.92, 0.99) : rng.range(0.68, 0.95));
      const bookD = cell.d * rng.range(0.8, 1);
      const tilt = rng.chance(0.12) ? rng.range(-0.16, 0.16) : 0;
      const color = isFeatured
        ? rng.chance(0.6)
          ? PALETTE.p5Red
          : PALETTE.brassLight
        : rng.chance(0.06)
          ? PALETTE.p5Red
          : rng.pick(BOOK_SPINE_COLORS);
      books.push({
        position: [cell.x + cursor + bookW / 2, cell.y + bookH / 2, cell.z],
        scale: [bookW, bookH, bookD],
        tilt,
        color: rng.chance(1 - fill) ? shade(color) : color,
      });
      cursor += bookW + rng.range(0.002, 0.008);
    }
  });
  return books;
}

function shade(color: string): string {
  // Slight deterministic-in-context darkening for "fill" variety.
  const c = new THREE.Color(color);
  c.multiplyScalar(0.85);
  return `#${c.getHexString()}`;
}

/* ------------------------------------------------------------------ rug -- */

/** Rounded-corner rug via ExtrudeGeometry (thin, lies flat). */
export function createRugGeometry(
  width = 3.2,
  depth = 2.2,
  radius = 0.18,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = width / 2;
  const d = depth / 2;
  const r = Math.min(radius, w, d);
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/* ----------------------------------------------------------------- lamp -- */

/** Floor lamp: lathe base, pole, lathe shade, emissive bulb, brass finial. */
export function createLamp(seed: string | number): RoomPart[] {
  const rng = createRng(typeof seed === 'string' ? `${seed}:lamp` : seed + 66);
  const baseProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.17, 0),
    new THREE.Vector2(0.19, 0.025),
    new THREE.Vector2(0.07, 0.06),
    new THREE.Vector2(0.035, 0.09),
  ];
  const shadeProfile = [
    new THREE.Vector2(0.1, 0),
    new THREE.Vector2(0.23, 0.3),
  ];
  const poleH = 1.32;
  const shadeY = poleH + 0.05;
  const tilt = rng.range(-0.02, 0.02);
  return [
    part(
      'lamp-base',
      new THREE.LatheGeometry(baseProfile, 14),
      'metalDark',
      [0, 0, 0],
    ),
    part(
      'lamp-pole',
      new THREE.CylinderGeometry(0.022, 0.026, poleH, 8),
      'brass',
      [0, poleH / 2 + 0.06, 0],
      [0, 0, tilt],
    ),
    part(
      'lamp-shade',
      new THREE.LatheGeometry(shadeProfile, 16, 0, Math.PI * 2),
      'lampShade',
      [0, shadeY, 0],
    ),
    part('lamp-bulb', new THREE.SphereGeometry(0.05, 10, 8), 'bulb', [
      0,
      shadeY + 0.1,
      0,
    ]),
    part('lamp-finial', new THREE.SphereGeometry(0.02, 8, 6), 'brass', [
      0,
      shadeY + 0.31,
      0,
    ]),
  ];
}

/** World-space position of the lamp bulb for the matching point light. */
export const LAMP_BULB_LOCAL: Vec3 = [0, 1.47, 0];

/* ------------------------------------------------------------ projector -- */

/**
 * Wall-shelf projector (body + lathe lens + brass bracket) and its additive
 * light cone. The cone is returned with material 'beam'; Room.tsx orients it.
 */
export function createProjector(seed: string | number): RoomPart[] {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:projector` : seed + 77,
  );
  const yaw = rng.range(-0.05, 0.05);
  const lensProfile = [
    new THREE.Vector2(0.03, 0),
    new THREE.Vector2(0.052, 0.02),
    new THREE.Vector2(0.058, 0.07),
    new THREE.Vector2(0.05, 0.1),
  ];
  return [
    part(
      'projector-body',
      box(0.36, 0.15, 0.28),
      'metalDark',
      [0, 0.075, 0],
      [0, yaw, 0],
    ),
    part(
      'projector-top',
      box(0.3, 0.02, 0.22),
      'woodDark',
      [0, 0.16, 0],
      [0, yaw, 0],
    ),
    part(
      'projector-lens',
      new THREE.LatheGeometry(lensProfile, 14),
      'brass',
      [0, 0.075, -0.14],
      [Math.PI / 2, 0, 0],
    ),
    part(
      'projector-lens-glass',
      new THREE.CircleGeometry(0.03, 12),
      'bulb',
      [0, 0.075, -0.19],
    ),
    part(
      'projector-bracket-l',
      box(0.03, 0.22, 0.03),
      'brass',
      [-0.14, -0.11, 0.08],
    ),
    part(
      'projector-bracket-r',
      box(0.03, 0.22, 0.03),
      'brass',
      [0.14, -0.11, 0.08],
    ),
  ];
}

/** Additive light cone from a projector lens toward the screen (opens -z). */
export function createLightCone(length = 2.4, endRadius = 0.75): RoomPart {
  const geometry = new THREE.ConeGeometry(endRadius, length, 20, 1, true);
  // Cone apex at +y by default; orient so the apex sits at the local origin
  // and the wide opening faces -z (the projector's throw direction).
  geometry.translate(0, -length / 2, 0);
  geometry.rotateX(Math.PI / 2);
  return part('projector-beam', geometry, 'beam');
}

/* --------------------------------------------------------------- frames -- */

/** Framed silhouette portrait: wood frame, brass slip, paper mat, bust shape. */
export function createFramedSilhouette(
  seed: string | number,
  variant = 0,
): RoomPart[] {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:frame${variant}` : seed + 88 + variant,
  );
  const w = 0.46 + rng.range(-0.04, 0.04);
  const h = 0.62 + rng.range(-0.05, 0.05);
  const t = 0.045;
  const parts: RoomPart[] = [
    part(`frame-back-${variant}`, box(w, h, 0.03), 'woodDark'),
    part(
      `frame-mat-${variant}`,
      new THREE.PlaneGeometry(w - t * 1.6, h - t * 1.6),
      'paper',
      [0, 0, 0.016],
    ),
  ];
  parts.push(
    part(`frame-top-${variant}`, box(w, t, 0.05), 'wood', [
      0,
      h / 2 - t / 2,
      0.005,
    ]),
    part(`frame-bottom-${variant}`, box(w, t, 0.05), 'wood', [
      0,
      -h / 2 + t / 2,
      0.005,
    ]),
    part(`frame-left-${variant}`, box(t, h, 0.05), 'wood', [
      -w / 2 + t / 2,
      0,
      0.005,
    ]),
    part(`frame-right-${variant}`, box(t, h, 0.05), 'wood', [
      w / 2 - t / 2,
      0,
      0.005,
    ]),
  );
  // Bust silhouette: shoulders + head, via THREE.Shape (deterministic).
  const shape = new THREE.Shape();
  const bustH = (h - t * 2) * 0.52;
  shape.moveTo(-bustH * 0.55, -bustH * 0.5);
  shape.quadraticCurveTo(
    -bustH * 0.5,
    bustH * 0.05,
    -bustH * 0.16,
    bustH * 0.1,
  );
  shape.quadraticCurveTo(-bustH * 0.22, bustH * 0.55, 0, bustH * 0.55);
  shape.quadraticCurveTo(bustH * 0.22, bustH * 0.55, bustH * 0.16, bustH * 0.1);
  shape.quadraticCurveTo(bustH * 0.5, bustH * 0.05, bustH * 0.55, -bustH * 0.5);
  shape.lineTo(-bustH * 0.55, -bustH * 0.5);
  const bust = new THREE.ShapeGeometry(shape, 6);
  parts.push(
    part(`frame-bust-${variant}`, bust, 'silhouette', [
      0,
      -bustH * 0.06,
      0.018,
    ]),
  );
  return parts;
}

/* --------------------------------------------------------------- window -- */

/** Night window: frame, mullions, emissive glass, sill. Faces +z locally. */
export function createWindow(): RoomPart[] {
  const w = 1.3;
  const h = 1.8;
  const t = 0.09;
  return [
    part(
      'window-glass',
      new THREE.PlaneGeometry(w - t, h - t),
      'nightGlass',
      [0, 0, -0.02],
    ),
    part('window-frame-top', box(w, t, 0.12), 'woodDark', [
      0,
      h / 2 - t / 2,
      0,
    ]),
    part('window-frame-bottom', box(w, t, 0.12), 'woodDark', [
      0,
      -h / 2 + t / 2,
      0,
    ]),
    part('window-frame-left', box(t, h, 0.12), 'woodDark', [
      -w / 2 + t / 2,
      0,
      0,
    ]),
    part('window-frame-right', box(t, h, 0.12), 'woodDark', [
      w / 2 - t / 2,
      0,
      0,
    ]),
    part(
      'window-mullion-v',
      box(0.045, h - t * 2, 0.06),
      'woodDark',
      [0, 0, 0.01],
    ),
    part(
      'window-mullion-h',
      box(w - t * 2, 0.045, 0.06),
      'woodDark',
      [0, 0.15, 0.01],
    ),
    part('window-sill', box(w + 0.2, 0.06, 0.26), 'wood', [
      0,
      -h / 2 - 0.02,
      0.08,
    ]),
    part(
      'window-brass-rod',
      new THREE.CylinderGeometry(0.015, 0.015, w + 0.4, 8),
      'brass',
      [0, h / 2 + 0.16, 0.1],
      [0, 0, Math.PI / 2],
    ),
  ];
}

/* ------------------------------------------------------------ game cases -- */

/**
 * Collectible game cases lying flat (commit 8 makes them interactive). Each
 * case's lid plane gets its UVs remapped into cell `index` of the caseLabels
 * atlas strip.
 */
export function createGameCases(
  seed: string | number,
  count: number,
  atlasColumns = 5,
): RoomPart[] {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:cases3d` : seed + 99,
  );
  const caseW = 0.15;
  const caseH = 0.028;
  const caseD = 0.2;
  const parts: RoomPart[] = [];
  for (let i = 0; i < count; i += 1) {
    const yaw = rng.range(-0.5, 0.5);
    const body = part(
      `case-body-${i}`,
      box(caseW, caseH, caseD),
      'metalDark',
      [rng.range(-0.01, 0.01), caseH / 2, rng.range(-0.01, 0.01)],
      [0, yaw, 0],
    );
    const lid = new THREE.PlaneGeometry(caseW - 0.012, caseD - 0.012);
    // Remap UVs [0,1]² → cell i of the horizontal atlas strip.
    const uv = lid.getAttribute('uv');
    for (let v = 0; v < uv.count; v += 1) {
      uv.setX(v, (i + uv.getX(v)) / atlasColumns);
    }
    uv.needsUpdate = true;
    // Bake the flat orientation + yaw into the geometry so the lid always
    // matches the body's heading (no Euler-order guesswork).
    lid.rotateX(-Math.PI / 2);
    lid.rotateY(yaw);
    parts.push(body);
    parts.push(part(`case-lid-${i}`, lid, 'caseLabel', [0, caseH + 0.001, 0]));
  }
  return parts;
}

/* -------------------------------------------------------------- helpers -- */

/** Sum of vertex counts across parts — used by budget tests (§3.8/§4.3). */
export function countVertices(parts: readonly RoomPart[]): number {
  return parts.reduce(
    (total, p) => total + (p.geometry.getAttribute('position')?.count ?? 0),
    0,
  );
}

/** Deterministic geometry fingerprint (rounded position-attribute checksum). */
export function geometryChecksum(geometry: THREE.BufferGeometry): number {
  const attr = geometry.getAttribute('position');
  if (!attr) return 0;
  let sum = 0;
  for (let i = 0; i < attr.count; i += 1) {
    sum +=
      Math.round(attr.getX(i) * 1e4) +
      Math.round(attr.getY(i) * 1e4) * 31 +
      Math.round(attr.getZ(i) * 1e4) * 97;
  }
  return Math.round(sum);
}

/** Dispose every geometry in a part list (Room unmount). */
export function disposeParts(parts: readonly RoomPart[]): void {
  for (const p of parts) p.geometry.dispose();
}
