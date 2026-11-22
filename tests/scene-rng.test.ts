import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../src/scene/art/rng';

describe('rng determinism (§4.3)', () => {
  it('hashSeed is deterministic for the same string', () => {
    expect(hashSeed('the-room')).toBe(hashSeed('the-room'));
    expect(hashSeed('the-room')).not.toBe(hashSeed('the-room-2'));
  });

  it('same seed produces identical sequences (numeric and string seeds)', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);

    const c = createRng('the-room');
    const d = createRng('the-room');
    const seqC = Array.from({ length: 50 }, () => c.next());
    const seqD = Array.from({ length: 50 }, () => d.next());
    expect(seqC).toEqual(seqD);
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
});

describe('rng helpers', () => {
  it('next() stays in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('range and int respect their bounds', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 500; i += 1) {
      const r = rng.range(-2.5, 3.5);
      expect(r).toBeGreaterThanOrEqual(-2.5);
      expect(r).toBeLessThan(3.5);
      const n = rng.int(4, 9);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(8);
    }
  });

  it('pick returns only array members and throws on empty input', () => {
    const rng = createRng('pick');
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(rng.pick(items));
    }
    expect(() => rng.pick([])).toThrow();
  });

  it('chance honours degenerate probabilities', () => {
    const rng = createRng('chance');
    for (let i = 0; i < 50; i += 1) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });
});
