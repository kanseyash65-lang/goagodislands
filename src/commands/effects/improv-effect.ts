import { hslToRgb } from '../../types/rgb';
import type { ComicEffect } from '../types';
import { result, type Effect, type EffectServices } from '../executor/effect-services';
import { focusOf, resolveTargets, sample } from '../executor/target-query';
import { applyBehavior } from './behavior-effects';
import { spawnMany } from './spawn-effects';

const VANISH_SECONDS = 3;
const COMIC_SECONDS = 8;
const GROW = 1.6;
const SHRINK = 0.6;
const FLOAT_VZ = 240;
const SALVAGE_THINGS = 3;

/** Applies one comic effect from the Improv pool (05 §9.3). */
export function applyComic(s: EffectServices, ids: readonly number[], effect: ComicEffect): void {
  const { em, rng } = s;
  switch (effect) {
    case 'float':
      for (const i of ids) em.vz[i] = FLOAT_VZ * rng.range(0.7, 1.2);
      break;
    case 'spin':
      applyBehavior(s, ids, 'spin', COMIC_SECONDS);
      break;
    case 'bounce':
      applyBehavior(s, ids, 'jump', COMIC_SECONDS);
      break;
    case 'dance':
      applyBehavior(s, ids, 'dance', COMIC_SECONDS);
      break;
    case 'glow':
      for (const i of ids) em.glow[i] = 1;
      break;
    case 'grow':
      for (const i of ids) em.scale[i] = Math.min(8, (em.scale[i] ?? 1) * GROW);
      break;
    case 'shrink':
      for (const i of ids) em.scale[i] = Math.max(0.15, (em.scale[i] ?? 1) * SHRINK);
      break;
    case 'recolor': {
      const c = hslToRgb(rng.next(), 0.75, 0.6);
      for (const i of ids) {
        em.tintR[i] = c.r;
        em.tintG[i] = c.g;
        em.tintB[i] = c.b;
      }
      break;
    }
    case 'vanish':
      for (const i of ids) em.opacity[i] = 0;
      s.schedule(VANISH_SECONDS, () => ids.forEach((i) => { if (em.isAlive(i)) em.opacity[i] = 1; }));
      break;
  }
  s.bus.emit('PropertyChanged', { ids: sample(ids), property: effect });
}

const TUESDAY_EVENTS: readonly ((s: EffectServices) => string)[] = [
  (s) => { s.params.weather = 'cloudy'; s.bus.emit('WeatherChanged', { weather: 'cloudy' }); return 'Some clouds arrived to look into it.'; },
  (s) => { spawnMany(s, { kindIds: [s.kinds.id('chicken')], label: -1, word: 'chickens' }, 3, s.view.centerX, s.view.centerY, undefined, true); return 'Three chickens appeared. They seem to know something.'; },
  (s) => { applyBehavior(s, s.em.collect((i) => s.kinds.hasTag(s.em.kind[i] ?? 0, 'human')), 'celebrate', 5); return 'Everyone briefly celebrated, just in case.'; },
  (s) => { spawnMany(s, { kindIds: [s.kinds.id('duck')], label: -1, word: 'ducks' }, 2, s.view.centerX, s.view.centerY, undefined, true); return 'Two ducks were issued, as a precaution.'; },
];

/** Improv effect: comic effects, salvage, and Tuesday Events. Always does something. */
export const improvEffect: Effect = {
  run(cmd, s) {
    const kind = cmd.improv ?? 'tuesday';
    if (kind === 'comic' || kind === 'salvage') {
      const ids = resolveTargets(cmd.target, s, cmd);
      const effect: ComicEffect = cmd.value?.type === 'effect' ? cmd.value.effect : s.rng.pick(['spin', 'glow', 'bounce', 'grow'] as const);
      applyComic(s, ids, effect);
      const focus = focusOf(ids, s) ?? { x: s.view.centerX, y: s.view.centerY };
      let extra = '';
      const word = cmd.value?.type === 'gift' ? cmd.value.gift : '';
      if (kind === 'salvage' && word) {
        spawnMany(s, { kindIds: [s.kinds.id('thing')], label: s.labels.slotFor(word), word }, SALVAGE_THINGS, focus.x, focus.y, undefined, true);
        extra = ` Also, some ${word}s.`;
      }
      return result(`Reality interpreted that as "${effect}".${extra}`, { ids: sample(ids), focus, reaction: 'improv', subject: word || effect, improvised: true });
    }
    const event = s.rng.pick(TUESDAY_EVENTS);
    const text = event(s);
    return result(`Local reality misunderstands request. ${text}`, { focus: { x: s.view.centerX, y: s.view.centerY }, reaction: 'improv', subject: 'that', improvised: true });
  },
};
