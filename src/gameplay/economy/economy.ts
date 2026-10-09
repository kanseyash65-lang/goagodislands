import type { HomeBase } from '../base/home-base';
import { buildingSpec, productionPerMinute, RESOURCES, storageCapacity, type Cost, type Resource } from './building-catalog';

const BASE_CAPACITY = 1500;
const START: Readonly<Record<Resource, number>> = { gold: 1800, timber: 1400, stone: 200, metal: 0 };
const XP_PER_LEVEL = 400;

export type ResourceMap = Record<Resource, number>;

/**
 * Resources, storage caps and production. Production reads the HomeBase data,
 * so it keeps running while the player is away on another island.
 */
export class Economy {
  readonly res: ResourceMap = { ...START };
  gems = 60;
  xp = 0;
  private carry: ResourceMap = { gold: 0, timber: 0, stone: 0, metal: 0 };

  constructor(private readonly base: HomeBase) {}

  capacity(r: Resource): number {
    let cap = BASE_CAPACITY;
    for (const b of this.base.buildings) {
      const spec = buildingSpec(b.kind);
      if (spec?.stores?.resource === r) cap += storageCapacity(spec, b.level);
    }
    return cap;
  }

  perMinute(r: Resource): number {
    let total = 0;
    for (const b of this.base.buildings) {
      const spec = buildingSpec(b.kind);
      if (spec?.produces?.resource === r) total += productionPerMinute(spec, b.level);
    }
    return total;
  }

  /** Accrues production (fractions carried so slow producers still pay out). */
  tick(dt: number): void {
    for (const r of RESOURCES) {
      const gain = (this.perMinute(r) / 60) * dt + (this.carry[r] ?? 0);
      const whole = Math.floor(gain);
      this.carry[r] = gain - whole;
      if (whole > 0) this.add(r, whole);
    }
  }

  canAfford(cost: Cost): boolean {
    return RESOURCES.every((r) => (cost[r] ?? 0) <= this.res[r]);
  }

  /** Spends if affordable; returns false (and spends nothing) otherwise. */
  spend(cost: Cost): boolean {
    if (!this.canAfford(cost)) return false;
    for (const r of RESOURCES) this.res[r] -= cost[r] ?? 0;
    return true;
  }

  /** Adds up to storage capacity; returns how much actually fit. */
  add(r: Resource, amount: number): number {
    const room = Math.max(0, this.capacity(r) - this.res[r]);
    const added = Math.max(0, Math.min(room, Math.round(amount)));
    this.res[r] += added;
    return added;
  }

  addXp(n: number): void {
    this.xp += Math.max(0, Math.round(n));
  }

  level(): number {
    return 1 + Math.floor(this.xp / XP_PER_LEVEL);
  }

  levelProgress(): number {
    return (this.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
  }

  /** Missing amounts for a cost (for "you need 300 more timber"). */
  shortfall(cost: Cost): string {
    return RESOURCES.filter((r) => (cost[r] ?? 0) > this.res[r]).map((r) => `${(cost[r] ?? 0) - this.res[r]} ${r}`).join(', ');
  }
}

export function formatCost(cost: Cost): string {
  return RESOURCES.filter((r) => (cost[r] ?? 0) > 0).map((r) => `${cost[r]} ${r}`).join(' · ') || 'free';
}
