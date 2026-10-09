import type { IslandContent, Placement } from '../../world/island-specs';
import type { Cost } from '../economy/building-catalog';

/** Campaign data: 7 defense missions of rising difficulty. You never attack: you defend each village with god powers. */
export type ObjectiveType = 'destroy-hq' | 'rescue' | 'protect' | 'scout' | 'survive' | 'destroy-depots' | 'escape' | 'boss' | 'defeat-raiders' | 'villagers';

export interface Objective {
  readonly type: ObjectiveType;
  readonly label: string;
  readonly count?: number;
}

export interface Wave {
  readonly delay: number;
  readonly troops: readonly { readonly kind: string; readonly count: number }[];
}

export interface MissionDef {
  readonly id: string;
  readonly order: number;
  readonly name: string;
  /** The Goan place being defended (newspaper headlines). */
  readonly place: string;
  readonly brief: string;
  readonly mapX: number;
  readonly mapY: number;
  readonly difficulty: number;
  /** attack: you invade; defend: hold your HQ; village: protect villagers with god powers only. */
  readonly mode: 'attack' | 'defend' | 'village';
  /** Village mode: the enemy gunboat firebombs a house this often (seconds). */
  readonly bombardEvery?: number;
  readonly island: IslandContent;
  readonly enemyLevel: number;
  readonly objectives: readonly Objective[];
  readonly energy?: number;
  /** Defenses start hidden under the jungle until spotted (scouting / getting close). */
  readonly hiddenDefenses?: boolean;
  readonly seconds?: number;
  readonly patrols?: readonly { readonly kind: string; readonly count: number; readonly fx: number; readonly fy: number }[];
  readonly waves?: readonly Wave[];
  /** Defend missions: defenses the player may place before the waves. */
  readonly kit?: readonly { readonly kind: string; readonly count: number }[];
  readonly reward: Cost & { readonly gems?: number; readonly xp: number };
  readonly unlocks: readonly string[];
}

const v = (kind: string, fx: number, fy: number, rot = 0): Placement => ({ kind, fx, fy, team: 0, rot });
/** A village building the player must protect (team 1, so raiders target it). */
const v1 = (kind: string, fx: number, fy: number, rot = 0): Placement => ({ kind, fx, fy, team: 1, rot });
const E = Math.PI / 2; // face east (toward the beach)

export const MISSIONS: readonly MissionDef[] = [
  {
    id: 'm1', place: 'Calangute', order: 1, name: 'Defend the Village', mapX: 0.3, mapY: 0.66, difficulty: 1, mode: 'village', enemyLevel: 1,
    brief: 'Raider boats are sailing for Calangute. They will firebomb the houses and attack the villagers. You are their god: make it rain on the fires, strengthen your people, and smite the invaders. Defeat every raider to save the village.',
    island: {
      style: { seed: 101, size: 0.9, roundness: 3.2, hills: 9 }, jungle: 0.8, villagers: 16, animals: 4,
      structures: [
        v1('house', -0.05, -0.32), v1('house', 0.2, -0.38), v1('house', -0.3, -0.12), v1('house', 0.25, 0.3, Math.PI), v1('house', -0.05, 0.36, Math.PI),
        v1('house', -0.32, 0.22), v1('chapel', -0.5, 0, E), v1('market', 0.22, -0.05), v1('shack', 0.66, -0.36, E), v1('shack', 0.68, 0.34, E),
        v('well', 0, 0), v('windmill', -0.55, -0.5), v('fishing-boat', 0.84, -0.1, 0.3), v('fishing-boat', 0.86, 0.18, -0.3), v('jetty', 0.95, 0.4, E),
      ],
    },
    bombardEvery: 9,
    waves: [
      { delay: 8, troops: [{ kind: 'rifleman', count: 6 }, { kind: 'rocketeer', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 8 }, { kind: 'rocketeer', count: 3 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 9 }, { kind: 'rocketeer', count: 3 }, { kind: 'heavy', count: 2 }] },
    ],
    objectives: [
      { type: 'defeat-raiders', label: 'Defeat every raider wave', count: 3 },
      { type: 'protect', label: 'Keep the village standing (lose at most 4 buildings)', count: 4 },
      { type: 'villagers', label: 'Keep your villagers alive' },
    ],
    seconds: 420,
    reward: { gold: 1500, timber: 1200, gems: 15, xp: 300 }, unlocks: ['heavy', 'medkit'],
  },
  {
    id: 'm2', place: 'Baga', order: 2, name: 'Save the Fishing Village', mapX: 0.46, mapY: 0.74, difficulty: 2, mode: 'village', enemyLevel: 1,
    brief: 'Raiders want the boats and nets of Baga. Their gunboat shells the fisherfolk huts from the bay. Keep the huts from burning and break three waves.',
    island: {
      style: { seed: 202, size: 0.92, roundness: 3.2, hills: 10 }, jungle: 0.8, villagers: 18, animals: 3,
      structures: [
        v1('house', 0.05, -0.36), v1('house', -0.22, -0.3), v1('house', 0.3, -0.24, E), v1('house', 0.32, 0.26, E), v1('house', 0.02, 0.36, Math.PI),
        v1('house', -0.28, 0.24), v1('chapel', -0.46, -0.02, E), v1('market', 0.12, 0.04), v1('shack', 0.62, -0.3, E), v1('shack', 0.64, 0.12, E), v1('shack', 0.6, 0.4, E),
        v('well', -0.12, 0.02), v('fishing-boat', 0.86, -0.18, 0.3), v('fishing-boat', 0.88, 0.06), v('fishing-boat', 0.85, 0.3, -0.3), v('jetty', 0.95, 0.42, E),
      ],
    },
    bombardEvery: 8,
    waves: [
      { delay: 8, troops: [{ kind: 'rifleman', count: 7 }, { kind: 'rocketeer', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 9 }, { kind: 'rocketeer', count: 3 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'rocketeer', count: 3 }, { kind: 'heavy', count: 2 }] },
    ],
    objectives: [
      { type: 'defeat-raiders', label: 'Defeat every raider wave', count: 3 },
      { type: 'protect', label: 'Lose at most 4 huts and houses', count: 4 },
      { type: 'villagers', label: 'Keep your villagers alive' },
    ],
    seconds: 420,
    reward: { gold: 2500, timber: 2000, stone: 400, gems: 20, xp: 500 }, unlocks: ['medic', 'shield'],
  },
  {
    id: 'm3', place: 'the Ghats', order: 3, name: 'The Jungle Chapel', mapX: 0.36, mapY: 0.44, difficulty: 3, mode: 'village', enemyLevel: 2,
    brief: 'A hill village hides under the palms of the Western Ghats coast. Tougher raiders with medics march through the jungle toward the old chapel. Protect the chapel and its people through four waves.',
    island: {
      style: { seed: 303, size: 1, roundness: 3.6, hills: 16 }, jungle: 1.7, villagers: 18, animals: 2,
      structures: [
        v1('chapel', -0.4, -0.1, E), v1('house', -0.18, -0.36), v1('house', 0.06, -0.3), v1('house', -0.2, 0.3), v1('house', 0.05, 0.34, Math.PI),
        v1('house', 0.22, 0.02, E), v1('market', -0.05, 0.02), v1('shack', 0.5, -0.24, E), v1('shack', 0.52, 0.26, E),
        v('well', -0.22, 0.04), v('windmill', -0.6, 0.38), v('fort-tower', -0.62, -0.42), v('fishing-boat', 0.86, 0.06),
      ],
    },
    bombardEvery: 8,
    waves: [
      { delay: 8, troops: [{ kind: 'rifleman', count: 7 }, { kind: 'rocketeer', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 8 }, { kind: 'medic', count: 2 }, { kind: 'rocketeer', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 9 }, { kind: 'heavy', count: 2 }, { kind: 'medic', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'heavy', count: 3 }, { kind: 'rocketeer', count: 3 }] },
    ],
    objectives: [
      { type: 'defeat-raiders', label: 'Defeat every raider wave', count: 4 },
      { type: 'protect', label: 'Lose at most 4 village buildings', count: 4 },
      { type: 'villagers', label: 'Keep your villagers alive' },
    ],
    seconds: 480,
    reward: { gold: 4000, timber: 3000, stone: 800, gems: 25, xp: 800 }, unlocks: ['rocketeer', 'quarry'],
  },
  {
    id: 'm4', place: 'Colva', order: 4, name: 'Protect the Coast', mapX: 0.58, mapY: 0.58, difficulty: 3, mode: 'village', enemyLevel: 2,
    brief: 'Colva beach is lined with shacks and homes. The raider gunboat fires faster here, so fires spread quickly. Keep the rain coming and hold four waves.',
    island: {
      style: { seed: 404, size: 0.95, roundness: 3.2, hills: 9 }, jungle: 0.9, villagers: 18, animals: 3,
      structures: [
        v1('house', -0.2, -0.38), v1('house', 0.04, -0.4), v1('house', -0.34, 0.34), v1('house', -0.06, 0.4, Math.PI), v1('house', 0.18, -0.12, E),
        v1('chapel', -0.55, -0.1, E), v1('market', 0.02, 0.08), v1('shack', 0.56, -0.34, E), v1('shack', 0.6, -0.08, E), v1('shack', 0.6, 0.18, E), v1('shack', 0.56, 0.42, E),
        v('well', -0.22, 0.02), v('lighthouse', -0.62, 0.42), v('fishing-boat', 0.86, -0.2, 0.3), v('fishing-boat', 0.88, 0.3, -0.3), v('jetty', 0.95, 0.06, E),
      ],
    },
    bombardEvery: 6,
    waves: [
      { delay: 8, troops: [{ kind: 'rifleman', count: 8 }, { kind: 'rocketeer', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 8 }, { kind: 'heavy', count: 2 }, { kind: 'rocketeer', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'heavy', count: 2 }, { kind: 'medic', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'heavy', count: 3 }, { kind: 'rocketeer', count: 4 }] },
    ],
    objectives: [
      { type: 'defeat-raiders', label: 'Defeat every raider wave', count: 4 },
      { type: 'protect', label: 'Lose at most 5 beach buildings', count: 5 },
      { type: 'villagers', label: 'Keep your villagers alive' },
    ],
    seconds: 480,
    reward: { gold: 5000, timber: 4000, stone: 1200, gems: 30, xp: 1000 }, unlocks: ['engineer', 'iron-mine'],
  },
  {
    id: 'm5', place: 'Chapora', order: 5, name: 'Smugglers Strike Back', mapX: 0.22, mapY: 0.34, difficulty: 4, mode: 'village', enemyLevel: 2,
    brief: 'The smugglers of Chapora cove send engineers with demolition charges. They run straight for the houses. Strike them down before they blow up the village.',
    island: {
      style: { seed: 505, size: 0.95, roundness: 3, hills: 14, cove: true }, jungle: 1.2, villagers: 18, animals: 1,
      structures: [
        v1('house', -0.28, -0.3), v1('house', -0.02, -0.34), v1('house', 0.22, -0.2, E), v1('house', 0.24, 0.24, E), v1('house', -0.02, 0.36, Math.PI),
        v1('house', -0.3, 0.3), v1('chapel', -0.5, 0, E), v1('market', 0, 0), v1('shack', 0.58, -0.1, E), v1('shack', 0.58, 0.2, E),
        v('well', -0.2, 0.04), v('windmill', -0.62, -0.42), v('fishing-boat', 0.86, 0.04),
      ],
    },
    bombardEvery: 7,
    waves: [
      { delay: 8, troops: [{ kind: 'rifleman', count: 7 }, { kind: 'engineer', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 8 }, { kind: 'engineer', count: 2 }, { kind: 'rocketeer', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 9 }, { kind: 'engineer', count: 2 }, { kind: 'heavy', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'engineer', count: 3 }, { kind: 'heavy', count: 2 }, { kind: 'medic', count: 2 }] },
    ],
    objectives: [
      { type: 'defeat-raiders', label: 'Defeat every raider wave', count: 4 },
      { type: 'protect', label: 'Lose at most 6 village buildings', count: 6 },
      { type: 'villagers', label: 'Keep your villagers alive' },
    ],
    seconds: 480,
    reward: { gold: 9000, timber: 7000, stone: 2000, metal: 800, gems: 40, xp: 1300 }, unlocks: ['barrage'],
  },
  {
    id: 'm6', place: 'Aguada', order: 6, name: 'Siege of Fort Aguada', mapX: 0.52, mapY: 0.3, difficulty: 4, mode: 'village', enemyLevel: 3,
    brief: 'The village below Fort Aguada is under siege. Five waves of veteran raiders and a gunboat that never stops firing. Only a god can hold this line.',
    island: {
      style: { seed: 606, size: 1.05, roundness: 4, hills: 12 }, jungle: 0.9, villagers: 20, animals: 0,
      structures: [
        v1('house', -0.12, -0.36), v1('house', 0.12, -0.32), v1('house', -0.3, -0.18), v1('house', -0.3, 0.2), v1('house', -0.1, 0.36, Math.PI), v1('house', 0.14, 0.32, Math.PI),
        v1('chapel', -0.48, 0, E), v1('market', 0.1, 0), v1('shack', 0.5, -0.26, E), v1('shack', 0.52, 0.26, E),
        v('fort-tower', -0.64, -0.4), v('lighthouse', -0.62, 0.42), v('well', -0.12, 0.02), v('jetty', 0.95, 0.4, E),
      ],
    },
    bombardEvery: 6,
    waves: [
      { delay: 8, troops: [{ kind: 'rifleman', count: 8 }, { kind: 'rocketeer', count: 3 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 9 }, { kind: 'heavy', count: 2 }, { kind: 'medic', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'engineer', count: 2 }, { kind: 'rocketeer', count: 3 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'heavy', count: 3 }, { kind: 'medic', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 12 }, { kind: 'heavy', count: 4 }, { kind: 'rocketeer', count: 4 }] },
    ],
    objectives: [
      { type: 'defeat-raiders', label: 'Defeat every raider wave', count: 5 },
      { type: 'protect', label: 'Lose at most 5 village buildings', count: 5 },
      { type: 'villagers', label: 'Keep your villagers alive' },
    ],
    seconds: 600,
    reward: { gold: 14000, timber: 11000, stone: 4000, metal: 1500, gems: 50, xp: 1800 }, unlocks: ['commander-intel'],
  },
  {
    id: 'm7', place: 'Panjim', order: 7, name: 'Liberate Goa', mapX: 0.72, mapY: 0.2, difficulty: 5, mode: 'village', enemyLevel: 3,
    brief: 'The raider Commander lands in person for one last assault on Panjim. Survive five waves, defeat the Commander, and Goa is free forever.',
    island: {
      style: { seed: 707, size: 1.15, roundness: 3.4, hills: 15 }, jungle: 1, villagers: 22, animals: 2,
      structures: [
        v1('house', -0.2, -0.38), v1('house', 0.04, -0.4), v1('house', 0.26, -0.26, E), v1('house', -0.36, -0.14), v1('house', -0.36, 0.2),
        v1('house', -0.14, 0.4, Math.PI), v1('house', 0.1, 0.38, Math.PI), v1('house', 0.28, 0.2, E), v1('chapel', -0.56, 0, E), v1('market', 0, 0),
        v1('shack', 0.56, -0.12, E), v1('shack', 0.56, 0.16, E),
        v('well', -0.18, 0.02), v('windmill', -0.66, -0.44), v('lighthouse', -0.64, 0.44), v('fishing-boat', 0.86, -0.2, 0.3), v('jetty', 0.95, 0.36, E),
      ],
    },
    bombardEvery: 6,
    waves: [
      { delay: 8, troops: [{ kind: 'rifleman', count: 9 }, { kind: 'rocketeer', count: 3 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'heavy', count: 2 }, { kind: 'medic', count: 2 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 10 }, { kind: 'engineer', count: 2 }, { kind: 'rocketeer', count: 3 }] },
      { delay: 6, troops: [{ kind: 'rifleman', count: 12 }, { kind: 'heavy', count: 4 }, { kind: 'medic', count: 2 }] },
      { delay: 6, troops: [{ kind: 'commander', count: 1 }, { kind: 'heavy', count: 3 }, { kind: 'rifleman', count: 10 }] },
    ],
    objectives: [
      { type: 'defeat-raiders', label: 'Defeat every raider wave', count: 5 },
      { type: 'boss', label: 'Defeat the raider Commander' },
      { type: 'protect', label: 'Lose at most 6 buildings', count: 6 },
      { type: 'villagers', label: 'Keep your villagers alive' },
    ],
    seconds: 660,
    reward: { gold: 25000, timber: 20000, stone: 8000, metal: 3000, gems: 100, xp: 3000 }, unlocks: ['liberated'],
  },
];

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function nextMission(completed: readonly string[]): MissionDef | undefined {
  return MISSIONS.find((m) => !completed.includes(m.id));
}
