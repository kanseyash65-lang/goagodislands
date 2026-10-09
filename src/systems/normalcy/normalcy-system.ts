import { MAGNITUDE_MAX } from '../../core/config/command.config';
import {
  CHAOS_DECAY_PER_SEC, CHAOS_GAIN_PER_MAGNITUDE, NORMALCY_HIT_PER_MAGNITUDE, NORMALCY_RECOVERY_PER_SEC,
  NORMALCY_START, NOVELTY_DECAY,
} from '../../core/config/sim.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { ISystem } from '../system-runner';

/** Read-only view for UI/newspaper. */
export interface IMoodState {
  /** 0..100: how "normal" villagers believe today is. */
  readonly normalcy: number;
  /** 0..10: recent command intensity. */
  readonly chaos: number;
}

const NOVELTY_RECOVERY_PER_SEC = 0.01;

/**
 * Normalcy & Chaos (06 §11). Each miracle subtracts magnitude × novelty;
 * repeated miracles of the same kind are less novel (habituation).
 * Events in: CommandExecuted.
 */
export class NormalcySystem implements ISystem, IMoodState {
  readonly name = 'normalcy';
  normalcy = NORMALCY_START;
  chaos = 0;
  private readonly novelty = new Map<string, number>();

  constructor(bus: IEventBus) {
    bus.on('CommandExecuted', ({ command, result }) => {
      const key = result.reaction;
      const nov = this.novelty.get(key) ?? 1;
      this.novelty.set(key, nov * NOVELTY_DECAY);
      this.normalcy = Math.max(0, this.normalcy - command.magnitude * nov * NORMALCY_HIT_PER_MAGNITUDE);
      this.chaos = Math.min(MAGNITUDE_MAX, this.chaos + command.magnitude * CHAOS_GAIN_PER_MAGNITUDE);
    });
  }

  step(dt: number): void {
    if (this.normalcy < NORMALCY_START) this.normalcy = Math.min(NORMALCY_START, this.normalcy + NORMALCY_RECOVERY_PER_SEC * dt);
    this.chaos *= Math.pow(CHAOS_DECAY_PER_SEC, dt);
    for (const [k, v] of this.novelty) {
      if (v < 1) this.novelty.set(k, Math.min(1, v + NOVELTY_RECOVERY_PER_SEC * dt));
    }
  }
}
