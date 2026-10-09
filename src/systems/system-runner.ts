import { SYSTEM_COOLDOWN_SECONDS, SYSTEM_MAX_FAILURES } from '../core/config/sim.config';
import { createLogger } from '../core/logger/logger';

const log = createLogger('systems');

/** A simulation system. Owns its logic; communicates only through events/services. */
export interface ISystem {
  readonly name: string;
  /** Fixed-step update. `t` is sim time in seconds. */
  step(dt: number, t: number): void;
}

interface Slot {
  readonly system: ISystem;
  failures: number;
  disabledUntil: number;
  ms: number;
}

/**
 * Runs systems in registration order with failure isolation: a system that
 * throws 3 times in a row is paused for 10 s while the world keeps going.
 */
export class SystemRunner {
  private readonly slots: Slot[] = [];
  private wall = 0;

  add(system: ISystem): void {
    this.slots.push({ system, failures: 0, disabledUntil: 0, ms: 0 });
  }

  step(dt: number, t: number): void {
    this.wall += dt;
    for (const s of this.slots) {
      if (this.wall < s.disabledUntil) continue;
      const start = performance.now();
      try {
        s.system.step(dt, t);
        s.failures = 0;
      } catch (err) {
        s.failures++;
        log.error(`${s.system.name} failed (${s.failures})`, err);
        if (s.failures >= SYSTEM_MAX_FAILURES) {
          s.disabledUntil = this.wall + SYSTEM_COOLDOWN_SECONDS;
          s.failures = 0;
        }
      }
      s.ms += (performance.now() - start - s.ms) * 0.1;
    }
  }

  /** Per-system timings (ms, smoothed) for the debug overlay. */
  timings(): { name: string; ms: number }[] {
    return this.slots.map((s) => ({ name: s.system.name, ms: s.ms }));
  }
}
