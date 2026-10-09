import { DEFAULT_BEHAVIOR_SECONDS } from '../../core/config/sim.config';
import { BEHAVIOR_STATE, type Behavior } from '../../types/behavior';
import { landPoint } from '../../world/world-populate';
import { result, type Effect, type EffectServices } from '../executor/effect-services';
import { nearestRaiders, strike } from './miracle-effect';
import { capitalize, describeTargets, focusOf, resolveTargets, sample } from '../executor/target-query';

const SPIN_SPEED = 7;
const FLOAT_IMPULSE = 260;
const LAUNCH_IMPULSE = 420;
const PANIC_RADIUS = 260;
const PANIC_SECONDS = 6;
const TELEPORT_SPREAD = 50;

const ING: Readonly<Record<Behavior, string>> = {
  dance: 'dancing. Nobody knows why', panic: 'panicking, efficiently', sleep: 'asleep. In the middle of the day', celebrate: 'celebrating something',
  pray: 'praying. To you, probably', sing: 'singing, mostly in tune', work: 'working. Suspiciously hard', run: 'running. From what is unclear',
  jump: 'jumping', spin: 'spinning', float: 'floating briefly', calm: 'calm again', fight: 'having a polite disagreement',
};

/** Applies a behaviour override to entities for a duration (or clears it with "calm"). */
export function applyBehavior(s: EffectServices, ids: readonly number[], b: Behavior, seconds: number): void {
  const { em, rng } = s;
  const until = s.clock.simTime + seconds;
  for (const i of ids) {
    if (b === 'calm') {
      em.override[i] = 0;
      em.rotVel[i] = 0;
      continue;
    }
    em.override[i] = BEHAVIOR_STATE[b];
    em.overrideUntil[i] = until;
    em.thinkAt[i] = 0;
    if (b === 'spin') em.rotVel[i] = (rng.chance(0.5) ? -1 : 1) * SPIN_SPEED;
    if (b === 'float') em.vz[i] = FLOAT_IMPULSE * rng.range(0.7, 1.2);
  }
}

export const behaviorEffect: Effect = {
  run(cmd, s) {
    const b = cmd.value?.type === 'behavior' ? cmd.value.behavior : 'dance';
    const ids = resolveTargets(cmd.target, s, cmd);
    applyBehavior(s, ids, b, cmd.duration ?? DEFAULT_BEHAVIOR_SECONDS);
    s.context.setTargets(ids, s.realTime());
    const focus = focusOf(ids, s);
    const who = capitalize(describeTargets(cmd.target, ids.length));
    const verb = ids.length === 1 || who === 'Everyone' || who === 'Everything' ? 'is' : 'are';
    return result(ids.length === 0 ? 'Nobody was available to do that.' : `${who} ${verb} ${ING[b]}.`,
      { ids: sample(ids), ...(focus ? { focus } : {}), reaction: b === 'dance' || b === 'celebrate' ? 'dance' : 'behavior', subject: b });
  },
};

export const moveEffect: Effect = {
  run(cmd, s) {
    const ids = resolveTargets(cmd.target, s, cmd);
    const { em, rng } = s;
    const anchor = cmd.where ? s.layout.anchors[cmd.where.anchor] : undefined;
    const who = capitalize(describeTargets(cmd.target, ids.length));
    if (anchor) {
      for (const i of ids) {
        const p = landPoint(s.layout, rng, anchor.x, anchor.y, TELEPORT_SPREAD + Math.sqrt(ids.length) * 4);
        em.x[i] = p.x;
        em.y[i] = p.y;
        em.targetX[i] = p.x;
        em.targetY[i] = p.y;
        em.homeX[i] = p.x;
        em.homeY[i] = p.y;
        em.spawnTime[i] = s.realTime();
      }
      s.bus.emit('PropertyChanged', { ids: sample(ids), property: 'position' });
      return result(`${who} ${ids.length === 1 ? 'has' : 'have'} been relocated to the ${cmd.where?.label ?? 'somewhere'}.`, { ids: sample(ids), focus: anchor, reaction: 'improv' });
    }
    for (const i of ids) {
      em.vz[i] = LAUNCH_IMPULSE * rng.range(0.7, 1.3);
      em.rotVel[i] = rng.range(-6, 6);
    }
    const focus = focusOf(ids, s);
    return result(`${who} ${ids.length === 1 ? 'has' : 'have'} been launched. ${ids.length === 1 ? 'It' : 'They'} will be back.`, { ids: sample(ids), ...(focus ? { focus } : {}), reaction: 'gravityOff', subject: 'launch' });
  },
};

const DISASTER_TEXT: Readonly<Record<string, string>> = {
  fire: 'A small, dramatic fire. Someone fetched the other bucket.',
  flood: 'A brief flood. Everyone now owns wet socks.',
  explosion: 'Kaboom. Tasteful, cartoonish kaboom.',
  lightning: 'Lightning strikes. Hair is standing up across the village.',
  earthquake: 'The ground shrugs. The village holds onto its hats.',
  meteor: 'Meteors fall from a clear Goan sky. Only on the raiders. Very precise meteors.',
};

/** Cartoon-safe disasters (full fire/flood simulation lands in M4). */
const LIGHTNING_DAMAGE = 600;
const QUAKE_DAMAGE = 260;
const QUAKE_RADIUS = 16;
const WAVE_DAMAGE = 240;
const WAVE_BOAT_DAMAGE = 900;
const METEOR_DAMAGE = 520;
const MAX_METEORS = 6;
/** Big disasters slow time for a beat so you can watch them land. */
const DRAMA_SLOWMO = { scale: 0.35, seconds: 1.1 };
const MAX_STRIKES = 8;
/** Few targets (one gunboat) get a volley, so a single call to the sky really hurts. */
const MIN_BOLTS = 3;

/** Cartoon-safe disasters that also act on the battle: lightning smites raiders, quakes rattle them, fire burns. */
export const disasterEffect: Effect = {
  run(cmd, s) {
    const d = cmd.value?.type === 'disaster' ? cmd.value.disaster : 'earthquake';
    const ids = cmd.target.type === 'none' ? [] : resolveTargets(cmd.target, s, cmd);
    const focus = focusOf(ids, s) ?? { x: s.view.centerX, y: s.view.centerY };
    s.bus.emit('ImpactRequested', { x: focus.x, y: focus.y, magnitude: cmd.magnitude, flash: d === 'lightning' || d === 'explosion' ? 0.6 : 0.15 });
    const { em } = s;
    const bystanders = em.collect((i) => (em.team[i] ?? 0) === 0 && s.kinds.hasTag(em.kind[i] ?? 0, 'human') && Math.hypot((em.x[i] ?? 0) - focus.x, (em.y[i] ?? 0) - focus.y) < PANIC_RADIUS);
    applyBehavior(s, bystanders, 'panic', PANIC_SECONDS);
    let extra = '';
    if (d === 'lightning') {
      const raiders = ids.filter((i) => (em.team[i] ?? 0) === 2);
      const victims = (raiders.length > 0 ? raiders : ids.length === 0 ? nearestRaiders(s, 3) : ids).slice(0, MAX_STRIKES);
      const bolts = victims.length === 0 ? [] : Array.from({ length: Math.max(MIN_BOLTS, victims.length) }, (_, n) => victims[n % victims.length] ?? -1);
      bolts.forEach((id, n) => s.schedule(n * 0.15, () => { if (em.isAlive(id)) strike(s, id, LIGHTNING_DAMAGE); }));
      if (victims.length > 0) extra = ` ${victims.length} struck by ${bolts.length} bolts.`;
    }
    const raiderIds = ids.filter((i) => (em.team[i] ?? 0) === 2 && !s.kinds.hasTag(em.kind[i] ?? 0, 'building'));
    if (d === 'earthquake' || d === 'flood' || d === 'meteor') s.bus.emit('SlowMoRequested', DRAMA_SLOWMO);
    if (d === 'flood') {
      // A tidal wave rolls over the raiders and slams the gunboat.
      for (const i of raiderIds) { s.powers.damage(i, WAVE_DAMAGE); em.vz[i] = 10; }
      for (const i of em.collect((j) => (em.team[j] ?? 0) === 2 && s.kinds.def(em.kind[j] ?? 0)?.mobility === 'boat')) s.powers.damage(i, WAVE_BOAT_DAMAGE);
      if (raiderIds.length > 0) extra = ` ${raiderIds.length} raiders swept off their feet.`;
    }
    if (d === 'meteor') {
      const targets = (raiderIds.length > 0 ? raiderIds : nearestRaiders(s, MAX_METEORS)).slice(0, MAX_METEORS);
      targets.forEach((id, n) => s.schedule(n * 0.2, () => {
        if (!em.isAlive(id)) return;
        s.bus.emit('ExplosionHappened', { x: em.x[id] ?? 0, y: em.y[id] ?? 0, z: 1, radius: 4, big: true });
        s.powers.damage(id, METEOR_DAMAGE);
      }));
      if (targets.length > 0) extra = ` ${targets.length} meteors found their raiders.`;
    }
    if (d === 'earthquake') {
      const shaken = raiderIds.length > 0 ? raiderIds : em.collect((j) => (em.team[j] ?? 0) === 2 && Math.hypot((em.x[j] ?? 0) - focus.x, (em.y[j] ?? 0) - focus.y) < QUAKE_RADIUS);
      for (const i of shaken) { s.powers.damage(i, QUAKE_DAMAGE); em.vz[i] = 7; }
      if (shaken.length > 0) extra = ` ${shaken.length} raiders knocked flat.`;
      for (const i of bystanders) em.vz[i] = 8;
    }
    if (d === 'fire') {
      let lit = 0;
      for (const i of ids) if (s.powers.ignite(i)) lit++;
      if (lit > 0) extra = ` ${lit} on fire. (Say "make it rain" to put it out.)`;
    }
    if (d === 'explosion' && ids.length > 0) {
      const points: number[] = [];
      for (const i of ids) {
        if (s.kinds.hasTag(em.kind[i] ?? 0, 'env')) continue;
        points.push(em.x[i] ?? 0, em.y[i] ?? 0);
        if ((em.team[i] ?? 0) !== 0) s.powers.damage(i, 1e6);
        else em.destroy(i);
      }
      s.bus.emit('EntitiesDestroyed', { count: points.length / 2, kind: cmd.target.type === 'none' ? 'things' : cmd.target.label, points });
    }
    return result((DISASTER_TEXT[d] ?? 'Something dramatic happened. Then it stopped.') + extra, { focus, affected: ids.length, reaction: 'disaster', subject: d });
  },
};
