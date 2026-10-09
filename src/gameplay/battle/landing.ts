import { TROOP_SPREAD } from '../../core/config/combat.config';
import type { IRng } from '../../core/rng/mulberry32';
import type { EntityManager } from '../../entities/entity-manager';
import type { Point, WorldLayout } from '../../world/world-layout';
import { isWalkable } from '../../world/world-layout';
import { spawnTroop, type SpawnDeps } from '../spawn/structures';

const CRAFT_SPEED = 11;
const ARRIVE = 1.5;
const SEAWARD = 4;
const INLAND = 4;

/** A landing craft carrying one squad (either team). */
interface Craft {
  readonly id: number;
  readonly kind: string;
  readonly count: number;
  readonly team: number;
  readonly level: number;
  readonly land: Point;
  readonly home: Point;
  returning: boolean;
}

/**
 * Landing craft visibly sail from the gunboat to the beach, drop their squad
 * and sail back. Works for player attacks and enemy waves alike.
 */
export class LandingCraftFleet {
  private crafts: Craft[] = [];

  constructor(private readonly spawn: SpawnDeps, private readonly world: { readonly layout: WorldLayout }, private readonly rng: IRng, private readonly realTime: () => number) {}

  get inTransit(): number {
    return this.crafts.filter((c) => !c.returning).length;
  }

  /** Sends a craft from `from` (at sea) to the landing point nearest `target`. */
  launch(kind: string, count: number, team: number, level: number, from: Point, target: Point): void {
    const land = nearestLanding(this.world.layout, target);
    const k = this.spawn.kinds.id('landing-craft');
    const id = this.spawn.factory.spawn(k, from.x + this.rng.range(-4, 4), from.y + this.rng.range(-4, 4));
    if (id < 0) return;
    const em = this.spawn.em;
    em.team[id] = team;
    em.scale[id] = 1.2;
    if (team === 2) {
      em.tintR[id] = 0.75;
      em.tintG[id] = 0.27;
      em.tintB[id] = 0.22;
    }
    this.crafts.push({ id, kind, count, team, level, land, home: from, returning: false });
  }

  step(dt: number): void {
    const em: EntityManager = this.spawn.em;
    for (const c of this.crafts) {
      if (em.alive[c.id] !== 1) continue;
      const tx = c.returning ? c.home.x : c.land.x + SEAWARD;
      const ty = c.returning ? c.home.y : c.land.y;
      const x = em.x[c.id] ?? 0;
      const y = em.y[c.id] ?? 0;
      const d = Math.hypot(tx - x, ty - y);
      if (d < ARRIVE) {
        if (c.returning) em.destroy(c.id);
        else this.unload(c);
        continue;
      }
      const step = Math.min(d, CRAFT_SPEED * dt);
      em.x[c.id] = x + ((tx - x) / d) * step;
      em.y[c.id] = y + ((ty - y) / d) * step;
      em.vx[c.id] = ((tx - x) / d) * CRAFT_SPEED;
      em.vy[c.id] = ((ty - y) / d) * CRAFT_SPEED;
    }
    this.crafts = this.crafts.filter((c) => em.alive[c.id] === 1);
  }

  private unload(c: Craft): void {
    c.returning = true;
    const l = this.world.layout;
    for (let n = 0; n < c.count; n++) {
      let x = c.land.x - INLAND + this.rng.range(-TROOP_SPREAD, TROOP_SPREAD);
      let y = c.land.y + this.rng.range(-TROOP_SPREAD, TROOP_SPREAD);
      if (!isWalkable(l, x, y)) {
        x = c.land.x - INLAND;
        y = c.land.y;
      }
      const id = spawnTroop(this.spawn, c.kind, x, y, c.team, c.level, this.realTime());
      if (id >= 0) {
        this.spawn.em.homeX[id] = x;
        this.spawn.em.homeY[id] = y;
      }
    }
  }

  clear(): void {
    this.crafts = [];
  }
}

export function nearestLanding(l: WorldLayout, p: Point): Point {
  let best = l.landing[0] ?? { x: p.x, y: p.y };
  let bestD = Infinity;
  for (const q of l.landing) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}
