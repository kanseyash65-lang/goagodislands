import type { Behavior } from '../../types/behavior';
import type { Intent, Value } from '../types';

/** A verb phrase → intent (optionally carrying an implied value). */
export interface VerbEntry {
  readonly intent: Intent | 'ambiguous';
  readonly value?: Value;
}

const v = (intent: Intent | 'ambiguous', value?: Value): VerbEntry => (value ? { intent, value } : { intent });
const each = (words: readonly string[], entry: VerbEntry): [string, VerbEntry][] => words.map((w) => [w, entry]);

const grow: Value = { type: 'size', factor: 1.6, relative: true, label: 'bigger' };
const shrink: Value = { type: 'size', factor: 0.6, relative: true, label: 'smaller' };
const faster: Value = { type: 'speed', factor: 1.8, relative: true, label: 'faster' };
const slower: Value = { type: 'speed', factor: 0.55, relative: true, label: 'slower' };
const beh = (b: Behavior): Value => ({ type: 'behavior', behavior: b });
const wx = (w: 'rain' | 'snow' | 'storm' | 'hail'): Value => ({ type: 'weather', weather: w });
const dis = (d: string): Value => ({ type: 'disaster', disaster: d });

/** ≥ 80 verb phrases (05 §14). Multi-word phrases are matched longest-first. */
export const VERB_TABLE: readonly [string, VerbEntry][] = [
  ...each(['spawn', 'summon', 'add', 'create', 'conjure', 'drop', 'produce', 'generate', 'bring', 'release', 'unleash',
    'manifest', 'hatch', 'breed', 'place', 'birth', 'materialize', 'materialise', 'invent', 'build', 'construct', 'erect',
    'assemble', 'craft', 'raise', 'put up', 'plant', 'deploy', 'insert', 'introduce', 'gimme'], v('spawn')),
  ...each(['delete', 'remove', 'destroy', 'erase', 'vanish', 'banish', 'kill', 'eliminate', 'obliterate',
    'annihilate', 'despawn', 'evaporate', 'disintegrate', 'exterminate', 'take away', 'eradicate', 'dismiss'], v('destroy')),
  ...each(['color', 'paint', 'dye', 'tint', 'recolor', 'shade', 'spray'], v('modify')),
  ...each(['make', 'turn', 'change', 'set', 'transform', 'let', 'get', 'convert', 'morph', 'become', 'go'], v('ambiguous')),
  ...each(['grow', 'enlarge', 'inflate', 'expand', 'embiggen', 'scale up', 'supersize', 'pump up'], v('modify', grow)),
  ...each(['shrink', 'deflate', 'squish', 'scale down', 'miniaturize', 'compress'], v('modify', shrink)),
  ...each(['speed up', 'hurry', 'accelerate', 'quicken'], v('modify', faster)),
  ...each(['slow down', 'slow', 'decelerate'], v('modify', slower)),
  ...each(['move', 'push', 'send', 'teleport', 'pull', 'throw', 'launch', 'yeet', 'fling', 'toss', 'lift', 'catapult', 'relocate', 'drag', 'carry'], v('move')),
  ...each(['heal', 'cure', 'revive', 'restore', 'fix', 'mend', 'soothe'], v('heal')),
  ...each(['hurt', 'poison', 'curse', 'zap', 'smite', 'punish', 'slap', 'bonk', 'tickle', 'annoy', 'scare', 'spook'], v('harm')),
  ...each(['give', 'grant', 'bless', 'gift', 'award', 'donate', 'reward', 'equip'], v('give')),
  ...each(['rain', 'pour', 'raining'], v('weather', wx('rain'))),
  ...each(['snow', 'snowing'], v('weather', wx('snow'))),
  ...each(['hail', 'hailing'], v('weather', wx('hail'))),
  ...each(['dance', 'boogie', 'groove', 'party', 'disco'], v('behavior', beh('dance'))),
  ...each(['panic', 'freak out', 'scream', 'riot'], v('behavior', beh('panic'))),
  ...each(['sleep', 'nap', 'snooze', 'rest', 'hibernate'], v('behavior', beh('sleep'))),
  ...each(['celebrate', 'cheer', 'rejoice', 'laugh'], v('behavior', beh('celebrate'))),
  ...each(['pray', 'worship', 'meditate'], v('behavior', beh('pray'))),
  ...each(['sing', 'serenade', 'chant'], v('behavior', beh('sing'))),
  ...each(['work', 'labor', 'labour'], v('behavior', beh('work'))),
  ...each(['run', 'flee', 'sprint', 'run away', 'escape'], v('behavior', beh('run'))),
  ...each(['jump', 'hop', 'bounce', 'leap'], v('behavior', beh('jump'))),
  ...each(['spin', 'twirl', 'rotate', 'pirouette'], v('behavior', beh('spin'))),
  ...each(['float', 'levitate', 'fly', 'hover'], v('behavior', beh('float'))),
  ...each(['calm', 'calm down', 'relax', 'chill', 'settle down'], v('behavior', beh('calm'))),
  ...each(['fight', 'argue', 'brawl', 'wrestle'], v('behavior', beh('fight'))),
  ...each(['burn', 'ignite', 'set fire to', 'torch', 'incinerate'], v('disaster', dis('fire'))),
  ...each(['flood', 'drown'], v('disaster', dis('flood'))),
  ...each(['explode', 'blow up', 'nuke', 'detonate', 'kaboom'], v('disaster', dis('explosion'))),
  ...each(['strike', 'electrocute'], v('disaster', dis('lightning'))),
  ...each(['shake', 'quake', 'rattle'], v('disaster', dis('earthquake'))),
];
