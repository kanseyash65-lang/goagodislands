import { DEFAULT_THING_COUNT } from '../../core/config/command.config';
import { hashString } from '../../core/rng/mulberry32';
import { COMIC_EFFECTS } from '../data/values';
import { NONSENSE } from '../parser/lexicon';
import type { Slots } from '../parser/slots';
import type { ImprovKind, TargetSpec, Value } from '../types';

/**
 * The Improv Engine (05 §9): when the parser can't fill a sensible command it
 * still produces *something*: a labelled Thing, a comic effect on a known
 * target, or a mild "Tuesday Event". Choices are deterministic (hash of text)
 * so replays stay identical.
 */
export interface ImprovPlan {
  readonly improv: ImprovKind;
  readonly target: TargetSpec;
  readonly value?: Value;
  readonly quantity?: number;
  readonly hint: string;
}

const VOWELS = /[aeiouy]/g;

/** Picks the most noun-like unknown word, or undefined for keyboard mash. */
export function pickThingWord(unknown: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const w of unknown) {
    if (NONSENSE.has(w) || !/^[\p{L}-]{3,16}$/u.test(w)) continue;
    const vowels = (w.match(VOWELS) ?? []).length / w.length;
    if (vowels < 0.2 || vowels > 0.75) continue;
    const score = w.length + (w.endsWith('s') ? 3 : 0) + (vowels > 0.3 ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return best === undefined ? undefined : singular(best);
}

export function singular(w: string): string {
  if (w.endsWith('ss') || w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(?:ches|shes|xes|sses|oes)$/.test(w)) return w.slice(0, -2);
  return w.endsWith('s') ? w.slice(0, -1) : w;
}

export function thingTarget(word: string): TargetSpec {
  return { type: 'thing', word, label: word };
}

export function planImprov(slots: Slots, text: string): ImprovPlan {
  const h = hashString(text);
  // An unknown first word is an unknown *verb* ("blorpify the cows"), not an object.
  const leading = slots.unknown[0] !== undefined && text.split(' ')[0] === slots.unknown[0];
  const word = pickThingWord(leading && slots.target ? slots.unknown.slice(1) : slots.unknown);
  const target = slots.target;
  if (target && word) {
    return { improv: 'salvage', target, quantity: 1, value: { type: 'gift', gift: word }, hint: 'Try: make the sun green' };
  }
  if (word) {
    return { improv: 'thing', target: thingTarget(word), quantity: slots.quantity ?? DEFAULT_THING_COUNT, hint: `Try: spawn 20 ${word}s` };
  }
  if (target) {
    const effect = COMIC_EFFECTS[h % COMIC_EFFECTS.length] ?? 'glow';
    return { improv: 'comic', target, value: { type: 'effect', effect }, hint: 'Try: make the chickens giant' };
  }
  return { improv: 'tuesday', target: { type: 'none' }, hint: 'Try: spawn 20 ducks' };
}
