import { hexToRgb, type Rgb } from '../../types/rgb';

/**
 * Entity kinds as data. Adding a kind here (plus a model) makes it spawnable,
 * targetable and modifiable by voice with no command-engine changes.
 * Goa edition: no chickens. Coconut palms, cows on the beach, Portuguese houses.
 */
export type Mobility =
  | 'villager' | 'animal' | 'flyer' | 'static' | 'cloud' | 'celestial' | 'thing' | 'prop'
  | 'troop' | 'boat' | 'env';

export interface KindDef {
  readonly name: string;
  readonly label: string;
  readonly plural: string;
  readonly tags: readonly string[];
  readonly mobility: Mobility;
  readonly scale: number;
  readonly tint: Rgb;
  /** Walk speed in units per second. */
  readonly speed: number;
  /** Participates in z-gravity (floats when gravity is deleted). */
  readonly physics: boolean;
  readonly spawnable: boolean;
  /** Random per-entity tint palette (houses, things). */
  readonly tintPalette?: readonly string[];
}

const LIVING = ['living'];
const HUMAN = [...LIVING, 'human', 'villager'];
const ANIMAL = [...LIVING, 'animal'];
const BUILDING = ['building', 'structure'];
const PLANT = ['plant', 'natural', 'burnable'];
const MILITARY = [...BUILDING, 'military'];
const DEFENSE = [...MILITARY, 'defense'];
const ECONOMY = [...BUILDING, 'economy'];
const TROOP = [...LIVING, 'human', 'troop', 'soldier'];

type Def = Omit<KindDef, 'tint' | 'label' | 'plural' | 'scale' | 'speed' | 'physics' | 'spawnable'> & {
  tint: string; label?: string; plural?: string; scale?: number; speed?: number; physics?: boolean; spawnable?: boolean;
};

function k(d: Def): KindDef {
  const label = d.label ?? d.name.replace(/-/g, ' ');
  return {
    ...d,
    tint: hexToRgb(d.tint),
    label,
    plural: d.plural ?? `${label}s`,
    scale: d.scale ?? 1,
    speed: d.speed ?? 0,
    physics: d.physics ?? true,
    spawnable: d.spawnable ?? true,
  };
}

const villager = (name: string, tint: string, speed: number, scale = 1): KindDef =>
  k({ name, tags: [...HUMAN, name], mobility: 'villager', tint, speed, scale });
const building = (name: string, tags: readonly string[], tint: string, extra: Partial<Def> = {}): KindDef =>
  k({ name, tags, mobility: 'static', tint, ...extra });
const troop = (name: string, speed: number, extra: Partial<Def> = {}): KindDef =>
  k({ name, tags: [...TROOP, name], mobility: 'troop', tint: '#3f7fd0', speed, ...extra });

export const KIND_DEFS: readonly KindDef[] = [
  villager('fisherman', '#2f7fbf', 2.2),
  villager('farmer', '#e0b84a', 2.1),
  villager('vendor', '#d9467a', 1.9),
  villager('tourist', '#f07a3a', 1.6),
  villager('child', '#7ac35a', 2.8, 0.75),
  villager('elder', '#e8e2d0', 1.4),
  k({ name: 'cow', tags: [...ANIMAL, 'livestock'], mobility: 'animal', tint: '#f2eee6', speed: 0.9 }),
  k({ name: 'dog', tags: [...ANIMAL, 'pet'], mobility: 'animal', tint: '#c08a58', speed: 3 }),
  k({ name: 'cat', tags: [...ANIMAL, 'pet'], mobility: 'animal', tint: '#f29a4c', speed: 2.2 }),
  k({ name: 'chicken', tags: [...ANIMAL, 'bird', 'livestock'], mobility: 'animal', tint: '#ffffff', speed: 1.8 }),
  k({ name: 'duck', tags: [...ANIMAL, 'bird'], mobility: 'animal', tint: '#ffe873', speed: 1.6 }),
  k({ name: 'dragon', tags: [...ANIMAL, 'magical', 'flying'], mobility: 'animal', tint: '#3fbfa8', speed: 2.4 }),
  k({ name: 'crow', tags: [...ANIMAL, 'bird', 'flying'], mobility: 'flyer', tint: '#2b2b33', speed: 6, physics: false }),
  k({ name: 'palm', label: 'coconut palm', plural: 'coconut palms', tags: [...PLANT, 'tree', 'palm', 'wooden'], mobility: 'static', tint: '#5fae3e' }),
  k({ name: 'banana', label: 'banana plant', plural: 'banana plants', tags: [...PLANT, 'tree'], mobility: 'static', tint: '#7cc548' }),
  k({ name: 'bush', plural: 'bushes', tags: [...PLANT], mobility: 'static', tint: '#4e9a3a' }),
  k({ name: 'hibiscus', plural: 'hibiscus', tags: [...PLANT, 'flower'], mobility: 'static', tint: '#e8344a' }),
  k({ name: 'rock', tags: ['natural', 'stone'], mobility: 'static', tint: '#b9b2a6' }),
  k({ name: 'cliff', tags: ['natural', 'stone'], mobility: 'static', tint: '#c9a07a', physics: false, spawnable: false }),
  building('house', [...BUILDING, 'goan', 'wooden'], '#f2c84b', { tintPalette: ['#f2c84b', '#4fa3e0', '#e86a9a', '#6cc06a', '#f08a3c', '#9d7be0'] }),
  building('chapel', [...BUILDING, 'goan'], '#ffffff'),
  building('shack', [...BUILDING, 'goan', 'wooden'], '#e8463c', { tintPalette: ['#e8463c', '#3cb4e8', '#f2c230', '#5cd07a'] }),
  building('market', [...BUILDING, 'goan'], '#e8463c'),
  building('well', [...BUILDING, 'stone'], '#c9b9a0'),
  building('windmill', [...BUILDING, 'wooden'], '#efe3c8'),
  building('lighthouse', [...BUILDING, 'goan'], '#e8463c'),
  building('fort-tower', [...BUILDING, 'stone', 'fort'], '#b8643c', { label: 'fort tower' }),
  building('jetty', [...BUILDING, 'wooden'], '#9a6a40', { physics: false }),
  building('fishing-boat', ['boat', 'wooden'], '#3cb4e8', { label: 'fishing boat', tintPalette: ['#3cb4e8', '#e8463c', '#f2c230', '#5cd07a'], physics: false }),
  building('hq', [...MILITARY, 'hq'], '#3f7fd0', { label: 'headquarters', plural: 'headquarters' }),
  building('cannon', [...DEFENSE], '#3f7fd0'),
  building('machine-gun', [...DEFENSE], '#3f7fd0', { label: 'machine gun' }),
  building('mortar', [...DEFENSE], '#3f7fd0'),
  building('sniper-tower', [...DEFENSE], '#3f7fd0', { label: 'sniper tower' }),
  building('mine', [...DEFENSE, 'hidden'], '#3f7fd0', { physics: false }),
  building('bunker', [...DEFENSE], '#3f7fd0'),
  building('cage', [...MILITARY, 'cage'], '#9a7a40'),
  building('supply-depot', [...MILITARY, 'depot'], '#3f7fd0', { label: 'supply depot' }),
  building('wall', [...MILITARY, 'stone'], '#b8643c'),
  building('residence', [...ECONOMY, 'goan'], '#f2c84b', { tintPalette: ['#f2c84b', '#4fa3e0', '#e86a9a', '#6cc06a'] }),
  building('sawmill', [...ECONOMY], '#9a6a40'),
  building('quarry', [...ECONOMY, 'stone'], '#b9b2a6'),
  building('iron-mine', [...ECONOMY], '#7a8494', { label: 'iron mine' }),
  building('vault', [...ECONOMY, 'storage'], '#f2c230'),
  building('timber-store', [...ECONOMY, 'storage'], '#9a6a40', { label: 'timber store' }),
  building('stone-store', [...ECONOMY, 'storage'], '#b9b2a6', { label: 'stone store' }),
  building('metal-store', [...ECONOMY, 'storage'], '#7a8494', { label: 'metal store' }),
  building('armory', [...ECONOMY, 'military'], '#3f7fd0'),
  building('barracks', [...ECONOMY, 'military'], '#5c7a3a'),
  building('dock', [...ECONOMY, 'military'], '#9a6a40', { physics: false }),
  building('radar', [...ECONOMY], '#d8dde6'),
  troop('rifleman', 3.2),
  troop('heavy', 2.1, { label: 'heavy gunner' }),
  troop('rocketeer', 2.5),
  troop('medic', 3),
  troop('engineer', 3.4),
  troop('commander', 1.8, { scale: 1.35 }),
  k({ name: 'landing-craft', label: 'landing craft', plural: 'landing craft', tags: ['boat', 'military'], mobility: 'boat', tint: '#3f7fd0', speed: 9, physics: false }),
  k({ name: 'gunboat', tags: ['boat', 'military'], mobility: 'boat', tint: '#3f7fd0', speed: 4, physics: false, spawnable: false }),
  k({ name: 'thing', tags: ['prop', 'magical'], mobility: 'thing', tint: '#ffffff', tintPalette: ['#ff8c8c', '#8cd9ff', '#ffd98c', '#b8ff8c', '#e0a6ff', '#ffb3e6'] }),
  k({ name: 'crate', tags: ['prop'], mobility: 'prop', tint: '#b8864a' }),
  k({ name: 'coin', tags: ['prop'], mobility: 'prop', tint: '#ffd24d' }),
  k({ name: 'pizza', tags: ['prop', 'edible'], mobility: 'prop', tint: '#ffffff' }),
  k({ name: 'fish', tags: ['prop', 'edible'], mobility: 'prop', tint: '#9ad0e8' }),
  k({ name: 'sun', tags: ['celestial', 'env'], mobility: 'celestial', tint: '#fff1c8', physics: false, spawnable: false }),
  k({ name: 'moon', tags: ['celestial', 'env'], mobility: 'celestial', tint: '#dfe6ff', physics: false, spawnable: false }),
  k({ name: 'sea', tags: ['env', 'water'], mobility: 'env', tint: '#ffffff', physics: false, spawnable: false }),
  k({ name: 'cloud', tags: ['sky', 'natural'], mobility: 'cloud', tint: '#ffffff', physics: false }),
];

/** Kind lookup by name/id and by tag. */
export class KindRegistry {
  private readonly byName = new Map<string, number>();
  private readonly byTag = new Map<string, number[]>();

  constructor(readonly defs: readonly KindDef[] = KIND_DEFS) {
    defs.forEach((d, i) => {
      this.byName.set(d.name, i);
      for (const t of d.tags) {
        const list = this.byTag.get(t) ?? [];
        list.push(i);
        this.byTag.set(t, list);
      }
    });
  }

  id(name: string): number {
    return this.byName.get(name) ?? -1;
  }

  def(id: number): KindDef | undefined {
    return this.defs[id];
  }

  name(id: number): string {
    return this.defs[id]?.name ?? '';
  }

  kindsWithTag(tag: string): readonly number[] {
    return this.byTag.get(tag) ?? [];
  }

  hasTag(id: number, tag: string): boolean {
    return this.defs[id]?.tags.includes(tag) ?? false;
  }
}
