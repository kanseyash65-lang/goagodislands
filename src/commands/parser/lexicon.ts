import { COLOR_MODIFIERS, COLOR_TABLE } from '../data/colors';
import { ANCHOR_TABLE, NOUN_TABLE, PRONOUNS, WHERE_WORDS } from '../data/nouns';
import { BEHAVIOR_TABLE, META_TABLE, MOOD_TABLE, SIZE_TABLE, SPEED_TABLE, TIME_TABLE, WEATHER_TABLE } from '../data/values';
import { VERB_TABLE } from '../data/verbs';
import { PhraseTable } from './phrase-table';

/** All vocabulary as phrase tables, built once from the data files. */
export const LEX = {
  verbs: new PhraseTable(VERB_TABLE),
  nouns: new PhraseTable(NOUN_TABLE),
  colors: new PhraseTable(COLOR_TABLE),
  colorMods: COLOR_MODIFIERS,
  sizes: new PhraseTable(SIZE_TABLE.map(([w, f, rel]) => [w, { factor: f, relative: rel, label: w }] as const)),
  speeds: new PhraseTable(SPEED_TABLE.map(([w, f, rel]) => [w, { factor: f, relative: rel, label: w }] as const)),
  moods: new PhraseTable(MOOD_TABLE),
  behaviors: new PhraseTable(BEHAVIOR_TABLE),
  weather: new PhraseTable(WEATHER_TABLE),
  times: new PhraseTable(TIME_TABLE),
  anchors: new PhraseTable(ANCHOR_TABLE),
  meta: new PhraseTable(META_TABLE.map(([w, a, args]) => [w, { action: a, args }] as const)),
  pronouns: PRONOUNS,
  whereWords: WHERE_WORDS,
};

/** Words that carry no meaning for the parser (never counted as "unknown"). */
export const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'of', 'to', 'some', 'all', 'every', 'each', 'at', 'with', 'my', 'your', 'our', 'their', 'his',
  'is', 'are', 'be', 'been', 'being', 'its', 'now', 'very', 'really', 'so', 'too', 'just', 'much', 'from', 'for',
  'and', 'then', 'also', 'up', 'down', 'out', 'off', 'on', 'in', 'into', 'over', 'around', 'like', 'as', 'than',
  'i', 'me', 'we', 'you', 'us', 'want', 'would', 'could', 'should', 'can', 'will', 'do', 'does', 'did', 'have', 'has',
  'little', 'bit', 'more', 'even', 'again', 'here', 'there', 'please', 'way', 'kind', 'sort', 'one', 'ones', 'other',
  'whole', 'entire', 'only', 'single', 'same', 'new', 'own', 'quite', 'pretty', 'maybe', 'perhaps', 'if', 'possible',
  'let', 'lets', 'go', 'going', 'gonna', 'wanna', 'start', 'begin', 'stop', 'suddenly', 'instantly', 'immediately',
  'everywhere', 'somewhere', 'anywhere', 'what', 'who', 'how', 'when', 'where', 'why', 'which', 'something', 'thing',
  'things', 'ok', 'okay', 'yes', 'yeah', 'no', 'not', 'dont', 'about', 'by', 'near', 'next', 'onto', 'colored',
  'coloured', 'color', 'size', 'sized', 'version', 'type', 'lot', 'times', 'time', 'shade', 'tone',
]);

/** Keyboard mashes and obvious nonsense never become a "Thing". */
export const NONSENSE: ReadonlySet<string> = new Set([
  'asdf', 'asdfgh', 'asdfghjkl', 'qwerty', 'qwertyuiop', 'zxcv', 'zxcvbnm', 'hjkl', 'jkl', 'lol', 'xd', 'aaa', 'aaaa',
  'blah', 'bla', 'test', 'testing', 'hmm', 'meh', 'idk', 'wtf', 'omg', 'gibberish', 'nonsense', 'lorem', 'ipsum',
]);
