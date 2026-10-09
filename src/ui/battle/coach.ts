import type { IEventBus } from '../../core/events/event-bus';
import type { BattleController, VillageStats } from '../../gameplay/battle/battle-controller';
import type { Command } from '../../commands/types';
import { el, type IPanel } from '../dom';

/** One coached moment in Mission 1. */
interface Beat {
  readonly icon: string;
  readonly title: string;
  readonly words: string;
  readonly why: string;
  readonly praise: string;
  /** When the moment arrives. */
  readonly trigger: (v: VillageStats, sinceLastDone: number) => boolean;
  /** Whether a command fulfils it. */
  readonly done: (c: Command, subject: string) => boolean;
}

const BEATS: readonly Beat[] = [
  {
    icon: '🔥', title: 'The raiders set a house on fire!', words: 'Make it rain', why: 'Rain puts out every fire.',
    praise: '🌧️ The rain saved the house! The villagers cheer.',
    trigger: (v) => v.fires > 0,
    done: (c, subject) => c.intent === 'weather' && /rain|storm/.test(subject),
  },
  {
    icon: '💔', title: 'Your villagers are losing the fight!', words: 'Increase the HP of villagers', why: 'Double their health and make them hit harder.',
    praise: '💪 Your villagers glow with divine strength!',
    trigger: (v, since) => v.raiders > 0 && (v.villagersHurt >= 2 || since > 14),
    done: (c) => (c.intent === 'modify' && c.property === 'health') || c.intent === 'heal',
  },
  {
    icon: '✨', title: 'You are a god. Try anything!', words: 'Turn the enemies into chickens', why: 'Speak any idea and the world obeys.',
    praise: '🐔 Kombi! The pirates are chickens now!',
    trigger: (v) => v.raiders >= 4 && v.wave >= 2,
    done: (c) => c.intent === 'transform',
  },
  {
    icon: '⚡', title: 'The biggest wave is here!', words: 'God, do something', why: 'Call down a divine miracle.',
    praise: '⚡ The heavens answered! Finish them off.',
    trigger: (v) => v.raiders >= 5 && v.wave >= 3,
    done: (c) => c.intent === 'miracle' || c.intent === 'disaster',
  },
];

/** While a prompt waits, the battle runs at this speed (real seconds cap). */
const COACH_SLOWMO = 0.3;
const SLOWMO_PULSE_S = 0.6;
const SLOWMO_BUDGET_S = 18;
const PRAISE_MS = 2600;
const FINALE_MS = 6500;

/**
 * Mission 1 coach: when each key moment arrives the battle slows, a big card
 * says exactly what to say (or tap), the matching power button glows, and the
 * card celebrates when you do it. Skippable; never blocks typing or tapping.
 */
export class Coach implements IPanel {
  private readonly root = el('div', 'coach');
  private readonly icon = el('div', 'coach-icon');
  private readonly title = el('div', 'coach-title');
  private readonly say = el('button', 'coach-say');
  private readonly why = el('div', 'coach-why');
  private index = 0;
  private showing = false;
  private enabled = false;
  private doneAt = 0;
  private slowSpent = 0;
  private hideTimer = 0;

  constructor(private readonly bus: IEventBus, private readonly battle: BattleController) {
    bus.on('SceneChanged', ({ scene }) => {
      this.enabled = scene === 'battle' && this.battle.mission?.order === 1;
      this.index = 0;
      this.doneAt = performance.now();
      this.hide();
    });
    bus.on('UiAction', ({ action }) => {
      if (action !== 'skip-coach') return;
      this.enabled = false;
      this.hide();
    });
    bus.on('BattleEnded', () => {
      this.enabled = false;
      this.hide();
    });
    bus.on('CommandExecuted', ({ command, result }) => this.onCommand(command, result.subject));
  }

  mount(root: HTMLElement): void {
    const label = el('div', 'coach-label', 'Say it or tap it:');
    const skip = el('button', 'coach-skip', 'Skip tutorial');
    skip.type = 'button';
    skip.addEventListener('click', () => this.bus.emit('UiAction', { action: 'skip-coach' }));
    this.say.type = 'button';
    this.say.addEventListener('click', () => this.bus.emit('CommandSubmitted', { raw: this.say.dataset['words'] ?? '', source: 'suggestion' }));
    this.root.append(this.icon, this.title, label, this.say, this.why, skip);
    this.root.hidden = true;
    root.appendChild(this.root);
  }

  /** ~4 Hz from the UI: start the next beat when its moment arrives; keep time slow while it waits. */
  update(): void {
    if (!this.enabled || !this.battle.active || this.battle.phase !== 'fighting') return;
    const beat = BEATS[this.index];
    if (!beat) return;
    const v = this.battle.villageStats();
    if (!this.showing && beat.trigger(v, (performance.now() - this.doneAt) / 1000)) this.showBeat(beat);
    if (this.showing && this.slowSpent < SLOWMO_BUDGET_S) {
      this.bus.emit('SlowMoRequested', { scale: COACH_SLOWMO, seconds: SLOWMO_PULSE_S });
      this.slowSpent += 0.25;
    }
  }

  private showBeat(b: Beat): void {
    window.clearTimeout(this.hideTimer);
    this.showing = true;
    this.slowSpent = 0;
    this.root.classList.remove('praise');
    this.icon.textContent = b.icon;
    this.title.textContent = b.title;
    this.say.textContent = `“${b.words}”`;
    this.say.dataset['words'] = b.words;
    this.why.textContent = b.why;
    this.root.hidden = false;
    document.body.classList.add('coaching');
    this.glow(b.words);
    this.bus.emit('CoachChanged', { words: b.words });
  }

  private onCommand(c: Command, subject: string): void {
    if (!this.enabled) return;
    const beat = BEATS[this.index];
    if (!beat || !beat.done(c, subject)) return;
    // Done early (before its moment) still counts: the player already knows that power.
    this.index++;
    this.doneAt = performance.now();
    this.showing = false;
    this.glow(null);
    this.root.classList.add('praise');
    this.root.hidden = false;
    this.icon.textContent = '✅';
    const last = this.index >= BEATS.length;
    this.title.textContent = last ? '🎉 You are a natural, God of Goa!' : beat.praise;
    this.say.textContent = last ? '“Summon a dragon”' : '';
    this.say.dataset['words'] = last ? 'Summon a dragon' : '';
    this.why.textContent = last ? 'Now say anything you can imagine. Try this one:' : '';
    document.body.classList.remove('coaching');
    this.bus.emit('CoachChanged', { words: null });
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), last ? FINALE_MS : PRAISE_MS);
  }

  private hide(): void {
    if (this.showing) this.bus.emit('CoachChanged', { words: null });
    this.showing = false;
    this.root.hidden = true;
    document.body.classList.remove('coaching');
    this.glow(null);
  }

  /** Makes the matching god-power button pulse. */
  private glow(words: string | null): void {
    document.querySelectorAll<HTMLElement>('.bh-power').forEach((b) => b.classList.toggle('hint', words !== null && b.dataset['words'] === words));
  }
}
