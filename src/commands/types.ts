import type { Behavior, Mood } from '../types/behavior';
import type { Rgb } from '../types/rgb';
import type { WeatherKind } from '../types/weather';

/** Structured command types produced by the parser and consumed by the executor. */
export type Intent =
  | 'spawn' | 'destroy' | 'modify' | 'transform' | 'move' | 'heal' | 'harm' | 'give'
  | 'weather' | 'time' | 'physics' | 'behavior' | 'disaster' | 'camera' | 'meta' | 'improv' | 'miracle';

export type CommandSource = 'voice' | 'text' | 'macro' | 'demo' | 'replay' | 'suggestion';

export type TargetSpec =
  | { readonly type: 'kind'; readonly kind: string; readonly label: string }
  | { readonly type: 'tag'; readonly tag: string; readonly label: string }
  | { readonly type: 'name'; readonly name: string; readonly label: string }
  | { readonly type: 'pronoun'; readonly label: string }
  | { readonly type: 'thing'; readonly word: string; readonly label: string }
  | { readonly type: 'none' };

export type ColorSpecial = 'none' | 'rainbow' | 'invisible' | 'glowing' | 'random';
export type TimeValue =
  | { readonly kind: 'set'; readonly minutes: number; readonly label: string }
  | { readonly kind: 'scale'; readonly factor: number; readonly label: string }
  | { readonly kind: 'freeze' }
  | { readonly kind: 'resume' }
  | { readonly kind: 'friday' };
export type CameraAction = 'zoom-in' | 'zoom-out' | 'overview' | 'focus';
export type MetaAction =
  | 'undo' | 'redo' | 'rewind' | 'remember' | 'cast' | 'spellbook' | 'newspaper' | 'close'
  | 'chronicle' | 'help' | 'demo' | 'mute' | 'reset' | 'photo' | 'debug' | 'repeat' | 'more' | 'pause';
export type ComicEffect = 'float' | 'spin' | 'bounce' | 'glow' | 'grow' | 'shrink' | 'dance' | 'recolor' | 'vanish';
export type ImprovKind = 'thing' | 'salvage' | 'comic' | 'tuesday';

export type Value =
  | { readonly type: 'color'; readonly name: string; readonly rgb: Rgb; readonly special: ColorSpecial }
  | { readonly type: 'size'; readonly factor: number; readonly relative: boolean; readonly label: string }
  | { readonly type: 'speed'; readonly factor: number; readonly relative: boolean; readonly label: string }
  | { readonly type: 'mood'; readonly mood: Mood }
  | { readonly type: 'behavior'; readonly behavior: Behavior }
  | { readonly type: 'weather'; readonly weather: WeatherKind; readonly item?: TargetSpec }
  | { readonly type: 'time'; readonly time: TimeValue }
  | { readonly type: 'gravity'; readonly gravity: number; readonly label: string }
  | { readonly type: 'camera'; readonly action: CameraAction }
  | { readonly type: 'meta'; readonly action: MetaAction; readonly arg?: string }
  | { readonly type: 'effect'; readonly effect: ComicEffect }
  | { readonly type: 'disaster'; readonly disaster: string }
  | { readonly type: 'gift'; readonly gift: string }
  | { readonly type: 'into'; readonly into: TargetSpec }
  | { readonly type: 'health'; readonly factor: number; readonly label: string };

export type PropertyName = 'color' | 'size' | 'speed' | 'mood' | 'health';

export interface WhereSpec {
  readonly anchor: string;
  readonly label: string;
}

export interface Command {
  readonly id: number;
  readonly source: CommandSource;
  readonly raw: string;
  readonly normalized: string;
  readonly intent: Intent;
  readonly target: TargetSpec;
  readonly property?: PropertyName;
  readonly value?: Value;
  /** Extra value applied to spawned entities ("spawn 10 *giant blue* chickens"). */
  readonly extras?: readonly Value[];
  readonly quantity?: number;
  readonly where?: WhereSpec;
  readonly duration?: number;
  /** Accessory phrase ("wearing a tiny hat") attached as a labelled Thing. */
  readonly accessory?: string;
  readonly confidence: number;
  readonly magnitude: number;
  readonly chainIndex: number;
  readonly chainLength: number;
  readonly improv?: ImprovKind;
  readonly note?: string;
}

/** Short human-readable parse preview for the "Reality heard" ribbon. */
export function describeCommand(c: Command): string {
  const parts: string[] = [c.intent];
  const t = c.target;
  if (t.type !== 'none') parts.push(t.label);
  if (c.quantity !== undefined && (c.intent === 'spawn' || c.improv === 'thing')) parts.push(`×${c.quantity}`);
  const v = c.value;
  if (v) parts.push(describeValue(v));
  if (c.where) parts.push(`near ${c.where.label}`);
  return parts.join(' · ');
}

function describeValue(v: Value): string {
  switch (v.type) {
    case 'color': return `color=${v.name}`;
    case 'size': return `size=${v.label}`;
    case 'speed': return `speed=${v.label}`;
    case 'mood': return `mood=${v.mood}`;
    case 'behavior': return v.behavior;
    case 'weather': return v.item && v.item.type !== 'none' ? `${v.weather} of ${v.item.label}` : v.weather;
    case 'time': return v.time.kind === 'set' || v.time.kind === 'scale' ? v.time.label : v.time.kind;
    case 'gravity': return `gravity=${v.label}`;
    case 'camera': return v.action;
    case 'meta': return v.arg ? `${v.action} ${v.arg}` : v.action;
    case 'effect': return v.effect;
    case 'disaster': return v.disaster;
    case 'gift': return v.gift;
    case 'into': return `into ${v.into.type === 'none' ? '?' : v.into.label}`;
    case 'health': return `HP ${v.label}`;
  }
}
