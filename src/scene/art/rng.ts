/**
 * Seeded deterministic RNG for the procedural art pipeline (REWORK_PLAN §4.3).
 *
 * Every texture plan, geometry jitter and book placement in src/scene/art
 * derives its randomness from createRng(), so a given seed produces identical
 * output in dev, CI and production — the whole room is reproducible from one
 * number. Dependency-free (no three, no DOM) so it is trivially testable.
 */

/** xmur3 string hash: turn a human-friendly seed into a 32-bit integer. */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface Rng {
  /** Raw float in [0, 1) — mulberry32. */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number;
  /** Uniform pick from a non-empty readonly array. */
  pick<T>(items: readonly T[]): T;
  /** True with probability p. */
  chance(p: number): boolean;
}

/** mulberry32 — small, fast, good enough for art jitter, fully deterministic. */
export function createRng(seed: number | string): Rng {
  let state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, maxExclusive) =>
      Math.min(
        maxExclusive - 1,
        Math.floor(min + (maxExclusive - min) * next()),
      ),
    pick: (items) => {
      if (items.length === 0) {
        throw new Error('createRng().pick: items must not be empty');
      }
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) {
        throw new Error('createRng().pick: index out of bounds');
      }
      return item;
    },
    chance: (p) => next() < p,
  };
}
