import type { ReactionKind } from '../../core/events/event-types';
import { moodIndex } from '../../types/behavior';
import type { Value } from '../types';
import { result, type Effect, type EffectServices } from '../executor/effect-services';
import { capitalize, describeTargets, focusOf, resolveTargets, sample } from '../executor/target-query';

const GIFT_ATTACH_MAX = 40;
const COIN_BURST_MAX = 60;
const GIFT_DZ = 20;
const HARM_HOP = 140;
const MONEY = new Set(['coins', 'coin', 'money', 'gold', 'cash']);

function describeValue(v: Value): string {
  switch (v.type) {
    case 'color': return v.special === 'invisible' ? 'invisible' : v.special === 'rainbow' ? 'rainbow-coloured' : v.special === 'random' ? 'every colour at once' : v.name;
    case 'size': return v.relative ? (v.factor > 1 ? 'bigger' : 'smaller') : v.label;
    case 'speed': return v.relative ? (v.factor > 1 ? 'faster' : 'slower') : v.label;
    case 'mood': return v.mood;
    case 'health': return v.factor >= 1 ? `tougher (HP ${v.label}) and fully healed` : `weaker (HP ${v.label})`;
    default: return 'different';
  }
}

function reactionFor(v: Value, isSun: boolean): ReactionKind {
  if (isSun && v.type === 'color') return 'sky';
  if (v.type === 'color') return 'color';
  if (v.type === 'size') return 'size';
  if (v.type === 'health') return 'blessing';
  if (v.type === 'mood') return v.mood === 'happy' || v.mood === 'excited' || v.mood === 'inspired' ? 'blessing' : 'behavior';
  return 'behavior';
}

export const modifyEffect: Effect = {
  run(cmd, s) {
    const v = cmd.value;
    const prop = v ? s.props.inferFor(v) : undefined;
    const ids = resolveTargets(cmd.target, s, cmd);
    const label = cmd.target.type === 'none' ? 'that' : cmd.target.label;
    if (!v || !prop) return result('Reality nodded politely and changed nothing.', { reaction: 'generic' });
    if (ids.length === 0) return result(`Reality looked for ${label} to change. None were available.`, { reaction: 'generic', subject: label });
    let changed = 0;
    for (const i of ids) if (prop.apply(s.em, i, v, s.rng)) changed++;
    const sunKind = s.kinds.id('sun');
    const isSun = ids.some((i) => s.em.kind[i] === sunKind);
    if (isSun && v.type === 'color') s.bus.emit('SunColorChanged', { color: v.rgb });
    s.context.setTargets(ids, s.realTime());
    s.bus.emit('PropertyChanged', { ids: sample(ids), property: prop.name });
    const focus = isSun ? { x: s.view.centerX, y: s.view.centerY } : focusOf(ids, s);
    const who = cmd.target.type === 'kind' && cmd.target.label === 'sky' ? 'the sky' : describeTargets(cmd.target, changed);
    const verb = changed === 1 || who === 'everyone' || who === 'everything' || who === 'the sky' ? 'is' : 'are';
    return result(`${capitalize(who)} ${verb} now ${describeValue(v)}.`, {
      ids: sample(ids), affected: changed, ...(focus ? { focus } : {}), reaction: reactionFor(v, isSun),
      subject: v.type === 'color' ? v.name : describeValue(v),
    });
  },
};

function setMood(s: EffectServices, ids: readonly number[], mood: Parameters<typeof moodIndex>[0]): void {
  const m = moodIndex(mood);
  for (const i of ids) s.em.mood[i] = m;
}

export const healEffect: Effect = {
  run(cmd, s) {
    const ids = resolveTargets(cmd.target, s, cmd);
    setMood(s, ids, 'happy');
    for (const i of ids) {
      s.em.glow[i] = 1;
      if ((s.em.maxHp[i] ?? 0) > 0) s.em.hp[i] = s.em.maxHp[i] ?? 0; // healing restores real hit points
    }
    s.schedule(4, () => ids.forEach((i) => { if (s.em.isAlive(i)) s.em.glow[i] = 0; }));
    s.bus.emit('PropertyChanged', { ids: sample(ids), property: 'health' });
    const focus = focusOf(ids, s);
    return result(`${capitalize(describeTargets(cmd.target, ids.length))} ${ids.length === 1 ? 'feels' : 'feel'} unusually fine.`, { ids: sample(ids), ...(focus ? { focus } : {}), reaction: 'blessing' });
  },
};

export const harmEffect: Effect = {
  run(cmd, s) {
    const ids = resolveTargets(cmd.target, s, cmd);
    setMood(s, ids, 'scared');
    for (const i of ids) if (s.params.gravity > 0) s.em.vz[i] = HARM_HOP * s.rng.range(0.6, 1);
    const focus = focusOf(ids, s);
    if (focus) s.bus.emit('ImpactRequested', { x: focus.x, y: focus.y, magnitude: 2, flash: 0 });
    return result(`${capitalize(describeTargets(cmd.target, ids.length))} ${ids.length === 1 ? 'has' : 'have'} been mildly inconvenienced. Nobody was hurt.`, { ids: sample(ids), ...(focus ? { focus } : {}), reaction: 'harm' });
  },
};

export const giveEffect: Effect = {
  run(cmd, s) {
    const gift = cmd.value?.type === 'gift' ? cmd.value.gift : 'blessing';
    const ids = resolveTargets(cmd.target, s, cmd);
    const { em, factory, kinds } = s;
    setMood(s, ids, 'happy');
    if (MONEY.has(gift)) {
      const coin = kinds.id('coin');
      for (let n = 0; n < Math.min(COIN_BURST_MAX, ids.length * 3); n++) {
        const i = ids[n % ids.length] ?? 0;
        const c = factory.spawn(coin, (em.x[i] ?? 0) + s.rng.range(-10, 10), (em.y[i] ?? 0) + s.rng.range(-8, 8), { popAt: s.realTime(), z: 60, vz: 80 });
        if (c >= 0) em.rotVel[c] = s.rng.range(-6, 6);
      }
    } else if (gift !== 'blessing') {
      const label = s.labels.slotFor(gift.replace(/s$/, ''));
      const thing = kinds.id('thing');
      for (const parent of ids.slice(0, GIFT_ATTACH_MAX)) {
        const id = factory.spawn(thing, em.x[parent] ?? 0, em.y[parent] ?? 0, { popAt: s.realTime(), label });
        if (id < 0) break;
        em.parent[id] = parent;
        em.scale[id] = 0.45;
        em.attachDz[id] = GIFT_DZ;
      }
    }
    s.bus.emit('PropertyChanged', { ids: sample(ids), property: 'gift' });
    const focus = focusOf(ids, s);
    const who = capitalize(describeTargets(cmd.target, ids.length));
    const text = MONEY.has(gift) ? `${who} got money. Inflation is now a concept.` : gift === 'blessing' ? `${who} ${ids.length === 1 ? 'was' : 'were'} blessed. Mildly.` : `${who} now ${ids.length === 1 ? 'has' : 'have'} ${gift}. Nobody asked for ${gift}.`;
    return result(text, { ids: sample(ids), ...(focus ? { focus } : {}), reaction: 'blessing', subject: gift });
  },
};
