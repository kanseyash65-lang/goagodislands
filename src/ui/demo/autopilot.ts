import type { IEventBus } from '../../core/events/event-bus';
import type { BattleController } from '../../gameplay/battle/battle-controller';
import { el, type IPanel } from '../dom';

/** Types a phrase into the command bar like a voice transcript, then submits it. */
export interface Typist {
  typeOut(text: string): Promise<void>;
}

const THINK_MS = 900;
const START_DELAY_MS = 600;

/**
 * Demo mode: plays Mission 1 by itself, "speaking" each god power into the
 * command bar at the right moment (great for a booth screen or a video).
 * Any real key press or tap hands control back to the player.
 */
export class Autopilot implements IPanel {
  private readonly badge = el('div', 'demo-badge', '🎬 DEMO · tap anywhere to take over');
  private active = false;
  private typing = false;
  private readonly lastSaid = new Map<string, number>();
  private timer = 0;

  constructor(private readonly bus: IEventBus, private readonly battle: BattleController, private readonly typist: Typist) {
    bus.on('UiAction', ({ action }) => { if (action === 'demo') this.start(); });
    bus.on('BattleEnded', ({ victory }) => {
      if (!this.active) return;
      // Show off the newspaper, then leave the player on the results screen.
      if (victory) window.setTimeout(() => document.querySelector<HTMLButtonElement>('.res-actions .paper')?.click(), 4200);
      this.stop(false);
    });
  }

  mount(root: HTMLElement): void {
    this.badge.hidden = true;
    root.appendChild(this.badge);
    const takeOver = (e: Event): void => {
      if (this.active && e.isTrusted && !this.typing) this.stop(true);
    };
    window.addEventListener('keydown', takeOver);
    window.addEventListener('pointerdown', takeOver);
  }

  private start(): void {
    this.active = true;
    this.lastSaid.clear();
    this.badge.hidden = false;
    window.setTimeout(() => this.bus.emit('UiAction', { action: 'start-mission', arg: 'm1' }), START_DELAY_MS);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => void this.think(), THINK_MS);
  }

  private stop(byPlayer: boolean): void {
    this.active = false;
    this.badge.hidden = true;
    window.clearInterval(this.timer);
    if (byPlayer) this.bus.emit('ToastRequested', { text: '🎮 You are in control now. Say anything!' });
  }

  private async think(): Promise<void> {
    if (!this.active || this.typing || !this.battle.active || this.battle.phase !== 'fighting') return;
    const v = this.battle.villageStats();
    const now = performance.now() / 1000;
    const ready = (w: string, gap: number): boolean => now - (this.lastSaid.get(w) ?? -1e9) >= gap;
    const once = (w: string): boolean => !this.lastSaid.has(w);
    let say: string | undefined;
    if (v.fires > 0 && ready('Make it rain', 12)) say = 'Make it rain';
    else if (v.raiders > 0 && (v.villagersHurt >= 2 || v.villagers <= 13) && ready('Increase the HP of villagers', 25)) say = 'Increase the HP of villagers';
    else if (v.wave >= 2 && v.raiders >= 4 && once('Turn the enemies into chickens')) say = 'Turn the enemies into chickens';
    else if (v.wave >= 2 && !once('Turn the enemies into chickens') && once('Summon a dragon')) say = 'Summon a dragon';
    else if (v.raiders >= 5 && v.wave >= 3 && ready('God, do something', 13)) say = 'God, do something';
    else if (v.gunboat && v.raiders === 0 && v.wave >= v.waves && ready('Strike the enemy boat', 8)) say = 'Strike the enemy boat';
    if (!say) return;
    this.lastSaid.set(say, now);
    this.typing = true;
    await this.typist.typeOut(say);
    this.typing = false;
  }
}
