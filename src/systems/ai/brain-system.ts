import {
  AI_THINK_MAX, AI_THINK_MIN, ANIMAL_WANDER_RADIUS, ARRIVE_DISTANCE, NIGHT_END_MIN, NIGHT_START_MIN,
  VILLAGER_WANDER_RADIUS,
} from '../../core/config/sim.config';
import { WORLD_H, WORLD_W } from '../../core/config/world.config';
import type { IRng } from '../../core/rng/mulberry32';
import type { IClock } from '../../core/time/clock';
import { MOB, type KindTables } from '../../entities/definitions/mobility-codes';
import type { EntityManager } from '../../entities/entity-manager';
import { STATE } from '../../types/behavior';
import type { WorldLayout } from '../../world/world-layout';
import type { WorldParams } from '../../world/world-params';
import { landPoint } from '../../world/world-populate';
import type { ISystem } from '../system-runner';

const PANIC_RETARGET_MIN = 0.35;
const PANIC_RETARGET_MAX = 0.9;
const PANIC_RADIUS = 12;
const IDLE_MIN = 1.5;
const IDLE_MAX = 5;
const WALK_CHANCE = 0.6;
const FLOAT_ALTITUDE = 6;
const ZERO_G = 0.05;

export function isNight(minutes: number): boolean {
  return minutes >= NIGHT_START_MIN || minutes < NIGHT_END_MIN;
}

/**
 * Utility-lite AI: schedules (night → home → sleep), wandering, work/idle,
 * and voice-commanded behaviour overrides. Brains think on staggered timers
 * (0.5–1.2 s), so per-frame cost is spread across entities.
 * Events in: none (reads WorldParams/clock). Events out: none.
 */
export class BrainSystem implements ISystem {
  readonly name = 'ai';

  constructor(
    private readonly em: EntityManager,
    private readonly tables: KindTables,
    private readonly world: { readonly layout: WorldLayout },
    private readonly params: WorldParams,
    private readonly clock: IClock,
    private readonly rng: IRng,
  ) {}

  step(_dt: number, t: number): void {
    const em = this.em;
    const night = isNight(this.clock.minutes);
    const zeroG = Math.abs(this.params.gravity) < ZERO_G || this.params.gravity < 0;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1) continue;
      const mob = this.tables.mobility[em.kind[i] ?? 0] ?? MOB.STATIC;
      if (mob !== MOB.VILLAGER && mob !== MOB.ANIMAL && mob !== MOB.FLYER) continue;
      if ((em.team[i] ?? 0) !== 0) continue; // defending the village: the combat system is in charge
      if (this.applyOverride(i, t)) continue;
      if (mob !== MOB.FLYER && zeroG && (em.z[i] ?? 0) > FLOAT_ALTITUDE) {
        em.state[i] = STATE.FLOAT;
        continue;
      }
      if (em.state[i] === STATE.FLOAT) em.state[i] = STATE.IDLE;
      if (t < (em.thinkAt[i] ?? 0)) continue;
      em.thinkAt[i] = t + this.rng.range(AI_THINK_MIN, AI_THINK_MAX);
      if (mob === MOB.VILLAGER) this.thinkVillager(i, t, night);
      else if (mob === MOB.ANIMAL) this.thinkAnimal(i, t, night);
      else this.thinkFlyer(i);
    }
  }

  /** Returns true while a voice-commanded behaviour owns this entity. */
  private applyOverride(i: number, t: number): boolean {
    const em = this.em;
    const ov = em.override[i] ?? 0;
    if (ov === 0) return false;
    if ((em.overrideUntil[i] ?? 0) <= t) {
      em.override[i] = 0;
      if (ov === STATE.SPIN) {
        em.rotVel[i] = 0;
        em.rot[i] = 0;
      }
      em.state[i] = STATE.IDLE;
      em.thinkAt[i] = t;
      return false;
    }
    em.state[i] = ov;
    if ((ov === STATE.PANIC || ov === STATE.RUN) && t >= (em.thinkAt[i] ?? 0)) {
      const p = landPoint(this.world.layout, this.rng, em.x[i] ?? 0, em.y[i] ?? 0, PANIC_RADIUS);
      em.targetX[i] = p.x;
      em.targetY[i] = p.y;
      em.thinkAt[i] = t + this.rng.range(PANIC_RETARGET_MIN, PANIC_RETARGET_MAX);
    }
    return true;
  }

  private thinkVillager(i: number, t: number, night: boolean): void {
    const em = this.em;
    if (em.state[i] === STATE.WALK && this.distToTarget(i) > ARRIVE_DISTANCE) return;
    const hx = em.homeX[i] ?? 0;
    const hy = em.homeY[i] ?? 0;
    if (night) {
      if (Math.hypot((em.x[i] ?? 0) - hx, (em.y[i] ?? 0) - hy) < ARRIVE_DISTANCE * 3) {
        em.state[i] = STATE.SLEEP;
      } else {
        this.walkTo(i, hx, hy);
      }
      return;
    }
    if (this.rng.chance(WALK_CHANCE)) {
      const useVillage = this.rng.chance(0.45);
      const cx = useVillage ? this.world.layout.village.x : hx;
      const cy = useVillage ? this.world.layout.village.y : hy;
      const p = landPoint(this.world.layout, this.rng, cx, cy, VILLAGER_WANDER_RADIUS);
      this.walkTo(i, p.x, p.y);
    } else {
      em.state[i] = this.rng.chance(0.5) ? STATE.WORK : STATE.IDLE;
      em.thinkAt[i] = t + this.rng.range(IDLE_MIN, IDLE_MAX);
    }
  }

  private thinkAnimal(i: number, t: number, night: boolean): void {
    const em = this.em;
    if (em.state[i] === STATE.WALK && this.distToTarget(i) > ARRIVE_DISTANCE) return;
    if (night && this.rng.chance(0.7)) {
      em.state[i] = STATE.SLEEP;
      em.thinkAt[i] = t + this.rng.range(IDLE_MIN, IDLE_MAX * 2);
      return;
    }
    if (this.rng.chance(0.5)) {
      const p = landPoint(this.world.layout, this.rng, em.homeX[i] ?? 0, em.homeY[i] ?? 0, ANIMAL_WANDER_RADIUS);
      this.walkTo(i, p.x, p.y);
    } else {
      em.state[i] = STATE.IDLE;
      em.thinkAt[i] = t + this.rng.range(IDLE_MIN * 0.5, IDLE_MAX);
    }
  }

  private thinkFlyer(i: number): void {
    if (this.distToTarget(i) > ARRIVE_DISTANCE * 6) return;
    this.walkTo(i, this.rng.range(60, WORLD_W - 60), this.rng.range(60, WORLD_H - 60));
  }

  private walkTo(i: number, x: number, y: number): void {
    this.em.targetX[i] = x;
    this.em.targetY[i] = y;
    this.em.state[i] = STATE.WALK;
  }

  private distToTarget(i: number): number {
    const em = this.em;
    return Math.hypot((em.targetX[i] ?? 0) - (em.x[i] ?? 0), (em.targetY[i] ?? 0) - (em.y[i] ?? 0));
  }
}
