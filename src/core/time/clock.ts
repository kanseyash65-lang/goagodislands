import { GAME_MINUTES_PER_SECOND, MINUTES_PER_DAY, START_MINUTES } from '../config/sim.config';

/** Read-only view of game time plus the few setters commands are allowed to use. */
export interface IClock {
  /** Sim seconds elapsed (stops when time is frozen). */
  readonly simTime: number;
  /** Minutes since midnight, 0..1440. */
  readonly minutes: number;
  readonly day: number;
  readonly timeScale: number;
  readonly frozen: boolean;
  setMinutes(minutes: number): void;
  setTimeScale(scale: number): void;
  setFrozen(frozen: boolean): void;
}

/** Game clock: 1 real second = 1 game minute by default. It is always Tuesday. */
export class GameClock implements IClock {
  simTime = 0;
  minutes = START_MINUTES;
  day = 1;
  timeScale = 1;
  frozen = false;

  advance(dt: number): void {
    if (this.frozen) return;
    this.simTime += dt;
    this.minutes += dt * GAME_MINUTES_PER_SECOND * this.timeScale;
    while (this.minutes >= MINUTES_PER_DAY) {
      this.minutes -= MINUTES_PER_DAY;
      this.day += 1;
    }
  }

  setMinutes(minutes: number): void {
    const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (m < this.minutes) this.day += 1; // jumping "back" to morning means tomorrow
    this.minutes = m;
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
