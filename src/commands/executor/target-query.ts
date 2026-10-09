import { RESULT_ID_SAMPLE } from '../../core/config/command.config';
import { isInView } from '../../core/services/view-info';
import { ENTITY_FLAG } from '../../entities/entity-manager';
import type { Command, TargetSpec } from '../types';
import type { EffectServices } from './effect-services';

/**
 * Resolves a TargetSpec to live entity ids at execution time.
 * Optional quantity picks the N nearest to the camera ("make 5 chickens blue").
 */
export function resolveTargets(spec: TargetSpec, s: EffectServices, cmd?: Command): number[] {
  const { em, kinds } = s;
  let ids: number[] = [];
  switch (spec.type) {
    case 'kind': {
      const k = kinds.id(spec.kind);
      if (k >= 0) ids = em.collect((i) => em.kind[i] === k);
      break;
    }
    case 'tag': {
      if (spec.tag === 'any') {
        ids = em.collect((i) => !kinds.hasTag(em.kind[i] ?? 0, 'env'));
      } else if (spec.tag === 'enemy' || spec.tag === 'ally') {
        // Raiders (team 2) or your own forces (team 1): soldiers, boats, and enemy buildings.
        const team = spec.tag === 'enemy' ? 2 : 1;
        ids = em.collect((i) => (em.team[i] ?? 0) === team && (team === 2 || kinds.hasTag(em.kind[i] ?? 0, 'troop')) && !em.hasFlag(i, ENTITY_FLAG.DESTROYED));
      } else if (spec.tag === 'human') {
        ids = em.collect((i) => kinds.hasTag(em.kind[i] ?? 0, 'villager'));
      } else {
        const set = new Set(kinds.kindsWithTag(spec.tag));
        ids = em.collect((i) => set.has(em.kind[i] ?? -1));
      }
      break;
    }
    case 'name': {
      const want = spec.name.toLowerCase();
      for (const [id, name] of em.names) if (em.isAlive(id) && name.toLowerCase().startsWith(want)) ids.push(id);
      break;
    }
    case 'pronoun':
      ids = s.context.pronounIds(s.realTime()).filter((i) => em.isAlive(i));
      break;
    case 'thing': {
      const slot = s.labels.texts.indexOf(spec.word);
      if (slot >= 0) ids = em.collect((i) => em.labelSlot[i] === slot);
      break;
    }
    case 'none':
      break;
  }
  if (cmd?.quantity !== undefined && cmd.intent !== 'spawn' && ids.length > cmd.quantity) ids = nearestToView(ids, s).slice(0, cmd.quantity);
  return ids;
}

function nearestToView(ids: number[], s: EffectServices): number[] {
  const { em, view } = s;
  const d = (i: number): number => Math.hypot((em.x[i] ?? 0) - view.centerX, (em.y[i] ?? 0) - view.centerY);
  return ids.slice().sort((a, b) => d(a) - d(b));
}

/** Centroid of affected entities, preferring the ones the player can see. */
export function focusOf(ids: readonly number[], s: EffectServices): { x: number; y: number } | undefined {
  if (ids.length === 0) return undefined;
  const { em, view } = s;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const pass of [true, false]) {
    for (const i of ids) {
      const x = em.x[i] ?? 0;
      const y = em.y[i] ?? 0;
      if (pass && !isInView(view, x, y)) continue;
      sx += x;
      sy += y;
      n++;
    }
    if (n > 0) break;
  }
  return n > 0 ? { x: sx / n, y: sy / n } : undefined;
}

export function sample(ids: readonly number[]): number[] {
  if (ids.length <= RESULT_ID_SAMPLE) return ids.slice();
  const out: number[] = [];
  const step = ids.length / RESULT_ID_SAMPLE;
  for (let k = 0; k < RESULT_ID_SAMPLE; k++) out.push(ids[Math.floor(k * step)] ?? 0);
  return out;
}

/** "the sun", "12 chickens", "Martha Plum", "everyone". */
export function describeTargets(spec: TargetSpec, count: number): string {
  if (spec.type === 'none') return 'nothing';
  if (spec.type === 'pronoun') return count === 1 ? 'it' : 'they';
  if (spec.type === 'name') return spec.name;
  if (spec.type === 'tag' && spec.tag === 'human') return count === 1 ? '1 villager' : `${count} villagers`;
  if (spec.type === 'tag' && spec.tag === 'enemy') return count === 1 ? '1 raider' : `${count} raiders`;
  if (spec.type === 'tag' && spec.tag === 'any') return 'everything';
  if (spec.type === 'kind' && (spec.kind === 'sun' || spec.kind === 'moon' || spec.kind === 'windmill' || spec.kind === 'market' || spec.kind === 'tavern' || spec.kind === 'well') && count <= 1) return `the ${spec.label}`;
  return count === 1 ? `1 ${spec.label.replace(/s$/, '')}` : `${count} ${spec.label}`;
}

export function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
