import { CLOUD_SPEED_MUL, HOP_IMPULSE, PANIC_SPEED_MUL, RAIN_SPEED_MUL, RUN_SPEED_MUL } from '../../core/config/sim.config';
import { WORLD_W } from '../../core/config/world.config';
import { MOB, type KindTables } from '../../entities/definitions/mobility-codes';
import type { EntityManager } from '../../entities/entity-manager';
import { STATE } from '../../types/behavior';
import { isWalkable, type WorldLayout } from '../../world/world-layout';
import type { WorldParams } from '../../world/world-params';
import type { ISystem } from '../system-runner';

const FLYER_ALTITUDE = 13;
const FLYER_BOB = 2;
const CLOUD_WRAP_MARGIN = 160;
const DANCE_ANIM_RATE = 2.2;
const ARRIVE = 0.4;

/**
 * Steering toward brain targets, walkability (no walking on water except the
 * bridge), animation clocks, cloud drift, accessories following parents.
 */
export class MovementSystem implements ISystem {
  readonly name = 'movement';

  constructor(
    private readonly em: EntityManager,
    private readonly tables: KindTables,
    private readonly world: { readonly layout: WorldLayout },
    private readonly params: WorldParams,
  ) {}

  step(dt: number, t: number): void {
    const em = this.em;
    const wet = this.params.weather === 'rain' || this.params.weather === 'storm' || this.params.weather === 'snow';
    const weatherMul = wet ? RAIN_SPEED_MUL : 1;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1) continue;
      const parent = em.parent[i] ?? -1;
      if (parent >= 0) {
        this.follow(i, parent);
        continue;
      }
      const mob = this.tables.mobility[em.kind[i] ?? 0] ?? MOB.STATIC;
      if (mob === MOB.CLOUD) {
        this.drift(i, dt);
        continue;
      }
      if (mob !== MOB.VILLAGER && mob !== MOB.ANIMAL && mob !== MOB.FLYER) continue;
      if ((em.team[i] ?? 0) !== 0) continue; // combat moves team units
      this.moveOne(i, mob, dt, t, weatherMul);
    }
  }

  private moveOne(i: number, mob: number, dt: number, t: number, weatherMul: number): void {
    const em = this.em;
    const st = em.state[i] ?? STATE.IDLE;
    em.vx[i] = 0;
    em.vy[i] = 0;
    if (st === STATE.DANCE || st === STATE.CELEBRATE || st === STATE.SING) {
      em.animTime[i] = (em.animTime[i] ?? 0) + dt * DANCE_ANIM_RATE;
      return;
    }
    em.animTime[i] = (em.animTime[i] ?? 0) + dt;
    if (st === STATE.JUMP && (em.z[i] ?? 0) <= 0.5 && this.params.gravity > 0) em.vz[i] = HOP_IMPULSE;
    if (mob === MOB.FLYER) {
      em.z[i] = FLYER_ALTITUDE + Math.sin(t * 1.3 + i) * FLYER_BOB;
    }
    const moving = st === STATE.WALK || st === STATE.PANIC || st === STATE.RUN;
    if (!moving) return;
    const dx = (em.targetX[i] ?? 0) - (em.x[i] ?? 0);
    const dy = (em.targetY[i] ?? 0) - (em.y[i] ?? 0);
    const d = Math.hypot(dx, dy);
    if (d < ARRIVE) return;
    const mul = st === STATE.PANIC ? PANIC_SPEED_MUL : st === STATE.RUN ? RUN_SPEED_MUL : 1;
    const speed = (this.tables.speed[em.kind[i] ?? 0] ?? 0) * (em.speedMul[i] ?? 1) * mul * weatherMul;
    const step = Math.min(d, speed * dt);
    const nx = (em.x[i] ?? 0) + (dx / d) * step;
    const ny = (em.y[i] ?? 0) + (dy / d) * step;
    if (mob !== MOB.FLYER && !isWalkable(this.world.layout, nx, ny)) {
      em.targetX[i] = em.x[i] ?? 0;
      em.targetY[i] = em.y[i] ?? 0;
      em.state[i] = STATE.IDLE;
      return;
    }
    em.x[i] = nx;
    em.y[i] = ny;
    em.vx[i] = (dx / d) * speed;
    em.vy[i] = (dy / d) * speed;
  }

  private drift(i: number, dt: number): void {
    const em = this.em;
    let x = (em.x[i] ?? 0) + this.params.windX * CLOUD_SPEED_MUL * dt;
    if (x > WORLD_W + CLOUD_WRAP_MARGIN) x = -CLOUD_WRAP_MARGIN;
    if (x < -CLOUD_WRAP_MARGIN) x = WORLD_W + CLOUD_WRAP_MARGIN;
    em.x[i] = x;
    em.y[i] = (em.y[i] ?? 0) + this.params.windY * CLOUD_SPEED_MUL * dt;
  }

  private follow(i: number, parent: number): void {
    const em = this.em;
    if (em.alive[parent] !== 1) {
      em.parent[i] = -1;
      return;
    }
    em.x[i] = em.x[parent] ?? 0;
    em.y[i] = (em.y[parent] ?? 0) - 0.5; // sort just in front of the parent
    em.z[i] = (em.z[parent] ?? 0) + (em.attachDz[i] ?? 0) * (em.scale[parent] ?? 1);
    em.vz[i] = 0;
  }
}
