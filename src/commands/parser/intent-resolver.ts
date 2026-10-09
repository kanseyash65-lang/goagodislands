import { pickThingWord, thingTarget } from '../improv/improv';
import type { Intent, ImprovKind, PropertyName, TargetSpec, Value } from '../types';
import type { Slots } from './slots';

/** The parser's decision before ids/magnitude are attached. */
export interface Resolution {
  readonly intent: Intent;
  readonly target: TargetSpec;
  readonly property?: PropertyName;
  readonly value?: Value;
  readonly extras?: readonly Value[];
  readonly quantity?: number;
  readonly improv?: ImprovKind;
}

const EVERYONE: TargetSpec = { type: 'tag', tag: 'human', label: 'villagers' };
const PRONOUN: TargetSpec = { type: 'pronoun', label: 'them' };
const SKY: TargetSpec = { type: 'kind', kind: 'sun', label: 'sky' };
const PLURAL_DEFAULT = 8;
const PRECIP = new Set(['rain', 'snow', 'hail', 'storm']);

/** Property value found in the sentence (colour > size > speed > mood). */
function propertyValue(s: Slots): { property: PropertyName; value: Value } | undefined {
  if (s.color) return { property: 'color', value: s.color };
  if (s.size) return { property: 'size', value: s.size };
  if (s.speed) return { property: 'speed', value: s.speed };
  if (s.mood) return { property: 'mood', value: { type: 'mood', mood: s.mood } };
  return undefined;
}

function extrasOf(s: Slots): Value[] {
  const out: Value[] = [];
  if (s.color) out.push(s.color);
  if (s.size) out.push(s.size);
  if (s.speed) out.push(s.speed);
  return out;
}

function isPlural(word: string | undefined): boolean {
  return word !== undefined && word.endsWith('s') && !word.endsWith('ss');
}

function subject(s: Slots, fallback: TargetSpec): TargetSpec {
  if (s.target) return s.target;
  return s.pronoun ? PRONOUN : fallback;
}

function spawnRes(s: Slots, target: TargetSpec, improv?: ImprovKind): Resolution {
  const word = target.type === 'thing' ? `${target.word}s` : s.targetWord;
  const quantity = s.quantity ?? (isPlural(word) || target.type === 'tag' ? PLURAL_DEFAULT : 1);
  const extras = extrasOf(s);
  const base: Resolution = { intent: 'spawn', target, quantity, ...(extras.length > 0 ? { extras } : {}) };
  return improv ? { ...base, improv } : base;
}

function weatherRes(s: Slots, weather: Value & { type: 'weather' }): Resolution {
  let item: TargetSpec | undefined;
  if (PRECIP.has(weather.weather)) {
    if (s.target && s.target.type !== 'pronoun' && !(s.target.type === 'kind' && (s.target.kind === 'sun' || s.target.kind === 'cloud'))) item = s.target;
    else {
      const w = pickThingWord(s.unknown);
      if (w) item = thingTarget(w);
    }
  }
  const value: Value = item ? { type: 'weather', weather: weather.weather === 'storm' ? 'rain' : weather.weather, item } : weather;
  return { intent: 'weather', target: { type: 'none' }, value };
}

/** Decides the intent from slots. Returns undefined when Improv should take over. */
export function resolveIntent(s: Slots, hasLastTarget: boolean): Resolution | undefined {
  const verb = s.verb?.entry;
  const vi = verb?.intent;
  const prop = propertyValue(s);
  const defaultTarget = hasLastTarget ? PRONOUN : EVERYONE;

  if (vi === 'weather' && verb?.value?.type === 'weather') return weatherRes(s, verb.value);
  if (s.weather && (vi === undefined || vi === 'ambiguous' || vi === 'spawn') && (!s.target || s.pronoun || PRECIP.has(s.weather))) {
    return weatherRes(s, { type: 'weather', weather: s.weather });
  }
  if (s.time && (vi === undefined || vi === 'ambiguous') && !prop && (!s.target || s.pronoun)) {
    return { intent: 'time', target: { type: 'none' }, value: { type: 'time', time: s.time } };
  }

  switch (vi) {
    case 'spawn': {
      if (s.target) return spawnRes(s, s.target);
      const w = pickThingWord(s.unknown);
      return w ? spawnRes(s, thingTarget(w), 'thing') : undefined;
    }
    case 'destroy': {
      if (s.target || s.pronoun) return { intent: 'destroy', target: subject(s, PRONOUN), ...(s.quantity ? { quantity: s.quantity } : {}) };
      const w = pickThingWord(s.unknown);
      return w ? { intent: 'destroy', target: thingTarget(w) } : undefined;
    }
    case 'modify': {
      const value = verb?.value ?? prop?.value ?? { type: 'color', name: 'random', rgb: { r: 1, g: 1, b: 1 }, special: 'random' };
      const property: PropertyName = value.type === 'size' ? 'size' : value.type === 'speed' ? 'speed' : value.type === 'mood' ? 'mood' : 'color';
      return { intent: 'modify', target: subject(s, defaultTarget), property, value, ...(s.quantity ? { quantity: s.quantity } : {}) };
    }
    case 'ambiguous':
      return resolveAmbiguous(s, prop, defaultTarget);
    case 'move':
      return { intent: 'move', target: subject(s, EVERYONE) };
    case 'heal':
    case 'harm':
      return { intent: vi, target: subject(s, EVERYONE) };
    case 'give': {
      const giftWord = s.target2?.type === 'kind' || s.target2?.type === 'tag' ? s.target2.label : pickThingWord(s.unknown);
      return { intent: 'give', target: subject(s, EVERYONE), value: { type: 'gift', gift: giftWord ?? 'blessing' } };
    }
    case 'behavior':
      return verb?.value ? { intent: 'behavior', target: subject(s, EVERYONE), value: verb.value } : undefined;
    case 'disaster':
      return verb?.value ? { intent: 'disaster', target: s.target ?? { type: 'none' }, value: verb.value } : undefined;
    default:
      return resolveVerbless(s, prop, defaultTarget);
  }
}

function resolveAmbiguous(s: Slots, prop: ReturnType<typeof propertyValue>, defaultTarget: TargetSpec): Resolution | undefined {
  if (s.intoTarget && (s.target || s.pronoun)) return { intent: 'transform', target: subject(s, PRONOUN), value: { type: 'into', into: s.intoTarget } };
  if (prop) return { intent: 'modify', target: subject(s, defaultTarget), property: prop.property, value: prop.value, ...(s.quantity ? { quantity: s.quantity } : {}) };
  if (s.behavior) return { intent: 'behavior', target: subject(s, EVERYONE), value: { type: 'behavior', behavior: s.behavior } };
  if (s.target && s.unknown.length === 0 && (s.quantity !== undefined || s.hasArticle || s.accessory)) return spawnRes(s, s.target);
  const w = pickThingWord(s.unknown);
  if (w && !s.target && (s.quantity !== undefined || s.hasArticle)) return spawnRes(s, thingTarget(w), 'thing');
  return undefined;
}

function resolveVerbless(s: Slots, prop: ReturnType<typeof propertyValue>, defaultTarget: TargetSpec): Resolution | undefined {
  if (s.behavior && (s.target || s.pronoun || !prop)) return { intent: 'behavior', target: subject(s, EVERYONE), value: { type: 'behavior', behavior: s.behavior } };
  if (prop && (s.target || s.pronoun)) return { intent: 'modify', target: subject(s, PRONOUN), property: prop.property, value: prop.value };
  if (prop?.property === 'color' && s.unknown.length === 0) return { intent: 'modify', target: hasPronounTarget(defaultTarget) ? defaultTarget : SKY, property: 'color', value: prop.value };
  if (prop) return { intent: 'modify', target: defaultTarget, property: prop.property, value: prop.value };
  if (s.target && s.target.type !== 'name' && (s.quantity !== undefined || s.hasArticle || s.accessory || s.unknown.length === 0)) return spawnRes(s, s.target);
  const w = pickThingWord(s.unknown);
  if (w && s.quantity !== undefined && !s.target) return spawnRes(s, thingTarget(w), 'thing');
  return undefined;
}

function hasPronounTarget(t: TargetSpec): boolean {
  return t.type === 'pronoun';
}
