import { SPAWN_SPREAD_MIN, SPAWN_SPREAD_PER_SQRT } from '../../core/config/command.config';
import { SPAWN_HOP_VZ } from '../../core/config/juice.config';
import type { ReactionKind } from '../../core/events/event-types';
import type { KindDef } from '../../entities/definitions/kinds';
import { ISLAND_CENTER, ISLAND_RADIUS } from '../../core/config/world.config';
import type { IRng } from '../../core/rng/mulberry32';
import { footprintOf } from '../../gameplay/economy/building-catalog';
import { overlapsBuilding, spawnTroop } from '../../gameplay/spawn/structures';
import { heightAt, type Point, type WorldLayout } from '../../world/world-layout';
import { landPoint } from '../../world/world-populate';
import type { Command, TargetSpec } from '../types';
import { result, type Effect, type EffectServices } from '../executor/effect-services';
import { capitalize, describeTargets, focusOf, resolveTargets, sample } from '../executor/target-query';

/** Altitude for accessories ("a dragon wearing a tiny hat"), by kind. */
const ACCESSORY_DZ: Readonly<Record<string, number>> = { dragon: 34, cow: 15, sheep: 13, chicken: 11, duck: 10, house: 34, castle: 60 };
const ACCESSORY_DZ_DEFAULT = 20;
const POOF_POINTS_MAX = 120;
/** Per-command caps for fighters summoned mid-mission (keeps battles winnable but not trivial, and fast). */
const BATTLE_DRAGONS_MAX = 3;
const BATTLE_FIGHTERS_MAX = 10;
/** Turning raiders into chickens freezes time for a beat: the moment people remember. */
const CHICKEN_SLOWMO = { scale: 0.3, seconds: 1.2 };
const RAIDER_TRANSFORM_COOLDOWN_S = 25;
let raiderTransformReadyAt = 0;

interface SpawnPlan {
  readonly kindIds: readonly number[];
  readonly label: number;
  readonly word: string;
  /** Team for soldiers (1 = yours, 2 = raiders); 0 for everything else. */
  readonly team?: number;
}

/** Which kinds a target spawns. "people" means villagers (never soldiers); "enemies" spawn raiders. */
function planSpawn(target: TargetSpec, s: EffectServices): SpawnPlan {
  const { kinds } = s;
  const spawnable = (id: number): boolean => kinds.def(id)?.spawnable === true;
  const thing = kinds.id('thing');
  // Soldiers are always yours; in a mission a summoned dragon fights for you too.
  const troopTeam = (id: number): number | undefined => (kinds.hasTag(id, 'troop') || (kinds.def(id)?.name === 'dragon' && s.powers.inBattle()) ? 1 : undefined);
  switch (target.type) {
    case 'kind': {
      const id = kinds.id(target.kind);
      if (spawnable(id)) {
        const team = troopTeam(id);
        return team ? { kindIds: [id], label: -1, word: target.label, team } : { kindIds: [id], label: -1, word: target.label };
      }
      return { kindIds: [thing], label: s.labels.slotFor(target.label), word: target.label };
    }
    case 'tag': {
      if (target.tag === 'enemy') return { kindIds: [kinds.id('rifleman')], label: -1, word: 'raiders', team: 2 };
      if (target.tag === 'ally') return { kindIds: [kinds.id('rifleman')], label: -1, word: 'soldiers', team: 1 };
      const tag = target.tag === 'human' ? 'villager' : target.tag === 'any' ? 'living' : target.tag;
      const ids = kinds.kindsWithTag(tag).filter((k) => spawnable(k) && !kinds.hasTag(k, 'troop'));
      return ids.length > 0 ? { kindIds: ids, label: -1, word: target.label } : { kindIds: [thing], label: s.labels.slotFor(target.label), word: target.label };
    }
    case 'name':
      return { kindIds: kinds.kindsWithTag('villager'), label: -1, word: target.name };
    case 'thing':
      return { kindIds: [thing], label: s.labels.slotFor(target.word), word: target.word };
    default:
      return { kindIds: [thing], label: s.labels.slotFor('thing'), word: 'thing' };
  }
}

/** Where a spawn is centred: a named place ("near the beach") or the whole island. */
export function spawnCenter(cmd: Command, s: EffectServices): { x: number; y: number } {
  const anchor = cmd.where ? s.layout.anchors[cmd.where.anchor] : undefined;
  return anchor ?? { x: ISLAND_CENTER, y: ISLAND_CENTER };
}

const ISLAND_TRIES = 30;
const SEA_RING = 1.25;

/** A random point anywhere on the island's land (beach to jungle), uniform by area. */
export function islandPoint(layout: WorldLayout, rng: IRng): Point {
  const R = ISLAND_RADIUS * layout.style.size;
  for (let t = 0; t < ISLAND_TRIES; t++) {
    const x = ISLAND_CENTER + rng.range(-1, 1) * R;
    const y = ISLAND_CENTER + rng.range(-1, 1) * R;
    const h = heightAt(layout, x, y);
    if (h > 0.3 && h < 9) return { x, y };
  }
  return { x: ISLAND_CENTER, y: ISLAND_CENTER };
}

function seaPoint(rng: IRng, size: number): Point {
  const a = rng.range(0, Math.PI * 2);
  const r = ISLAND_RADIUS * size * rng.range(SEA_RING, SEA_RING + 0.3);
  return { x: ISLAND_CENTER + Math.cos(a) * r, y: ISLAND_CENTER + Math.sin(a) * r };
}

/**
 * Spawns N entities with the squash & stretch pop. With no place named they are
 * scattered across the whole island (boats go to sea); with a place they
 * cluster there. Buildings avoid overlapping each other.
 */
export function spawnMany(s: EffectServices, plan: SpawnPlan, q: number, cx: number, cy: number, cmd?: Command, local = cmd?.where !== undefined): number[] {
  const { em, factory, rng, props, kinds } = s;
  const spread = Math.max(SPAWN_SPREAD_MIN, Math.sqrt(q) * SPAWN_SPREAD_PER_SQRT);
  const now = s.realTime();
  const ids: number[] = [];
  const deps = { em, kinds, factory, rng };
  for (let n = 0; n < q; n++) {
    const k = rng.pick(plan.kindIds);
    const def = kinds.def(k);
    const isBoat = def?.mobility === 'boat';
    const isBuilding = def?.mobility === 'static';
    let p: Point = { x: cx, y: cy };
    for (let t = 0; t < 8; t++) {
      p = isBoat ? seaPoint(rng, s.layout.style.size) : local ? landPoint(s.layout, rng, cx, cy, spread) : islandPoint(s.layout, rng);
      if (!isBuilding || !overlapsBuilding(deps, p.x, p.y, footprintOf(def?.name ?? ''))) break;
    }
    let id: number;
    if (plan.team && def) id = spawnTroop(deps, def.name, p.x, p.y, plan.team, 1, now);
    else id = factory.spawn(k, p.x, p.y, plan.label >= 0 ? { popAt: now, vz: SPAWN_HOP_VZ, label: plan.label } : { popAt: now, vz: isBoat ? 0 : SPAWN_HOP_VZ });
    if (id < 0) break;
    em.homeX[id] = p.x;
    em.homeY[id] = p.y;
    for (const extra of cmd?.extras ?? []) props.inferFor(extra)?.apply(em, id, extra, rng);
    ids.push(id);
  }
  return ids;
}

function attachAccessory(s: EffectServices, ids: readonly number[], word: string): void {
  const thing = s.kinds.id('thing');
  const label = s.labels.slotFor(word);
  for (const parent of ids.slice(0, 40)) {
    const id = s.factory.spawn(thing, s.em.x[parent] ?? 0, s.em.y[parent] ?? 0, { popAt: s.realTime(), label });
    if (id < 0) return;
    s.em.parent[id] = parent;
    s.em.scale[id] = 0.5;
    s.em.attachDz[id] = ACCESSORY_DZ[s.kinds.def(s.em.kind[parent] ?? 0)?.name ?? ''] ?? ACCESSORY_DZ_DEFAULT;
  }
}

function spawnReaction(def: KindDef | undefined, q: number, isThing: boolean): ReactionKind {
  if (isThing) return 'improv';
  if (def?.name === 'dragon') return 'dragon';
  if (def?.name === 'chicken' && q >= 20) return 'chickens';
  return q >= 20 ? 'spawnMany' : 'spawn';
}

export const spawnEffect: Effect = {
  run(cmd, s) {
    const plan = planSpawn(cmd.target, s);
    const asked = cmd.quantity ?? 1;
    const isDragon = plan.kindIds.length === 1 && s.kinds.def(plan.kindIds[0] ?? -1)?.name === 'dragon';
    const q = plan.team === 1 && s.powers.inBattle() ? Math.min(asked, isDragon ? BATTLE_DRAGONS_MAX : BATTLE_FIGHTERS_MAX) : asked;
    const c = spawnCenter(cmd, s);
    const ids = spawnMany(s, plan, q, c.x, c.y, cmd);
    if (cmd.accessory) attachAccessory(s, ids, cmd.accessory);
    s.context.setTargets(ids, s.realTime());
    const first = ids[0];
    const def = first !== undefined ? s.kinds.def(s.em.kind[first] ?? 0) : undefined;
    const isThing = plan.label >= 0;
    const word = isThing ? plan.word : (cmd.target.type === 'kind' || cmd.target.type === 'tag' ? cmd.target.label : def?.plural ?? plan.word);
    const focus = focusOf(ids, s) ?? c;
    s.bus.emit('EntitiesSpawned', { ids: sample(ids), count: ids.length, kind: word, x: focus.x, y: focus.y });
    const short = ids.length < q ? ` Reality ran out of room after ${ids.length}.` : '';
    const text = isThing
      ? `Reality made ${ids.length} ${ids.length === 1 ? plan.word : `${plan.word}s`}. They are probably ${plan.word}s.`
      : ids.length === 1
        ? `A ${def?.label ?? plan.word} appeared${cmd.accessory ? `, wearing a ${cmd.accessory}` : ''}.`
        : `${ids.length} ${word} appeared ${cmd.where ? `near the ${cmd.where.label}` : 'all over the island'}.${short}`;
    return result(text, { ids: sample(ids), affected: ids.length, focus, reaction: spawnReaction(def, ids.length, isThing), subject: isThing ? `${plan.word}` : word, improvised: isThing });
  },
};

export const destroyEffect: Effect = {
  run(cmd, s) {
    const { em, kinds } = s;
    const ids = resolveTargets(cmd.target, s, cmd);
    const label = cmd.target.type === 'none' ? 'that' : cmd.target.label;
    if (ids.length === 0) return result(`Reality looked for ${label}. There were none. Awkward.`, { reaction: 'generic', subject: label });
    const focus = focusOf(ids, s);
    const celestial = ids.filter((i) => kinds.hasTag(em.kind[i] ?? 0, 'celestial'));
    for (const i of celestial) em.opacity[i] = 0; // the sky keeps its bodies; it just hides them
    const points: number[] = [];
    let removed = 0;
    for (const i of ids) {
      if (kinds.hasTag(em.kind[i] ?? 0, 'celestial')) continue;
      if (points.length < POOF_POINTS_MAX * 2) points.push(em.x[i] ?? 0, (em.y[i] ?? 0) + (em.z[i] ?? 0));
      em.destroy(i);
      removed++;
    }
    s.bus.emit('EntitiesDestroyed', { count: removed, kind: label, points });
    const text = celestial.length > 0 && removed === 0
      ? `${capitalize(describeTargets(cmd.target, 1))} has been put away.`
      : `${capitalize(describeTargets(cmd.target, removed))} ${removed === 1 ? 'is' : 'are'} gone.`;
    return result(text, { affected: removed + celestial.length, ...(focus ? { focus } : {}), reaction: 'destroy', subject: label });
  },
};

export const transformEffect: Effect = {
  run(cmd, s) {
    const into = cmd.value?.type === 'into' ? cmd.value.into : undefined;
    const ids = resolveTargets(cmd.target, s, cmd);
    if (!into || ids.length === 0) return result('Reality found nothing to transform. It transformed its expectations.', { reaction: 'improv', improvised: true });
    const raiders = s.powers.inBattle() && ids.some((i) => (s.em.team[i] ?? 0) === 2);
    if (raiders && s.realTime() < raiderTransformReadyAt) {
      return result(`That spell is recharging (${Math.ceil(raiderTransformReadyAt - s.realTime())}s). Try "God, do something" or "Summon a dragon".`, { reaction: 'none' });
    }
    if (raiders) raiderTransformReadyAt = s.realTime() + RAIDER_TRANSFORM_COOLDOWN_S;
    const plan = planSpawn(into, s);
    const { em } = s;
    const out: number[] = [];
    for (const i of ids) {
      const x = em.x[i] ?? 0;
      const y = em.y[i] ?? 0;
      em.destroy(i);
      out.push(...spawnMany(s, plan, 1, x, y, undefined, true));
    }
    s.context.setTargets(out, s.realTime());
    const focus = focusOf(out, s);
    s.bus.emit('EntitiesSpawned', { ids: sample(out), count: out.length, kind: plan.word, x: focus?.x ?? 0, y: focus?.y ?? 0 });
    if (s.powers.inBattle()) s.bus.emit('SlowMoRequested', CHICKEN_SLOWMO);
    const intoLabel = into.type === 'none' ? 'something' : into.label;
    return result(`${capitalize(describeTargets(cmd.target, ids.length))} ${ids.length === 1 ? 'is' : 'are'} now ${intoLabel}. Paperwork pending.`,
      { ids: sample(out), affected: out.length, ...(focus ? { focus } : {}), reaction: plan.word.startsWith('dragon') ? 'dragon' : 'improv', subject: intoLabel });
  },
};
