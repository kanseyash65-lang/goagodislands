import { ISLAND_CENTER } from '../../core/config/world.config';
import { ENTITY_FLAG } from '../../entities/entity-manager';
import { result, type Effect, type EffectServices } from '../executor/effect-services';
import { sample } from '../executor/target-query';

const COOLDOWN_SECONDS = 12;
const MAX_BOLTS = 7;
const BOLT_DAMAGE = 650;
const BOAT_DAMAGE = 1100;
const HEAL_FRACTION = 0.45;
const BOLT_STAGGER = 0.18;
/** Time slows while the heavens open. */
const MIRACLE_SLOWMO = { scale: 0.3, seconds: 1.6 };
/** Raiders the god smites first: house-wreckers and the boss jump the queue. */
const PRIORITY: Readonly<Record<string, number>> = { engineer: 3, commander: 2, rocketeer: 1 };
/** Distance credit per priority point, so a far engineer still beats a near rifleman. */
const PRIORITY_RANGE = 40;

/** Up to N raiders (team 2): the most dangerous first, then the nearest to the village. */
export function nearestRaiders(s: EffectServices, max: number): number[] {
  const { em, kinds } = s;
  const v = s.layout.village;
  const ids = em.collect((i) => (em.team[i] ?? 0) === 2 && kinds.hasTag(em.kind[i] ?? 0, 'troop'));
  const d = (i: number): number => Math.hypot((em.x[i] ?? 0) - v.x, (em.y[i] ?? 0) - v.y);
  const score = (i: number): number => d(i) - (PRIORITY[kinds.def(em.kind[i] ?? 0)?.name ?? ''] ?? 0) * PRIORITY_RANGE;
  return ids.sort((a, b) => score(a) - score(b)).slice(0, max);
}

/** Lightning from the god's hands: real damage, flash and a visible bolt. */
export function strike(s: EffectServices, id: number, damage: number): void {
  const x = s.em.x[id] ?? 0;
  const y = s.em.y[id] ?? 0;
  s.bus.emit('LightningStruck', { x, y });
  s.bus.emit('ExplosionHappened', { x, y, z: 1, radius: 2.5, big: true });
  s.powers.damage(id, damage);
}

/**
 * "God, do something!": a divine intervention. Bolts of lightning hit the
 * raiders nearest the village and the raider gunboat, villagers are healed,
 * and the fires go out. Has a short cooldown so it stays special.
 */
export function createMiracleEffect(): Effect {
  let readyAt = 0;
  return {
    run(_cmd, s) {
      const now = s.realTime();
      if (now < readyAt) {
        return result(`The heavens are recharging (${Math.ceil(readyAt - now)}s). Meanwhile try "make it rain" or "increase the HP of the villagers".`, { reaction: 'none' });
      }
      readyAt = now + COOLDOWN_SECONDS;
      const { em, kinds } = s;
      const raiders = nearestRaiders(s, MAX_BOLTS);
      raiders.forEach((id, n) => s.schedule(n * BOLT_STAGGER, () => { if (em.isAlive(id)) strike(s, id, BOLT_DAMAGE); }));
      const boats = em.collect((i) => (em.team[i] ?? 0) === 2 && kinds.def(em.kind[i] ?? 0)?.mobility === 'boat');
      boats.forEach((id, n) => s.schedule((raiders.length + n) * BOLT_STAGGER, () => { if (em.isAlive(id)) strike(s, id, BOAT_DAMAGE); }));
      const villagers = em.collect((i) => (em.team[i] ?? 0) === 1 && (em.maxHp[i] ?? 0) > 0 && !kinds.hasTag(em.kind[i] ?? 0, 'building') && !em.hasFlag(i, ENTITY_FLAG.DESTROYED));
      for (const i of villagers) {
        em.hp[i] = Math.min(em.maxHp[i] ?? 0, (em.hp[i] ?? 0) + (em.maxHp[i] ?? 0) * HEAL_FRACTION);
        em.glow[i] = 1;
      }
      s.schedule(4, () => villagers.forEach((i) => { if (em.isAlive(i)) em.glow[i] = 0; }));
      const fires = s.powers.extinguishAll();
      s.bus.emit('ImpactRequested', { x: s.layout.village.x, y: s.layout.village.y, magnitude: 6, flash: 0.7 });
      s.bus.emit('SlowMoRequested', MIRACLE_SLOWMO);
      s.bus.emit('PropertyChanged', { ids: sample(villagers), property: 'health' });
      const parts: string[] = [];
      if (raiders.length > 0) parts.push(`${raiders.length} raider${raiders.length === 1 ? ' was' : 's were'} struck by lightning`);
      if (boats.length > 0) parts.push('the raider gunboat took a divine hit');
      if (villagers.length > 0) parts.push('the villagers feel stronger');
      if (fires > 0) parts.push(`${fires} fire${fires === 1 ? '' : 's'} went out`);
      const text = parts.length > 0 ? `Divine intervention! ${capitalizeFirst(parts.join(', '))}.` : 'The sky crackles. There is nothing left to smite, so everyone feels vaguely blessed.';
      const focus = { x: s.layout.village.x || ISLAND_CENTER, y: s.layout.village.y || ISLAND_CENTER };
      return result(text, { ids: sample(raiders), affected: raiders.length, focus, reaction: 'disaster', subject: 'lightning' });
    },
  };
}

function capitalizeFirst(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
