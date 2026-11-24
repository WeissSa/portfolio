/**
 * Procedural geometry tests (§4.3): low-poly furniture factories are pure CPU
 * math (three geometry constructors need no WebGL), so determinism and budget
 * assertions run headlessly in node/jsdom.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { POSTS, postId } from '../src/content/posts';
import {
  atlasCellUV,
  beveledBox,
  bookAtlasRows,
  BOOK_ATLAS_COLUMNS,
  countVertices,
  createBookInstances,
  createBookshelf,
  createChair,
  createClutterInstances,
  createLibraryBooks,
  createDesk,
  createFramedSilhouette,
  createGameCases,
  createLamp,
  createLightCone,
  createMonitor,
  createNarrativeProps,
  createPcTower,
  createProjector,
  createRoomShell,
  createRugGeometry,
  createSpineLabelsGeometry,
  createWindow,
  DESK_TOP_HEIGHT,
  disposeParts,
  geometryChecksum,
  MAX_BOOK_INSTANCES,
  MAX_CLUTTER_INSTANCES,
  NARRATIVE_PROP_IDS,
  paintEdgeAO,
  SPINE_LABEL_VERTICES,
  withPulledOutLabel,
  type RoomPart,
} from '../src/scene/art/geometry';
import { PALETTE } from '../src/scene/art/palette';

const partsFingerprint = (parts: readonly RoomPart[]): string =>
  parts
    .map(
      (p) =>
        `${p.id}|${p.material}|${geometryChecksum(p.geometry)}|${JSON.stringify(p.position ?? null)}|${JSON.stringify(p.rotation ?? null)}`,
    )
    .join(';');

const allProps = (seed = 'geo') => {
  const props = createNarrativeProps(seed);
  return [
    ...props.desk,
    ...props.monitor,
    ...props.floor,
    ...props.tower,
    ...props.shelf,
  ];
};

const allRoomParts = (seed = 'geo'): RoomPart[] => {
  const shelf = createBookshelf(seed);
  return [
    ...createRoomShell(),
    ...createDesk(seed),
    ...createMonitor(seed),
    ...createPcTower(seed),
    ...shelf.parts,
    ...createLamp(seed),
    ...createProjector(seed),
    createLightCone(),
    ...createWindow(),
    ...createChair(seed),
    ...allProps(seed),
    ...createFramedSilhouette(seed, 0),
    ...createGameCases(seed, 5),
  ];
};

describe('geometry determinism', () => {
  it('same seed → identical part fingerprints for every factory', () => {
    expect(partsFingerprint(createDesk('a'))).toBe(
      partsFingerprint(createDesk('a')),
    );
    expect(partsFingerprint(createMonitor('a'))).toBe(
      partsFingerprint(createMonitor('a')),
    );
    expect(partsFingerprint(createPcTower('a'))).toBe(
      partsFingerprint(createPcTower('a')),
    );
    expect(partsFingerprint(createLamp('a'))).toBe(
      partsFingerprint(createLamp('a')),
    );
    expect(partsFingerprint(createProjector('a'))).toBe(
      partsFingerprint(createProjector('a')),
    );
    expect(partsFingerprint(createChair('a'))).toBe(
      partsFingerprint(createChair('a')),
    );
    expect(partsFingerprint(allProps('a'))).toBe(
      partsFingerprint(allProps('a')),
    );
    expect(partsFingerprint(createFramedSilhouette('a', 2))).toBe(
      partsFingerprint(createFramedSilhouette('a', 2)),
    );
    expect(partsFingerprint(createBookshelf('a').parts)).toBe(
      partsFingerprint(createBookshelf('a').parts),
    );
    expect(partsFingerprint(createGameCases('a', 5))).toBe(
      partsFingerprint(createGameCases('a', 5)),
    );
  });

  it('different seed → different jittered furniture', () => {
    expect(partsFingerprint(createDesk('a'))).not.toBe(
      partsFingerprint(createDesk('b')),
    );
    // Shelf panels are exact carpentry; the seed lives in the cell jitter.
    expect(createBookshelf('a').cells).not.toEqual(createBookshelf('b').cells);
    expect(
      createBookInstances('a', createBookshelf('shared').cells),
    ).not.toEqual(createBookInstances('b', createBookshelf('shared').cells));
  });

  it('rug and light cone are deterministic (unseeded primitives)', () => {
    expect(geometryChecksum(createRugGeometry())).toBe(
      geometryChecksum(createRugGeometry()),
    );
    expect(geometryChecksum(createLightCone().geometry)).toBe(
      geometryChecksum(createLightCone().geometry),
    );
  });
});

describe('bookshelf + instanced books (§3.8 instancing)', () => {
  const shelf = createBookshelf('shelf', { bays: 3, shelves: 4 });

  it('produces one cell per bay/shelf opening', () => {
    expect(shelf.cells).toHaveLength(3 * 4);
  });

  it('book scatter is reproducible from the seed', () => {
    const a = createBookInstances('books', shelf.cells, {
      featured: [0, 3, 6],
    });
    const b = createBookInstances('books', shelf.cells, {
      featured: [0, 3, 6],
    });
    expect(a).toEqual(b);
    const c = createBookInstances('other', shelf.cells, {
      featured: [0, 3, 6],
    });
    expect(c).not.toEqual(a);
  });

  it('stays within the instance cap and inside shelf cells', () => {
    const books = createBookInstances('books', shelf.cells);
    expect(books.length).toBeGreaterThan(0);
    expect(books.length).toBeLessThanOrEqual(MAX_BOOK_INSTANCES);
    for (const book of books) {
      // Every book sits above a shelf surface and inside the shelf envelope.
      expect(book.position[1]).toBeGreaterThan(0);
      expect(book.scale[0]).toBeGreaterThan(0.02);
      expect(book.scale[1]).toBeGreaterThan(0.1);
      expect(book.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Math.abs(book.tilt)).toBeLessThanOrEqual(0.17);
    }
  });

  it('caps requested book counts beyond the hard budget', () => {
    const books = createBookInstances('books', shelf.cells, { maxBooks: 9999 });
    expect(books.length).toBeLessThanOrEqual(MAX_BOOK_INSTANCES);
  });
});

describe('geometry budgets (§4.3 draw-call/vertex discipline)', () => {
  it('the whole room shell stays far under any vertex concern', () => {
    const total = countVertices(allRoomParts());
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(80_000);
  });

  it('uses lathe for the lamp and extrude for the rug (plan §4.3)', () => {
    const lamp = createLamp('l');
    expect(lamp.some((p) => p.geometry.type === 'LatheGeometry')).toBe(true);
    const projector = createProjector('p');
    expect(projector.some((p) => p.geometry.type === 'LatheGeometry')).toBe(
      true,
    );
    expect(createRugGeometry().type).toBe('ExtrudeGeometry');
  });

  it('room shell has floor, ceiling, three walls and merged skirting', () => {
    const ids = createRoomShell().map((p) => p.id);
    for (const expected of [
      'floor',
      'ceiling',
      'wall-back',
      'wall-left',
      'wall-right',
      'skirting',
    ]) {
      expect(ids).toContain(expected);
    }
    // 3c: three skirting boards are baked into one static draw call.
    expect(ids).toHaveLength(6);
  });

  it('merges same-material static families without losing geometry', () => {
    const tower = createPcTower('merge');
    expect(tower.find((p) => p.id === 'tower-vents')?.material).toBe(
      'metalDark',
    );
    expect(
      tower
        .find((p) => p.id === 'tower-vents')
        ?.geometry.getAttribute('position')?.count,
    ).toBeGreaterThan(24);
    expect(tower.some((p) => p.id === 'tower-vent-0')).toBe(false);
    expect(
      createDesk('merge').find((p) => p.id === 'desk-pulls'),
    ).toBeDefined();
    const frame = createFramedSilhouette('merge', 0);
    expect(frame.find((p) => p.id === 'frame-trim-0')?.material).toBe('wood');
    expect(frame.some((p) => p.id === 'frame-top-0')).toBe(false);
  });

  it('disposeParts is safe to call on fresh geometry', () => {
    const parts = createDesk('dispose-me');
    expect(() => disposeParts(parts)).not.toThrow();
  });
});

describe('authored silhouettes (art-overhaul commit 3a)', () => {
  it('beveledBox keeps outer dimensions and beats a plain box in vertices', () => {
    const geometry = beveledBox(0.5, 0.2, 0.3, 0.015);
    expect(geometry.type).toBe('ExtrudeGeometry');
    geometry.computeBoundingBox();
    const size = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute('position') as THREE.BufferAttribute,
    );
    const dims = size.getSize(new THREE.Vector3());
    expect(dims.x).toBeCloseTo(0.5, 5);
    expect(dims.y).toBeCloseTo(0.2, 5);
    expect(dims.z).toBeCloseTo(0.3, 5);
    expect(geometry.getAttribute('position')?.count ?? 0).toBeGreaterThan(24);
    // Degenerate dimensions clamp the bevel instead of exploding.
    const thin = beveledBox(0.4, 0.01, 0.3, 0.05);
    thin.computeBoundingBox();
    expect(thin.getAttribute('position')).toBeDefined();
    geometry.dispose();
    thin.dispose();
  });

  it('bevels the major furniture: desk, shelf, tower, monitor', () => {
    const desk = createDesk('bvl');
    expect(desk.find((p) => p.id === 'desk-top')?.geometry.type).toBe(
      'ExtrudeGeometry',
    );
    expect(desk.find((p) => p.id === 'desk-pedestal')?.geometry.type).toBe(
      'ExtrudeGeometry',
    );
    const shelf = createBookshelf('bvl');
    expect(shelf.parts.find((p) => p.id === 'shelf-crown')?.geometry.type).toBe(
      'ExtrudeGeometry',
    );
    expect(
      shelf.parts.find((p) => p.id === 'shelf-board-1')?.geometry.type,
    ).toBe('ExtrudeGeometry');
    expect(
      createPcTower('bvl').find((p) => p.id === 'tower-case')?.geometry.type,
    ).toBe('ExtrudeGeometry');
    expect(
      createMonitor('bvl').find((p) => p.id === 'monitor-bezel')?.geometry.type,
    ).toBe('ExtrudeGeometry');
  });

  it('spins higher-segment lathes for the lamp and projector lens', () => {
    const lampBase = createLamp('seg').find((p) => p.id === 'lamp-base');
    // 24 radial segments × 6 profile points, pole vertex merged → 125 vertices
    // (the old 14-segment lathe had 75).
    expect(lampBase?.geometry.type).toBe('LatheGeometry');
    expect(
      lampBase?.geometry.getAttribute('position')?.count ?? 0,
    ).toBeGreaterThanOrEqual(125);
    const shade = createLamp('seg').find((p) => p.id === 'lamp-shade');
    expect(
      shade?.geometry.getAttribute('position')?.count ?? 0,
    ).toBeGreaterThanOrEqual(58);
    const lens = createProjector('seg').find((p) => p.id === 'projector-lens');
    expect(lens?.geometry.type).toBe('LatheGeometry');
    expect(
      lens?.geometry.getAttribute('position')?.count ?? 0,
    ).toBeGreaterThanOrEqual(100);
  });

  it('createChair: seat, curved open-ended back shell, rails, four legs', () => {
    const chair = createChair('chair');
    const ids = chair.map((p) => p.id);
    for (const expected of [
      'chair-seat',
      'chair-back',
      'chair-rail-top',
      'chair-rail-low',
      'chair-leg-0',
      'chair-leg-1',
      'chair-leg-2',
      'chair-leg-3',
    ]) {
      expect(ids, expected).toContain(expected);
    }
    const back = chair.find((p) => p.id === 'chair-back');
    const params = (back?.geometry as THREE.CylinderGeometry)
      .parameters as unknown as {
      openEnded: boolean;
      thetaLength: number;
    };
    expect(back?.geometry.type).toBe('CylinderGeometry');
    expect(params.openEnded).toBe(true);
    // A curved ARC, never a full tube — the silhouette reads as a bent back.
    expect(params.thetaLength).toBeGreaterThan(0.5);
    expect(params.thetaLength).toBeLessThan(Math.PI * 2);
  });

  it('the 7 narrative props exist with specified anchors and unique proportions', () => {
    const props = createNarrativeProps('story');
    const all = allProps('story');
    // Every prop family id prefix is present exactly once in the union.
    const prefixes = NARRATIVE_PROP_IDS.map(
      (id) => id.replace(/^prop-/, '').split('-')[0],
    );
    expect(prefixes).toHaveLength(7);
    for (const prefix of prefixes) {
      expect(
        all.filter((p) => p.id.startsWith(`prop-${prefix}`)).length,
        prefix,
      ).toBeGreaterThan(0);
    }

    // Specified anchors (art-direction, not scatter):
    //  - mug sits in the desk-group lamp pool at x ≈ -0.6 on the desk surface;
    const mug = props.desk.find((p) => p.id === 'prop-mug-body');
    expect(mug?.position?.[0]).toBeCloseTo(-0.6, 5);
    expect(mug?.position?.[1]).toBeCloseTo(DESK_TOP_HEIGHT + 0.035, 5);
    //  - headphones hang on the monitor bezel's top edge (y = 0.86);
    const band = props.monitor.find((p) => p.id === 'prop-headphones-band');
    expect(band?.position?.[1]).toBeCloseTo(0.86, 5);
    //  - the paper stack + cable coil are floor-level world-space props;
    expect(props.floor.every((p) => (p.position?.[1] ?? 1) < 0.1)).toBe(true);
    //  - sticky notes ride the tower front panel (z > tower depth/2 = 0.24);
    expect(props.tower.every((p) => (p.position?.[2] ?? 0) > 0.24)).toBe(true);
    //  - the flask stands on the shelf crown (y ≈ 2.295).
    const flask = props.shelf.find((p) => p.id === 'prop-flask-body');
    expect(flask?.position?.[1]).toBeCloseTo(2.295, 5);

    // UNIQUE proportions: no prop family shares a bounding envelope with
    // another (they are authored items, never instanced clones of one mesh).
    const familyPrefixes = [
      'prop-mug',
      'prop-headphones',
      'prop-paper-stack',
      'prop-cable-coil',
      'prop-sticky',
      'prop-keyboard',
      'prop-flask',
    ];
    const envelopeOf = (prefix: string): string => {
      const box3 = new THREE.Box3();
      for (const part of all.filter((p) => p.id.startsWith(prefix))) {
        part.geometry.computeBoundingBox();
        const local = part.geometry.boundingBox?.clone() ?? new THREE.Box3();
        local.translate(new THREE.Vector3(...(part.position ?? [0, 0, 0])));
        box3.union(local);
      }
      const size = box3.getSize(new THREE.Vector3());
      const center = box3.getCenter(new THREE.Vector3());
      return [size, center]
        .flatMap((v) => [v.x, v.y, v.z])
        .map((n) => n.toFixed(3))
        .join(',');
    };
    const envelopes = familyPrefixes.map(envelopeOf);
    expect(new Set(envelopes).size).toBe(7);
  });
});

describe('instanced clutter + vertex AO (art-overhaul commit 3b)', () => {
  it('curated families are deterministic, capped, and colored from tokens', () => {
    const a = createClutterInstances('clut');
    const b = createClutterInstances('clut');
    expect(a).toEqual(b);
    expect(a.pencils.length).toBeGreaterThanOrEqual(3);
    expect(a.tins.length).toBeGreaterThanOrEqual(3);
    expect(a.pencils.length + a.tins.length).toBeLessThanOrEqual(
      MAX_CLUTTER_INSTANCES,
    );
    for (const instance of [...a.pencils, ...a.tins]) {
      expect(instance.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(instance.scale.every((s) => s > 0)).toBe(true);
    }
    // Pencils lean in the mug (euler set); unique scales, never clones.
    expect(a.pencils.every((p) => p.rotation !== undefined)).toBe(true);
    const scales = new Set(
      [...a.pencils, ...a.tins].map((i) => i.scale.join(',')),
    );
    expect(scales.size).toBe(a.pencils.length + a.tins.length);
  });

  it('paintEdgeAO darkens boundary vertices, spares the interior', () => {
    const plane = new THREE.PlaneGeometry(8, 7, 12, 10);
    paintEdgeAO(plane, { falloff: 0.3, strength: 0.55 });
    const color = plane.getAttribute('color') as THREE.BufferAttribute;
    const position = plane.getAttribute('position');
    expect(color).toBeDefined();
    expect(color.count).toBe(position.count);
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    let centerAo: number | null = null;
    for (let i = 0; i < color.count; i += 1) {
      const ao = color.getX(i);
      // Neutral gray AO: r == g == b.
      expect(color.getY(i)).toBeCloseTo(ao, 6);
      expect(color.getZ(i)).toBeCloseTo(ao, 6);
      expect(ao).toBeGreaterThanOrEqual(0.45 - 1e-6);
      expect(ao).toBeLessThanOrEqual(1);
      min = Math.min(min, ao);
      max = Math.max(max, ao);
      if (
        Math.abs(position.getX(i)) < 0.1 &&
        Math.abs(position.getY(i)) < 0.1
      ) {
        centerAo = ao;
      }
    }
    expect(min).toBeCloseTo(0.45, 5); // corners: full AO strength
    expect(max).toBe(1); // interior untouched
    expect(centerAo).toBe(1);
    plane.dispose();
  });

  it('paintEdgeAO is a no-op for degenerate geometry (no position data)', () => {
    const empty = new THREE.BufferGeometry();
    expect(paintEdgeAO(empty)).toBe(empty);
    expect(empty.getAttribute('color')).toBeUndefined();
  });

  it('the room shell floor uses the vertex-color AO material', () => {
    const floor = createRoomShell().find((p) => p.id === 'floor');
    expect(floor?.material).toBe('floor');
    expect(floor?.geometry.getAttribute('color')).toBeDefined();
    // Subdivided so the AO gradient has vertices to paint on.
    expect(
      floor?.geometry.getAttribute('position')?.count ?? 0,
    ).toBeGreaterThan(100);
  });
});

describe('library books (commit 6)', () => {
  const cells = createBookshelf('library').cells;
  const posts = POSTS.map((post) => ({
    id: postId(post),
    featured: post.featured,
  }));
  const books = createLibraryBooks(cells, posts);

  it('creates exactly one volume per post with a matching featured flag', () => {
    expect(books).toHaveLength(POSTS.length);
    expect(books).toHaveLength(13);
    books.forEach((book, index) => {
      expect(book.id).toBe(posts[index]!.id);
      expect(book.featured).toBe(posts[index]!.featured);
      expect(book.index).toBe(index);
    });
    expect(books.filter((book) => book.featured).length).toBe(
      POSTS.filter((post) => post.featured).length,
    );
  });

  it('features are visibly larger and use a tokenized accent color', () => {
    const featured = books.filter((book) => book.featured);
    const plain = books.filter((book) => !book.featured);
    expect(featured.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
    expect(Math.min(...featured.map((b) => b.scale[0]))).toBeGreaterThan(
      Math.max(...plain.map((b) => b.scale[0])),
    );
    for (const book of featured) {
      // Commit 2 recolors P5 red → brass and keeps brassLight → gold; both are
      // read from the canonical tokens so the assertion follows the palette.
      expect([PALETTE.p5Red, PALETTE.brassLight]).toContain(book.color);
    }
  });

  it('the 13th book shares the first cell via a second slot', () => {
    // 12 shelf cells, 13 posts: index 12 wraps to cell 0 beside index 0.
    const cell = cells[0]!;
    for (const book of [books[0]!, books[12]!]) {
      expect(book.position[0]).toBeGreaterThanOrEqual(cell.x - cell.w / 2);
      expect(book.position[0]).toBeLessThanOrEqual(cell.x + cell.w / 2);
    }
    expect(books[12]!.position[0]).not.toBe(books[0]!.position[0]);
  });

  it('maps each atlas cell into its own UV rect', () => {
    const cols = BOOK_ATLAS_COLUMNS;
    const rows = bookAtlasRows(POSTS.length);
    expect(rows).toBe(4);
    const rect = atlasCellUV(5, cols, rows);
    expect(rect.u0).toBeCloseTo(1 / cols, 6);
    expect(rect.u1).toBeCloseTo(2 / cols, 6);
    expect(rect.v1 - rect.v0).toBeCloseTo(1 / rows, 6);
    // Adjacent cells never overlap.
    const next = atlasCellUV(6, cols, rows);
    expect(rect.u1).toBeCloseTo(next.u0, 6);
  });

  it('builds one merged label geometry with per-book atlas UVs', () => {
    const rows = bookAtlasRows(books.length);
    const geometry = createSpineLabelsGeometry(books, rows);
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    expect(position.count).toBe(books.length * 4);
    expect(uv.count).toBe(books.length * 4);
    expect(geometry.getIndex()?.count).toBe(books.length * 6);
    // Each book's four vertices stay inside its own atlas cell column/row.
    books.forEach((book, index) => {
      const cell = atlasCellUV(book.index, BOOK_ATLAS_COLUMNS, rows);
      for (let v = index * 4; v < index * 4 + 4; v += 1) {
        expect(uv.getX(v)).toBeGreaterThanOrEqual(cell.u0 - 1e-6);
        expect(uv.getX(v)).toBeLessThanOrEqual(cell.u1 + 1e-6);
        expect(uv.getY(v)).toBeGreaterThanOrEqual(cell.v0 - 1e-6);
        expect(uv.getY(v)).toBeLessThanOrEqual(cell.v1 + 1e-6);
      }
    });
    expect(() => geometry.dispose()).not.toThrow();
  });

  it('moves only the selected spine-label quad forward with the body (A1)', () => {
    const rows = bookAtlasRows(books.length);
    const geometry = createSpineLabelsGeometry(books, rows);
    const source = geometry.getAttribute('position');
    const selected = 2;
    const first = selected * SPINE_LABEL_VERTICES;
    const originalZ = source.getZ(first);

    const pulled = withPulledOutLabel(geometry, selected, 0.13);
    const moved = pulled.getAttribute('position');
    for (let vertex = 0; vertex < source.count; vertex += 1) {
      // Float32BufferAttribute rounds on write; mirror that exact rounding so
      // the assertion checks semantics, not single-precision drift.
      const expected =
        vertex >= first && vertex < first + SPINE_LABEL_VERTICES
          ? Math.fround(originalZ + 0.13)
          : source.getZ(vertex);
      expect(moved.getZ(vertex)).toBeCloseTo(expected, 6);
    }
    // Pure: the source geometry (and its vertex data) is never mutated.
    expect(source.getZ(first)).toBe(originalZ);
    const untouched = withPulledOutLabel(geometry, null, 0.13);
    expect(untouched.getAttribute('position').getZ(first)).toBe(originalZ);

    geometry.dispose();
    pulled.dispose();
    untouched.dispose();
  });
});

describe('game case lid UVs map into atlas cells', () => {
  it('each lid samples only its own label cell', () => {
    const count = 5;
    const cases = createGameCases('uv', count, count);
    for (let i = 0; i < count; i += 1) {
      const lid = cases.find((p) => p.id === `case-lid-${i}`);
      expect(lid).toBeDefined();
      const uv = lid?.geometry.getAttribute('uv');
      expect(uv).toBeDefined();
      if (!uv) continue;
      for (let v = 0; v < uv.count; v += 1) {
        expect(uv.getX(v)).toBeGreaterThanOrEqual(i / count - 1e-6);
        expect(uv.getX(v)).toBeLessThanOrEqual((i + 1) / count + 1e-6);
      }
    }
  });
});
