import type { IEventBus } from '../../core/events/event-bus';
import type { EffectResult } from '../../core/events/event-types';
import type { IRng } from '../../core/rng/mulberry32';
import type { IViewInfo } from '../../core/services/view-info';
import type { IClock } from '../../core/time/clock';
import type { KindRegistry } from '../../entities/definitions/kinds';
import type { EntityManager } from '../../entities/entity-manager';
import type { EntityFactory } from '../../entities/factory/entity-factory';
import type { LabelRegistry } from '../../entities/labels/label-registry';
import type { PropertyRegistry } from '../../entities/properties/property-registry';
import type { WorldLayout } from '../../world/world-layout';
import type { WorldParams } from '../../world/world-params';
import type { CommandContext } from '../context/command-context';
import type { Command } from '../types';

/** Services an effect may use. Effects mutate only through these. */
export interface EffectServices {
  readonly em: EntityManager;
  readonly kinds: KindRegistry;
  readonly factory: EntityFactory;
  readonly props: PropertyRegistry;
  readonly params: WorldParams;
  readonly clock: IClock;
  readonly bus: IEventBus;
  readonly rng: IRng;
  readonly view: IViewInfo;
  readonly layout: WorldLayout;
  readonly labels: LabelRegistry;
  readonly context: CommandContext;
  /** Real time in seconds (drives juice timing and pronoun TTL). */
  readonly realTime: () => number;
  /** Battle hooks for god powers (damage, fire). */
  readonly powers: GodPowers;
  /** Runs `fn` after `seconds` of real time (temporary effects revert). */
  readonly schedule: (seconds: number, fn: () => void) => void;
}

/** What god powers may do to the battle (implemented by the combat and fire systems). */
export interface GodPowers {
  /** True during a defense mission (summoned beasts fight, spawns are capped). */
  inBattle(): boolean;
  damage(id: number, amount: number): void;
  ignite(id: number): boolean;
  extinguishAll(): number;
  burning(): number;
}

/** One effect family. Must never throw (the executor still guards it). */
export interface Effect {
  run(cmd: Command, s: EffectServices): EffectResult;
}

export interface ResultOptions {
  readonly ids?: readonly number[];
  readonly affected?: number;
  readonly focus?: { readonly x: number; readonly y: number };
  readonly reaction?: EffectResult['reaction'];
  readonly subject?: string;
  readonly improvised?: boolean;
}

export function result(text: string, o: ResultOptions = {}): EffectResult {
  return {
    text,
    focusX: o.focus?.x ?? 0,
    focusY: o.focus?.y ?? 0,
    hasFocus: o.focus !== undefined,
    ids: o.ids ?? [],
    affected: o.affected ?? o.ids?.length ?? 0,
    reaction: o.reaction ?? 'generic',
    subject: o.subject ?? '',
    improvised: o.improvised ?? false,
  };
}
