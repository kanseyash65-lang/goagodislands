import type { Mood } from '../../types/behavior';
import type { Behavior } from '../../types/behavior';
import type { WeatherKind } from '../../types/weather';
import type { TargetSpec, TimeValue, Value, WhereSpec } from '../types';
import type { VerbEntry } from '../data/verbs';
import { LEX, STOPWORDS } from './lexicon';
import { damerauLevenshtein } from './phrase-table';

/** Everything the slot extractor found in one command segment. */
export interface Slots {
  verb?: { readonly entry: VerbEntry; readonly word: string; readonly index: number };
  quantity?: number;
  hasArticle: boolean;
  target?: TargetSpec;
  targetWord?: string;
  target2?: TargetSpec;
  intoTarget?: TargetSpec;
  pronoun: boolean;
  color?: Value;
  size?: Value;
  speed?: Value;
  mood?: Mood;
  behavior?: Behavior;
  weather?: WeatherKind;
  time?: TimeValue;
  where?: WhereSpec;
  duration?: number;
  accessory?: string;
  half: boolean;
  unknown: string[];
  known: number;
  content: number;
}

const DURATION_UNITS: Readonly<Record<string, number>> = {
  second: 1, seconds: 1, sec: 1, secs: 1, minute: 60, minutes: 60, min: 60, mins: 60, hour: 3600, hours: 3600,
};
const ACCESSORY_WORDS: ReadonlySet<string> = new Set(['wearing', 'holding', 'wielding', 'carrying', 'riding', 'with']);
const ARTICLES: ReadonlySet<string> = new Set(['a', 'an', 'one']);

/** Tokens: lowercased words without apostrophes ("it's" → "its"). */
export function tokenize(segment: string): string[] {
  return segment
    .split(/\s+/)
    .map((t) => t.replace(/'/g, '').replace(/^-+|-+$/g, ''))
    .filter((t) => t.length > 0);
}

/**
 * Walks tokens left→right, consuming the longest match from each table in a
 * fixed priority order. Names are fuzzy-matched against living villagers.
 */
export function extractSlots(tokens: readonly string[], names: readonly string[]): Slots {
  const s: Slots = { hasArticle: false, pronoun: false, half: false, unknown: [], known: 0, content: 0 };
  let i = 0;
  while (i < tokens.length) {
    const used = consumeSpecial(tokens, i, s) || consumeVerb(tokens, i, s) || consumeValue(tokens, i, s) || consumeName(tokens, i, s, names);
    if (used > 0) {
      i += used;
      continue;
    }
    const t = tokens[i] ?? '';
    if (!STOPWORDS.has(t)) {
      const fz = consumeFuzzy(t, s);
      s.content++;
      if (fz) s.known++;
      else s.unknown.push(t);
    }
    i++;
  }
  return s;
}

function consumeSpecial(tokens: readonly string[], i: number, s: Slots): number {
  const t = tokens[i] ?? '';
  const next = tokens[i + 1] ?? '';
  if (/^\d+$/.test(t)) {
    if (s.quantity === undefined) s.quantity = Number(t);
    return 1;
  }
  if (ARTICLES.has(t)) {
    s.hasArticle = true;
    return 1;
  }
  if (t === 'half') {
    s.half = true;
    return 1;
  }
  if (t === 'for' && /^\d+$/.test(next) && DURATION_UNITS[tokens[i + 2] ?? ''] !== undefined) {
    s.duration = Number(next) * (DURATION_UNITS[tokens[i + 2] ?? ''] ?? 1);
    return 3;
  }
  if (t === 'for' && (next === 'a' || next === 'an') && DURATION_UNITS[tokens[i + 2] ?? ''] !== undefined) {
    s.duration = DURATION_UNITS[tokens[i + 2] ?? ''] ?? 1;
    return 3;
  }
  if (ACCESSORY_WORDS.has(t) && s.target !== undefined && i + 1 < tokens.length) {
    const rest = tokens.slice(i + 1).filter((w) => !ARTICLES.has(w) && w !== 'the');
    if (rest.length > 0) {
      s.accessory = rest.join(' ').slice(0, 18);
      return tokens.length - i;
    }
  }
  if (t === 'into' || (t === 'to' && s.verb?.entry.intent === 'ambiguous' && s.target !== undefined && LEX.nouns.match(tokens, i + 1 + (next === 'a' || next === 'the' ? 1 : 0)))) {
    const skip = next === 'a' || next === 'an' || next === 'the' ? 1 : 0;
    const m = LEX.nouns.match(tokens, i + 1 + skip);
    if (m && s.target !== undefined) {
      s.intoTarget = m.value;
      s.known++;
      s.content++;
      return 1 + skip + m.len;
    }
  }
  if (LEX.whereWords.has(t)) {
    let j = i + 1;
    if (tokens[j] === 'to') j++;
    if (tokens[j] === 'the') j++;
    const m = LEX.anchors.match(tokens, j);
    if (m && (s.target !== undefined || s.verb !== undefined)) {
      s.where = { anchor: m.value, label: m.key };
      s.known++;
      s.content++;
      return j - i + m.len;
    }
  }
  return 0;
}

function consumeVerb(tokens: readonly string[], i: number, s: Slots): number {
  if (s.verb) return 0;
  const m = LEX.verbs.match(tokens, i);
  if (!m) return 0;
  // A behaviour/weather verb after a target is better read as a value ("everyone dance").
  s.verb = { entry: m.value, word: m.key, index: i };
  s.known++;
  s.content++;
  return m.len;
}

function consumeValue(tokens: readonly string[], i: number, s: Slots): number {
  const preferNoun = s.target === undefined && (s.verb?.entry.intent === 'spawn' || s.verb?.entry.intent === 'give');
  if (preferNoun) {
    const n = consumeNoun(tokens, i, s);
    if (n > 0) return n;
  }
  const mod = LEX.colorMods.get(tokens[i] ?? '');
  const colorAt = mod ? i + 1 : i;
  const c = LEX.colors.match(tokens, colorAt);
  if (c && s.color === undefined) {
    const rgb = mod ? mod(c.value.rgb) : c.value.rgb;
    s.color = { type: 'color', name: mod ? `${tokens[i]} ${c.value.name}` : c.value.name, rgb, special: c.value.special };
    return hit(s, colorAt - i + c.len);
  }
  const size = LEX.sizes.match(tokens, i);
  if (size && s.size === undefined) {
    s.size = { type: 'size', ...size.value };
    return hit(s, size.len);
  }
  const speed = LEX.speeds.match(tokens, i);
  if (speed && s.speed === undefined) {
    s.speed = { type: 'speed', ...speed.value };
    return hit(s, speed.len);
  }
  const beh = LEX.behaviors.match(tokens, i);
  if (beh && s.behavior === undefined) {
    s.behavior = beh.value;
    return hit(s, beh.len);
  }
  const mood = LEX.moods.match(tokens, i);
  if (mood && s.mood === undefined) {
    s.mood = mood.value;
    return hit(s, mood.len);
  }
  const wx = LEX.weather.match(tokens, i);
  if (wx && s.weather === undefined) {
    s.weather = wx.value;
    return hit(s, wx.len);
  }
  const tm = LEX.times.match(tokens, i);
  if (tm && s.time === undefined) {
    s.time = tm.value;
    return hit(s, tm.len);
  }
  return consumeNoun(tokens, i, s);
}

function consumeNoun(tokens: readonly string[], i: number, s: Slots): number {
  const n = LEX.nouns.match(tokens, i);
  if (n) {
    if (s.target === undefined) {
      s.target = n.value;
      s.targetWord = n.key;
    } else if (s.target2 === undefined) s.target2 = n.value;
    return hit(s, n.len);
  }
  const t = tokens[i] ?? '';
  if (LEX.pronouns.has(t)) {
    s.pronoun = true;
    return 1;
  }
  return 0;
}

function consumeName(tokens: readonly string[], i: number, s: Slots, names: readonly string[]): number {
  const t = tokens[i] ?? '';
  if (t.length < 3 || s.target !== undefined) return 0;
  for (const n of names) {
    const ln = n.toLowerCase();
    if (ln === t || (t.length >= 5 && damerauLevenshtein(t, ln, 2) <= 1)) {
      s.target = { type: 'name', name: n, label: n };
      return hit(s, 1);
    }
  }
  return 0;
}

/** Fuzzy fallback for misheard words: nouns, then colours, weather, behaviours. */
function consumeFuzzy(t: string, s: Slots): boolean {
  if (t.length < 4) return false;
  const n = LEX.nouns.fuzzy(t);
  if (n && s.target === undefined) {
    s.target = n.value;
    s.targetWord = n.key;
    return true;
  }
  const c = LEX.colors.fuzzy(t);
  if (c && s.color === undefined) {
    s.color = { type: 'color', name: c.value.name, rgb: c.value.rgb, special: c.value.special };
    return true;
  }
  const w = LEX.weather.fuzzy(t);
  if (w && s.weather === undefined) {
    s.weather = w.value;
    return true;
  }
  const b = LEX.behaviors.fuzzy(t);
  if (b && s.behavior === undefined) {
    s.behavior = b.value;
    return true;
  }
  return false;
}

function hit(s: Slots, len: number): number {
  s.known++;
  s.content++;
  return len;
}
