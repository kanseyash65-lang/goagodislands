import type { PropertyName, Value } from '../../commands/types';
import type { IRng } from '../../core/rng/mulberry32';
import { MOODS } from '../../types/behavior';
import { hslToRgb } from '../../types/rgb';
import { ENTITY_FLAG, type EntityManager } from '../entity-manager';

/**
 * Property Registry: every voice-editable property is described as data.
 * The executor only ever calls `apply`, so new kinds need no command changes.
 */
export interface PropertyDef {
  readonly name: PropertyName;
  readonly aliases: readonly string[];
  /** Applies a value to one entity. Returns false if the value does not fit. */
  apply(em: EntityManager, id: number, value: Value, rng: IRng): boolean;
}

const SCALE_MIN = 0.15;
const SCALE_MAX = 8;
const SPEED_MIN = 0.05;
const SPEED_MAX = 8;
const GLOW_BOOST = 1.35;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const color: PropertyDef = {
  name: 'color',
  aliases: ['colour', 'tint', 'shade', 'paint'],
  apply(em, id, value, rng) {
    if (value.type !== 'color') return false;
    em.flags[id] = (em.flags[id] ?? 0) & ~ENTITY_FLAG.RAINBOW;
    em.opacity[id] = 1;
    em.glow[id] = 0;
    let c = value.rgb;
    if (value.special === 'rainbow') em.flags[id] = (em.flags[id] ?? 0) | ENTITY_FLAG.RAINBOW;
    if (value.special === 'invisible') em.opacity[id] = 0;
    if (value.special === 'random') c = hslToRgb(rng.next(), 0.75, 0.6);
    const boost = value.special === 'glowing' ? GLOW_BOOST : 1;
    if (value.special === 'glowing') em.glow[id] = 1;
    em.tintR[id] = c.r * boost;
    em.tintG[id] = c.g * boost;
    em.tintB[id] = c.b * boost;
    return true;
  },
};

const size: PropertyDef = {
  name: 'size',
  aliases: ['scale', 'big', 'small'],
  apply(em, id, value) {
    if (value.type !== 'size') return false;
    const cur = em.scale[id] ?? 1;
    em.scale[id] = clamp(value.relative ? cur * value.factor : value.factor, SCALE_MIN, SCALE_MAX);
    return true;
  },
};

const speed: PropertyDef = {
  name: 'speed',
  aliases: ['fast', 'slow', 'velocity'],
  apply(em, id, value) {
    if (value.type !== 'speed') return false;
    const cur = em.speedMul[id] ?? 1;
    em.speedMul[id] = clamp(value.relative ? cur * value.factor : value.factor, SPEED_MIN, SPEED_MAX);
    return true;
  },
};

const mood: PropertyDef = {
  name: 'mood',
  aliases: ['happiness', 'feeling', 'emotion'],
  apply(em, id, value) {
    if (value.type !== 'mood') return false;
    em.mood[id] = Math.max(0, MOODS.indexOf(value.mood));
    return true;
  },
};

const HP_BASE = 100;
const HP_MAX = 20000;
/** Blessed units also hit harder: half the HP factor goes to damage, capped. */
const DMG_SHARE = 0.5;
const DMG_MUL_MAX = 4;

/** Hit points: a factor > 1 raises max HP, fully heals and emboldens (more damage); < 1 weakens. */
const health: PropertyDef = {
  name: 'health',
  aliases: ['hp', 'life', 'lives', 'strength', 'toughness'],
  apply(em, id, value) {
    if (value.type !== 'health') return false;
    const max = (em.maxHp[id] ?? 0) > 0 ? (em.maxHp[id] ?? 0) : HP_BASE;
    const next = clamp(max * value.factor, 1, HP_MAX);
    em.maxHp[id] = next;
    em.hp[id] = value.factor >= 1 ? next : Math.min(em.hp[id] ?? next, next);
    em.dmgMul[id] = clamp((em.dmgMul[id] ?? 1) * (1 + (value.factor - 1) * DMG_SHARE), 0.1, DMG_MUL_MAX);
    em.glow[id] = value.factor >= 1 ? 1 : 0;
    return true;
  },
};

export class PropertyRegistry {
  private readonly defs = new Map<string, PropertyDef>();

  constructor(defs: readonly PropertyDef[] = [color, size, speed, mood, health]) {
    for (const d of defs) {
      this.defs.set(d.name, d);
      for (const a of d.aliases) this.defs.set(a, d);
    }
  }

  get(name: string): PropertyDef | undefined {
    return this.defs.get(name);
  }

  /** Infers the property a value implies ("green" ⇒ color, "giant" ⇒ size). */
  inferFor(value: Value): PropertyDef | undefined {
    switch (value.type) {
      case 'color': return this.defs.get('color');
      case 'size': return this.defs.get('size');
      case 'speed': return this.defs.get('speed');
      case 'mood': return this.defs.get('mood');
      case 'health': return this.defs.get('health');
      default: return undefined;
    }
  }
}
