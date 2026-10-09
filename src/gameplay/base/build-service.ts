import { ISLAND_CENTER, ISLAND_RADIUS } from '../../core/config/world.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { WorldBundle } from '../../core/world-bundle';
import { isBuildable } from '../../world/world-layout';
import { buildingSpec, costFor, type Cost } from '../economy/building-catalog';
import { formatCost } from '../economy/economy';
import { overlapsBuilding, spawnStructure } from '../spawn/structures';
import type { GameState } from '../state/game-state';

/** What the Build panel offers, with the perk each building gives your defense missions. */
export interface BuildOption {
  readonly kind: string;
  readonly icon: string;
  readonly perk: string;
}

export const BUILD_MENU: readonly BuildOption[] = [
  { kind: 'house', icon: '🏠', perk: '+1 villager defends every mission' },
  { kind: 'residence', icon: '🏡', perk: '+2 villagers defend every mission' },
  { kind: 'palm', icon: '🌴', perk: 'Shade and charm for your village' },
  { kind: 'cannon', icon: '💥', perk: 'Guards your home coast' },
  { kind: 'machine-gun', icon: '🔫', perk: 'Guards your home coast' },
  { kind: 'wall', icon: '🧱', perk: 'Red laterite fort wall' },
];

/** Residences the starting island already has (only extra ones add defenders). */
const STARTING_RESIDENCES = 2;
const VILLAGERS_PER_RESIDENCE = 2;
export const EXTRA_VILLAGERS_MAX = 10;
const PLACE_ATTEMPTS = 120;
const PLACE_MIN_R = 10;
const PLACE_MAX_R = ISLAND_RADIUS * 0.72;
const CLEARANCE = 1.2;

export interface BuildResult {
  readonly ok: boolean;
  readonly text: string;
}

/** Extra villagers your built homes add to every defense mission. */
export function extraVillagers(state: GameState): number {
  const fromHouses = state.base.count('house');
  const fromResidences = Math.max(0, state.base.count('residence') - STARTING_RESIDENCES) * VILLAGERS_PER_RESIDENCE;
  return Math.min(EXTRA_VILLAGERS_MAX, fromHouses + fromResidences);
}

/**
 * Builds and upgrades on the home island: checks HQ level, limits and cost,
 * finds a free buildable spot near the village, spends, spawns, saves.
 */
export class BuildService {
  constructor(
    private readonly world: WorldBundle,
    private readonly state: GameState,
    private readonly bus: IEventBus,
    private readonly atHome: () => boolean,
    private readonly realTime: () => number,
  ) {}

  /** How many of `kind` the current HQ level allows. */
  limit(kind: string): number {
    return buildingSpec(kind)?.maxCount[this.state.base.hqLevel()] ?? 0;
  }

  cost(kind: string): Cost {
    const spec = buildingSpec(kind);
    return spec ? costFor(spec, 1) : {};
  }

  hqUpgradeCost(): Cost | null {
    const spec = buildingSpec('hq');
    const level = this.state.base.hqLevel();
    return spec && level < spec.maxLevel ? costFor(spec, level + 1) : null;
  }

  /** Why `kind` cannot be built right now, or null when it can. */
  blocker(kind: string): string | null {
    const spec = buildingSpec(kind);
    if (!spec) return 'Unknown building.';
    if (!this.atHome()) return 'Sail home to build.';
    if (this.state.base.hqLevel() < spec.hqLevel || this.limit(kind) === 0) return `Needs HQ level ${Math.max(spec.hqLevel, 2)}.`;
    if (this.state.base.count(kind) >= this.limit(kind)) return 'Limit reached. Upgrade the HQ.';
    const cost = costFor(spec, 1);
    if (!this.state.economy.canAfford(cost)) return `Need ${this.state.economy.shortfall(cost)}.`;
    return null;
  }

  build(kind: string): BuildResult {
    const why = this.blocker(kind);
    const spec = buildingSpec(kind);
    if (why || !spec) return this.report(false, why ?? 'Unknown building.');
    const spot = this.findSpot(spec.footprint);
    if (!spot) return this.report(false, 'No free space left near the village.');
    this.state.economy.spend(costFor(spec, 1));
    const rot = this.world.rng.world.range(0, Math.PI * 2);
    const bb = this.state.base.add(kind, spot.x, spot.y, rot, 1);
    const id = spawnStructure(this.world.spawn, kind, spot.x, spot.y, { team: 1, rot, popAt: this.realTime() });
    if (id >= 0) {
      this.world.owned.set(id, bb.uid);
      this.bus.emit('EntitiesSpawned', { ids: [id], count: 1, kind, x: spot.x, y: spot.y });
    }
    this.bus.emit('CameraRequested', { action: 'focus', x: spot.x, y: spot.y });
    this.state.save();
    this.bus.emit('ResourcesChanged', {});
    return this.report(true, `🔨 Built a ${spec.label}.`);
  }

  upgradeHq(): BuildResult {
    const cost = this.hqUpgradeCost();
    if (!cost) return this.report(false, 'The HQ is at max level.');
    if (!this.atHome()) return this.report(false, 'Sail home to upgrade.');
    if (!this.state.economy.spend(cost)) return this.report(false, `Need ${this.state.economy.shortfall(cost)}.`);
    const hq = this.state.base.buildings.find((b) => b.kind === 'hq');
    if (hq) hq.level++;
    for (const [id, uid] of this.world.owned) if (uid === hq?.uid) this.world.em.level[id] = hq.level;
    this.state.save();
    this.bus.emit('ResourcesChanged', {});
    return this.report(true, `🏛️ Headquarters upgraded to level ${hq?.level ?? 1}. More buildings unlocked.`);
  }

  describeCost(kind: string): string {
    return formatCost(this.cost(kind));
  }

  private findSpot(footprint: number): { x: number; y: number } | null {
    const rng = this.world.rng.world;
    for (let n = 0; n < PLACE_ATTEMPTS; n++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(PLACE_MIN_R, PLACE_MAX_R);
      const x = ISLAND_CENTER + Math.cos(a) * r;
      const y = ISLAND_CENTER + Math.sin(a) * r;
      if (isBuildable(this.world.layout, x, y) && !overlapsBuilding(this.world.spawn, x, y, footprint + CLEARANCE)) return { x, y };
    }
    return null;
  }

  private report(ok: boolean, text: string): BuildResult {
    this.bus.emit('ToastRequested', { text });
    return { ok, text };
  }
}
