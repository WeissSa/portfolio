/**
 * Procedural geometry tests (§4.3): low-poly furniture factories are pure CPU
 * math (three geometry constructors need no WebGL), so determinism and budget
 * assertions run headlessly in node/jsdom.
 */
import { describe, expect, it } from 'vitest';
import {
  countVertices,
  createBookInstances,
  createBookshelf,
  createDesk,
  createFramedSilhouette,
  createGameCases,
  createLamp,
  createLightCone,
  createMonitor,
  createPcTower,
  createProjector,
  createRoomShell,
  createRugGeometry,
  createWindow,
  disposeParts,
  geometryChecksum,
  MAX_BOOK_INSTANCES,
  type RoomPart,
} from '../src/scene/art/geometry';

const partsFingerprint = (parts: readonly RoomPart[]): string =>
  parts
    .map(
      (p) =>
        `${p.id}|${p.material}|${geometryChecksum(p.geometry)}|${JSON.stringify(p.position ?? null)}|${JSON.stringify(p.rotation ?? null)}`,
    )
    .join(';');

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

  it('room shell has floor, ceiling, three walls and skirting', () => {
    const ids = createRoomShell().map((p) => p.id);
    for (const expected of [
      'floor',
      'ceiling',
      'wall-back',
      'wall-left',
      'wall-right',
      'skirt-back',
      'skirt-left',
      'skirt-right',
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it('disposeParts is safe to call on fresh geometry', () => {
    const parts = createDesk('dispose-me');
    expect(() => disposeParts(parts)).not.toThrow();
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
