import { AI_THINK_MAX } from '../../core/config/sim.config';
import type { IRng } from '../../core/rng/mulberry32';
import { generateName } from '../../data/names';
import { hexToRgb } from '../../types/rgb';
import type { KindRegistry } from '../definitions/kinds';
import type { EntityManager } from '../entity-manager';

export interface SpawnOptions {
  readonly z?: number;
  readonly vz?: number;
  /** Real time (s) the spawn happened; drives the squash & stretch pop. */
  readonly popAt?: number;
  readonly label?: number;
}

/** Creates entities with their kind defaults applied. */
export class EntityFactory {
  constructor(
    private readonly em: EntityManager,
    private readonly kinds: KindRegistry,
    private readonly rng: IRng,
    private readonly names: IRng,
  ) {}

  spawn(kindId: number, x: number, y: number, opts: SpawnOptions = {}): number {
    const def = this.kinds.def(kindId);
    if (!def) return -1;
    const id = this.em.create(kindId, x, y);
    if (id < 0) return -1;
    const em = this.em;
    const tint = def.tintPalette ? hexToRgb(this.rng.pick(def.tintPalette)) : def.tint;
    em.tintR[id] = tint.r;
    em.tintG[id] = tint.g;
    em.tintB[id] = tint.b;
    em.scale[id] = def.scale * (def.mobility === 'static' ? this.rng.range(0.85, 1.15) : 1);
    em.variant[id] = this.rng.int(0, 255);
    em.z[id] = opts.z ?? 0;
    em.vz[id] = opts.vz ?? 0;
    em.thinkAt[id] = this.rng.range(0, AI_THINK_MAX);
    em.animTime[id] = this.rng.range(0, 10);
    if (opts.popAt !== undefined) em.spawnTime[id] = opts.popAt;
    if (opts.label !== undefined) em.labelSlot[id] = opts.label;
    if (def.mobility === 'villager') em.names.set(id, generateName(this.names));
    return id;
  }
}
