import { ITEM_RAIN_SECONDS, ZERO_G_DRIFT_IMPULSE } from '../../core/config/sim.config';
import { formatClock } from '../../core/time/clock';
import { WEATHER_LABEL } from '../../types/weather';
import { result, type Effect, type EffectServices } from '../executor/effect-services';
import type { TargetSpec } from '../types';

const ZERO_G_SPIN = 0.8;

function itemKind(item: TargetSpec, s: EffectServices): { kind: number; label: number; word: string } {
  const thing = s.kinds.id('thing');
  if (item.type === 'kind') {
    const id = s.kinds.id(item.kind);
    if (s.kinds.def(id)?.spawnable) return { kind: id, label: -1, word: item.label };
  }
  if (item.type === 'tag') {
    const ids = s.kinds.kindsWithTag(item.tag).filter((k) => s.kinds.def(k)?.spawnable);
    if (ids.length > 0) return { kind: s.rng.pick(ids), label: -1, word: item.label };
  }
  const word = item.type === 'thing' ? item.word : item.type === 'none' ? 'thing' : item.label;
  return { kind: thing, label: s.labels.slotFor(word), word };
}

/** Weather + comedic item rain ("rain pizza"). The weather system eases the transition. */
export const weatherEffect: Effect = {
  run(cmd, s) {
    if (cmd.value?.type !== 'weather') return result('The weather considered it.', { reaction: 'generic' });
    const { weather, item } = cmd.value;
    s.params.weather = weather;
    if (weather === 'clear') s.params.itemRainKind = -1;
    s.bus.emit('WeatherChanged', { weather });
    const focus = { x: s.view.centerX, y: s.view.centerY };
    if (item && item.type !== 'none') {
      const k = itemKind(item, s);
      s.params.itemRainKind = k.kind;
      s.params.itemRainLabel = k.label;
      s.params.itemRainUntil = s.clock.simTime + ITEM_RAIN_SECONDS;
      return result(`It is raining ${k.word}. The forecast did not mention this.`, { focus, reaction: 'itemRain', subject: k.word, improvised: k.label >= 0 });
    }
    const text: Record<string, string> = {
      rain: 'It is now raining.', storm: 'A storm rolls in. Hats are held.', snow: 'It is snowing. In Tuesday.',
      fog: 'Fog arrives. Visibility: vibes.', clear: 'The sky clears. Everyone pretends nothing happened.',
      cloudy: 'Clouds gather, ominously, for no reason.', windy: 'It is windy. Laundry is relocating.', hail: 'Hail. Small, rude ice.',
    };
    const reaction = weather === 'rain' || weather === 'storm' ? 'rain' : weather === 'snow' ? 'snow' : 'weather';
    const fires = s.powers.burning();
    const wet = weather === 'rain' || weather === 'storm' || weather === 'snow' || weather === 'hail';
    const extra = wet && fires > 0 ? ` The rain hisses over ${fires} burning building${fires === 1 ? '' : 's'}. The fires are going out!` : '';
    return result((text[weather] ?? `${WEATHER_LABEL[weather]} weather.`) + extra, { focus, reaction, subject: weather });
  },
};

export const timeEffect: Effect = {
  run(cmd, s) {
    if (cmd.value?.type !== 'time') return result('Time shrugged.', { reaction: 'generic' });
    const t = cmd.value.time;
    const { clock } = s;
    let text: string;
    switch (t.kind) {
      case 'set':
        clock.setMinutes(t.minutes);
        clock.setFrozen(false);
        text = `It is now ${t.label} (${formatClock(t.minutes)}). Still Tuesday.`;
        break;
      case 'scale':
        clock.setFrozen(false);
        clock.setTimeScale(t.factor);
        text = t.factor > 1 ? 'Time is moving quickly. Nobody consented.' : 'Time slows to a polite crawl.';
        break;
      case 'freeze':
        clock.setFrozen(true);
        text = 'Time has stopped. The villagers will not notice. They cannot.';
        break;
      case 'resume':
        clock.setFrozen(false);
        clock.setTimeScale(1);
        text = 'Time resumes. Everyone carries on mid-sentence.';
        break;
      case 'friday':
        text = 'It is Tuesday.';
        break;
    }
    return result(text, { reaction: 'time', subject: 'time' });
  },
};

/** Gravity laws. Deleting gravity nudges everything upward so the world visibly drifts. */
export const physicsEffect: Effect = {
  run(cmd, s) {
    if (cmd.value?.type !== 'gravity') return result('Gravity remained gravity.', { reaction: 'generic' });
    const g = cmd.value.gravity;
    const prev = s.params.gravity;
    s.params.gravity = g;
    const { em, rng, kinds } = s;
    if (g === 0 && prev !== 0) {
      for (let i = 0; i < em.highWater; i++) {
        if (em.alive[i] !== 1 || !kinds.def(em.kind[i] ?? 0)?.physics || (em.parent[i] ?? -1) >= 0) continue;
        em.vz[i] = (em.vz[i] ?? 0) + ZERO_G_DRIFT_IMPULSE * rng.range(0.35, 1.5);
        em.rotVel[i] = rng.range(-ZERO_G_SPIN, ZERO_G_SPIN);
      }
    }
    s.bus.emit('GravityChanged', { gravity: g });
    const focus = { x: s.view.centerX, y: s.view.centerY };
    if (g === 0) return result('Gravity has been deleted.', { focus, reaction: 'gravityOff', subject: 'gravity' });
    if (g < 0) return result('Gravity now points up.', { focus, reaction: 'gravityReverse', subject: 'gravity' });
    if (g === 1) return result('Gravity is back. It did not apologise.', { focus, reaction: 'gravityOn', subject: 'gravity' });
    return result(g < 1 ? 'Gravity is now optional-ish.' : 'Gravity is now very serious about itself.', { focus, reaction: g < 1 ? 'gravityOff' : 'gravityOn', subject: 'gravity' });
  },
};
