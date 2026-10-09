import type { IEventBus } from '../../core/events/event-bus';
import type { IRng } from '../../core/rng/mulberry32';
import type { EntityManager } from '../../entities/entity-manager';
import type { CombatTables } from '../combat/combat-tables';

/** Speech priority above every ambient line: the only bubbles allowed mid-mission. */
export const SHOUT_PRIORITY = 9;
const MIN_GAP_MS = 1400;

/** Short Konkani shouts (with English) for the big moments of a defense. */
const LINES: Readonly<Record<string, readonly string[]>> = {
  rain: ['Paus ailo! (The rain is here!)', 'Dev borem korum! (God bless!)', 'Uzo vosson gelo! (The fire is out!)'],
  strong: ['Hanv bolvont zalo! (I feel strong!)', 'Chol, zhuzonk! (Come on, fight!)', 'Dev amchea sangata! (God is with us!)'],
  miracle: ['Dhanyavad, Deva! (Thank you, God!)', 'Dev amchea sangata! (God is with us!)', 'Ojeap! (A miracle!)'],
  chickens: ['Kombi! Kombi! 🐔', 'Pirates zale kombi! (The pirates are chickens!)', 'Aiz kombichi koddi! (Chicken curry tonight!)'],
  dragon: ['Amcho dragon! (Our dragon!)', 'Uzo kadd, dragon! (Breathe fire, dragon!)'],
  landing: ['Pirates aile! (Pirates are here!)', 'Sambhal! (Watch out!)', 'Deva, rakh amkam! (God, protect us!)'],
  victory: ['Viva Goa! Dev borem korum!', 'Ami jikleat! (We won!)'],
};

/**
 * Villagers cheer and shout in Konkani when the god acts or the battle turns.
 * Emits DialogueSpoken at SHOUT_PRIORITY from a random fighting villager.
 */
export class ShoutDirector {
  private lastAt = 0;
  private active = false;

  constructor(private readonly bus: IEventBus, private readonly em: EntityManager, private readonly tables: CombatTables, private readonly rng: IRng) {
    bus.on('SceneChanged', ({ scene }) => { this.active = scene === 'battle'; });
    bus.on('CommandExecuted', ({ command, result }) => {
      if (!this.active || (result.affected === 0 && command.intent !== 'weather')) return;
      const key = this.keyFor(command.intent, command.property, result.subject);
      if (key) window.setTimeout(() => this.shout(key), 600);
    });
    bus.on('ToastRequested', ({ text }) => {
      if (this.active && text.includes('is landing')) this.shout('landing');
    });
    bus.on('BattleEnded', ({ victory }) => { if (victory) this.shout('victory', true); });
  }

  private keyFor(intent: string, property: string | undefined, subject: string): string | undefined {
    if (intent === 'weather' && /rain|storm/.test(subject)) return 'rain';
    if (intent === 'modify' && property === 'health') return 'strong';
    if (intent === 'heal') return 'strong';
    if (intent === 'miracle' || intent === 'disaster') return 'miracle';
    if (intent === 'transform' && subject.includes('chicken')) return 'chickens';
    if (intent === 'spawn' && subject.includes('dragon')) return 'dragon';
    return undefined;
  }

  private shout(key: string, force = false): void {
    const now = performance.now();
    if (!force && now - this.lastAt < MIN_GAP_MS) return;
    const lines = LINES[key];
    const speaker = this.pickVillager();
    if (!lines || speaker < 0) return;
    this.lastAt = now;
    this.bus.emit('DialogueSpoken', { id: speaker, text: this.rng.pick(lines), priority: SHOUT_PRIORITY });
  }

  private pickVillager(): number {
    const em = this.em;
    const ids = em.collect((i) => (em.team[i] ?? 0) === 1 && this.tables.isVillager[em.kind[i] ?? 0] === 1);
    return ids.length > 0 ? this.rng.pick(ids) : -1;
  }
}
