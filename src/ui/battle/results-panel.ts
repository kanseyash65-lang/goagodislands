import type { IEventBus } from '../../core/events/event-bus';
import type { BattleController } from '../../gameplay/battle/battle-controller';
import { starsFor, type MissionStory } from '../../gameplay/battle/mission-story';
import { campaignComplete, grantDefeat, grantVictory, isAvailable } from '../../gameplay/campaign/campaign';
import { missionById, MISSIONS, type MissionDef } from '../../gameplay/missions/mission-defs';
import type { GameState } from '../../gameplay/state/game-state';
import { clear, el, type IPanel } from '../dom';

const SHOW_DELAY_MS = 2600;
const STAR_STAGGER_MS = 350;

/**
 * Victory/defeat card: animated star rating, what you achieved, rewards, the
 * Goa God Herald front page about your defense, and Next Mission / Replay / Home.
 */
export class ResultsPanel implements IPanel {
  private readonly root = el('div', 'panel results');

  constructor(
    private readonly bus: IEventBus,
    private readonly state: GameState,
    private readonly battle: BattleController,
    private readonly story: MissionStory,
  ) {
    bus.on('BattleEnded', ({ victory, missionId, reason }) => window.setTimeout(() => this.show(victory, missionId, reason), victory ? SHOW_DELAY_MS : SHOW_DELAY_MS / 2));
    bus.on('SceneChanged', () => {
      this.root.hidden = true;
    });
  }

  mount(root: HTMLElement): void {
    this.root.hidden = true;
    root.appendChild(this.root);
  }

  private show(victory: boolean, missionId: string, reason: string): void {
    const m = missionById(missionId);
    if (!m) return;
    clear(this.root);
    this.root.classList.toggle('victory', victory);
    this.root.append(el('h2', '', victory ? '🏆 VILLAGE SAVED!' : '☠ THE VILLAGE FELL'), el('p', 'res-mission', `Mission ${m.order} · ${m.name}`));
    const protect = this.battle.objectives.find((o) => o.def.type === 'protect');
    const lost = protect?.progress ?? 0;
    const villagers = this.battle.villageStats().villagers;
    if (victory) {
      const stars = starsFor(lost, protect?.target ?? 0, villagers, this.story.villagersAtStart);
      this.root.appendChild(this.starRow(stars));
      this.root.appendChild(this.stats(villagers, lost));
      const r = grantVictory(this.state, m);
      this.state.campaign.stars[m.id] = Math.max(this.state.campaign.stars[m.id] ?? 0, stars);
      this.state.save();
      const list = el('ul', 'res-rewards');
      for (const line of r.lines) list.appendChild(el('li', '', line));
      this.root.appendChild(list);
      if (r.unlocked.length > 0) this.root.appendChild(el('p', 'res-unlock', `Unlocked: ${r.unlocked.join(', ')}`));
      if (campaignComplete(this.state)) this.root.appendChild(el('p', 'res-unlock', '🌴 Goa is liberated. The whole archipelago is free. Susegad!'));
      this.root.appendChild(this.actions(m, true, () => this.bus.emit('NewspaperRequested', { special: this.story.edition(m, villagers, lost, stars) })));
    } else {
      this.root.appendChild(el('p', 'res-reason', reason));
      grantDefeat(this.state);
      this.root.appendChild(el('p', 'res-note', 'Tip: say "Make it rain" the moment a house burns, and "God, do something" when the raiders outnumber your villagers.'));
      this.root.appendChild(this.actions(m, false));
    }
    this.root.hidden = false;
  }

  private starRow(stars: number): HTMLElement {
    const row = el('div', 'res-stars');
    for (let i = 0; i < 3; i++) {
      const s = el('span', `res-star${i < stars ? ' won' : ''}`, '★');
      s.style.animationDelay = `${i * STAR_STAGGER_MS}ms`;
      row.appendChild(s);
    }
    return row;
  }

  private stats(villagers: number, lost: number): HTMLElement {
    const t = this.story.tally;
    const grid = el('div', 'res-stats');
    const stat = (icon: string, value: string, label: string): void => {
      const c = el('div', 'res-stat');
      c.append(el('span', 'res-stat-icon', icon), el('span', 'res-stat-value', value), el('span', 'res-stat-label', label));
      grid.appendChild(c);
    };
    stat('🧑‍🌾', String(villagers), 'villagers saved');
    stat('⚔️', String(this.story.raidersDefeated()), 'raiders defeated');
    stat('🏠', String(lost), lost === 1 ? 'home lost' : 'homes lost');
    stat('✨', String(t.rains + t.boosts + t.miracles + t.disasters + (t.chickens > 0 ? 1 : 0) + (t.dragons > 0 ? 1 : 0)), 'god powers');
    return grid;
  }

  private actions(m: MissionDef, victory: boolean, onPaper?: () => void): HTMLElement {
    const box = el('div', 'res-actions');
    const add = (label: string, cls: string, fn: () => void): void => {
      const b = el('button', `btn ${cls}`, label);
      b.type = 'button';
      b.addEventListener('click', fn);
      box.appendChild(b);
    };
    if (onPaper) add('📰 Read the Goa God Herald', 'primary paper', onPaper);
    const next = MISSIONS.find((x) => x.order === m.order + 1);
    if (victory && next && isAvailable(this.state, next)) add(`▶ Next: ${next.name}`, 'red', () => this.bus.emit('UiAction', { action: 'start-mission', arg: next.id }));
    add(victory ? '↻ Replay' : '↻ Try again', victory ? '' : 'red', () => this.bus.emit('UiAction', { action: 'start-mission', arg: m.id }));
    add('🏝️ Home', '', () => this.bus.emit('UiAction', { action: 'home' }));
    return box;
  }
}
