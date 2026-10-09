/**
 * Home-island buildings: costs, unlocks, footprint, production and storage.
 * Costs and outputs scale with level; upgrades really change gameplay.
 */
export type Resource = 'gold' | 'timber' | 'stone' | 'metal';
export const RESOURCES: readonly Resource[] = ['gold', 'timber', 'stone', 'metal'];
export type Cost = Partial<Record<Resource, number>>;
export type Category = 'core' | 'economy' | 'defense' | 'army' | 'decor';

export interface BuildingSpec {
  readonly kind: string;
  readonly label: string;
  readonly category: Category;
  /** Placement/collision radius (units). */
  readonly footprint: number;
  readonly maxLevel: number;
  /** HQ level needed to build the first one. */
  readonly hqLevel: number;
  /** How many may exist per HQ level (index = HQ level). */
  readonly maxCount: readonly number[];
  readonly baseCost: Cost;
  readonly produces?: { readonly resource: Resource; readonly perMinute: number };
  readonly stores?: { readonly resource: Resource; readonly capacity: number };
  readonly description: string;
}

const counts = (...n: number[]): number[] => [0, ...n];

export const BUILDINGS: readonly BuildingSpec[] = [
  { kind: 'hq', label: 'Headquarters', category: 'core', footprint: 6, maxLevel: 8, hqLevel: 1, maxCount: counts(1, 1, 1, 1, 1, 1, 1, 1), baseCost: { gold: 2000, timber: 1500 }, stores: { resource: 'gold', capacity: 2500 }, description: 'The heart of your island. Lose it and the battle is over. Upgrading unlocks more buildings.' },
  { kind: 'residence', label: 'Goan Residence', category: 'economy', footprint: 3.6, maxLevel: 8, hqLevel: 1, maxCount: counts(2, 3, 4, 5, 6, 6, 7, 8), baseCost: { gold: 200, timber: 150 }, produces: { resource: 'gold', perMinute: 120 }, description: 'Colourful Portuguese-style homes. Residents pay gold in taxes (and gossip).' },
  { kind: 'sawmill', label: 'Sawmill', category: 'economy', footprint: 3.8, maxLevel: 8, hqLevel: 1, maxCount: counts(1, 2, 2, 3, 3, 4, 4, 5), baseCost: { gold: 300 }, produces: { resource: 'timber', perMinute: 100 }, description: 'Turns fallen coconut palms into timber.' },
  { kind: 'quarry', label: 'Laterite Quarry', category: 'economy', footprint: 3.8, maxLevel: 8, hqLevel: 2, maxCount: counts(0, 1, 2, 2, 3, 3, 4, 4), baseCost: { gold: 600, timber: 400 }, produces: { resource: 'stone', perMinute: 70 }, description: 'Cuts red laterite stone, the stuff Goan forts are made of.' },
  { kind: 'iron-mine', label: 'Iron Mine', category: 'economy', footprint: 3.8, maxLevel: 8, hqLevel: 3, maxCount: counts(0, 0, 1, 2, 2, 3, 3, 4), baseCost: { gold: 1200, timber: 800, stone: 400 }, produces: { resource: 'metal', perMinute: 45 }, description: 'Goa has always had iron ore. Now you do too.' },
  { kind: 'vault', label: 'Vault', category: 'economy', footprint: 3.2, maxLevel: 8, hqLevel: 1, maxCount: counts(1, 1, 2, 2, 2, 3, 3, 3), baseCost: { gold: 300, timber: 200 }, stores: { resource: 'gold', capacity: 6000 }, description: 'Stores gold.' },
  { kind: 'timber-store', label: 'Timber Store', category: 'economy', footprint: 3.2, maxLevel: 8, hqLevel: 1, maxCount: counts(1, 1, 2, 2, 2, 3, 3, 3), baseCost: { gold: 300 }, stores: { resource: 'timber', capacity: 6000 }, description: 'Stores timber.' },
  { kind: 'stone-store', label: 'Stone Store', category: 'economy', footprint: 3.2, maxLevel: 8, hqLevel: 2, maxCount: counts(0, 1, 1, 2, 2, 2, 3, 3), baseCost: { gold: 500, timber: 300 }, stores: { resource: 'stone', capacity: 4000 }, description: 'Stores laterite stone.' },
  { kind: 'metal-store', label: 'Metal Store', category: 'economy', footprint: 3.2, maxLevel: 8, hqLevel: 3, maxCount: counts(0, 0, 1, 1, 2, 2, 2, 3), baseCost: { gold: 900, timber: 600, stone: 300 }, stores: { resource: 'metal', capacity: 3000 }, description: 'Stores metal.' },
  { kind: 'dock', label: 'Landing Dock', category: 'army', footprint: 3.4, maxLevel: 8, hqLevel: 1, maxCount: counts(2, 3, 3, 4, 4, 5, 5, 6), baseCost: { gold: 500, timber: 400 }, description: 'Each dock adds one landing craft (one squad) to your attack.' },
  { kind: 'barracks', label: 'Barracks', category: 'army', footprint: 4, maxLevel: 8, hqLevel: 1, maxCount: counts(1, 1, 1, 1, 1, 1, 1, 1), baseCost: { gold: 800, timber: 600 }, description: 'Each level adds 2 troop space to every landing craft.' },
  { kind: 'armory', label: 'Armory', category: 'army', footprint: 4, maxLevel: 8, hqLevel: 2, maxCount: counts(0, 1, 1, 1, 1, 1, 1, 1), baseCost: { gold: 1000, timber: 800, stone: 200 }, description: 'Each level makes every troop 10% tougher and harder-hitting.' },
  { kind: 'radar', label: 'Radar', category: 'army', footprint: 3, maxLevel: 5, hqLevel: 1, maxCount: counts(1, 1, 1, 1, 1, 1, 1, 1), baseCost: { gold: 400, timber: 300 }, description: 'Clears fog of war on the archipelago map.' },
  { kind: 'cannon', label: 'Cannon', category: 'defense', footprint: 2.8, maxLevel: 8, hqLevel: 1, maxCount: counts(1, 2, 2, 3, 3, 4, 4, 5), baseCost: { gold: 600, timber: 300 }, description: 'Long range, heavy single shots.' },
  { kind: 'machine-gun', label: 'Machine Gun', category: 'defense', footprint: 2.6, maxLevel: 8, hqLevel: 1, maxCount: counts(1, 2, 2, 3, 3, 4, 4, 5), baseCost: { gold: 500, timber: 400 }, description: 'Short range, rapid fire. Hates crowds.' },
  { kind: 'sniper-tower', label: 'Sniper Tower', category: 'defense', footprint: 2.6, maxLevel: 8, hqLevel: 2, maxCount: counts(0, 1, 2, 2, 3, 3, 4, 4), baseCost: { gold: 700, timber: 500 }, description: 'Long-range precision fire.' },
  { kind: 'mortar', label: 'Mortar', category: 'defense', footprint: 2.8, maxLevel: 8, hqLevel: 3, maxCount: counts(0, 0, 1, 1, 2, 2, 3, 3), baseCost: { gold: 1200, timber: 700, stone: 300 }, description: 'Lobs splash shells. Cannot hit close targets.' },
  { kind: 'mine', label: 'Mine', category: 'defense', footprint: 1.2, maxLevel: 5, hqLevel: 2, maxCount: counts(0, 3, 4, 6, 8, 10, 12, 14), baseCost: { gold: 150, metal: 0 }, description: 'Hidden. Goes boom.' },
  { kind: 'wall', label: 'Laterite Wall', category: 'defense', footprint: 1.8, maxLevel: 5, hqLevel: 2, maxCount: counts(0, 6, 10, 14, 18, 22, 26, 30), baseCost: { stone: 40 }, description: 'A chunk of red fort wall. Slows attackers down.' },
  { kind: 'house', label: 'Goan House', category: 'decor', footprint: 3.4, maxLevel: 1, hqLevel: 1, maxCount: counts(6, 8, 10, 12, 14, 16, 18, 20), baseCost: { gold: 100 }, description: 'Purely for charm. Villagers live here.' },
  { kind: 'palm', label: 'Coconut Palm', category: 'decor', footprint: 1.2, maxLevel: 1, hqLevel: 1, maxCount: counts(60, 60, 60, 60, 60, 60, 60, 60), baseCost: { gold: 20 }, description: 'Essential. Mind the coconuts.' },
];

const BY_KIND = new Map(BUILDINGS.map((b) => [b.kind, b]));

export function buildingSpec(kind: string): BuildingSpec | undefined {
  return BY_KIND.get(kind);
}

/** Cost to build (level 1) or upgrade to `level`. Grows ~1.8x per level. */
export function costFor(spec: BuildingSpec, level: number): Cost {
  const f = Math.pow(1.8, Math.max(0, level - 1));
  const out: Cost = {};
  for (const r of Object.keys(spec.baseCost) as Resource[]) {
    const v = spec.baseCost[r] ?? 0;
    if (v > 0) out[r] = Math.round((v * f) / 10) * 10;
  }
  return out;
}

export function productionPerMinute(spec: BuildingSpec, level: number): number {
  return spec.produces ? Math.round(spec.produces.perMinute * (1 + 0.45 * (level - 1))) : 0;
}

export function storageCapacity(spec: BuildingSpec, level: number): number {
  return spec.stores ? Math.round(spec.stores.capacity * (1 + 0.6 * (level - 1))) : 0;
}

/** Collision footprint for any kind (decor and nature included). */
const NATURE_FOOTPRINT: Readonly<Record<string, number>> = {
  chapel: 4.5, shack: 2.6, market: 3, well: 1.6, windmill: 3, lighthouse: 2.6, 'fort-tower': 3.4, bunker: 3.2,
  cage: 1.8, 'supply-depot': 3, jetty: 0, 'fishing-boat': 0, palm: 0.6, banana: 0.6, bush: 0.6, hibiscus: 0.6, rock: 1, cliff: 5,
};

export function footprintOf(kind: string): number {
  return BY_KIND.get(kind)?.footprint ?? NATURE_FOOTPRINT[kind] ?? 1.5;
}

