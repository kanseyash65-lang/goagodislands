import { BATTLE_SECONDS, ENERGY_MAX, ENERGY_PER_BUILDING, ENERGY_START, ESCAPE_SECONDS, VICTORY_CHAIN_DELAY } from '../../core/config/combat.config';
import { ISLAND_CENTER, ISLAND_RADIUS } from '../../core/config/world.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { WorldBundle } from '../../core/world-bundle';
import { ENTITY_FLAG } from '../../entities/entity-manager';
import { placementPoint } from '../../world/world-populate';
import type { Point } from '../../world/world-layout';
import type { CombatSystem } from '../combat/combat-system';
import type { FireSystem } from '../fire/fire-system';
import { heightAt } from '../../world/world-layout';
import type { MissionDef } from '../missions/mission-defs';
import { spawnStructure, spawnTroop } from '../spawn/structures';
import type { GameState } from '../state/game-state';
import { levelHp, TROOPS, VILLAGERS } from '../units/unit-stats';
import { extraVillagers } from '../base/build-service';
import { Abilities, type AbilityName } from './abilities';
import { LandingCraftFleet } from './landing';
import { createObjectives, emptyTally, escapeActive, evaluate, failedObjective, isVictory, type BattleTally, type ObjectiveState } from './objectives';

export type BattlePhase = 'none' | 'scouting' | 'ready' | 'prep' | 'fighting' | 'escape' | 'victory' | 'defeat';

export interface Squad {
  readonly kind: string;
  readonly count: number;
  deployed: boolean;
}

const SCOUT_RADIUS = 12;
const ESCAPE_RADIUS = 10;
const DEPOT_LOOT = { gold: 600, timber: 500, stone: 150 } as const;
const ENEMY_GUNBOAT_HP = 3000;
const FIREBOMB_DAMAGE = 70;
const FIREBOMB_SPLASH = 3;
/** Village defense balance: villagers are sturdier and raiders hit softer, so the fight lasts long enough for god powers to matter. */
export const VILLAGER_HP_MUL = 2.2;
const RAIDER_DAMAGE_MUL = 0.35;
/** Engineers wreck houses in seconds; in a village defense their charges are weaker still. */
const ENGINEER_DAMAGE_MUL = 0.55;
/** Army upgrades: each training level adds villager HP and damage; each guard level posts two riflemen. */
export const TRAINING_HP_STEP = 0.2;
export const TRAINING_DMG_STEP = 0.15;
export const GUARDS_PER_LEVEL = 2;
const GUARD_SPREAD = 6;
const EXTRA_VILLAGER_KINDS = ['fisherman', 'farmer', 'vendor', 'fisherman', 'farmer'];

/** Live numbers for village-defense hints. */
export interface VillageStats {
  readonly fires: number;
  readonly villagers: number;
  readonly villagersHurt: number;
  readonly engineers: number;
  readonly raiders: number;
  readonly wave: number;
  readonly waves: number;
  readonly gunboat: boolean;
}

/**
 * One battle on one island: deploy squads by landing craft, spend gunboat
 * energy, track objectives, run enemy waves (defend), decide victory/defeat,
 * pay rewards. Stepped by the game loop; reads/writes the world via services.
 */
export class BattleController {
  phase: BattlePhase = 'none';
  mission: MissionDef | null = null;
  squads: Squad[] = [];
  energy = ENERGY_START;
  timeLeft = BATTLE_SECONDS;
  objectives: ObjectiveState[] = [];
  readonly abilities: Abilities;
  scoutMarkers: { id: number; x: number; y: number; found: boolean }[] = [];
  kit: { kind: string; count: number }[] = [];
  endReason = '';
  private tally: BattleTally = emptyTally();
  private readonly fleet: LandingCraftFleet;
  private started = false;
  private waveIndex = 0;
  private waveTimer = 0;
  private escapeTimer = ESCAPE_SECONDS;
  private chain: number[] = [];
  private chainTimer = 0;
  private now = 0;
  private bombardTimer = 0;
  private enemyGunboat = -1;
  private readonly tamed = new Set<number>();

  constructor(
    private readonly world: WorldBundle,
    private readonly combat: CombatSystem,
    private readonly bus: IEventBus,
    private readonly state: GameState,
    private readonly realTime: () => number,
    private readonly fire: FireSystem,
  ) {
    this.fleet = new LandingCraftFleet(world.spawn, world, world.rng.ai, realTime);
    this.abilities = new Abilities(combat, world, world.rng.ai);
    bus.on('BuildingDestroyed', (e) => this.onBuildingDestroyed(e.kind, e.team, e.x, e.y));
    bus.on('UnitKilled', (e) => {
      this.tamed.delete(e.id);
      if (e.kind === 'commander' && e.team === 2) this.tally.bossDown = true;
    });
  }

  get active(): boolean {
    return this.phase !== 'none';
  }

  /** Gunboat parks offshore east of the beach. */
  get gunboat(): Point {
    return { x: ISLAND_CENTER + ISLAND_RADIUS * 1.75, y: ISLAND_CENTER + 4 };
  }

  /** Called after the scene manager has loaded the mission island. */
  begin(m: MissionDef, scoutOnly: boolean): void {
    this.mission = m;
    this.tally = emptyTally();
    this.objectives = createObjectives(m.objectives);
    this.energy = m.energy ?? ENERGY_START;
    this.timeLeft = m.seconds ?? BATTLE_SECONDS;
    this.started = false;
    this.waveIndex = 0;
    this.waveTimer = m.waves?.[0]?.delay ?? 0;
    this.escapeTimer = ESCAPE_SECONDS;
    this.chain = [];
    this.endReason = '';
    this.abilities.reset();
    this.fleet.clear();
    this.combat.reset();
    this.fire.reset();
    this.bombardTimer = m.bombardEvery ?? 0;
    this.squads = m.mode === 'village' ? [] : this.state.army.map((kind) => ({ kind, count: Math.max(1, Math.floor(this.state.craftCapacity() / (TROOPS[kind]?.space ?? 1))), deployed: false }));
    this.kit = (m.kit ?? []).map((k) => ({ ...k }));
    this.setupIsland(m);
    if (m.mode === 'village') {
      this.setupVillage();
      this.started = true;
      this.phase = 'fighting';
      this.bus.emit('ToastRequested', { text: '⛵ Raider boats on the horizon! Protect the village, O God of Goa.' });
      this.changed();
      return;
    }
    this.phase = m.mode === 'defend' ? 'prep' : scoutOnly || m.objectives.some((o) => o.type === 'scout') ? 'scouting' : 'ready';
    this.changed();
  }

  end(): void {
    this.fire.reset();
    this.phase = 'none';
    this.mission = null;
    this.fleet.clear();
    this.combat.reset();
    this.changed();
  }

  /** Lands one squad at the beach point nearest (x, y). */
  deploy(index: number, x: number, y: number): boolean {
    const sq = this.squads[index];
    if (!sq || sq.deployed || !this.canDeploy()) return false;
    sq.deployed = true;
    this.fleet.launch(sq.kind, sq.count, 1, this.state.troopLevel(), this.gunboat, { x, y });
    this.startClock();
    this.changed();
    return true;
  }

  /** Defend prep: put a squad down right where the player taps (troop positioning). */
  positionSquad(index: number, x: number, y: number): boolean {
    const sq = this.squads[index];
    if (!sq || sq.deployed || this.phase !== 'prep') return false;
    sq.deployed = true;
    for (let n = 0; n < sq.count; n++) {
      const id = spawnTroop(this.world.spawn, sq.kind, x + this.world.rng.ai.range(-2.5, 2.5), y + this.world.rng.ai.range(-2.5, 2.5), 1, this.state.troopLevel(), this.realTime());
      if (id >= 0) {
        this.world.em.homeX[id] = x;
        this.world.em.homeY[id] = y;
      }
    }
    this.changed();
    return true;
  }

  /** Lands every remaining squad, spread along the beach. */
  deployAll(): number {
    const left = this.squads.map((s, i) => (s.deployed ? -1 : i)).filter((i) => i >= 0);
    const pts = this.world.layout.landing;
    left.forEach((idx, n) => {
      const p = pts[Math.floor(((n + 0.5) / left.length) * pts.length)] ?? this.gunboat;
      this.deploy(idx, p.x, p.y);
    });
    return left.length;
  }

  canDeploy(): boolean {
    return this.phase === 'scouting' || this.phase === 'ready' || this.phase === 'fighting' || this.phase === 'prep';
  }

  /** Spends energy on a gunboat ability. Returns a reason string when refused. */
  useAbility(name: AbilityName, x: number, y: number): string | null {
    if (!this.state.isUnlocked(name)) return `${name} is still locked. Win missions to unlock it.`;
    if (this.phase !== 'fighting' && this.phase !== 'ready' && this.phase !== 'scouting' && this.phase !== 'escape') return 'Abilities work during battle.';
    const cost = this.abilities.costs[name];
    if (this.energy < cost) return `Not enough gunboat energy (${this.energy}/${cost}).`;
    this.energy -= cost;
    this.abilities.cast(name, x, y, this.now, this.gunboat);
    this.startClock();
    this.changed();
    return null;
  }

  /** Scouting: tapping near a hidden defense spots it. Returns true if something was found. */
  scoutAt(x: number, y: number): boolean {
    const em = this.world.em;
    for (const m of this.scoutMarkers) {
      if (m.found || Math.hypot(m.x - x, m.y - y) > SCOUT_RADIUS) continue;
      m.found = true;
      if (em.isAlive(m.id)) {
        em.setFlag(m.id, ENTITY_FLAG.HIDDEN, false);
        em.setFlag(m.id, ENTITY_FLAG.SCOUTED, true);
      }
      this.tally.scouted++;
      this.changed();
      return true;
    }
    return false;
  }

  /** Defend prep: place a kit item (mine, wall, gun) for free. */
  placeKit(kind: string, x: number, y: number): boolean {
    const item = this.kit.find((k) => k.kind === kind && k.count > 0);
    if (!item || this.phase !== 'prep') return false;
    if (spawnStructure(this.world.spawn, kind, x, y, { team: 1, level: this.mission?.enemyLevel ?? 1, rot: Math.PI / 2, popAt: this.realTime() }) < 0) return false;
    item.count--;
    this.changed();
    return true;
  }

  /** Defend: start the waves. */
  startWaves(): void {
    if (this.phase !== 'prep') return;
    this.phase = 'fighting';
    this.started = true;
    this.changed();
  }

  retreat(): void {
    if (this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'none') return;
    this.finish(false, 'You sounded the retreat.');
  }

  step(dt: number, t: number): void {
    this.now = t;
    if (this.phase === 'none') return;
    this.fleet.step(dt);
    if (this.phase === 'victory' || this.phase === 'defeat') {
      this.stepChain(dt);
      return;
    }
    if (this.started) this.timeLeft -= dt;
    if ((this.mission?.mode === 'defend' || this.mission?.mode === 'village') && this.phase === 'fighting') this.stepWaves(dt);
    if (this.mission?.mode === 'village') {
      this.stepBombard(dt);
      this.tally.villagersAlive = this.countVillagers();
      this.tameRaiders();
    }
    if (this.phase === 'escape') this.stepEscape(dt);
    this.tally.hqDestroyed = this.countAlive('hq', 2) === 0 && this.mission?.mode === 'attack';
    this.tally.playerHqLost = this.mission?.mode === 'defend' && this.countAlive('hq', 1) === 0;
    evaluate(this.objectives, this.tally);
    this.decide();
  }

  private decide(): void {
    const failed = failedObjective(this.objectives);
    if (failed) return this.finish(false, `Objective failed: ${failed.def.label}.`);
    if (escapeActive(this.objectives) && this.phase !== 'escape') {
      this.phase = 'escape';
      this.bus.emit('ToastRequested', { text: 'Depots destroyed! Get a troop back to the beach!' });
      this.changed();
    }
    if (isVictory(this.objectives)) return this.finish(true, 'All objectives complete.');
    if (this.started && this.timeLeft <= 0) return this.finish(false, 'Time ran out.');
    if (this.mission?.mode === 'attack' && this.started && this.squads.every((s) => s.deployed) && this.fleet.inTransit === 0 && this.countTroops(1) === 0) {
      this.finish(false, 'Your army was wiped out.');
    }
  }

  private finish(victory: boolean, reason: string): void {
    const m = this.mission;
    if (!m) return;
    this.phase = victory ? 'victory' : 'defeat';
    this.endReason = reason;
    if (victory && m.mode === 'village') this.sinkEnemyGunboat();
    if (victory && m.mode !== 'village') {
      this.chain = this.world.em.collect((i) => (this.world.em.team[i] ?? 0) === 2 && (this.world.em.maxHp[i] ?? 0) > 0 && !this.world.em.hasFlag(i, ENTITY_FLAG.DESTROYED) && this.combat.tables.isBuilding[this.world.em.kind[i] ?? 0] === 1);
      this.chainTimer = 0;
    }
    this.bus.emit('BattleEnded', { victory, missionId: m.id, reason });
    this.changed();
  }

  /** Boom Beach-style finale: the remaining enemy buildings blow up one by one. */
  private stepChain(dt: number): void {
    if (this.chain.length === 0) return;
    this.chainTimer -= dt;
    if (this.chainTimer > 0) return;
    this.chainTimer = VICTORY_CHAIN_DELAY;
    const id = this.chain.shift();
    if (id !== undefined) this.combat.damage(id, 1e9);
  }

  private stepWaves(dt: number): void {
    const m = this.mission;
    if (!m?.waves) return;
    const wave = m.waves[this.waveIndex];
    if (!wave) {
      if (this.countTroops(2) === 0 && this.fleet.inTransit === 0) this.tally.wavesCleared = m.waves.length;
      return;
    }
    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;
    const prevCleared = this.countTroops(2) === 0 && this.fleet.inTransit === 0;
    if (this.waveIndex > 0 && !prevCleared) return;
    if (this.waveIndex > 0) this.tally.wavesCleared = this.waveIndex;
    const pts = this.world.layout.landing;
    wave.troops.forEach((tr, n) => {
      const p = pts[(n * 3 + this.waveIndex * 2) % Math.max(1, pts.length)] ?? this.gunboat;
      this.fleet.launch(tr.kind, tr.count, 2, m.enemyLevel, this.gunboat, p);
    });
    this.bus.emit('ToastRequested', { text: `Wave ${this.waveIndex + 1} of ${m.waves.length} is landing!` });
    this.waveIndex++;
    this.waveTimer = m.waves[this.waveIndex]?.delay ?? 0;
    this.changed();
  }

  private stepEscape(dt: number): void {
    this.escapeTimer -= dt;
    const em = this.world.em;
    for (const p of this.world.layout.landing) {
      if (em.collect((i) => (em.team[i] ?? 0) === 1 && this.combat.tables.isTroop[em.kind[i] ?? 0] === 1 && Math.hypot((em.x[i] ?? 0) - p.x, (em.y[i] ?? 0) - p.y) < ESCAPE_RADIUS).length > 0) {
        this.tally.escaped = true;
        return;
      }
    }
    if (this.escapeTimer <= 0) this.finish(false, 'The squad did not make it back to the beach.');
  }

  private onBuildingDestroyed(kind: string, team: number, x: number, y: number): void {
    if (this.phase === 'none') return;
    if (team === 2) {
      this.energy = Math.min(ENERGY_MAX, this.energy + ENERGY_PER_BUILDING);
      if (kind === 'cage') this.freeVillager(x, y);
      if (kind === 'supply-depot') {
        this.tally.depotsDestroyed++;
        for (const [r, v] of Object.entries(DEPOT_LOOT)) this.state.economy.add(r as keyof typeof DEPOT_LOOT, v);
        this.bus.emit('ToastRequested', { text: `Loot! +${DEPOT_LOOT.gold} gold, +${DEPOT_LOOT.timber} timber, +${DEPOT_LOOT.stone} stone` });
      }
    }
    const villageBuilding = team === 0 || (team === 1 && this.mission?.mode === 'village');
    if (villageBuilding && this.mission?.objectives.some((o) => o.type === 'protect')) this.tally.villageLost++;
    this.changed();
  }

  private freeVillager(x: number, y: number): void {
    this.tally.cagesFreed++;
    const id = this.world.factory.spawn(this.world.kinds.id('fisherman'), x, y, { popAt: this.realTime() });
    if (id >= 0) {
      const beach = this.world.layout.anchors['beach'];
      this.world.em.homeX[id] = beach?.x ?? x;
      this.world.em.homeY[id] = beach?.y ?? y;
      this.world.em.names.set(id, 'Rescued fisherman');
    }
    this.bus.emit('ToastRequested', { text: `Villager freed! (${this.tally.cagesFreed})` });
  }

  /** Patrols, hidden jungle defenses and scouting markers for this mission. */
  private setupIsland(m: MissionDef): void {
    const em = this.world.em;
    for (const p of m.patrols ?? []) {
      const c = placementPoint(p, m.island.style.size);
      for (let n = 0; n < p.count; n++) {
        const id = spawnTroop(this.world.spawn, p.kind, c.x + this.world.rng.ai.range(-5, 5), c.y + this.world.rng.ai.range(-5, 5), 2, m.enemyLevel);
        if (id >= 0) {
          em.homeX[id] = c.x;
          em.homeY[id] = c.y;
        }
      }
    }
    this.scoutMarkers = [];
    if (m.hiddenDefenses) {
      const rng = this.world.rng.ai;
      em.collect((i) => (em.team[i] ?? 0) === 2 && this.combat.tables.weapon[em.kind[i] ?? 0] !== undefined && this.combat.tables.names[em.kind[i] ?? 0] !== 'hq').forEach((id) => {
        em.setFlag(id, ENTITY_FLAG.HIDDEN, true);
        this.scoutMarkers.push({ id, x: (em.x[id] ?? 0) + rng.range(-4, 4), y: (em.y[id] ?? 0) + rng.range(-4, 4), found: false });
      });
    }
    if (m.mode === 'village') return;
    this.gunboatId = this.world.factory.spawn(this.world.kinds.id('gunboat'), this.gunboat.x, this.gunboat.y);
    if (this.gunboatId >= 0) {
      em.team[this.gunboatId] = 1;
      em.rot[this.gunboatId] = -Math.PI / 2;
    }
  }

  private gunboatId = -1;

  /** Village defense: every villager takes up arms (team 1, real hit points); the raider gunboat anchors offshore. */
  private setupVillage(): void {
    const em = this.world.em;
    const v = this.world.layout.village;
    const rng = this.world.rng.ai;
    // Homes you built on your island send extra defenders.
    for (let n = 0; n < extraVillagers(this.state); n++) {
      const kind = EXTRA_VILLAGER_KINDS[n % EXTRA_VILLAGER_KINDS.length] ?? 'farmer';
      this.world.factory.spawn(this.world.kinds.id(kind), v.x + rng.range(-GUARD_SPREAD, GUARD_SPREAD), v.y + rng.range(-GUARD_SPREAD, GUARD_SPREAD));
    }
    this.tamed.clear();
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1 || !this.combat.tables.isVillager[em.kind[i] ?? 0]) continue;
      const stats = VILLAGERS[this.combat.tables.names[em.kind[i] ?? 0] ?? ''];
      em.team[i] = 1;
      const trained = this.state.upgrades.training;
      em.maxHp[i] = levelHp(stats?.hp ?? 90, 1) * VILLAGER_HP_MUL * (1 + TRAINING_HP_STEP * trained);
      em.dmgMul[i] = 1 + TRAINING_DMG_STEP * trained;
      em.hp[i] = em.maxHp[i] ?? 90;
    }
    const gb = this.world.factory.spawn(this.world.kinds.id('gunboat'), this.gunboat.x, this.gunboat.y - 10);
    if (gb >= 0) {
      em.team[gb] = 2;
      em.maxHp[gb] = ENEMY_GUNBOAT_HP;
      em.hp[gb] = ENEMY_GUNBOAT_HP;
      em.rot[gb] = -Math.PI / 2;
      em.tintR[gb] = 0.75;
      em.tintG[gb] = 0.27;
      em.tintB[gb] = 0.22;
    }
    this.enemyGunboat = gb;
    for (let n = 0; n < this.state.upgrades.guards * GUARDS_PER_LEVEL; n++) {
      spawnTroop(this.world.spawn, 'rifleman', v.x + rng.range(-GUARD_SPREAD, GUARD_SPREAD), v.y + rng.range(-GUARD_SPREAD, GUARD_SPREAD), 1, this.state.troopLevel());
    }
  }

  /** The raider gunboat lobs a firebomb at a random village building. */
  private stepBombard(dt: number): void {
    const m = this.mission;
    const em = this.world.em;
    if (this.enemyGunboat >= 0 && !em.isAlive(this.enemyGunboat)) {
      this.enemyGunboat = -1;
      this.bus.emit('ToastRequested', { text: '⚓ You sank the raider gunboat! No more firebombs.' });
    }
    if (!m?.bombardEvery || this.enemyGunboat < 0 || !em.isAlive(this.enemyGunboat)) return;
    this.bombardTimer -= dt;
    if (this.bombardTimer > 0) return;
    this.bombardTimer = m.bombardEvery;
    const targets = em.collect((i) => (em.team[i] ?? 0) === 1 && this.combat.tables.isBuilding[em.kind[i] ?? 0] === 1 && !em.hasFlag(i, ENTITY_FLAG.DESTROYED));
    if (targets.length === 0) return;
    const t = targets[Math.floor(this.world.rng.ai.next() * targets.length)] ?? -1;
    if (t < 0) return;
    const gx = em.x[this.enemyGunboat] ?? 0;
    const gy = em.y[this.enemyGunboat] ?? 0;
    const tx = em.x[t] ?? 0;
    const ty = em.y[t] ?? 0;
    this.combat.projectiles.launch('mortar', gx, gy, 4, tx, ty, heightAt(this.world.layout, tx, ty) + 1, FIREBOMB_DAMAGE, FIREBOMB_SPLASH, 2, t);
    this.bus.emit('ShotFired', { kind: 'shell', fx: gx, fy: gy, fz: 4, tx, ty, tz: 2, team: 2 });
  }

  private sinkEnemyGunboat(): void {
    const em = this.world.em;
    if (this.enemyGunboat >= 0 && em.isAlive(this.enemyGunboat)) {
      this.bus.emit('ExplosionHappened', { x: em.x[this.enemyGunboat] ?? 0, y: em.y[this.enemyGunboat] ?? 0, z: 2, radius: 6, big: true });
      em.destroy(this.enemyGunboat);
    }
    this.enemyGunboat = -1;
  }

  /** Freshly landed raiders get the village-defense damage scale once. */
  private tameRaiders(): void {
    const em = this.world.em;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1 || (em.team[i] ?? 0) !== 2 || this.tamed.has(i) || this.combat.tables.isTroop[em.kind[i] ?? 0] !== 1) continue;
      this.tamed.add(i);
      const engineer = this.combat.tables.names[em.kind[i] ?? 0] === 'engineer';
      em.dmgMul[i] = (em.dmgMul[i] ?? 1) * RAIDER_DAMAGE_MUL * (engineer ? ENGINEER_DAMAGE_MUL : 1);
    }
  }

  private countVillagers(): number {
    const em = this.world.em;
    let n = 0;
    for (let i = 0; i < em.highWater; i++) if (em.alive[i] === 1 && (em.team[i] ?? 0) === 1 && this.combat.tables.isVillager[em.kind[i] ?? 0] === 1) n++;
    return n;
  }

  /** Numbers the HUD uses to suggest the right voice power. */
  villageStats(): VillageStats {
    const em = this.world.em;
    let villagers = 0;
    let hurt = 0;
    let raiders = 0;
    let engineers = 0;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1) continue;
      const k = em.kind[i] ?? 0;
      const team = em.team[i] ?? 0;
      if (team === 1 && this.combat.tables.isVillager[k] === 1) {
        villagers++;
        if ((em.hp[i] ?? 0) < (em.maxHp[i] ?? 1) * 0.5) hurt++;
      } else if (team === 2 && this.combat.tables.isTroop[k] === 1) {
        raiders++;
        if (this.combat.tables.names[k] === 'engineer') engineers++;
      }
    }
    const waves = this.mission?.waves?.length ?? 0;
    return { fires: this.fire.count, villagers, villagersHurt: hurt, engineers, raiders, wave: Math.min(this.waveIndex, waves), waves, gunboat: this.enemyGunboat >= 0 && em.isAlive(this.enemyGunboat) };
  }

  private startClock(): void {
    if (this.started) return;
    this.started = true;
    if (this.phase === 'scouting' || this.phase === 'ready') this.phase = 'fighting';
  }

  private countAlive(kind: string, team: number): number {
    const em = this.world.em;
    const k = this.world.kinds.id(kind);
    let n = 0;
    for (let i = 0; i < em.highWater; i++) if (em.alive[i] === 1 && em.kind[i] === k && (em.team[i] ?? 0) === team && !em.hasFlag(i, ENTITY_FLAG.DESTROYED)) n++;
    return n;
  }

  private countTroops(team: number): number {
    const em = this.world.em;
    let n = 0;
    for (let i = 0; i < em.highWater; i++) if (em.alive[i] === 1 && (em.team[i] ?? 0) === team && this.combat.tables.isTroop[em.kind[i] ?? 0] === 1) n++;
    return n;
  }

  private changed(): void {
    this.bus.emit('BattleChanged', {});
  }
}
