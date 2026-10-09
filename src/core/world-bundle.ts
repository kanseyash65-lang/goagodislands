import { buildKindTables, type KindTables } from '../entities/definitions/mobility-codes';
import { KindRegistry } from '../entities/definitions/kinds';
import { EntityManager } from '../entities/entity-manager';
import { EntityFactory } from '../entities/factory/entity-factory';
import { LabelRegistry } from '../entities/labels/label-registry';
import { PropertyRegistry } from '../entities/properties/property-registry';
import type { BaseBuilding } from '../gameplay/base/home-base';
import type { SpawnDeps } from '../gameplay/spawn/structures';
import { HOME_ISLAND, type IslandContent } from '../world/island-specs';
import { generateLayout, type WorldLayout } from '../world/world-layout';
import { WorldParams } from '../world/world-params';
import { populateIsland } from '../world/world-populate';
import { createStreams, type RngStreams } from './rng/mulberry32';
import { GameClock } from './time/clock';

/**
 * Simulation-side state (no rendering, no DOM). `layout` and `content` change
 * when the player sails to another island; systems read them through this bundle.
 */
export interface WorldBundle {
  readonly seed: number;
  readonly rng: RngStreams;
  readonly kinds: KindRegistry;
  readonly tables: KindTables;
  readonly em: EntityManager;
  readonly labels: LabelRegistry;
  readonly props: PropertyRegistry;
  readonly factory: EntityFactory;
  readonly params: WorldParams;
  readonly clock: GameClock;
  readonly spawn: SpawnDeps;
  layout: WorldLayout;
  content: IslandContent;
  /** Entity id → home-base building uid (only on the home island). */
  owned: Map<number, number>;
}

export function createWorld(seed: number, base: readonly BaseBuilding[]): WorldBundle {
  const rng = createStreams(seed);
  const kinds = new KindRegistry();
  const em = new EntityManager();
  const factory = new EntityFactory(em, kinds, rng.world, rng.names);
  const world: WorldBundle = {
    seed,
    rng,
    kinds,
    tables: buildKindTables(kinds),
    em,
    labels: new LabelRegistry(),
    props: new PropertyRegistry(),
    factory,
    params: new WorldParams(),
    clock: new GameClock(),
    spawn: { em, kinds, factory, rng: rng.world },
    layout: generateLayout(HOME_ISLAND.style),
    content: HOME_ISLAND,
    owned: new Map(),
  };
  world.owned = populateIsland(HOME_ISLAND, world.layout, world.spawn, base);
  return world;
}

/** Replaces every entity with a freshly generated island (player base only at home). */
export function loadIsland(world: WorldBundle, content: IslandContent, base?: readonly BaseBuilding[]): void {
  world.em.clear();
  world.layout = generateLayout(content.style);
  world.content = content;
  world.owned = populateIsland(content, world.layout, world.spawn, base);
}
