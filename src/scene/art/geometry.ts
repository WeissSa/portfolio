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
import { PLAQUE } from '../diegetic';
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

/**
 * Chamfered box (art-overhaul commit 3a): an ExtrudeGeometry of the w×h
 * cross-section with a single bevel segment, so every long edge AND both end
 * faces catch the key light — an authored silhouette instead of a flat-shaded
 * cuboid. ExtrudeGeometry's bevel GROWS the contour outward by bevelSize and
 * adds bevelThickness on both ends, so the shape is inset by `b` and the
 * extrusion shortened by 2b — the result has exactly the requested outer
 * dimensions, centered on its bounding box: a drop-in replacement for box().
 */
export function beveledBox(
  w: number,
  h: number,
  d: number,
  bevel = 0.012,
): THREE.BufferGeometry {
  const b = Math.max(
    0.002,
    Math.min(bevel, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002),
  );
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + b, -h / 2 + b);
  shape.lineTo(w / 2 - b, -h / 2 + b);
  shape.lineTo(w / 2 - b, h / 2 - b);
  shape.lineTo(-w / 2 + b, h / 2 - b);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, d - 2 * b),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geometry.center();
  return geometry;
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

/**
 * Bake a family of STATIC parts that share one material into a single geometry
 * (art-overhaul commit 3c): N same-material meshes become ONE draw call. Local
 * transforms are applied to cloned vertex data, the source geometries are
 * disposed, and the returned part owns the merged geometry. Only use for parts
 * with identical attribute sets (boxes/planes/extrudes: position/normal/uv) and
 * no per-part picking or animation. Pure CPU math — testable without WebGL.
 */
export function mergeStaticParts(
  id: string,
  parts: readonly RoomPart[],
): RoomPart {
  const first = parts[0];
  if (!first) throw new Error('mergeStaticParts: no parts to merge');
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const hasColor = Boolean(first.geometry.getAttribute('color'));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  for (const item of parts) {
    const geometry = item.geometry.index
      ? item.geometry.toNonIndexed()
      : item.geometry.clone();
    euler.set(...(item.rotation ?? [0, 0, 0]));
    quaternion.setFromEuler(euler);
    position.set(...(item.position ?? [0, 0, 0]));
    scale.set(...(item.scale ?? [1, 1, 1]));
    geometry.applyMatrix4(matrix.compose(position, quaternion, scale));
    const vertices = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    if (!vertices || !normal || !uv) {
      geometry.dispose();
      throw new Error(`mergeStaticParts: ${item.id} lacks position/normal/uv`);
    }
    const color = hasColor ? geometry.getAttribute('color') : null;
    for (let i = 0; i < vertices.count; i += 1) {
      positions.push(vertices.getX(i), vertices.getY(i), vertices.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
      if (color) colors.push(color.getX(i), color.getY(i), color.getZ(i));
    }
    geometry.dispose();
    item.geometry.dispose(); // the merged part now owns the vertex data
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (hasColor) {
    merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  return { id, geometry: merged, material: first.material };
}

/**
 * Group a STATIC family by material and merge same-material siblings into one
 * draw call (draw-call budget work, perf(ux)). `mergeStaticParts` bakes each
 * local TRS into the vertex data, so the merged part needs no per-frame matrix
 * work and keeps the exact authored pose. Parts carrying extra baked
 * attributes (e.g. the floor's vertex AO `color`) are bucketed separately so
 * no per-vertex data is silently dropped; a group of one is left untouched.
 *
 * Never call this on pickable/animated families (plaque rows, lifted cases,
 * monitor, books) — those need their own geometry identity for picking.
 */
export function mergePartsByMaterial(
  familyId: string,
  parts: readonly RoomPart[],
): RoomPart[] {
  const groups = new Map<string, RoomPart[]>();
  const order: string[] = [];
  for (const item of parts) {
    // Attribute signature must match or mergeStaticParts would discard data.
    const signature = Object.keys(item.geometry.attributes).sort().join(',');
    const key = `${item.material}|${signature}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }
  const merged: RoomPart[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    merged.push(
      group.length === 1
        ? group[0]!
        : mergeStaticParts(`${familyId}-${group[0]!.material}`, group),
    );
  }
  return merged;
}

/* ---------------------------------------------------------------- shell -- */

/**
 * Baked vertex-color ambient occlusion (art-overhaul commit 3b): darkens
 * vertices that sit close to the geometry's bounding-box edges, so big flat
 * surfaces (the floor) read as grounded against the walls instead of floating
 * under a flat light. Writes an RGB `color` attribute in [1-strength, 1];
 * the consuming material must set vertexColors: true. Returns the same
 * geometry for chaining; pure CPU math, unit-testable headlessly.
 */
export function paintEdgeAO(
  geometry: THREE.BufferGeometry,
  options: { falloff?: number; strength?: number } = {},
): THREE.BufferGeometry {
  const falloff = options.falloff ?? 0.3;
  const strength = options.strength ?? 0.5;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox ?? new THREE.Box3();
  const size = bounds.getSize(new THREE.Vector3());
  const position = geometry.getAttribute('position');
  // Flat geometry (a plane's zero-thickness axis) must NOT count as "at the
  // edge" — only non-degenerate extents measure distance-to-edge, and the
  // falloff band is a fraction of the smaller real extent so wide floors get
  // a proportionate darkened border.
  const spans = [size.x, size.y, size.z].filter((span) => span > 1e-4);
  if (!position || position.count === 0 || spans.length === 0) {
    return geometry;
  }
  const colors = new Float32Array(position.count * 3);
  const band = Math.max(1e-6, falloff * Math.min(...spans) * 0.5);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    let distance = Number.POSITIVE_INFINITY;
    if (size.x > 1e-4) {
      distance = Math.min(distance, x - bounds.min.x, bounds.max.x - x);
    }
    if (size.y > 1e-4) {
      distance = Math.min(distance, y - bounds.min.y, bounds.max.y - y);
    }
    if (size.z > 1e-4) {
      distance = Math.min(distance, z - bounds.min.z, bounds.max.z - z);
    }
    const ao = 1 - strength * (1 - Math.min(1, Math.max(0, distance / band)));
    colors[i * 3] = ao;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Floor, three walls (front stays open for the camera), ceiling, skirting. */
export function createRoomShell(dims: RoomDims = ROOM_DIMS): RoomPart[] {
  const { width: w, depth: d, height: h } = dims;
  // The floor gets a subdivided plane + baked edge AO (commit 3b) so the room
  // grounds against the walls; the 'floor' material enables vertexColors.
  const floorGeometry = paintEdgeAO(new THREE.PlaneGeometry(w, d, 12, 10), {
    falloff: 0.3,
    strength: 0.55,
  });
  const parts: RoomPart[] = [
    part('floor', floorGeometry, 'floor', [0, 0, 0], [-Math.PI / 2, 0, 0]),
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
  // Skirting boards along the three walls (3c: merged to ONE draw call).
  const skirtH = 0.12;
  parts.push(
    mergeStaticParts('skirting', [
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
    part('desk-top', beveledBox(topW, 0.07, topD, 0.014), 'wood', [
      0,
      DESK_TOP_HEIGHT,
      0,
    ]),
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
    part('desk-pedestal', beveledBox(pedW, pedH, 0.8, 0.01), 'woodDark', [
      pedX,
      pedH / 2,
      pedZ - 0.1,
    ]),
  );
  const pulls: RoomPart[] = [];
  for (let d = 0; d < 2; d += 1) {
    const dy = pedH * (0.3 + d * 0.4);
    parts.push(
      part(`desk-drawer-${d}`, box(pedW - 0.06, pedH * 0.3, 0.02), 'wood', [
        pedX,
        dy,
        pedZ + 0.31,
      ]),
    );
    pulls.push(
      part(`desk-pull-${d}`, box(0.12, 0.02, 0.03), 'brass', [
        pedX,
        dy - 0.06,
        pedZ + 0.33,
      ]),
    );
  }
  // Both brass pulls share a material and never move independently.
  parts.push(mergeStaticParts('desk-pulls', pulls));
  return parts;
}

/* ---------------------------------------------------------- wall plaque -- */

/**
 * CANONICAL global-nav plaque (commit 4): beveled dark-wood board, raised
 * brass inlay frame, four corner rosettes, two P5-ish brass slash/jag motifs,
 * a dark inlay panel and a thin purple inlay line. The lettered face is a
 * separate plane carrying the seeded `plaque` CanvasTexture (gilt lettering
 * on ink, NEVER on brass). Local origin is the plaque centre, face +z.
 */
export function createWallPlaque(seed: string | number): RoomPart[] {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:wall-plaque` : seed + 404,
  );
  const w = PLAQUE.width;
  const h = PLAQUE.height;
  const parts: RoomPart[] = [
    part(
      'plaque-board',
      beveledBox(w + 0.12, h + 0.12, 0.09, 0.018),
      'woodDark',
      [0, 0, -0.045],
    ),
    part(
      'plaque-inlay-panel',
      box(w + 0.01, h + 0.01, 0.008),
      'silhouette',
      [0, 0, 0.006],
    ),
    part(
      'plaque-lettered-face',
      new THREE.PlaneGeometry(w, h),
      'plaqueFace',
      [0, 0, 0.012],
    ),
  ];
  const frame: RoomPart[] = [
    part('plaque-frame-top', box(w + 0.06, 0.02, 0.014), 'brass', [
      0,
      h / 2 + 0.015,
      0.016,
    ]),
    part('plaque-frame-bottom', box(w + 0.06, 0.02, 0.014), 'brass', [
      0,
      -h / 2 - 0.015,
      0.016,
    ]),
    part('plaque-frame-left', box(0.02, h + 0.05, 0.014), 'brass', [
      -w / 2 - 0.015,
      0,
      0.016,
    ]),
    part('plaque-frame-right', box(0.02, h + 0.05, 0.014), 'brass', [
      w / 2 + 0.015,
      0,
      0.016,
    ]),
  ];
  parts.push(mergeStaticParts('plaque-brass-frame', frame));
  // Raised rosettes: cylinder axis is +y, rotate onto the wall (+z).
  const rosettes: RoomPart[] = [];
  const corners: [number, number][] = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ];
  for (const [sx, sy] of corners) {
    rosettes.push(
      part(
        `plaque-rosette-${sx}-${sy}`,
        new THREE.CylinderGeometry(0.042, 0.042, 0.014, 10),
        'brass',
        [sx * (w / 2 + 0.012), sy * (h / 2 + 0.012), 0.026],
        [Math.PI / 2, 0, 0],
      ),
    );
  }
  parts.push(...rosettes);
  // Two brass jag inlays at the board edges, echoing the painted slash motif.
  parts.push(
    part(
      'plaque-jag-left',
      box(0.012, 0.18, 0.01),
      'brass',
      [-w / 2 - 0.032, rng.range(-0.12, 0.12), 0.02],
      [0, 0, 0.42],
    ),
    part(
      'plaque-jag-right',
      box(0.012, 0.18, 0.01),
      'brass',
      [w / 2 + 0.032, rng.range(-0.12, 0.12), 0.02],
      [0, 0, -0.42],
    ),
    // Thin purple inlay under the heading band (accent only, never lettering).
    part('plaque-purple-inlay', box(w - 0.12, 0.004, 0.006), 'plaqueAccent', [
      0,
      h / 2 - 0.1,
      0.018,
    ]),
  );
  return parts;
}

/* -------------------------------------------------------------- monitor -- */

/** Local y of the monitor's screen quad (shared with the desktop-zoom camera). */
export const MONITOR_SCREEN_LOCAL_Y = 0.565;

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
      beveledBox(bezelW, bezelH, 0.05, 0.01),
      'metalDark',
      [0, 0.56, 0],
      [0, yaw, 0],
    ),
    part(
      'monitor-screen',
      new THREE.PlaneGeometry(bezelW - 0.08, bezelH - 0.09),
      'monitorScreen',
      [Math.sin(yaw) * 0.027, MONITOR_SCREEN_LOCAL_Y, Math.cos(yaw) * 0.027],
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
    part('tower-case', beveledBox(w, h, d, 0.016), 'metalDark', [0, h / 2, 0]),
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
  const vents: RoomPart[] = [];
  for (let v = 0; v < 4; v += 1) {
    vents.push(
      part(
        `tower-vent-${v}`,
        box(0.01, 0.014, d - 0.14),
        'metalDark',
        [w / 2 + 0.001, h * 0.35 + v * 0.03, 0],
        [0, 0, 0],
      ),
    );
  }
  // Four identical metalDark vents: one merged mesh, three fewer draw calls.
  parts.push(mergeStaticParts('tower-vents', vents));
  return parts;
}

/* --------------------------------------------------------------- chair -- */

/**
 * Author-written desk chair (art-overhaul commit 3a): beveled seat, a CURVED
 * backrest shell (open partial cylinder — the silhouette reads as a bentwood
 * throne, not a slab), a top rail and four slightly splayed turned legs.
 * Origin at floor level, facing +z; Room.tsx rotates it toward the desk.
 */
export function createChair(seed: string | number): RoomPart[] {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:chair` : seed + 111,
  );
  const seatH = 0.44;
  const seatW = 0.44;
  const seatD = 0.42;
  const backR = 0.27;
  const backArc = 1.55; // radians of the wrap-around shell
  const parts: RoomPart[] = [
    part('chair-seat', beveledBox(seatW, 0.05, seatD, 0.012), 'wood', [
      0,
      seatH,
      0,
    ]),
  ];
  // Curved backrest: open cylinder arc centered on -z (theta=π faces -z).
  const shell = new THREE.CylinderGeometry(
    backR,
    backR,
    0.4,
    14,
    1,
    true,
    Math.PI - backArc / 2,
    backArc,
  );
  parts.push(part('chair-back', shell, 'woodDark', [0, seatH + 0.26, 0.01]));
  // Rails cap the shell top and bottom (thicker crown, thin lumbar band).
  for (const [railY, railH, railR, key] of [
    [seatH + 0.48, 0.055, backR + 0.006, 'chair-rail-top'],
    [seatH + 0.09, 0.035, backR + 0.004, 'chair-rail-low'],
  ] as [number, number, number, string][]) {
    parts.push(
      part(
        key,
        new THREE.CylinderGeometry(
          railR,
          railR,
          railH,
          14,
          1,
          true,
          Math.PI - backArc / 2,
          backArc,
        ),
        'wood',
        [0, railY, 0.01],
      ),
    );
  }
  // Four turned legs, splayed a millimeter-scale amount (hand-made wobble).
  const legInsetX = seatW / 2 - 0.055;
  const legInsetZ = seatD / 2 - 0.055;
  const legCorners: [number, number][] = [
    [-legInsetX, -legInsetZ],
    [legInsetX, -legInsetZ],
    [-legInsetX, legInsetZ],
    [legInsetX, legInsetZ],
  ];
  legCorners.forEach(([lx, lz], i) => {
    const splayX = lx > 0 ? 0.055 : -0.055;
    const splayZ = lz > 0 ? 0.05 : -0.05;
    parts.push(
      part(
        `chair-leg-${i}`,
        new THREE.CylinderGeometry(0.017, 0.023, seatH - 0.02, 8, 1, false),
        'woodDark',
        [lx, (seatH - 0.02) / 2, lz],
        [splayZ + rng.range(-0.008, 0.008), 0, -splayX],
      ),
    );
  });
  return parts;
}

/* ---------------------------------------------------- narrative props -- */

/**
 * The curated 7-item narrative prop set (art-overhaul commit 3a). Each prop is
 * authored with UNIQUE proportions — no instanced clones — and belongs to one
 * placement subset so Room.tsx can parent it to the right group:
 *
 *   desk    (desk-group local):   mug under the lamp light pool, keyboard
 *   monitor (monitor-offset grp): headphones draped over the bezel's top-right
 *   floor   (world space):        paper stack + cable coil beside the tower
 *   tower   (tower-group local):  two sticky notes on the front panel
 *   shelf   (shelf-group local):  a glowing elixir flask on the crown
 *
 * Positions are SPECIFIED (see each comment) so the composition stays an art
 * decision, not a scatter roll; the seed only drives millimeter jitter.
 */
export interface NarrativeProps {
  desk: RoomPart[];
  monitor: RoomPart[];
  floor: RoomPart[];
  tower: RoomPart[];
  shelf: RoomPart[];
}

export const NARRATIVE_PROP_IDS = [
  'prop-mug',
  'prop-headphones',
  'prop-paper-stack',
  'prop-cable-coil',
  'prop-sticky-notes',
  'prop-keyboard',
  'prop-flask',
] as const;

export function createNarrativeProps(seed: string | number): NarrativeProps {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:props` : seed + 123,
  );

  /* 1. Mug — desk local, directly under the desk-lamp light pool (the key
   *    light aims at desk-local x≈-0.6, so the mug sits in the bright pool). */
  const mugProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.038, 0),
    new THREE.Vector2(0.043, 0.008),
    new THREE.Vector2(0.036, 0.055),
    new THREE.Vector2(0.041, 0.088),
    new THREE.Vector2(0.038, 0.092),
  ];
  const desk: RoomPart[] = [
    part(
      'prop-mug-body',
      new THREE.LatheGeometry(mugProfile, 14),
      'paper',
      [-0.6, DESK_TOP_HEIGHT + 0.035, 0.14],
      [0, rng.range(-0.4, 0.4), 0],
    ),
    part(
      'prop-mug-handle',
      new THREE.TorusGeometry(0.026, 0.006, 5, 10),
      'paper',
      [-0.553, DESK_TOP_HEIGHT + 0.035 + 0.05, 0.14],
      [0, 0, 0.2],
    ),
  ];

  /* 6. Keyboard — desk local, square with the monitor, yawed a few degrees
   *    as if pushed aside after a long session. Base + key deck + row bars. */
  const kbX = -0.3;
  const kbY = DESK_TOP_HEIGHT + 0.035;
  const kbZ = 0.2;
  const kbYaw = -0.06 + rng.range(-0.02, 0.02);
  desk.push(
    part(
      'prop-keyboard-base',
      beveledBox(0.4, 0.014, 0.145, 0.004),
      'metalDark',
      [kbX, kbY + 0.007, kbZ],
      [0, kbYaw, 0],
    ),
    part(
      'prop-keyboard-keys',
      box(0.37, 0.006, 0.1),
      'silhouette',
      [kbX, kbY + 0.017, kbZ - 0.01],
      [0, kbYaw, 0],
    ),
    part(
      'prop-keyboard-row-a',
      box(0.35, 0.004, 0.018),
      'metalDark',
      [kbX, kbY + 0.022, kbZ - 0.045],
      [0, kbYaw, 0],
    ),
    part(
      'prop-keyboard-row-b',
      box(0.35, 0.004, 0.018),
      'metalDark',
      [kbX, kbY + 0.022, kbZ - 0.005],
      [0, kbYaw, 0],
    ),
  );

  /* 2. Headphones — monitor-group local, draped over the bezel's top-right
   *    corner: half-torus band arching front↔back over the edge, two cups. */
  const hpX = 0.28;
  const hpY = 0.86; // bezel top edge (center 0.56 + h/2)
  const monitor: RoomPart[] = [
    part(
      'prop-headphones-band',
      new THREE.TorusGeometry(0.075, 0.011, 6, 14, Math.PI),
      'silhouette',
      [hpX, hpY, 0],
      [0, Math.PI / 2, 0],
    ),
    part(
      'prop-headphones-cup-front',
      new THREE.CylinderGeometry(0.042, 0.05, 0.028, 12),
      'metalDark',
      [hpX, hpY - 0.062, 0.075],
      [Math.PI / 2 + 0.12, 0, 0],
    ),
    part(
      'prop-headphones-cup-back',
      new THREE.CylinderGeometry(0.042, 0.05, 0.028, 12),
      'metalDark',
      [hpX, hpY - 0.062, -0.075],
      [Math.PI / 2 - 0.12, 0, 0],
    ),
  ];

  /* 3. Paper stack — world space on the floor beside the PC tower
   *    (tower stands at [3.3, 0, -2.9]); three sheets, each its own size. */
  const stackX = 2.94;
  const stackZ = -2.5;
  const floor: RoomPart[] = [
    part(
      'prop-paper-stack-0',
      box(0.24, 0.012, 0.33),
      'paper',
      [stackX, 0.006, stackZ],
      [0, 0.07, 0],
    ),
    part(
      'prop-paper-stack-1',
      box(0.225, 0.011, 0.315),
      'paper',
      [stackX + 0.012, 0.0175, stackZ - 0.006],
      [0, -0.11, 0],
    ),
    part(
      'prop-paper-stack-2',
      box(0.25, 0.01, 0.3),
      'paper',
      [stackX - 0.008, 0.028, stackZ + 0.01],
      [0, 0.19, 0],
    ),
  ];

  /* 4. Cable coil — world space on the floor between tower and desk: two
   *    flat torus loops at different radii + a loose tail. */
  const ccX = 2.6;
  const ccZ = -2.16;
  floor.push(
    part(
      'prop-cable-coil-loop-a',
      new THREE.TorusGeometry(0.135, 0.011, 5, 20),
      'silhouette',
      [ccX, 0.012, ccZ],
      [Math.PI / 2, 0, 0],
    ),
    part(
      'prop-cable-coil-loop-b',
      new THREE.TorusGeometry(0.1, 0.011, 5, 20),
      'silhouette',
      [ccX + 0.008, 0.036, ccZ - 0.004],
      [Math.PI / 2 + 0.09, 0.3, 0],
    ),
    part(
      'prop-cable-coil-tail',
      new THREE.CylinderGeometry(0.009, 0.007, 0.24, 6),
      'silhouette',
      [ccX + 0.14, 0.01, ccZ + 0.13],
      [Math.PI / 2 - 0.15, 0.7, 0],
    ),
  );

  /* 5. Sticky notes — tower-group local, on the front panel (z = +0.24):
   *    two squares, different sizes and tilts, like sprint reminders. */
  const tower: RoomPart[] = [
    part(
      'prop-sticky-note-a',
      new THREE.PlaneGeometry(0.075, 0.075),
      'paper',
      [-0.05, 0.35, 0.247],
      [0, 0, 0.09],
    ),
    part(
      'prop-sticky-note-b',
      new THREE.PlaneGeometry(0.06, 0.06),
      'paper',
      [0.052, 0.255, 0.247],
      [0, 0, -0.14],
    ),
  ];

  /* 7. Flask — shelf-group local, on the crown board left of the projector
   *    (crown top ≈ y 2.26): lathe body in the warm lampshade glaze + cork. */
  const flaskProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.05, 0),
    new THREE.Vector2(0.056, 0.012),
    new THREE.Vector2(0.06, 0.05),
    new THREE.Vector2(0.048, 0.088),
    new THREE.Vector2(0.019, 0.115),
    new THREE.Vector2(0.017, 0.155),
    new THREE.Vector2(0.021, 0.163),
  ];
  const shelf: RoomPart[] = [
    part(
      'prop-flask-body',
      new THREE.LatheGeometry(flaskProfile, 14),
      'lampShade',
      [-1.05, 2.295, 0.02],
      [0, rng.range(0, Math.PI * 2), 0],
    ),
    part(
      'prop-flask-cork',
      new THREE.CylinderGeometry(0.018, 0.021, 0.026, 8),
      'wood',
      [-1.05, 2.295 + 0.172, 0.02],
    ),
  ];

  return { desk, monitor, floor, tower, shelf };
}

/* ----------------------------------------------------- instanced clutter -- */

/**
 * One instance of a clutter family (art-overhaul commit 3b): same shape as a
 * BookInstance plus a full euler, rendered via ONE InstancedMesh per family
 * with per-instance color (§3.8 instancing discipline — repeated small items
 * are instanced; the 7 narrative props above stay authored singles).
 */
export interface ClutterInstance {
  position: Vec3;
  /** Euler XYZ radians (tilt/lean), optional. */
  rotation?: Vec3;
  scale: Vec3;
  color: string;
}

export interface ClutterFamilies {
  /** Pencils standing in the desk mug (desk-group LOCAL coordinates). */
  pencils: ClutterInstance[];
  /** Small tins/jars: shelf crown, tower top, window sill (WORLD space). */
  tins: ClutterInstance[];
}

/** Hard cap across all clutter families (draw-call + vertex discipline). */
export const MAX_CLUTTER_INSTANCES = 24;

/**
 * Curated instanced clutter. Positions are art-directed anchors (not scatter):
 * three pencils lean in the mug under the lamp pool; tins sit on the shelf
 * crown beside the flask, on the PC tower top and on the window sill. The
 * seed only drives small hue/lean variation between instances.
 */
export function createClutterInstances(seed: string | number): ClutterFamilies {
  const rng = createRng(
    typeof seed === 'string' ? `${seed}:clutter` : seed + 145,
  );
  const mugY = DESK_TOP_HEIGHT + 0.035;
  const pencils: ClutterInstance[] = [
    {
      position: [-0.615, mugY + 0.045, 0.135],
      rotation: [0.18, 0.3, -0.16],
      scale: [0.007, 0.095, 0.007],
      color: PALETTE.brassLight,
    },
    {
      position: [-0.585, mugY + 0.05, 0.152],
      rotation: [-0.21, -0.4, 0.12],
      scale: [0.006, 0.105, 0.006],
      color: PALETTE.woodWarm,
    },
    {
      position: [-0.6, mugY + 0.04, 0.155],
      rotation: [0.1, 1.2, -0.26],
      scale: [0.008, 0.085, 0.008],
      color: rng.chance(0.5) ? PALETTE.p5Red : PALETTE.brassDark,
    },
  ];
  const tins: ClutterInstance[] = [
    // Shelf crown, right of the flask (world-space; shelf group is rotated).
    {
      position: [-3.59, 2.33, 0.16],
      scale: [0.05, 0.07, 0.05],
      color: PALETTE.brassDark,
    },
    {
      position: [-3.5, 2.325, -0.06],
      scale: [0.04, 0.06, 0.04],
      color: PALETTE.metalDark,
    },
    // On the PC tower top.
    {
      position: [3.29, 0.555, -2.95],
      scale: [0.045, 0.065, 0.045],
      color: PALETTE.brass,
    },
    // On the window sill.
    {
      position: [3.86, 0.9, -0.7],
      scale: [0.05, 0.075, 0.05],
      color: PALETTE.rugRust,
    },
  ];
  const total = pencils.length + tins.length;
  if (total > MAX_CLUTTER_INSTANCES) {
    throw new Error(
      `createClutterInstances: ${total} instances exceed the cap ${MAX_CLUTTER_INSTANCES}`,
    );
  }
  return { pencils, tins };
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
    part(
      'shelf-crown',
      beveledBox(width + 0.08, 0.07, depth + 0.06, 0.012),
      'wood',
      [0, height + 0.02, 0],
    ),
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
          beveledBox(width - sideT, boardT, depth - 0.02, 0.006),
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

/* ------------------------------------------------------- library books -- */

/** Atlas grid used by planBookSpineAtlas — 4 columns, ceil(n/4) rows. */
export const BOOK_ATLAS_COLUMNS = 4;
export const bookAtlasRows = (count: number): number =>
  Math.ceil(count / BOOK_ATLAS_COLUMNS);

export interface LibraryBook {
  /** postId() from content — the DOM/store bridge. */
  id: string;
  /** Index into POSTS == the atlas cell index. */
  index: number;
  featured: boolean;
  /** Shelf-local book-body center. */
  position: Vec3;
  /** Shelf-local body dimensions [width, height, depth]. */
  scale: Vec3;
  /** Per-instance body color (featured = brass/red accent). */
  color: string;
}

/**
 * One pickable volume per POST (commit 6). Books stand at the FRONT of a shelf
 * cell so their atlas spine labels face the camera; the 13th book shares the
 * first cell (12 shelf cells, 13 posts) via a second slot. Pure CPU math — no
 * three context needed — so placement is unit-testable headlessly.
 */
export function createLibraryBooks(
  cells: readonly ShelfCell[],
  posts: readonly { id: string; featured: boolean }[],
): LibraryBook[] {
  if (cells.length === 0) return [];
  return posts.map((post, index) => {
    const cell = cells[index % cells.length]!;
    const slot = Math.floor(index / cells.length); // 0 for most, 1 for the 13th
    const bookW = post.featured ? 0.086 : 0.062;
    const bookH = cell.h * (post.featured ? 0.96 : 0.82);
    const bookD = Math.min(cell.d * 0.92, 0.24);
    const x = cell.x + (slot === 0 ? -cell.w * 0.2 : cell.w * 0.2);
    const y = cell.y + bookH / 2;
    const z = cell.z + cell.d / 2 - bookD / 2;
    const color = post.featured
      ? index % 2 === 0
        ? PALETTE.p5Red
        : PALETTE.brassLight
      : BOOK_SPINE_COLORS[index % BOOK_SPINE_COLORS.length]!;
    return {
      id: post.id,
      index,
      featured: post.featured,
      position: [x, y, z],
      scale: [bookW, bookH, bookD],
      color,
    };
  });
}

/**
 * Atlas UV rect for a 0-based cell. Canvas rows run top→bottom while three
 * texture V runs bottom→top (CanvasTexture flipY), hence the 1 - … mapping.
 */
export function atlasCellUV(
  index: number,
  columns = BOOK_ATLAS_COLUMNS,
  rows: number,
): { u0: number; u1: number; v0: number; v1: number } {
  const col = index % columns;
  const row = Math.floor(index / columns);
  return {
    u0: col / columns,
    u1: (col + 1) / columns,
    v0: 1 - (row + 1) / rows,
    v1: 1 - row / rows,
  };
}

/** Vertices in one spine-label quad (two triangles). */
export const SPINE_LABEL_VERTICES = 4;

/**
 * All spine labels in ONE BufferGeometry (one draw call): a quad per book on
 * the front face, UVs remapped into its atlas cell. Keeps instancing discipline
 * (§3.8) while still giving each volume a distinct title from the shared atlas.
 */
export function createSpineLabelsGeometry(
  books: readonly LibraryBook[],
  rows: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  books.forEach((book, i) => {
    const [x, y, z] = book.position;
    const [w, h, d] = book.scale;
    const frontZ = z + d / 2 + 0.0015;
    const halfW = w * 0.46;
    const halfH = h * 0.47;
    const corners: [number, number][] = [
      [x - halfW, y - halfH],
      [x + halfW, y - halfH],
      [x + halfW, y + halfH],
      [x - halfW, y + halfH],
    ];
    const { u0, u1, v0, v1 } = atlasCellUV(
      book.index,
      BOOK_ATLAS_COLUMNS,
      rows,
    );
    const cellUvs: [number, number][] = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ];
    const base = i * SPINE_LABEL_VERTICES;
    corners.forEach(([cornerX, cornerY], corner) => {
      positions.push(cornerX, cornerY, frontZ);
      normals.push(0, 0, 1);
      uvs.push(...cellUvs[corner]!);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Review fix A1: a selected book's BODY slides toward the viewer by `pullOut`,
 * but the shared label geometry's quad would stay behind and be occluded by
 * the body's own front face. Return a COPY of `labelsGeometry` with the
 * selected book's four label vertices shifted forward by `pullOut`, so spine
 * and body travel together. `selectedIndex === null` returns an untouched copy.
 *
 * Pure CPU data: the input geometry is never mutated, so this is unit-testable
 * headlessly (the GPU copy is disposed by the caller on selection change).
 */
export function withPulledOutLabel(
  labelsGeometry: THREE.BufferGeometry,
  selectedIndex: number | null,
  pullOut: number,
): THREE.BufferGeometry {
  const copy = labelsGeometry.clone();
  const position = copy.getAttribute('position');
  if (selectedIndex !== null && position) {
    const first = selectedIndex * SPINE_LABEL_VERTICES;
    for (
      let vertex = first;
      vertex < first + SPINE_LABEL_VERTICES;
      vertex += 1
    ) {
      position.setZ(vertex, position.getZ(vertex) + pullOut);
    }
    position.needsUpdate = true;
  }
  return copy;
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
      new THREE.LatheGeometry(baseProfile, 24),
      'metalDark',
      [0, 0, 0],
    ),
    part(
      'lamp-pole',
      new THREE.CylinderGeometry(0.022, 0.026, poleH, 12),
      'brass',
      [0, poleH / 2 + 0.06, 0],
      [0, 0, tilt],
    ),
    part(
      'lamp-shade',
      new THREE.LatheGeometry(shadeProfile, 28, 0, Math.PI * 2),
      'lampShade',
      [0, shadeY, 0],
    ),
    part('lamp-bulb', new THREE.SphereGeometry(0.05, 14, 10), 'bulb', [
      0,
      shadeY + 0.1,
      0,
    ]),
    part('lamp-finial', new THREE.SphereGeometry(0.02, 10, 8), 'brass', [
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
      new THREE.LatheGeometry(lensProfile, 24),
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

/**
 * Derive a cone's throw length + end radius from the ACTUAL produced geometry
 * (apex at the local origin, opening at -z). Ambient motes consume these values
 * as props, so a future change to `createLightCone(...)` cannot leave their
 * envelope hardcode-drifted from the beam they are supposed to live inside.
 * Bounding-box based so it stays correct for any cone tessellation.
 */
export function beamEnvelope(geometry: THREE.BufferGeometry): {
  length: number;
  radius: number;
} {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return { length: 0, radius: 0 };
  return {
    length: box.max.z - box.min.z,
    radius: Math.max(
      Math.abs(box.min.x),
      Math.abs(box.max.x),
      Math.abs(box.min.y),
      Math.abs(box.max.y),
    ),
  };
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
  // Four wooden trim rails share one material and never animate: bake to one
  // mesh (commit 3c). The back, mat and bust stay separate (different materials).
  parts.push(
    mergeStaticParts(`frame-trim-${variant}`, [
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
  // Commit 8: spread the cases into a row on the desk shelf so each one is a
  // distinct pick target (commit 7 stacked them at the origin). Spacing is
  // deterministic — the seeded jitter stays small enough to keep the order.
  const spacing = caseW + 0.03;
  const parts: RoomPart[] = [];
  for (let i = 0; i < count; i += 1) {
    const yaw = rng.range(-0.5, 0.5);
    const centerX = (i - (count - 1) / 2) * spacing + rng.range(-0.005, 0.005);
    const centerZ = rng.range(-0.01, 0.01);
    const body = part(
      `case-body-${i}`,
      box(caseW, caseH, caseD),
      'metalDark',
      [centerX, caseH / 2, centerZ],
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
    // Lid shares the body's centre; the zone animates this mesh's group for
    // the open/flip interaction without touching the baked geometry.
    parts.push(
      part(`case-lid-${i}`, lid, 'caseLabel', [
        centerX,
        caseH + 0.001,
        centerZ,
      ]),
    );
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
