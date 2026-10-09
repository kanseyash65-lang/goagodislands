import {
  AGGRO_RADIUS, DEFENSE_TURN_SPEED, MEDKIT_HEAL_PER_SEC, REVEAL_RADIUS, SEPARATION_RADIUS, UNIT_THINK_SECONDS,
} from '../../core/config/combat.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { IRng } from '../../core/rng/mulberry32';
import type { KindRegistry } from '../../entities/definitions/kinds';
import type { KindTables } from '../../entities/definitions/mobility-codes';
import { ENTITY_FLAG, type EntityManager } from '../../entities/entity-manager';
import type { ISystem } from '../../systems/system-runner';
import { STATE } from '../../types/behavior';
import { heightAt, isWalkable, type WorldLayout } from '../../world/world-layout';
import { spawnTroop, type SpawnDeps } from '../spawn/structures';
import { levelDamage } from '../units/unit-stats';
import { buildCombatTables, type CombatTables } from './combat-tables';
import { ProjectilePool, type IProjectileView } from './projectiles';

/** Battle zones set by the battle controller (abilities). */
export interface Zone {
  x: number;
  y: number;
  radius: number;
  until: number;
}

export interface CombatZones {
  flare: Zone | null;
  readonly shields: Zone[];
  readonly medkits: Zone[];
}

const PROJECTILE_CAPACITY = 512;
const MUZZLE_HEIGHT = 1.4;
const BUILDING_PUSH = 1.2;
const PATROL_RADIUS = 14;
const BUNKER_SPAWN_RADIUS = 4;
const FIRE_JITTER = 0.15;
const FLEE_HP = 0.35;
const FLEE_RADIUS = 14;
/** Villagers rally to any raider inside the village, not just the one next door (no fighting one by one). */
const VILLAGE_RALLY_RADIUS = 60;

/**
 * Troops vs defenses, both teams symmetric (1 = player, 2 = enemy).
 * Troops: pick targets, steer around buildings and each other, stop at range,
 * fire. Medics heal. Defenses aim and fire. Mines, bunkers, hidden defenses.
 * Events out: ShotFired, ExplosionHappened, UnitKilled, BuildingDestroyed.
 */
export class CombatSystem implements ISystem {
  readonly name = 'combat';
  readonly projectiles = new ProjectilePool(PROJECTILE_CAPACITY);
  readonly zones: CombatZones = { flare: null, shields: [], medkits: [] };
  readonly tables: CombatTables;
  /** Called when a raider explosive lands: sets nearby buildings on fire. */
  igniter: ((x: number, y: number, radius: number) => void) | null = null;
  /** Off on islands with nothing to fight (saves the scans). */
  active = true;
  private t = 0;

  constructor(
    private readonly em: EntityManager,
    kinds: KindRegistry,
    private readonly kindTables: KindTables,
    private readonly world: { readonly layout: WorldLayout; readonly spawn: SpawnDeps },
    private readonly bus: IEventBus,
    private readonly rng: IRng,
    private readonly realTime: () => number,
  ) {
    this.tables = buildCombatTables(kinds);
  }

  get view(): IProjectileView {
    return this.projectiles;
  }

  step(dt: number, t: number): void {
    this.t = t;
    if (!this.active) return;
    this.pruneZones();
    const em = this.em;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1) continue;
      const k = em.kind[i] ?? 0;
      const team = em.team[i] ?? 0;
      if (team === 0) continue;
      if (this.tables.isTroop[k] === 1) this.stepTroop(i, k, team, dt);
      else if (this.tables.isBuilding[k] === 1 && !em.hasFlag(i, ENTITY_FLAG.DESTROYED)) this.stepStructure(i, k, team, dt);
    }
    this.projectiles.update(dt, (x, y, h, dmg, splash, team, target, kind) => this.impact(x, y, h, dmg, splash, team, target, kind));
  }

  /** Applies damage; returns true if it killed. Shields protect player troops. */
  damage(id: number, amount: number): boolean {
    const em = this.em;
    if (em.alive[id] !== 1 || em.hasFlag(id, ENTITY_FLAG.DESTROYED)) return false;
    if ((em.team[id] ?? 0) === 1 && this.tables.isTroop[em.kind[id] ?? 0] === 1 && this.inZone(this.zones.shields, em.x[id] ?? 0, em.y[id] ?? 0)) return false;
    em.hp[id] = (em.hp[id] ?? 0) - amount;
    em.hitTime[id] = this.realTime();
    if ((em.hp[id] ?? 0) > 0) return false;
    this.kill(id);
    return true;
  }

  /** Splash damage to every enemy of `team` (units and buildings) in radius. */
  splash(x: number, y: number, radius: number, amount: number, team: number, hitBuildings: boolean): void {
    const em = this.em;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1) continue;
      const other = em.team[i] ?? 0;
      if (other === team || (other === 0 && !hitBuildings)) continue;
      const k = em.kind[i] ?? 0;
      const isB = this.tables.isBuilding[k] === 1;
      if (isB && (!hitBuildings || em.hasFlag(i, ENTITY_FLAG.DESTROYED) || (em.maxHp[i] ?? 0) <= 0)) continue;
      if (!isB && this.tables.isTroop[k] !== 1) continue;
      const d = Math.hypot((em.x[i] ?? 0) - x, (em.y[i] ?? 0) - y) - (isB ? (this.tables.footprint[k] ?? 0) : 0);
      if (d <= radius) this.damage(i, amount * (1 - Math.max(0, d) / (radius * 2)));
    }
  }

  private kill(id: number): void {
    const em = this.em;
    const k = em.kind[id] ?? 0;
    const x = em.x[id] ?? 0;
    const y = em.y[id] ?? 0;
    const name = this.tables.names[k] ?? '';
    if (this.tables.isBuilding[k] === 1) {
      em.hp[id] = 0;
      em.setFlag(id, ENTITY_FLAG.DESTROYED, true);
      em.setFlag(id, ENTITY_FLAG.HIDDEN, false);
      this.bus.defer('BuildingDestroyed', { id, kind: name, team: em.team[id] ?? 0, x, y });
    } else {
      em.destroy(id);
      this.bus.defer('UnitKilled', { id, kind: name, team: em.team[id] ?? 0, x, y });
    }
  }

  private stepTroop(i: number, k: number, team: number, dt: number): void {
    const em = this.em;
    em.cooldown[i] = (em.cooldown[i] ?? 0) - dt;
    em.animTime[i] = (em.animTime[i] ?? 0) + dt;
    if (team === 1 && this.zones.medkits.length > 0 && this.inZone(this.zones.medkits, em.x[i] ?? 0, em.y[i] ?? 0)) {
      em.hp[i] = Math.min(em.maxHp[i] ?? 0, (em.hp[i] ?? 0) + MEDKIT_HEAL_PER_SEC * dt);
    }
    if (this.t >= (em.thinkAt[i] ?? 0)) {
      em.thinkAt[i] = this.t + UNIT_THINK_SECONDS * this.rng.range(0.8, 1.2);
      em.targetId[i] = this.chooseTarget(i, k, team);
    }
    if (this.tables.isVillager[k] === 1 && this.shouldFlee(i, k, team)) {
      this.moveToward(i, k, em.homeX[i] ?? 0, em.homeY[i] ?? 0, dt, -1);
      return;
    }
    const target = em.targetId[i] ?? -1;
    const flare = team === 1 ? this.zones.flare : null;
    if (flare) {
      this.moveToward(i, k, flare.x, flare.y, dt, -1);
      return;
    }
    if (target < 0 || em.alive[target] !== 1) {
      this.idle(i, team, dt);
      return;
    }
    const heal = this.tables.heal[k] ?? 0;
    const w = this.tables.weapon[k];
    const range = heal > 0 ? 6 : (w?.range ?? 1);
    const tx = em.x[target] ?? 0;
    const ty = em.y[target] ?? 0;
    const reach = Math.hypot(tx - (em.x[i] ?? 0), ty - (em.y[i] ?? 0)) - (this.tables.footprint[em.kind[target] ?? 0] ?? 0.5);
    if (reach > range) {
      this.moveToward(i, k, tx, ty, dt, target);
      return;
    }
    this.face(i, tx, ty);
    em.state[i] = STATE.IDLE;
    if (heal > 0) {
      em.hp[target] = Math.min(em.maxHp[target] ?? 0, (em.hp[target] ?? 0) + heal * dt);
      return;
    }
    if (w && (em.cooldown[i] ?? 0) <= 0) {
      em.cooldown[i] = w.interval * this.rng.range(1 - FIRE_JITTER, 1 + FIRE_JITTER);
      this.fire(i, target, w, team);
    }
  }

  private stepStructure(i: number, k: number, team: number, dt: number): void {
    const em = this.em;
    const mine = this.tables.mine[k];
    if (mine) {
      if (this.nearestEnemyUnit(i, team, mine.radius) >= 0) this.detonateMine(i, mine.damage, mine.splash, team);
      return;
    }
    const bunker = this.tables.bunker[k];
    if (bunker && (em.targetId[i] ?? -1) !== -2 && this.nearestEnemyUnit(i, team, bunker.trigger) >= 0) {
      em.targetId[i] = -2; // triggered once
      for (let n = 0; n < bunker.count; n++) {
        const a = (n / bunker.count) * Math.PI * 2;
        spawnTroop(this.world.spawn, bunker.kind, (em.x[i] ?? 0) + Math.cos(a) * BUNKER_SPAWN_RADIUS, (em.y[i] ?? 0) + Math.sin(a) * BUNKER_SPAWN_RADIUS, team, em.level[i] ?? 1, this.realTime());
      }
    }
    const w = this.tables.weapon[k];
    if (!w) return;
    em.cooldown[i] = (em.cooldown[i] ?? 0) - dt;
    let target = em.targetId[i] ?? -1;
    if (target < 0 || em.alive[target] !== 1 || !this.inRange(i, target, w.range, w.minRange)) {
      target = this.nearestEnemyUnit(i, team, w.range, w.minRange);
      em.targetId[i] = target;
    }
    if (target < 0) return;
    if (em.hasFlag(i, ENTITY_FLAG.HIDDEN)) em.setFlag(i, ENTITY_FLAG.HIDDEN, false); // firing gives it away
    const want = Math.atan2((em.x[target] ?? 0) - (em.x[i] ?? 0), (em.y[target] ?? 0) - (em.y[i] ?? 0));
    let d = want - (em.aimYaw[i] ?? 0);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    em.aimYaw[i] = (em.aimYaw[i] ?? 0) + Math.sign(d) * Math.min(Math.abs(d), DEFENSE_TURN_SPEED * dt);
    if (Math.abs(d) < 0.35 && (em.cooldown[i] ?? 0) <= 0) {
      em.cooldown[i] = w.interval;
      this.fire(i, target, w, team);
    }
  }

  private fire(i: number, target: number, w: NonNullable<CombatTables['weapon'][number]>, team: number): void {
    const em = this.em;
    const l = this.world.layout;
    const sx = em.x[i] ?? 0;
    const sy = em.y[i] ?? 0;
    const tx = em.x[target] ?? 0;
    const ty = em.y[target] ?? 0;
    const isB = this.tables.isBuilding[em.kind[i] ?? 0] === 1;
    const sh = heightAt(l, sx, sy) + (isB ? 2.6 : MUZZLE_HEIGHT) * (em.scale[i] ?? 1);
    const th = heightAt(l, tx, ty) + (em.z[target] ?? 0) + 1;
    const dmg = levelDamage(w.damage, em.level[i] ?? 1) * (em.dmgMul[i] ?? 1);
    this.bus.defer('ShotFired', { kind: w.projectile, fx: sx, fy: sy, fz: sh, tx, ty, tz: th, team });
    if (w.projectile === 'bullet' || w.projectile === 'snipe' || w.projectile === 'melee') {
      this.damage(target, dmg);
      return;
    }
    const aimX = w.projectile === 'mortar' ? tx + this.rng.range(-1.5, 1.5) : tx;
    const aimY = w.projectile === 'mortar' ? ty + this.rng.range(-1.5, 1.5) : ty;
    this.projectiles.launch(w.projectile, sx, sy, sh, aimX, aimY, th, dmg, w.splash, team, target);
  }

  private impact(x: number, y: number, h: number, dmg: number, splash: number, team: number, target: number, kind: number): void {
    this.bus.defer('ExplosionHappened', { x, y, z: h, radius: Math.max(1.2, splash), big: splash > 2.5 });
    const troopShot = team === 1;
    if (splash > 0) this.splash(x, y, splash, dmg, team, troopShot || kind === 3);
    if (team === 2 && splash > 0) this.igniter?.(x, y, splash + 1.5);
    else if (target >= 0) this.damage(target, dmg);
  }

  private detonateMine(i: number, damage: number, splash: number, team: number): void {
    const em = this.em;
    const x = em.x[i] ?? 0;
    const y = em.y[i] ?? 0;
    this.bus.defer('ExplosionHappened', { x, y, z: heightAt(this.world.layout, x, y) + 0.5, radius: splash, big: true });
    this.splash(x, y, splash, damage, team, false);
    em.setFlag(i, ENTITY_FLAG.HIDDEN, false);
    this.kill(i);
  }

  /**
   * Troops target buildings (Boom Beach style); infantry also engage soldiers
   * that come close. Enemy soldiers go for the player's troops first.
   */
  private chooseTarget(i: number, k: number, team: number): number {
    if ((this.tables.heal[k] ?? 0) > 0) return this.mostHurtAlly(i, team);
    const w = this.tables.weapon[k];
    if (!w) return -1;
    // Villagers defend themselves against raiders that come close; they never march off.
    if (this.tables.isVillager[k] === 1) return this.nearestEnemyUnit(i, team, VILLAGE_RALLY_RADIUS);
    const unit = w.targets !== 'buildings' ? this.nearestEnemyUnit(i, team, team === 2 ? AGGRO_RADIUS : (w.range + 4)) : -1;
    if (unit >= 0) return unit;
    const building = this.nearestEnemyBuilding(i, team);
    if (building >= 0 || w.targets === 'buildings') return building;
    return this.nearestEnemyUnit(i, team, Infinity); // nothing to wreck: hunt the enemy down
  }

  /** Badly hurt villagers (and unarmed ones near raiders) run home. */
  private shouldFlee(i: number, k: number, team: number): boolean {
    const em = this.em;
    const hurt = (em.hp[i] ?? 0) < (em.maxHp[i] ?? 1) * FLEE_HP;
    return hurt || (!this.tables.weapon[k] && this.nearestEnemyUnit(i, team, FLEE_RADIUS) >= 0);
  }

  private nearestEnemyBuilding(i: number, team: number): number {
    const em = this.em;
    const x = em.x[i] ?? 0;
    const y = em.y[i] ?? 0;
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < em.highWater; j++) {
      if (em.alive[j] !== 1) continue;
      const other = em.team[j] ?? 0;
      if (other === 0 || other === team) continue;
      const k = em.kind[j] ?? 0;
      if (this.tables.isBuilding[k] !== 1 || this.tables.mine[k] || (em.maxHp[j] ?? 0) <= 0) continue;
      if (em.hasFlag(j, ENTITY_FLAG.DESTROYED)) continue;
      if (em.hasFlag(j, ENTITY_FLAG.HIDDEN)) {
        if (Math.hypot((em.x[j] ?? 0) - x, (em.y[j] ?? 0) - y) > REVEAL_RADIUS) continue;
        em.setFlag(j, ENTITY_FLAG.HIDDEN, false); // spotted
      }
      const d = Math.hypot((em.x[j] ?? 0) - x, (em.y[j] ?? 0) - y) - (this.tables.footprint[k] ?? 0);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    return best;
  }

  private nearestEnemyUnit(i: number, team: number, range: number, minRange = 0): number {
    const em = this.em;
    const x = em.x[i] ?? 0;
    const y = em.y[i] ?? 0;
    const pad = this.tables.isBuilding[em.kind[i] ?? 0] === 1 ? (this.tables.footprint[em.kind[i] ?? 0] ?? 0) : 0;
    let best = -1;
    let bestD = range + pad;
    for (let j = 0; j < em.highWater; j++) {
      if (em.alive[j] !== 1) continue;
      const other = em.team[j] ?? 0;
      if (other === 0 || other === team || this.tables.isTroop[em.kind[j] ?? 0] !== 1) continue;
      const d = Math.hypot((em.x[j] ?? 0) - x, (em.y[j] ?? 0) - y);
      if (d < bestD && d >= minRange) {
        bestD = d;
        best = j;
      }
    }
    return best;
  }

  private mostHurtAlly(i: number, team: number): number {
    const em = this.em;
    let best = -1;
    let worst = 0.999;
    for (let j = 0; j < em.highWater; j++) {
      if (j === i || em.alive[j] !== 1 || (em.team[j] ?? 0) !== team || this.tables.isTroop[em.kind[j] ?? 0] !== 1) continue;
      const f = (em.hp[j] ?? 0) / Math.max(1, em.maxHp[j] ?? 1);
      if (f < worst) {
        worst = f;
        best = j;
      }
    }
    return best >= 0 ? best : this.nearestAlly(i, team);
  }

  private nearestAlly(i: number, team: number): number {
    const em = this.em;
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < em.highWater; j++) {
      if (j === i || em.alive[j] !== 1 || (em.team[j] ?? 0) !== team || this.tables.isTroop[em.kind[j] ?? 0] !== 1 || (this.tables.heal[em.kind[j] ?? 0] ?? 0) > 0) continue;
      const d = Math.hypot((em.x[j] ?? 0) - (em.x[i] ?? 0), (em.y[j] ?? 0) - (em.y[i] ?? 0));
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    return best;
  }

  private inRange(i: number, j: number, range: number, minRange: number): boolean {
    const em = this.em;
    const d = Math.hypot((em.x[j] ?? 0) - (em.x[i] ?? 0), (em.y[j] ?? 0) - (em.y[i] ?? 0));
    return d <= range + (this.tables.footprint[em.kind[i] ?? 0] ?? 0) && d >= minRange;
  }

  /** Steering: seek + separation from troops + push out of building footprints; slides along water. */
  private moveToward(i: number, k: number, tx: number, ty: number, dt: number, target: number): void {
    const em = this.em;
    const x = em.x[i] ?? 0;
    const y = em.y[i] ?? 0;
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = (this.speedOf(k)) * (em.speedMul[i] ?? 1);
    let vx = (dx / d) * speed;
    let vy = (dy / d) * speed;
    for (let j = 0; j < em.highWater; j++) {
      if (j === i || em.alive[j] !== 1) continue;
      const kj = em.kind[j] ?? 0;
      const ox = x - (em.x[j] ?? 0);
      const oy = y - (em.y[j] ?? 0);
      const od = Math.hypot(ox, oy);
      if (this.tables.isTroop[kj] === 1) {
        if (od > 0.001 && od < SEPARATION_RADIUS) {
          vx += (ox / od) * speed * 0.8;
          vy += (oy / od) * speed * 0.8;
        }
      } else if (this.tables.isBuilding[kj] === 1 && j !== target && !em.hasFlag(j, ENTITY_FLAG.DESTROYED)) {
        const r = (this.tables.footprint[kj] ?? 0) + BUILDING_PUSH;
        if (r > 0.5 && od < r && od > 0.001) {
          // Slide around the building: push out and add a tangent so troops walk around it.
          vx += (ox / od) * speed * 1.5 + (-oy / od) * speed * 0.6;
          vy += (oy / od) * speed * 1.5 + (ox / od) * speed * 0.6;
        }
      }
    }
    const l = this.world.layout;
    let nx = x + vx * dt;
    let ny = y + vy * dt;
    if (!isWalkable(l, nx, ny)) {
      if (isWalkable(l, nx, y)) ny = y;
      else if (isWalkable(l, x, ny)) nx = x;
      else {
        nx = x;
        ny = y;
      }
    }
    em.x[i] = nx;
    em.y[i] = ny;
    em.vx[i] = vx;
    em.vy[i] = vy;
    em.state[i] = STATE.WALK;
  }

  private idle(i: number, team: number, dt: number): void {
    const em = this.em;
    // Enemy patrols wander around their post; idle player troops hold position.
    if (team === 2 && this.t >= (em.overrideUntil[i] ?? 0)) {
      em.overrideUntil[i] = this.t + this.rng.range(2, 5);
      em.targetX[i] = (em.homeX[i] ?? 0) + this.rng.range(-PATROL_RADIUS, PATROL_RADIUS);
      em.targetY[i] = (em.homeY[i] ?? 0) + this.rng.range(-PATROL_RADIUS, PATROL_RADIUS);
    }
    if (team === 2 && Math.hypot((em.targetX[i] ?? 0) - (em.x[i] ?? 0), (em.targetY[i] ?? 0) - (em.y[i] ?? 0)) > 1) {
      this.moveToward(i, em.kind[i] ?? 0, em.targetX[i] ?? 0, em.targetY[i] ?? 0, dt * 0.5, -1);
      return;
    }
    em.vx[i] = 0;
    em.vy[i] = 0;
    em.state[i] = STATE.IDLE;
  }

  private face(i: number, tx: number, ty: number): void {
    const em = this.em;
    const dx = tx - (em.x[i] ?? 0);
    const dy = ty - (em.y[i] ?? 0);
    const d = Math.hypot(dx, dy) || 1;
    // A tiny velocity turns the renderer's facing without triggering the walk cycle.
    em.vx[i] = (dx / d) * 0.03;
    em.vy[i] = (dy / d) * 0.03;
  }

  private speedOf(k: number): number {
    return this.kindTables.speed[k] ?? 3;
  }

  private inZone(zones: readonly Zone[], x: number, y: number): boolean {
    for (const z of zones) if (Math.hypot(z.x - x, z.y - y) <= z.radius) return true;
    return false;
  }

  private pruneZones(): void {
    const now = this.t;
    const keep = (zs: Zone[]): void => {
      for (let i = zs.length - 1; i >= 0; i--) if ((zs[i]?.until ?? 0) < now) zs.splice(i, 1);
    };
    keep(this.zones.shields);
    keep(this.zones.medkits);
    if (this.zones.flare && this.zones.flare.until < now) this.zones.flare = null;
  }

  /** Clears projectiles and zones (scene switch). */
  reset(): void {
    this.projectiles.clear();
    this.zones.flare = null;
    this.zones.shields.length = 0;
    this.zones.medkits.length = 0;
  }
}
