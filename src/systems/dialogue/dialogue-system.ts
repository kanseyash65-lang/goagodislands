import {
  AMBIENT_CHATTER_SECONDS, BUBBLE_HISTORY_PER_NPC, BUBBLE_NPC_COOLDOWN_MS, HABITUATION_AFTER, REACTION_SPEAKERS,
} from '../../core/config/ui.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { EffectResult, ReactionKind } from '../../core/events/event-types';
import type { IRng } from '../../core/rng/mulberry32';
import { isInView, type IViewInfo } from '../../core/services/view-info';
import type { IClock } from '../../core/time/clock';
import { AMBIENT_LINES, HABITUATION_LINES, NIGHT_LINES, REACTION_LINES } from '../../data/dialogue';
import { MOB, type KindTables } from '../../entities/definitions/mobility-codes';
import type { EntityManager } from '../../entities/entity-manager';
import { STATE } from '../../types/behavior';
import { isNight } from '../ai/brain-system';
import type { ISystem } from '../system-runner';

interface PendingReaction {
  readonly at: number;
  readonly result: EffectResult;
  readonly guaranteed: boolean;
}

const REACTION_DELAY_S = 0.35;
const REACTION_STAGGER_S = 0.6;
const HABITUATION_CHANCE = 0.5;
const PRIORITY_AMBIENT = 1;
const PRIORITY_REACTION = 2;
const PRIORITY_LEAD = 3;
const VIEW_MARGIN = 12;

/**
 * Chooses who speaks and what they say. Runs on real time so villagers can
 * still comment when sim time is frozen. Events in: CommandExecuted.
 * Events out: DialogueSpoken (the UI bubble layer decides what is shown).
 */
export class DialogueSystem implements ISystem {
  readonly name = 'dialogue';
  private now = 0;
  private nextAmbient = AMBIENT_CHATTER_SECONDS;
  private readonly pending: PendingReaction[] = [];
  private readonly lines: { readonly at: number; readonly id: number; readonly text: string; readonly priority: number }[] = [];
  private readonly cooldownUntil = new Map<number, number>();
  private readonly history = new Map<number, string[]>();
  private readonly reactionCounts = new Map<ReactionKind, number>();
  private commandsSeen = 0;

  constructor(
    private readonly em: EntityManager,
    private readonly tables: KindTables,
    private readonly bus: IEventBus,
    private readonly view: IViewInfo,
    private readonly clock: IClock,
    private readonly rng: IRng,
  ) {
    bus.on('CommandExecuted', ({ result }) => {
      if (result.reaction === 'none') return;
      this.commandsSeen++;
      // First command always gets a strong reaction (02 §11).
      this.pending.push({ at: this.now + REACTION_DELAY_S, result, guaranteed: this.commandsSeen === 1 });
    });
  }

  step(dt: number): void {
    this.now += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (p && p.at <= this.now) {
        this.pending.splice(i, 1);
        this.react(p);
      }
    }
    this.flushLines();
    if (this.now >= this.nextAmbient) {
      this.nextAmbient = this.now + AMBIENT_CHATTER_SECONDS * this.rng.range(0.6, 1.4);
      this.ambient();
    }
  }

  private react(p: PendingReaction): void {
    const r = p.result;
    const count = (this.reactionCounts.get(r.reaction) ?? 0) + 1;
    this.reactionCounts.set(r.reaction, count);
    const speakers = this.pickSpeakers(r.hasFocus ? r.focusX : this.view.centerX, r.hasFocus ? r.focusY : this.view.centerY, REACTION_SPEAKERS, p.guaranteed);
    speakers.forEach((id, n) => {
      const bank = count > HABITUATION_AFTER && this.rng.chance(HABITUATION_CHANCE) ? HABITUATION_LINES : REACTION_LINES[r.reaction];
      const text = this.pickLine(id, bank, r.subject);
      if (!text) return;
      // Stagger so bubbles land one after another rather than all at once.
      this.lines.push({ at: this.now + n * REACTION_STAGGER_S, id, text, priority: n === 0 ? PRIORITY_LEAD : PRIORITY_REACTION });
    });
  }

  private flushLines(): void {
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      if (l && l.at <= this.now) {
        this.lines.splice(i, 1);
        if (this.em.alive[l.id] === 1) this.say(l.id, l.text, l.priority);
      }
    }
  }

  private ambient(): void {
    const [id] = this.pickSpeakers(this.view.centerX, this.view.centerY, 1, false, true);
    if (id === undefined) return;
    const bank = isNight(this.clock.minutes) ? NIGHT_LINES : AMBIENT_LINES;
    const line = this.pickLine(id, bank, '');
    if (line) this.say(id, line, PRIORITY_AMBIENT);
  }

  /** Nearest awake villagers to (x, y), preferring those on screen. */
  private pickSpeakers(x: number, y: number, n: number, ignoreCooldown: boolean, randomize = false): number[] {
    const em = this.em;
    const cands: { id: number; d: number }[] = [];
    const nowMs = this.now * 1000;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1 || this.tables.mobility[em.kind[i] ?? 0] !== MOB.VILLAGER) continue;
      if (em.state[i] === STATE.SLEEP) continue;
      if (!ignoreCooldown && (this.cooldownUntil.get(i) ?? 0) > nowMs) continue;
      const ex = em.x[i] ?? 0;
      const ey = em.y[i] ?? 0;
      const offscreen = isInView(this.view, ex, ey, VIEW_MARGIN) ? 0 : 1e6;
      const d = randomize ? this.rng.next() * 1000 + offscreen : Math.hypot(ex - x, ey - y) + offscreen;
      cands.push({ id: i, d });
    }
    cands.sort((a, b) => a.d - b.d);
    return cands.slice(0, n).map((c) => c.id);
  }

  private pickLine(id: number, bank: readonly string[], subject: string): string | undefined {
    if (bank.length === 0) return undefined;
    const hist = this.history.get(id) ?? [];
    let line = this.rng.pick(bank);
    for (let tries = 0; tries < 4 && hist.includes(line); tries++) line = this.rng.pick(bank);
    hist.push(line);
    if (hist.length > BUBBLE_HISTORY_PER_NPC) hist.shift();
    this.history.set(id, hist);
    return line.split('{thing}').join(subject || 'that');
  }

  private say(id: number, text: string, priority: number): void {
    this.cooldownUntil.set(id, this.now * 1000 + BUBBLE_NPC_COOLDOWN_MS);
    this.bus.emit('DialogueSpoken', { id, text: capitalize(text), priority });
  }
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
