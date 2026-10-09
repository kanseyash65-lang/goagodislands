import { PRONOUN_TTL_SECONDS } from '../../core/config/command.config';
import type { Command } from '../types';

/**
 * Follow-up memory (05 §11): last affected entities for "it/them", and the last
 * executed chain for "again"/"more". Times are real seconds.
 */
export class CommandContext {
  private lastIds: number[] = [];
  private lastAt = -Infinity;
  private chain: Command[] = [];
  private pendingChain: Command[] = [];

  setTargets(ids: readonly number[], now: number): void {
    if (ids.length === 0) return;
    this.lastIds = ids.slice();
    this.lastAt = now;
  }

  hasTargets(now: number): boolean {
    return this.lastIds.length > 0 && now - this.lastAt <= PRONOUN_TTL_SECONDS;
  }

  pronounIds(now: number): readonly number[] {
    return this.hasTargets(now) ? this.lastIds : [];
  }

  /** Records an executed command; a new chain starts at chainIndex 0. */
  recordExecuted(cmd: Command): void {
    if (cmd.intent === 'meta' || cmd.intent === 'camera') return;
    if (cmd.chainIndex === 0) this.pendingChain = [];
    this.pendingChain.push(cmd);
    this.chain = this.pendingChain.slice();
  }

  /** Forget follow-ups (entity ids are reused after a scene change). */
  clear(): void {
    this.lastIds = [];
    this.lastAt = -Infinity;
  }

  lastChain(): readonly Command[] {
    return this.chain;
  }
}
