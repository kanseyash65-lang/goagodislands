import type { EffectResult } from '../../core/events/event-types';
import { createLogger } from '../../core/logger/logger';
import { behaviorEffect, disasterEffect, moveEffect } from '../effects/behavior-effects';
import { improvEffect } from '../effects/improv-effect';
import { createMiracleEffect } from '../effects/miracle-effect';
import { cameraEffect, metaEffect } from '../effects/meta-effects';
import { giveEffect, harmEffect, healEffect, modifyEffect } from '../effects/modify-effects';
import { destroyEffect, spawnEffect, transformEffect } from '../effects/spawn-effects';
import { physicsEffect, timeEffect, weatherEffect } from '../effects/world-effects';
import type { Command, Intent } from '../types';
import type { Effect, EffectServices } from './effect-services';

const log = createLogger('executor');

/** Effect Registry: intent → effect. New behaviours register here, never in a switch. */
export class EffectRegistry {
  private readonly effects = new Map<Intent, Effect>();

  register(intent: Intent, effect: Effect): this {
    this.effects.set(intent, effect);
    return this;
  }

  get(intent: Intent): Effect | undefined {
    return this.effects.get(intent);
  }
}

export function createDefaultRegistry(): EffectRegistry {
  return new EffectRegistry()
    .register('spawn', spawnEffect)
    .register('destroy', destroyEffect)
    .register('transform', transformEffect)
    .register('modify', modifyEffect)
    .register('heal', healEffect)
    .register('harm', harmEffect)
    .register('give', giveEffect)
    .register('weather', weatherEffect)
    .register('time', timeEffect)
    .register('physics', physicsEffect)
    .register('behavior', behaviorEffect)
    .register('move', moveEffect)
    .register('disaster', disasterEffect)
    .register('camera', cameraEffect)
    .register('meta', metaEffect)
    .register('improv', improvEffect)
    .register('miracle', createMiracleEffect());
}

/**
 * Executes structured commands. Never parses, never throws: an effect failure
 * is logged and replaced by an Improv Tuesday Event so the player sees something.
 */
export class Executor {
  constructor(
    private readonly registry: EffectRegistry,
    private readonly services: EffectServices,
  ) {}

  execute(cmd: Command): EffectResult {
    const effect = this.registry.get(cmd.intent) ?? improvEffect;
    try {
      return effect.run(cmd, this.services);
    } catch (err) {
      log.error(`effect ${cmd.intent} failed for "${cmd.raw}"`, err);
      return improvEffect.run({ ...cmd, intent: 'improv', improv: 'tuesday' }, this.services);
    }
  }
}
