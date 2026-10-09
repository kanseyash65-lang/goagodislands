import { RAIN_PER_SEC, SNOW_PER_SEC } from '../../core/config/render.config';
import { CONFETTI_PER_SEC, POOF_PER_COMMAND_MAX, POOF_PER_ENTITY, RUNE_LIFETIME, RUNES_PER_SUBMIT } from '../../core/config/juice.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { IRng } from '../../core/rng/mulberry32';
import { MOB, type KindTables } from '../../entities/definitions/mobility-codes';
import { ENTITY_FLAG, type EntityManager } from '../../entities/entity-manager';
import { STATE } from '../../types/behavior';
import type { WorldParams } from '../../world/world-params';
import type { CameraRig } from '../camera/camera-rig';
import { CELL, FACE, type ParticleSystem } from './particles3d';
import { hueToRgb } from '../sync/hue';
import type { IProjectileView } from '../../gameplay/combat/projectiles';

const AMBIENT_SCAN_SECONDS = 0.25;
const RAIN_TOP = 42;
const RAIN_SPEED = 48;
const TRACER_SPEED = 160;
const hands = { x: 0, y: 0, z: 0 };

/**
 * Event-driven visual effects in 3D: god rune bursts, poofs, precipitation,
 * combat (muzzle flashes, tracers, explosions, smoke from damaged buildings)
 * and ambient emitters. Reads entities; never mutates simulation state.
 */
export class FxDirector {
  /** In-flight shells/rockets to draw (set by the composition root). */
  projectiles: IProjectileView | null = null;
  private scanAcc = 0;
  private rainAcc = 0;

  constructor(
    private readonly ps: ParticleSystem,
    private readonly cam: CameraRig,
    private readonly em: EntityManager,
    private readonly tables: KindTables,
    private readonly params: WorldParams,
    private readonly rng: IRng,
    private readonly groundAt: (x: number, y: number) => number,
    private readonly godHands: (out: { x: number; y: number; z: number }) => void,
    bus: IEventBus,
  ) {
    bus.on('CommandSubmitted', () => this.runeBurst());
    bus.on('EntitiesDestroyed', ({ points }) => this.poofs(points));
    bus.on('ShotFired', (e) => this.shot(e.kind, e.fx, e.fy, e.fz, e.tx, e.ty, e.tz));
    bus.on('ExplosionHappened', (e) => this.explosion(e.x, e.y, e.z, e.radius, e.big));
    bus.on('BuildingDestroyed', (e) => this.explosion(e.x, e.y, this.groundAt(e.x, e.y) + 1.5, 5, true));
    bus.on('LightningStruck', (e) => this.lightning(e.x, e.y));
    bus.on('UnitKilled', (e) => this.puff(e.x, e.y, this.groundAt(e.x, e.y) + 0.8, 4, 0.6, 0.55, 0.5));
  }

  update(dt: number): void {
    this.precipitation(dt);
    this.trails();
    this.flames(dt);
    this.scanAcc += dt;
    if (this.scanAcc >= AMBIENT_SCAN_SECONDS) {
      this.ambient(this.scanAcc);
      this.scanAcc = 0;
    }
  }

  /** Golden runes fly from the god's hands to where the player is looking. */
  runeBurst(): void {
    this.godHands(hands);
    const tx = this.cam.centerX;
    const ty = this.cam.centerY;
    const tz = this.groundAt(tx, ty) + 2;
    for (let n = 0; n < RUNES_PER_SUBMIT; n++) {
      const life = RUNE_LIFETIME * this.rng.range(0.8, 1.1);
      const sx = this.rng.range(-6, 6);
      const sz = this.rng.range(-6, 6);
      const c = hueToRgb(0.1 + this.rng.next() * 0.08);
      const i = this.ps.emit(CELL.SPARK, hands.x, hands.y, hands.z, (tx - hands.x) / life + sx, (tz - hands.y) / life + 8, (ty - hands.z) / life + sz, life, 1.6, 0.6, c.r + 0.3, c.g + 0.3, c.b + 0.4, 1);
      this.ps.style(i, { additive: true, gravity: 16, rotVel: this.rng.range(-5, 5) });
    }
  }

  /** Buildings on fire: rising flames, embers and a dark smoke column (every frame). */
  private flames(dt: number): void {
    const em = this.em;
    const rate = Math.min(1, dt * 60);
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1 || !em.hasFlag(i, ENTITY_FLAG.BURNING)) continue;
      const x = em.x[i] ?? 0;
      const y = em.y[i] ?? 0;
      const g = this.groundAt(x, y);
      for (let k = 0; k < 2; k++) {
        if (!this.rng.chance(rate)) continue;
        const f = this.ps.emit(CELL.SOFT, x + this.rng.range(-2.5, 2.5), g + this.rng.range(1, 4), y + this.rng.range(-2.5, 2.5), this.rng.range(-0.4, 0.4), this.rng.range(2.5, 5), this.rng.range(-0.4, 0.4), this.rng.range(0.45, 0.8), this.rng.range(1.4, 2.4), 0.3, 1, this.rng.range(0.45, 0.7), 0.12, 1);
        this.ps.style(f, { additive: true });
      }
      if (this.rng.chance(0.5 * rate)) {
        const sm = this.ps.emit(CELL.SOFT, x + this.rng.range(-1.5, 1.5), g + 5, y + this.rng.range(-1.5, 1.5), this.params.windX * 0.5, this.rng.range(2, 3.5), 0, 2.6, 2, 6, 0.18, 0.16, 0.15, 0.6);
        this.ps.style(sm, { drag: 0.3 });
      }
      if (this.rng.chance(0.3 * rate)) {
        const e = this.ps.emit(CELL.SPARK, x, g + 3, y, this.rng.range(-2, 2), this.rng.range(4, 8), this.rng.range(-2, 2), 1, 0.35, 0.1, 1, 0.7, 0.3, 1);
        this.ps.style(e, { additive: true, gravity: 3 });
      }
    }
  }

  /** A jagged bolt from the clouds to the ground, plus a flash ring. */
  lightning(x: number, y: number): void {
    const g = this.groundAt(x, y);
    let px = x;
    let py = y;
    const segments = 10;
    for (let k = 0; k < segments; k++) {
      const h = g + 48 - (k / segments) * 48;
      px += this.rng.range(-1.2, 1.2);
      py += this.rng.range(-1.2, 1.2);
      const b = this.ps.emit(CELL.STREAK, px, h - 2.4, py, 0, 0, 0, 0.28, 0.9, 0.9, 0.75, 0.85, 1, 1);
      this.ps.style(b, { additive: true, face: FACE.UPRIGHT, stretch: 6 });
      const glow = this.ps.emit(CELL.SOFT, px, h - 2.4, py, 0, 0, 0, 0.22, 3, 2, 0.6, 0.7, 1, 0.6);
      this.ps.style(glow, { additive: true });
    }
    const ring = this.ps.emit(CELL.RING, x, g + 0.15, y, 0, 0, 0, 0.5, 1, 9, 0.8, 0.9, 1, 1);
    this.ps.style(ring, { face: FACE.GROUND, additive: true });
  }

  /** Glowing head + smoke trail for each shell, rocket and mortar round in flight. */
  private trails(): void {
    const p = this.projectiles;
    if (!p) return;
    for (let i = 0; i < p.count; i++) {
      const x = p.px[i] ?? 0;
      const y = p.py[i] ?? 0;
      const h = p.ph[i] ?? 0;
      const head = this.ps.emit(CELL.SOFT, x, h, y, 0, 0, 0, 0.06, 0.9, 0.6, 1, 0.75, 0.35, 1);
      this.ps.style(head, { additive: true });
      if ((p.kindCode[i] ?? 0) !== 1) {
        const smoke = this.ps.emit(CELL.SOFT, x, h, y, 0, 0.6, 0, 0.7, 0.5, 1.4, 0.7, 0.68, 0.66, 0.5);
        this.ps.style(smoke, { drag: 1 });
      }
    }
  }

  private poofs(points: readonly number[]): void {
    const max = Math.min(points.length / 2, POOF_PER_COMMAND_MAX / POOF_PER_ENTITY);
    for (let p = 0; p < max; p++) {
      const x = points[p * 2] ?? 0;
      const y = points[p * 2 + 1] ?? 0;
      this.puff(x, y, this.groundAt(x, y) + 0.6, POOF_PER_ENTITY, 0.95, 0.92, 0.88);
    }
  }

  private puff(x: number, y: number, z: number, n: number, r: number, g: number, b: number): void {
    for (let k = 0; k < n; k++) {
      const i = this.ps.emit(CELL.SOFT, x + this.rng.range(-0.5, 0.5), z, y + this.rng.range(-0.5, 0.5), this.rng.range(-1.5, 1.5), this.rng.range(1, 3), this.rng.range(-1.5, 1.5), 0.8, 1.2, 3.2, r, g, b, 0.85);
      this.ps.style(i, { drag: 1.5 });
    }
  }

  /** Muzzle flash + tracer for bullets/snipes; smoke puff for cannons and rockets. */
  private shot(kind: string, fx: number, fy: number, fz: number, tx: number, ty: number, tz: number): void {
    const flash = this.ps.emit(CELL.SOFT, fx, fz, fy, 0, 0, 0, 0.08, kind === 'shell' ? 2.4 : 0.9, 0.3, 1, 0.85, 0.4, 1);
    this.ps.style(flash, { additive: true });
    if (kind === 'bullet' || kind === 'snipe') {
      const dx = tx - fx;
      const dy = ty - fy;
      const dz = tz - fz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const life = Math.min(0.25, len / TRACER_SPEED);
      const i = this.ps.emit(CELL.SPARK, fx, fz, fy, (dx / len) * TRACER_SPEED, (dz / len) * TRACER_SPEED, (dy / len) * TRACER_SPEED, life, kind === 'snipe' ? 0.7 : 0.45, 0.3, 1, 0.9, 0.5, 1);
      this.ps.style(i, { additive: true });
    } else if (kind === 'shell' || kind === 'rocket' || kind === 'mortar') {
      this.puff(fx, fy, fz, 2, 0.75, 0.72, 0.7);
    }
  }

  /** Fireball, sparks, smoke and a ground shock ring. */
  explosion(x: number, y: number, z: number, radius: number, big: boolean): void {
    const n = big ? 14 : 6;
    for (let k = 0; k < n; k++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(2, 6) * (big ? 1.4 : 1);
      const f = this.ps.emit(CELL.SOFT, x, z, y, Math.cos(a) * sp, this.rng.range(2, 7), Math.sin(a) * sp, this.rng.range(0.35, 0.6), radius * 0.5, radius * 1.1, 1, this.rng.range(0.45, 0.75), 0.15, 1);
      this.ps.style(f, { additive: true, drag: 2.5 });
      const s = this.ps.emit(CELL.SOFT, x, z + 0.5, y, Math.cos(a) * sp * 0.4, this.rng.range(1.5, 4), Math.sin(a) * sp * 0.4, this.rng.range(1.2, 2.2), radius * 0.5, radius * 1.6, 0.3, 0.28, 0.26, 0.75);
      this.ps.style(s, { drag: 1.2 });
    }
    for (let k = 0; k < (big ? 10 : 4); k++) {
      const d = this.ps.emit(CELL.SOFT, x, z, y, this.rng.range(-7, 7), this.rng.range(5, 12), this.rng.range(-7, 7), 1.1, 0.5, 0.4, 0.35, 0.28, 0.22, 1);
      this.ps.style(d, { gravity: 22 });
    }
    const ring = this.ps.emit(CELL.RING, x, this.groundAt(x, y) + 0.1, y, 0, 0, 0, 0.45, radius * 0.3, radius * 2.4, 1, 0.9, 0.7, 0.8);
    this.ps.style(ring, { face: FACE.GROUND });
  }

  private precipitation(dt: number): void {
    const p = this.params;
    const kind = p.weather;
    if (p.weatherIntensity <= 0.01 || (kind !== 'rain' && kind !== 'storm' && kind !== 'snow' && kind !== 'hail')) return;
    const snow = kind === 'snow';
    this.rainAcc += (snow ? SNOW_PER_SEC : RAIN_PER_SEC) * p.weatherIntensity * (kind === 'storm' ? 1.4 : 1) * dt;
    const c = this.cam;
    const spread = Math.min(260, c.viewWidth * 0.7);
    while (this.rainAcc >= 1) {
      this.rainAcc -= 1;
      const x = c.centerX + this.rng.range(-0.5, 0.5) * spread;
      const y = c.centerY + this.rng.range(-0.5, 0.5) * spread;
      if (snow) {
        if (this.ps.emit(CELL.SOFT, x, RAIN_TOP * 0.6, y, p.windX * 0.6, -5, this.rng.range(-0.5, 0.5), 5, 0.35, 0.35, 1, 1, 1, 0.95) < 0) break;
      } else {
        const i = this.ps.emit(CELL.STREAK, x, RAIN_TOP, y, p.windX * 1.5, -RAIN_SPEED, 0, RAIN_TOP / RAIN_SPEED, 0.14, 0.14, 0.75, 0.85, 1, 0.55);
        if (i < 0) break;
        this.ps.style(i, { face: FACE.UPRIGHT, stretch: 14 });
      }
    }
  }

  /** Low-rate scan for state-based emitters and battle damage smoke. */
  private ambient(dt: number): void {
    const em = this.em;
    const c = this.cam;
    const half = Math.max(c.viewWidth, c.viewHeight) * 0.6;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1) continue;
      const x = em.x[i] ?? 0;
      const y = em.y[i] ?? 0;
      if (Math.abs(x - c.centerX) > half || Math.abs(y - c.centerY) > half) continue;
      const mob = this.tables.mobility[em.kind[i] ?? 0];
      const maxHp = em.maxHp[i] ?? 0;
      if (mob === MOB.STATIC && maxHp > 0 && !em.hasFlag(i, ENTITY_FLAG.DESTROYED)) {
        const f = (em.hp[i] ?? 0) / maxHp;
        if (f < 0.6 && this.rng.chance(0.8)) this.smoke(x, y, this.groundAt(x, y) + 3, f < 0.3);
        continue;
      }
      if (mob !== MOB.VILLAGER && mob !== MOB.ANIMAL) continue;
      const st = em.state[i];
      const top = this.groundAt(x, y) + (em.z[i] ?? 0) + 2.4 * (em.scale[i] ?? 1);
      if (st === STATE.SLEEP && mob === MOB.VILLAGER && this.rng.chance(0.1)) {
        const z = this.ps.emit(CELL.SPARK, x, top, y, 0.3, 0.8, 0, 1.6, 0.4, 0.7, 0.8, 0.9, 1, 0.9);
        this.ps.style(z, { additive: true });
      } else if ((st === STATE.SING || st === STATE.CELEBRATE || (st === STATE.DANCE && mob === MOB.VILLAGER)) && this.rng.chance(CONFETTI_PER_SEC * dt * 0.5)) {
        for (let k = 0; k < 3; k++) {
          const col = hueToRgb(this.rng.next());
          const q = this.ps.emit(CELL.SOFT, x, top, y, this.rng.range(-2, 2), this.rng.range(3, 6), this.rng.range(-2, 2), 1.4, 0.35, 0.3, col.r, col.g, col.b, 1);
          this.ps.style(q, { gravity: 9 });
        }
      }
    }
  }

  private smoke(x: number, y: number, z: number, fire: boolean): void {
    const s = this.ps.emit(CELL.SOFT, x + this.rng.range(-1, 1), z, y + this.rng.range(-1, 1), this.params.windX * 0.4, this.rng.range(1.5, 3), 0, 2.2, 1.5, 4.5, 0.25, 0.23, 0.22, 0.55);
    this.ps.style(s, { drag: 0.4 });
    if (fire) {
      const f = this.ps.emit(CELL.SOFT, x + this.rng.range(-1, 1), z - 1, y + this.rng.range(-1, 1), 0, this.rng.range(1, 2.5), 0, 0.5, 1.6, 0.6, 1, 0.55, 0.15, 0.95);
      this.ps.style(f, { additive: true });
    }
  }
}
