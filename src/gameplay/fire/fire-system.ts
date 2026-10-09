import type { IEventBus } from '../../core/events/event-bus';
import type { IRng } from '../../core/rng/mulberry32';
import { ENTITY_FLAG, type EntityManager } from '../../entities/entity-manager';
import type { ISystem } from '../../systems/system-runner';
import type { WorldParams } from '../../world/world-params';

const FIRE_DPS = 32;
const SPREAD_PER_SEC = 0.05;
const SPREAD_RADIUS = 11;
const RAIN_PUT_OUT_PER_SEC = 1.4;
const RAIN_THRESHOLD = 0.25;
const WET_WEATHER = new Set(['rain', 'storm', 'snow', 'hail']);

/** Read-only fire view for the HUD and hints. */
export interface IFireView {
  readonly count: number;
}

/**
 * Burning buildings: fire eats hit points, can leap to a neighbour, and rain
 * (or snow) puts it out. Sets the BURNING flag the renderer turns into flames.
 * Events out: ToastRequested when the rain wins (the battle banner announces fires).
 */
export class FireSystem implements ISystem, IFireView {
  readonly name = 'fire';
  private readonly burning = new Set<number>();

  constructor(
    private readonly em: EntityManager,
    private readonly params: WorldParams,
    private readonly bus: IEventBus,
    private readonly rng: IRng,
    private readonly damage: (id: number, amount: number) => void,
    private readonly isBuilding: (id: number) => boolean,
  ) {}

  get count(): number {
    return this.burning.size;
  }

  /** Sets a building on fire. Returns false if it cannot burn. */
  ignite(id: number): boolean {
    const em = this.em;
    if (!em.isAlive(id) || !this.isBuilding(id) || (em.maxHp[id] ?? 0) <= 0 || em.hasFlag(id, ENTITY_FLAG.DESTROYED) || this.burning.has(id)) return false;
    if (this.raining()) return false; // wet thatch does not catch
    this.burning.add(id);
    em.setFlag(id, ENTITY_FLAG.BURNING, true);
    return true;
  }

  /** Puts out every fire. Returns how many were burning. */
  extinguishAll(): number {
    const n = this.burning.size;
    for (const id of this.burning) this.em.setFlag(id, ENTITY_FLAG.BURNING, false);
    this.burning.clear();
    return n;
  }

  reset(): void {
    this.extinguishAll();
  }

  step(dt: number): void {
    if (this.burning.size === 0) return;
    const rain = this.raining();
    let doused = 0;
    for (const id of [...this.burning]) {
      if (!this.em.isAlive(id) || this.em.hasFlag(id, ENTITY_FLAG.DESTROYED)) {
        this.burning.delete(id);
        this.em.setFlag(id, ENTITY_FLAG.BURNING, false);
        continue;
      }
      if (rain && this.rng.chance(RAIN_PUT_OUT_PER_SEC * dt)) {
        this.burning.delete(id);
        this.em.setFlag(id, ENTITY_FLAG.BURNING, false);
        doused++;
        continue;
      }
      this.damage(id, FIRE_DPS * dt);
      if (!rain && this.rng.chance(SPREAD_PER_SEC * dt)) this.spreadFrom(id);
    }
    if (doused > 0 && this.burning.size === 0) this.bus.emit('ToastRequested', { text: '🌧 The rain put out every fire. The villagers cheer (quietly).' });
  }

  private raining(): boolean {
    return WET_WEATHER.has(this.params.weather) && this.params.weatherIntensity > RAIN_THRESHOLD;
  }

  private spreadFrom(id: number): void {
    const em = this.em;
    const x = em.x[id] ?? 0;
    const y = em.y[id] ?? 0;
    let best = -1;
    let bestD = SPREAD_RADIUS;
    for (let j = 0; j < em.highWater; j++) {
      if (j === id || em.alive[j] !== 1 || (em.maxHp[j] ?? 0) <= 0 || this.burning.has(j) || em.hasFlag(j, ENTITY_FLAG.DESTROYED)) continue;
      if ((em.team[j] ?? 0) === 2) continue;
      const d = Math.hypot((em.x[j] ?? 0) - x, (em.y[j] ?? 0) - y);
      if (d < bestD && this.isBuilding(j)) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) this.ignite(best);
  }
}
