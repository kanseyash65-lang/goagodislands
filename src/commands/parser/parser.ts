import { IMPROV_CONFIDENCE, SPAWN_MAX_PER_COMMAND } from '../../core/config/command.config';
import { planImprov } from '../improv/improv';
import { normalize } from '../normalizer/normalizer';
import type { Command, CommandSource, TargetSpec } from '../types';
import { matchCamera, matchDisasterNoun, matchGravity, matchHealth, matchMeta, matchMiracle, matchTimeControl } from './control-phrases';
import { resolveIntent, type Resolution } from './intent-resolver';
import { LEX } from './lexicon';
import { computeMagnitude } from './magnitude';
import { extractSlots, tokenize } from './slots';
import { splitChain } from './splitter';

/** What the parser may know about the world (kept tiny so parsing stays pure). */
export interface ParseContext {
  readonly names: readonly string[];
  readonly hasLastTarget: boolean;
  readonly nextId: () => number;
}

interface Base {
  readonly id: number;
  readonly source: CommandSource;
  readonly raw: string;
  readonly normalized: string;
  readonly chainIndex: number;
  readonly chainLength: number;
}

/**
 * Transcript → Command[]. Never throws: unparseable input becomes Improv.
 * Pipeline: normalize → split chain → per segment: control phrases → slots →
 * intent → confidence check → Improv fallback → magnitude.
 */
export function parseTranscript(raw: string, source: CommandSource, ctx: ParseContext): Command[] {
  try {
    const normalized = normalize(raw);
    const segments = splitChain(normalized);
    if (segments.length === 0) {
      return [finish(base(raw, '', source, ctx, 0, 1), { intent: 'improv', target: { type: 'none' }, improv: 'tuesday' }, 0.1)];
    }
    return segments.map((seg, i) => parseSegment(base(raw, seg, source, ctx, i, segments.length), ctx));
  } catch {
    // Parser bugs must never reach the player: degrade to a Tuesday Event.
    return [finish(base(raw, '', source, ctx, 0, 1), { intent: 'improv', target: { type: 'none' }, improv: 'tuesday' }, 0)];
  }
}

function base(raw: string, normalized: string, source: CommandSource, ctx: ParseContext, chainIndex: number, chainLength: number): Base {
  return { id: ctx.nextId(), source, raw, normalized, chainIndex, chainLength };
}

export function parseSegment(b: Base, ctx: ParseContext): Command {
  const tokens = tokenize(b.normalized);
  // Before meta: "god help" is a plea for a miracle, not the help menu.
  if (matchMiracle(tokens)) return finish(b, { intent: 'miracle', target: { type: 'tag', tag: 'enemy', label: 'raiders' } }, 1);
  const disaster = matchDisasterNoun(tokens);
  if (disaster) return finish(b, { intent: 'disaster', target: { type: 'tag', tag: 'enemy', label: 'raiders' }, value: { type: 'disaster', disaster } }, 1);
  const meta = matchMeta(tokens);
  if (meta) return finish(b, { intent: 'meta', target: { type: 'none' }, value: { type: 'meta', ...meta } }, 1);
  const cam = matchCamera(tokens);
  if (cam) {
    const target = cam.rest.length > 0 ? cameraTarget(cam.rest, ctx) : { type: 'none' as const };
    return finish(b, { intent: 'camera', target, value: { type: 'camera', action: cam.action } }, 1);
  }
  const gravity = matchGravity(tokens);
  if (gravity) return finish(b, { intent: 'physics', target: { type: 'none' }, value: { type: 'gravity', ...gravity } }, 1);
  const time = matchTimeControl(tokens);
  if (time) return finish(b, { intent: 'time', target: { type: 'none' }, value: { type: 'time', time } }, 1);
  const hp = matchHealth(tokens);
  if (hp) {
    const s = extractSlots(tokens, ctx.names);
    const target: TargetSpec = s.target ?? (s.pronoun ? { type: 'pronoun', label: 'them' } : { type: 'tag', tag: 'human', label: 'villagers' });
    return withSlotsExtras(finish(b, { intent: 'modify', target, property: 'health', value: { type: 'health', ...hp } }, 1), s.where, s.duration, undefined);
  }

  const slots = extractSlots(tokens, ctx.names);
  const confidence = Math.min(1, slots.known / Math.max(1, slots.content) + (slots.verb ? 0.15 : 0));
  const res = resolveIntent(slots, ctx.hasLastTarget);
  if (res && (confidence >= IMPROV_CONFIDENCE || res.improv === 'thing')) {
    const cmd = finish(b, res, confidence);
    return withSlotsExtras(cmd, slots.where, slots.duration, slots.accessory);
  }
  const plan = planImprov(slots, b.normalized);
  const improvRes: Resolution = {
    intent: plan.improv === 'thing' ? 'spawn' : 'improv',
    target: plan.target,
    ...(plan.value ? { value: plan.value } : {}),
    ...(plan.quantity !== undefined ? { quantity: plan.quantity } : {}),
    improv: plan.improv,
  };
  return { ...withSlotsExtras(finish(b, improvRes, Math.min(confidence, 0.3)), slots.where, undefined, undefined), note: plan.hint };
}

function cameraTarget(rest: readonly string[], ctx: ParseContext): TargetSpec {
  const m = LEX.nouns.match(rest, 0);
  if (m) return m.value;
  for (const n of ctx.names) {
    if (rest.includes(n.toLowerCase())) return { type: 'name', name: n, label: n };
  }
  const anchor = LEX.anchors.match(rest, 0);
  if (anchor) return { type: 'tag', tag: `@${anchor.value}`, label: anchor.key };
  return { type: 'thing', word: rest.join(' '), label: rest.join(' ') };
}

function finish(b: Base, r: Resolution, confidence: number): Command {
  const quantity = r.quantity !== undefined ? Math.max(1, Math.min(SPAWN_MAX_PER_COMMAND, Math.floor(r.quantity))) : undefined;
  const cmd: Command = {
    ...b,
    intent: r.intent,
    target: r.target,
    confidence: Math.round(confidence * 100) / 100,
    magnitude: computeMagnitude({ intent: r.intent, target: r.target, ...(r.value ? { value: r.value } : {}), ...(quantity !== undefined ? { quantity } : {}) }),
    ...(r.property ? { property: r.property } : {}),
    ...(r.value ? { value: r.value } : {}),
    ...(r.extras ? { extras: r.extras } : {}),
    ...(quantity !== undefined ? { quantity } : {}),
    ...(r.improv ? { improv: r.improv } : {}),
  };
  return cmd;
}

function withSlotsExtras(c: Command, where: Command['where'], duration: number | undefined, accessory: string | undefined): Command {
  return {
    ...c,
    ...(where ? { where } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(accessory ? { accessory } : {}),
  };
}
