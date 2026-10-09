import { MAGNITUDE_MAX } from '../../core/config/command.config';
import type { Intent, TargetSpec, Value } from '../types';

/**
 * Estimated impact 0..10 (05 §8). Drives Impact Cam, chaos, normalcy and the
 * newspaper (front page when > 7).
 */
export interface MagnitudeInput {
  readonly intent: Intent;
  readonly target: TargetSpec;
  readonly value?: Value;
  readonly quantity?: number;
}

const BIG_KINDS: Readonly<Record<string, number>> = { dragon: 2.5, castle: 1.5, mountain: 1.5, sun: 2, moon: 1.5 };
const DISASTER: Readonly<Record<string, number>> = { explosion: 8, earthquake: 7, fire: 7, flood: 7, meteor: 8, lightning: 5, tornado: 7 };
const WEATHER: Readonly<Record<string, number>> = { rain: 3.5, storm: 5.5, snow: 4.5, fog: 3, clear: 2, cloudy: 2, windy: 3, hail: 5 };

export function computeMagnitude(c: MagnitudeInput): number {
  return Math.round(Math.min(MAGNITUDE_MAX, Math.max(0, raw(c))) * 10) / 10;
}

function scopeBonus(t: TargetSpec): number {
  if (t.type === 'tag') return t.tag === 'any' ? 3 : t.tag === 'human' || t.tag === 'living' ? 1.5 : 1;
  if (t.type === 'kind') return BIG_KINDS[t.kind] ?? 0;
  return 0;
}

function raw(c: MagnitudeInput): number {
  const q = Math.max(1, c.quantity ?? 1);
  const v = c.value;
  switch (c.intent) {
    case 'spawn':
      return 2 + Math.log10(q) * 2.4 + scopeBonus(c.target);
    case 'destroy':
      return 4 + scopeBonus(c.target) * 1.4;
    case 'modify': {
      const big = v?.type === 'size' && !v.relative && (v.factor >= 3.5 || v.factor <= 0.3) ? 1 : 0;
      return (v?.type === 'health' ? 4 : 3) + scopeBonus(c.target) * 1.3 + big;
    }
    case 'transform':
      return 6 + scopeBonus(c.target) * 0.5;
    case 'weather': {
      const base = v?.type === 'weather' ? WEATHER[v.weather] ?? 3 : 3;
      return base + (v?.type === 'weather' && v.item && v.item.type !== 'none' ? 3 : 0);
    }
    case 'time':
      if (v?.type !== 'time') return 3;
      return v.time.kind === 'freeze' ? 6 : v.time.kind === 'scale' ? 4 : v.time.kind === 'friday' ? 2 : 3;
    case 'physics':
      if (v?.type !== 'gravity') return 5;
      return v.gravity === 0 ? 8.5 : v.gravity < 0 ? 9 : v.gravity === 1 ? 4 : 6;
    case 'behavior':
      return 3 + scopeBonus(c.target) + (v?.type === 'behavior' && v.behavior === 'panic' ? 1 : 0);
    case 'move':
      return 4 + scopeBonus(c.target);
    case 'disaster':
      return v?.type === 'disaster' ? DISASTER[v.disaster] ?? 6 : 6;
    case 'heal':
    case 'give':
    case 'harm':
      return 3 + scopeBonus(c.target) * 0.5;
    case 'improv':
      return 3;
    case 'miracle':
      return 7.5;
    case 'camera':
    case 'meta':
      return 0;
  }
}
