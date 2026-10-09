import type { KindRegistry, Mobility } from './kinds';

/** Numeric mobility codes so hot loops avoid string compares and def lookups. */
export const MOB = {
  STATIC: 0,
  VILLAGER: 1,
  ANIMAL: 2,
  FLYER: 3,
  CLOUD: 4,
  CELESTIAL: 5,
  THING: 6,
  PROP: 7,
  TROOP: 8,
  BOAT: 9,
  ENV: 10,
} as const;

const CODE: Readonly<Record<Mobility, number>> = {
  static: MOB.STATIC,
  villager: MOB.VILLAGER,
  animal: MOB.ANIMAL,
  flyer: MOB.FLYER,
  cloud: MOB.CLOUD,
  celestial: MOB.CELESTIAL,
  thing: MOB.THING,
  prop: MOB.PROP,
  troop: MOB.TROOP,
  boat: MOB.BOAT,
  env: MOB.ENV,
};

/** Per-kind lookup tables derived once from the registry. */
export interface KindTables {
  readonly mobility: Uint8Array;
  readonly physics: Uint8Array;
  readonly speed: Float32Array;
  readonly building: Uint8Array;
}

export function buildKindTables(kinds: KindRegistry): KindTables {
  const n = kinds.defs.length;
  const t: KindTables = {
    mobility: new Uint8Array(n),
    physics: new Uint8Array(n),
    speed: new Float32Array(n),
    building: new Uint8Array(n),
  };
  kinds.defs.forEach((d, i) => {
    t.mobility[i] = CODE[d.mobility];
    t.physics[i] = d.physics ? 1 : 0;
    t.speed[i] = d.speed;
    t.building[i] = d.tags.includes('building') ? 1 : 0;
  });
  return t;
}
