import {
  POP_DURATION, RING_END_SIZE, RING_LIFETIME, RING_START_SIZE, RINGS_PER_COMMAND_MAX, SPARKLE_LIFETIME,
  SPARKLE_SPEED, SPARKLES_PER_COMMAND_MAX, SPARKLES_PER_ENTITY,
} from '../../core/config/juice.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { IRng } from '../../core/rng/mulberry32';
import type { EntityManager } from '../../entities/entity-manager';
import { hueToRgb } from '../sync/hue';
import { CELL, FACE, type ParticleSystem } from './particles3d';
import { popScale, type PopScale } from './pop-curve';

const BIG_RING_FACTOR = 2.6;
const SCAN_SLACK = 0.05;
const CHANGE_SPARKLE_IDS = 40;
const CHANGE_SPARKLES_EACH = 2;

/** Per-entity pop multipliers the entity sync reads (renderer-side, read-only to the sim). */
export interface JuiceState {
  readonly active: Uint8Array;
  readonly sx: Float32Array;
  readonly sy: Float32Array;
}

/**
 * Spawn juice: squash & stretch pop, a ground shock ring and sparkles.
 * Costs nothing at rest: the pop pre-pass only runs while something is younger
 * than POP_DURATION. All time spent here is reported via `takeMs()`.
 */
export class JuiceDirector implements JuiceState {
  readonly active: Uint8Array;
  readonly sx: Float32Array;
  readonly sy: Float32Array;
  private spentMs = 0;
  private scanUntil = -Infinity;
  private readonly live: number[] = [];
  private readonly out: PopScale = { sx: 1, sy: 1 };

  constructor(
    private readonly em: EntityManager,
    private readonly ps: ParticleSystem,
    private readonly rng: IRng,
    private readonly now: () => number,
    private readonly groundAt: (x: number, y: number) => number,
    bus: IEventBus,
  ) {
    this.active = new Uint8Array(em.capacity);
    this.sx = new Float32Array(em.capacity);
    this.sy = new Float32Array(em.capacity);
    bus.on('EntitiesSpawned', ({ ids, count, x, y }) => this.timed(() => this.onSpawn(ids, count, x, y)));
    bus.on('PropertyChanged', ({ ids, property }) => this.timed(() => {
      if (property === 'position') this.scanUntil = this.now() + POP_DURATION + SCAN_SLACK;
      this.sparkleIds(ids);
    }));
  }

  update(): void {
    const t0 = performance.now();
    for (const i of this.live) this.active[i] = 0;
    this.live.length = 0;
    const now = this.now();
    if (now < this.scanUntil) {
      const em = this.em;
      for (let i = 0; i < em.highWater; i++) {
        if (em.alive[i] !== 1) continue;
        if (!popScale(now - (em.spawnTime[i] ?? -1000), this.out)) continue;
        this.active[i] = 1;
        this.sx[i] = this.out.sx;
        this.sy[i] = this.out.sy;
        this.live.push(i);
      }
    }
    this.spentMs += performance.now() - t0;
  }

  takeMs(): number {
    const ms = this.spentMs;
    this.spentMs = 0;
    return ms;
  }

  private timed(fn: () => void): void {
    const t0 = performance.now();
    fn();
    this.spentMs += performance.now() - t0;
  }

  private onSpawn(ids: readonly number[], count: number, cx: number, cy: number): void {
    this.scanUntil = this.now() + POP_DURATION + SCAN_SLACK;
    const em = this.em;
    for (const i of ids.slice(0, RINGS_PER_COMMAND_MAX)) this.ring(em.x[i] ?? 0, em.y[i] ?? 0, 1);
    if (count > RINGS_PER_COMMAND_MAX) this.ring(cx, cy, BIG_RING_FACTOR);
    const total = Math.min(SPARKLES_PER_COMMAND_MAX, count * SPARKLES_PER_ENTITY);
    for (let n = 0; n < total && ids.length > 0; n++) {
      const i = ids[n % ids.length] ?? 0;
      const c = hueToRgb(0.1 + this.rng.next() * 0.08);
      this.sparkle(em.x[i] ?? 0, em.y[i] ?? 0, c.r, c.g + 0.2, c.b + 0.5);
    }
  }

  private sparkleIds(ids: readonly number[]): void {
    const em = this.em;
    for (const i of ids.slice(0, CHANGE_SPARKLE_IDS)) {
      if (em.alive[i] !== 1) continue;
      for (let k = 0; k < CHANGE_SPARKLES_EACH; k++) {
        this.sparkle(em.x[i] ?? 0, em.y[i] ?? 0, Math.min(1, (em.tintR[i] ?? 1) + 0.3), Math.min(1, (em.tintG[i] ?? 1) + 0.3), Math.min(1, (em.tintB[i] ?? 1) + 0.3));
      }
    }
  }

  private ring(x: number, y: number, scale: number): void {
    const i = this.ps.emit(CELL.RING, x, this.groundAt(x, y) + 0.12, y, 0, 0, 0, RING_LIFETIME, RING_START_SIZE * scale, RING_END_SIZE * scale, 1, 0.95, 0.75, 0.9);
    this.ps.style(i, { face: FACE.GROUND, additive: true });
  }

  private sparkle(x: number, y: number, r: number, g: number, b: number): void {
    const a = this.rng.range(0, Math.PI * 2);
    const sp = this.rng.range(0.4, 1) * SPARKLE_SPEED;
    const i = this.ps.emit(CELL.SPARK, x + this.rng.range(-0.6, 0.6), this.groundAt(x, y) + this.rng.range(0.5, 2), y + this.rng.range(-0.6, 0.6), Math.cos(a) * sp, this.rng.range(2, 5), Math.sin(a) * sp, SPARKLE_LIFETIME, this.rng.range(0.5, 0.9), 0.1, r, g, b, 1);
    this.ps.style(i, { additive: true, gravity: SPARKLE_SPEED * 1.2, rotVel: this.rng.range(-5, 5) });
  }
}
