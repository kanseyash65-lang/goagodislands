import type { Objective } from '../missions/mission-defs';

/** Live progress of one mission objective. */
export interface ObjectiveState {
  readonly def: Objective;
  progress: number;
  readonly target: number;
  done: boolean;
  failed: boolean;
}

export function createObjectives(defs: readonly Objective[]): ObjectiveState[] {
  return defs.map((def) => ({ def, progress: 0, target: def.count ?? 1, done: false, failed: false }));
}

/** Facts the controller counts during a battle. */
export interface BattleTally {
  hqDestroyed: boolean;
  cagesFreed: number;
  villageLost: number;
  scouted: number;
  wavesCleared: number;
  depotsDestroyed: number;
  escaped: boolean;
  bossDown: boolean;
  playerHqLost: boolean;
  /** Villagers still standing (village defense). */
  villagersAlive: number;
}

export function emptyTally(): BattleTally {
  return { hqDestroyed: false, cagesFreed: 0, villageLost: 0, scouted: 0, wavesCleared: 0, depotsDestroyed: 0, escaped: false, bossDown: false, playerHqLost: false, villagersAlive: 1 };
}

/** Updates every objective from the tally. Pure (unit-tested). */
export function evaluate(objs: ObjectiveState[], t: BattleTally): void {
  for (const o of objs) {
    switch (o.def.type) {
      case 'destroy-hq': o.progress = t.hqDestroyed ? 1 : 0; break;
      case 'rescue': o.progress = t.cagesFreed; break;
      case 'scout': o.progress = t.scouted; break;
      case 'survive': o.progress = t.wavesCleared; o.failed = t.playerHqLost; break;
      case 'destroy-depots': o.progress = t.depotsDestroyed; break;
      case 'escape': o.progress = t.escaped ? 1 : 0; break;
      case 'boss': o.progress = t.bossDown ? 1 : 0; break;
      case 'defeat-raiders': o.progress = t.wavesCleared; break;
      case 'villagers':
        o.progress = t.villagersAlive;
        o.failed = t.villagersAlive <= 0;
        break;
      case 'protect':
        o.progress = t.villageLost;
        o.failed = t.villageLost > o.target;
        break;
    }
    o.done = o.def.type === 'protect' || o.def.type === 'villagers' ? false : o.progress >= o.target;
  }
}

/** Victory: every non-protect objective done and nothing failed. */
export function isVictory(objs: readonly ObjectiveState[]): boolean {
  return objs.every((o) => !o.failed && (o.def.type === 'protect' || o.def.type === 'villagers' || o.done));
}

export function failedObjective(objs: readonly ObjectiveState[]): ObjectiveState | undefined {
  return objs.find((o) => o.failed);
}

/** Escape becomes the active goal only after the depots are gone. */
export function escapeActive(objs: readonly ObjectiveState[]): boolean {
  const esc = objs.some((o) => o.def.type === 'escape');
  return esc && objs.filter((o) => o.def.type !== 'escape' && o.def.type !== 'protect' && o.def.type !== 'villagers').every((o) => o.done);
}
