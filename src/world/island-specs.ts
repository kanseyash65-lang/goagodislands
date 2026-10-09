import type { IslandStyle } from './world-layout';

/**
 * Island content as data. Positions are fractions of the island radius from the
 * centre (fx east, fy south); the beach is on the east side.
 */
export interface Placement {
  readonly kind: string;
  readonly fx: number;
  readonly fy: number;
  readonly team?: number;
  readonly level?: number;
  readonly rot?: number;
}

export interface IslandContent {
  readonly style: IslandStyle;
  readonly structures: readonly Placement[];
  /** Palm/plant density multiplier for the jungle. */
  readonly jungle: number;
  readonly villagers: number;
  readonly animals: number;
}

const p = (kind: string, fx: number, fy: number, extra: Partial<Placement> = {}): Placement => ({ kind, fx, fy, ...extra });
const PI = Math.PI;

/** The starting home island: a small Goan fishing village with a modest base. */
export const HOME_ISLAND: IslandContent = {
  style: { seed: 20261028, size: 1, roundness: 3.4, hills: 13 },
  jungle: 1,
  villagers: 14,
  animals: 9,
  structures: [
    p('hq', 0, 0, { team: 1 }),
    p('residence', 0.25, -0.18, { team: 1 }), p('residence', 0.3, 0.2, { team: 1 }),
    p('sawmill', -0.3, 0.12, { team: 1 }), p('vault', -0.15, -0.22, { team: 1 }), p('timber-store', -0.32, -0.12, { team: 1 }),
    p('barracks', 0.16, 0.36, { team: 1, rot: PI / 2 }), p('radar', -0.12, 0.28, { team: 1 }),
    p('dock', 0.68, -0.22, { team: 1, rot: PI / 2 }), p('dock', 0.68, 0.18, { team: 1, rot: PI / 2 }),
    p('cannon', 0.46, -0.02, { team: 1, rot: PI / 2 }), p('machine-gun', 0.42, 0.34, { team: 1, rot: PI / 2 }),
    p('chapel', -0.02, 0.56, { rot: -PI / 2 }), p('market', 0.42, -0.36), p('well', 0.12, -0.38),
    p('house', 0.06, -0.52), p('house', 0.26, -0.56), p('house', -0.18, -0.48), p('house', 0.48, 0.54, { rot: PI }), p('house', 0.3, 0.6, { rot: PI }),
    p('shack', 0.8, -0.48, { rot: PI / 2 }), p('shack', 0.84, 0.44, { rot: PI / 2 }),
    p('windmill', -0.52, -0.62), p('lighthouse', 0.66, -0.76), p('fort-tower', -0.42, 0.52),
    p('jetty', 1.02, 0.02, { rot: PI / 2 }), p('fishing-boat', 0.9, -0.08, { rot: 0.3 }), p('fishing-boat', 0.88, 0.32, { rot: -0.4 }),
  ],
};
