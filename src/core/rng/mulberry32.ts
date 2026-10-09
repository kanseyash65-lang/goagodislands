/** Seeded PRNG (mulberry32). All randomness flows through named streams for replayability. */
export interface IRng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): IRng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    // Callers only pass non-empty tables; the cast avoids a branch in hot paths.
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
  };
}

/** FNV-1a string hash, used to derive stream seeds. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface RngStreams {
  readonly world: IRng;
  readonly ai: IRng;
  readonly weather: IRng;
  readonly names: IRng;
  readonly improv: IRng;
  readonly cosmetic: IRng;
}

export function createStreams(seed: number): RngStreams {
  const s = (name: string): IRng => createRng((seed ^ hashString(name)) >>> 0);
  return {
    world: s('world'),
    ai: s('ai'),
    weather: s('weather'),
    names: s('names'),
    improv: s('improv'),
    cosmetic: s('cosmetic'),
  };
}
