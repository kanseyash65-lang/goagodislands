import type { IEventBus } from '../../core/events/event-bus';
import type { EffectResult } from '../../core/events/event-types';
import type { IClock } from '../../core/time/clock';
import type { Command } from '../../commands/types';

export interface ChronicleEntry {
  readonly text: string;
  readonly raw: string;
  readonly magnitude: number;
  readonly minutes: number;
  readonly day: number;
  readonly result: EffectResult;
  readonly command: Command;
}

/** Read-only chronicle for the newspaper and UI. */
export interface IChronicle {
  readonly entries: readonly ChronicleEntry[];
  latestBig(minMagnitude: number): ChronicleEntry | undefined;
}

const MAX_ENTRIES = 60;

/**
 * Minimal Chronicle (full incident naming arrives in M4): records every executed
 * command's result line with its in-world time.
 * Events in: CommandExecuted. Events out: ChronicleEntryAdded.
 */
export class Chronicle implements IChronicle {
  readonly entries: ChronicleEntry[] = [];

  constructor(bus: IEventBus, clock: IClock) {
    bus.on('CommandExecuted', ({ command, result }) => {
      if (command.intent === 'camera' || command.intent === 'meta') return; // not history
      const entry: ChronicleEntry = {
        text: result.text,
        raw: command.raw,
        magnitude: command.magnitude,
        minutes: clock.minutes,
        day: clock.day,
        result,
        command,
      };
      this.entries.push(entry);
      if (this.entries.length > MAX_ENTRIES) this.entries.shift();
      bus.emit('ChronicleEntryAdded', { text: entry.text, magnitude: entry.magnitude, minutes: entry.minutes, day: entry.day });
    });
  }

  latestBig(minMagnitude: number): ChronicleEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      if (e && e.magnitude >= minMagnitude) return e;
    }
    return this.entries[this.entries.length - 1];
  }
}
