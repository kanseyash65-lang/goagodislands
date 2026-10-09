import { CHAIN_STAGGER_MS, SPAWN_MAX_PER_COMMAND } from '../core/config/command.config';
import type { IEventBus } from '../core/events/event-bus';
import { createLogger } from '../core/logger/logger';
import { firstName } from '../data/names';
import type { CommandContext } from './context/command-context';
import type { Executor } from './executor/executor';
import { parseTranscript } from './parser/parser';
import type { Command, CommandSource } from './types';

const log = createLogger('commands');

interface Queued {
  readonly at: number;
  readonly cmd: Command;
}

interface Scheduled {
  readonly at: number;
  readonly fn: () => void;
}

/**
 * Transcript in → queued, staggered execution out. Expands "again"/"more",
 * never drops a command (queues while busy), and runs scheduled reverts.
 * Events in: CommandSubmitted. Events out: CommandParsed, CommandExecuted.
 */
export class CommandManager {
  private readonly queue: Queued[] = [];
  private readonly scheduled: Scheduled[] = [];
  private nextId = 1;
  private nowMs = 0;

  constructor(
    private readonly bus: IEventBus,
    private readonly executor: Executor,
    private readonly context: CommandContext,
    private readonly villagerNames: () => Iterable<string>,
  ) {
    bus.on('CommandSubmitted', ({ raw, source }) => this.submit(raw, source));
  }

  /** Real-time scheduler shared with effects (temporary effects revert). */
  schedule(seconds: number, fn: () => void): void {
    this.scheduled.push({ at: this.nowMs + seconds * 1000, fn });
  }

  submit(raw: string, source: CommandSource): void {
    const names = [...new Set([...this.villagerNames()].map(firstName))];
    const parsed = parseTranscript(raw, source, {
      names,
      hasLastTarget: this.context.hasTargets(this.nowMs / 1000),
      nextId: () => this.nextId++,
    });
    const cmds = parsed.flatMap((c) => this.expandRepeats(c));
    this.bus.emit('CommandParsed', { raw, commands: cmds });
    const start = Math.max(this.nowMs, this.queue[this.queue.length - 1]?.at ?? 0);
    cmds.forEach((cmd, i) => this.queue.push({ at: start + i * CHAIN_STAGGER_MS, cmd }));
  }

  update(nowMs: number): void {
    this.nowMs = nowMs;
    while (this.queue.length > 0 && (this.queue[0]?.at ?? Infinity) <= nowMs) {
      const q = this.queue.shift();
      if (q) this.run(q.cmd);
    }
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const s = this.scheduled[i];
      if (s && s.at <= nowMs) {
        this.scheduled.splice(i, 1);
        try {
          s.fn();
        } catch (err) {
          log.error('scheduled revert failed', err);
        }
      }
    }
  }

  private run(cmd: Command): void {
    const result = this.executor.execute(cmd);
    this.context.recordExecuted(cmd);
    this.bus.emit('CommandExecuted', { command: cmd, result });
  }

  /** "again" replays the last chain; "more" replays it with doubled quantities. */
  private expandRepeats(c: Command): Command[] {
    if (c.intent !== 'meta' || c.value?.type !== 'meta' || (c.value.action !== 'repeat' && c.value.action !== 'more')) return [c];
    const last = this.context.lastChain();
    if (last.length === 0) return [{ ...c, intent: 'improv', improv: 'tuesday' }];
    const more = c.value.action === 'more';
    return last.map((l, i) => ({
      ...l,
      id: this.nextId++,
      raw: c.raw,
      source: c.source,
      chainIndex: i,
      chainLength: last.length,
      ...(more && l.quantity !== undefined ? { quantity: Math.min(SPAWN_MAX_PER_COMMAND, l.quantity * 2) } : {}),
    }));
  }
}
