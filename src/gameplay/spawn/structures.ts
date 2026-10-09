import type { IRng } from '../../core/rng/mulberry32';
import type { KindRegistry } from '../../entities/definitions/kinds';
import { ENTITY_FLAG, type EntityManager } from '../../entities/entity-manager';
import type { EntityFactory, SpawnOptions } from '../../entities/factory/entity-factory';
import { footprintOf } from '../economy/building-catalog';
import { baseHpOf, DEFENSES, levelHp, TROOPS } from '../units/unit-stats';

/** Buildings read a little larger than life, like a mobile strategy diorama. */
export const STRUCTURE_SCALE = 1.3;

/** Everything needed to spawn combat-aware entities. */
export interface SpawnDeps {
  readonly em: EntityManager;
  readonly kinds: KindRegistry;
  readonly factory: EntityFactory;
  readonly rng: IRng;
}

export interface StructureOptions {
  readonly team?: number;
  readonly level?: number;
  readonly rot?: number;
  readonly popAt?: number;
}

/**
 * Spawns a building with hit points, team, level and yaw from the stats tables.
 * Mines start hidden for the attacker. Returns -1 when full or unknown.
 */
export function spawnStructure(d: SpawnDeps, kind: string, x: number, y: number, o: StructureOptions = {}): number {
  const k = d.kinds.id(kind);
  if (k < 0) return -1;
  const opts: SpawnOptions = o.popAt !== undefined ? { popAt: o.popAt } : {};
  const id = d.factory.spawn(k, x, y, opts);
  if (id < 0) return -1;
  const level = o.level ?? 1;
  const em = d.em;
  em.team[id] = o.team ?? 0;
  em.level[id] = level;
  em.rot[id] = o.rot ?? 0;
  em.scale[id] = STRUCTURE_SCALE;
  const isMilitary = d.kinds.hasTag(k, 'building');
  if (isMilitary) {
    em.maxHp[id] = levelHp(baseHpOf(kind), level);
    em.hp[id] = em.maxHp[id] ?? 0;
  }
  if (kind === 'mine' && (o.team ?? 0) === 2) em.setFlag(id, ENTITY_FLAG.HIDDEN, true);
  if (DEFENSES[kind]?.weapon) em.aimYaw[id] = o.rot ?? 0;
  return id;
}

/** Spawns a troop (player = team 1, enemy = team 2) with level-scaled hit points. */
export function spawnTroop(d: SpawnDeps, kind: string, x: number, y: number, team: number, level = 1, popAt?: number): number {
  const k = d.kinds.id(kind);
  const stats = TROOPS[kind];
  if (k < 0 || !stats) return -1;
  const id = d.factory.spawn(k, x, y, popAt !== undefined ? { popAt } : {});
  if (id < 0) return -1;
  const em = d.em;
  em.team[id] = team;
  em.level[id] = level;
  em.maxHp[id] = levelHp(stats.hp, level);
  em.hp[id] = em.maxHp[id] ?? 0;
  em.tintR[id] = team === 2 ? 0.75 : 0.25;
  em.tintG[id] = team === 2 ? 0.27 : 0.5;
  em.tintB[id] = team === 2 ? 0.22 : 0.85;
  return id;
}

/** True if a circle of radius r at (x, y) overlaps an existing building footprint. */
export function overlapsBuilding(d: Pick<SpawnDeps, 'em' | 'kinds'>, x: number, y: number, r: number, ignore = -1): boolean {
  const em = d.em;
  for (let i = 0; i < em.highWater; i++) {
    if (em.alive[i] !== 1 || i === ignore) continue;
    const def = d.kinds.def(em.kind[i] ?? 0);
    if (!def || def.mobility !== 'static') continue;
    const fr = footprintOf(def.name);
    if (fr <= 0) continue;
    if (Math.hypot((em.x[i] ?? 0) - x, (em.y[i] ?? 0) - y) < fr + r) return true;
  }
  return false;
}
