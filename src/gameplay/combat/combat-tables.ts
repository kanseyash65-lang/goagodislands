import type { KindRegistry } from '../../entities/definitions/kinds';
import { footprintOf } from '../economy/building-catalog';
import { DEFENSES, TROOPS, VILLAGERS, type WeaponStats } from '../units/unit-stats';

/** Per-kind combat data resolved once (hot loops index by kind id). */
export interface CombatTables {
  readonly weapon: readonly (WeaponStats | undefined)[];
  readonly heal: Float32Array;
  /** Fights as a unit when on a team (troops, and villagers defending their village). */
  readonly isTroop: Uint8Array;
  readonly isVillager: Uint8Array;
  readonly isBuilding: Uint8Array;
  readonly footprint: Float32Array;
  readonly mine: readonly ({ radius: number; damage: number; splash: number } | undefined)[];
  readonly bunker: readonly ({ kind: string; count: number; trigger: number } | undefined)[];
  readonly hqKind: number;
  readonly names: readonly string[];
}

export function buildCombatTables(kinds: KindRegistry): CombatTables {
  const defs = kinds.defs;
  const n = defs.length;
  const heal = new Float32Array(n);
  const isTroop = new Uint8Array(n);
  const isVillager = new Uint8Array(n);
  const isBuilding = new Uint8Array(n);
  const footprint = new Float32Array(n);
  defs.forEach((d, i) => {
    heal[i] = TROOPS[d.name]?.heal ?? 0;
    isVillager[i] = d.mobility === 'villager' ? 1 : 0;
    isTroop[i] = d.mobility === 'troop' || d.mobility === 'villager' || TROOPS[d.name] !== undefined ? 1 : 0;
    isBuilding[i] = d.tags.includes('building') ? 1 : 0;
    footprint[i] = isBuilding[i] ? footprintOf(d.name) : 0.5;
  });
  return {
    weapon: defs.map((d) => TROOPS[d.name]?.weapon ?? DEFENSES[d.name]?.weapon ?? VILLAGERS[d.name]?.weapon),
    heal,
    isTroop,
    isVillager,
    isBuilding,
    footprint,
    mine: defs.map((d) => DEFENSES[d.name]?.mine),
    bunker: defs.map((d) => DEFENSES[d.name]?.bunker),
    hqKind: kinds.id('hq'),
    names: defs.map((d) => d.name),
  };
}
