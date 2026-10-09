import type { CameraAction, MetaAction, TimeValue } from '../types';
import { LEX } from './lexicon';
import { damerauLevenshtein } from './phrase-table';

/**
 * Whole-sentence control phrases that bypass slot extraction:
 * meta commands, camera moves, gravity laws, and time control.
 */
export interface MetaMatch {
  readonly action: MetaAction;
  readonly arg?: string;
}

export function matchMeta(tokens: readonly string[]): MetaMatch | undefined {
  const m = LEX.meta.match(tokens, 0);
  if (!m) return undefined;
  const rest = tokens.slice(m.len).filter((t) => t !== 'the' && t !== 'spell' && t !== 'a');
  if (m.value.args) {
    if (m.value.action === 'cast' && rest.length === 0) return undefined;
    return rest.length > 0 ? { action: m.value.action, arg: rest.join(' ') } : { action: m.value.action };
  }
  // Non-argument meta phrases must cover the sentence ("more chickens" is not "more").
  const leftover = rest.filter((t) => t !== 'please' && t !== 'now' && t !== 'that' && t !== 'it');
  return leftover.length === 0 ? { action: m.value.action } : undefined;
}

export interface CameraMatch {
  readonly action: CameraAction;
  /** Remaining tokens naming what to focus on. */
  readonly rest: readonly string[];
}

const OVERVIEW = ['show everything', 'show me everything', 'show the whole world', 'show the world', 'birds eye view',
  'birds eye', 'bird eye view', 'overview', 'zoom all the way out', 'show the whole map', 'show the map', 'whole village'];

export function matchCamera(tokens: readonly string[]): CameraMatch | undefined {
  const s = tokens.join(' ');
  if (OVERVIEW.some((p) => s === p || s.startsWith(`${p} `))) return { action: 'overview', rest: [] };
  const focusLead = /^(?:zoom in on|zoom into|zoom to|focus on|look at|show me|show|follow|find|where is|where are|go to|center on|take me to|pan to)\b/.exec(s);
  if (focusLead) {
    const rest = s.slice(focusLead[0].length).trim().split(' ').filter((t) => t.length > 0 && t !== 'the' && t !== 'me' && t !== 'all');
    if (rest.length > 0) return { action: 'focus', rest };
  }
  if (/^(?:zoom in|closer|get closer|move closer|zoom closer|enhance)$/.test(s)) return { action: 'zoom-in', rest: [] };
  if (/^(?:zoom out|further|pull back|zoom further out|back up|wider)$/.test(s)) return { action: 'zoom-out', rest: [] };
  return undefined;
}

export interface GravityMatch {
  readonly gravity: number;
  readonly label: string;
}

const OFF = /\b(?:0|delete|remove|disable|off|no|zero|stop|kill|destroy|without|cancel|vanish|erase|banish|end|eliminate|get rid|turn off|switch off|break|nuke)\b/;
const REVERSE = /\b(?:reverse|reversed|flip|flipped|invert|inverted|upside|backwards|backward|anti|negative|opposite)\b/;
const LOW = /\b(?:low|lower|less|weak|weaker|moon|light|half|reduce|reduced|decrease|tiny|little)\b/;
const HIGH = /\b(?:high|higher|heavy|heavier|strong|stronger|more|double|extra|triple|increase|max|maximum|crank)\b/;
const ON = /\b(?:on|restore|normal|back|enable|return|fix|reset|bring|put|turn on|switch on|default)\b/;

/** Detects gravity laws: "delete gravity", "reverse gravity", "low gravity", "gravity back on". */
export function matchGravity(tokens: readonly string[]): GravityMatch | undefined {
  const hasGravity = tokens.some((t) => t === 'gravity' || (t.length >= 6 && damerauLevenshtein(t, 'gravity', 3) <= 2 && t.startsWith('gra')));
  const s = tokens.join(' ');
  if (!hasGravity) {
    if (/^(?:0 g|zero g|zero-g|0-g|antigravity|upside down|weightless|weightlessness)$/.test(s)) return /upside/.test(s) ? { gravity: -1, label: 'reversed' } : { gravity: 0, label: 'off' };
    return undefined;
  }
  if (REVERSE.test(s)) return { gravity: -1, label: 'reversed' };
  if (/\b(?:turn on|switch on|back on|restore|bring back|put back|normal)\b/.test(s)) return { gravity: 1, label: 'normal' };
  if (OFF.test(s)) return { gravity: 0, label: 'off' };
  if (LOW.test(s)) return { gravity: 0.25, label: 'low' };
  if (HIGH.test(s)) return { gravity: 3, label: 'heavy' };
  if (ON.test(s)) return { gravity: 1, label: 'normal' };
  return { gravity: 1, label: 'normal' };
}

/** "speed up time", "stop time", "resume time", "it's friday". */
export function matchTimeControl(tokens: readonly string[]): TimeValue | undefined {
  const s = tokens.join(' ');
  const hasTime = /\b(?:time|clock|day)\b/.test(s);
  if (/\b(?:fast forward|fastforward|time lapse|timelapse)\b/.test(s)) return { kind: 'scale', factor: 8, label: 'fast forward' };
  if (!hasTime) return undefined;
  if (/\b(?:stop|freeze|pause|halt|frozen|still)\b/.test(s)) return { kind: 'freeze' };
  if (/\b(?:resume|unfreeze|unpause|continue|start|restart|normal|go again)\b/.test(s)) return { kind: 'resume' };
  if (/\b(?:speed up|faster|fast|accelerate|quicker|hurry)\b/.test(s)) return { kind: 'scale', factor: 6, label: 'faster' };
  if (/\b(?:slow down|slower|slow|decelerate)\b/.test(s)) return { kind: 'scale', factor: 0.25, label: 'slower' };
  if (/\b(?:reverse|backwards|rewind)\b/.test(s)) return { kind: 'set', minutes: 6 * 60 + 30, label: 'dawn (again)' };
  return undefined;
}

const HP_WORDS = /\b(?:hp|health|life|lives|hit points|stamina|strength|toughness)\b/;
const HP_STRONGER = /\b(?:stronger|tougher|strong|tough|invincible|unbreakable)\b/;
const HP_DOWN = /\b(?:decrease|reduce|lower|less|half|halve|weaken|weaker|drain|down|lose)\b/;

/** "increase the HP of the villagers", "double health", "make the enemy base stronger". */
export function matchHealth(tokens: readonly string[]): { factor: number; label: string } | undefined {
  const s = tokens.join(' ');
  const hp = HP_WORDS.test(s);
  if (!hp && !HP_STRONGER.test(s)) return undefined;
  if (/\b(?:triple|3 times|three times)\b/.test(s)) return { factor: 3, label: '×3' };
  if (/\b(?:double|twice|2 times)\b/.test(s)) return { factor: 2, label: '×2' };
  if (/\binvincible|unbreakable\b/.test(s)) return { factor: 10, label: '×10' };
  if (HP_DOWN.test(s)) return { factor: 0.5, label: '×0.5' };
  return { factor: hp ? 2 : 1.5, label: hp ? '×2' : '×1.5' };
}

const MIRACLE = /^(?:do something|do anything|help (?:us|me|them|the villagers|the village|my people|everyone)|save (?:us|them|the village|the villagers|the island|my people|everyone)|protect (?:us|them|the village|the villagers|the island)|defend (?:us|the village|the villagers|the island)|smite (?:the )?(?:enemies|enemy|raiders|invaders|pirates|them)|strike (?:the )?(?:enemies|enemy|raiders|invaders|pirates|them)(?: with lightning)?|kill (?:the |all )?(?:enemies|enemy|raiders|invaders|pirates)|divine intervention|perform a miracle|miracle|a miracle|god help|fight back|attack (?:the )?(?:enemies|enemy|raiders))$/;

const DISASTER_NOUN = /^(?:(?:start|cause|make|summon|send|call|bring|create|unleash|drop|throw)(?: down)?\s+)?(?:(?:an?|the|some)\s+)?(earthquake|quake|lightning(?: strike| bolt)?|thunderbolts?|tsunami|tidal wave|giant wave|meteors?(?: shower)?|meteor strike|volcano)(?:\s+(?:on|at)\s+(?:the\s+)?(?:enemies|enemy|raiders|pirates|invaders|them|boat|enemy boat))?$/;
const DISASTER_OF: Readonly<Record<string, string>> = { earthquake: 'earthquake', quake: 'earthquake', tsunami: 'flood', 'tidal wave': 'flood', 'giant wave': 'flood', volcano: 'meteor' };

/** "Earthquake!", "send a tsunami", "meteor shower on the raiders": a disaster aimed at the raiders. */
export function matchDisasterNoun(tokens: readonly string[]): string | undefined {
  const m = DISASTER_NOUN.exec(tokens.join(' '));
  const word = m?.[1];
  if (!word) return undefined;
  if (word.startsWith('lightning') || word.startsWith('thunderbolt')) return 'lightning';
  if (word.startsWith('meteor')) return 'meteor';
  return DISASTER_OF[word] ?? 'earthquake';
}

/** "God, do something!", "save the village", "smite the raiders": a divine intervention. */
export function matchMiracle(tokens: readonly string[]): boolean {
  return MIRACLE.test(tokens.join(' '));
}
