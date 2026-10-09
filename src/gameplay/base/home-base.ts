import { ISLAND_CENTER, ISLAND_RADIUS } from '../../core/config/world.config';
import { HOME_ISLAND } from '../../world/island-specs';
import { buildingSpec } from '../economy/building-catalog';

/** One player-owned building on the home island (persistent). */
export interface BaseBuilding {
  readonly uid: number;
  readonly kind: string;
  x: number;
  y: number;
  rot: number;
  level: number;
}

/**
 * The home island's player buildings as data. Entities are spawned from this
 * when the home island loads; build mode edits it; production reads it even
 * while you are away attacking.
 */
export class HomeBase {
  buildings: BaseBuilding[] = [];
  private nextUid = 1;

  static fresh(): HomeBase {
    const b = new HomeBase();
    for (const p of HOME_ISLAND.structures) {
      if ((p.team ?? 0) !== 1) continue;
      b.add(p.kind, ISLAND_CENTER + p.fx * ISLAND_RADIUS, ISLAND_CENTER + p.fy * ISLAND_RADIUS, p.rot ?? 0, p.level ?? 1);
    }
    return b;
  }

  static restore(list: readonly BaseBuilding[]): HomeBase {
    const b = new HomeBase();
    for (const s of list) if (buildingSpec(s.kind)) b.add(s.kind, s.x, s.y, s.rot, s.level);
    if (b.count('hq') === 0) return HomeBase.fresh();
    return b;
  }

  add(kind: string, x: number, y: number, rot = 0, level = 1): BaseBuilding {
    const bb: BaseBuilding = { uid: this.nextUid++, kind, x, y, rot, level };
    this.buildings.push(bb);
    return bb;
  }

  remove(uid: number): void {
    this.buildings = this.buildings.filter((b) => b.uid !== uid);
  }

  get(uid: number): BaseBuilding | undefined {
    return this.buildings.find((b) => b.uid === uid);
  }

  count(kind: string): number {
    let n = 0;
    for (const b of this.buildings) if (b.kind === kind) n++;
    return n;
  }

  hqLevel(): number {
    return this.buildings.find((b) => b.kind === 'hq')?.level ?? 1;
  }

  levelOf(kind: string): number {
    let best = 0;
    for (const b of this.buildings) if (b.kind === kind) best = Math.max(best, b.level);
    return best;
  }
}
