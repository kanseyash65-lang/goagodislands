import type { IEventBus } from '../../core/events/event-bus';
import type { UiActionName } from '../../core/events/event-types';
import { RESOURCES, type Resource } from '../../gameplay/economy/building-catalog';
import { nextMission } from '../../gameplay/missions/mission-defs';
import type { GameState } from '../../gameplay/state/game-state';
import { el, type IPanel } from '../dom';

const ICON: Readonly<Record<Resource, string>> = { gold: '🪙', timber: '🪵', stone: '🧱', metal: '⚙️' };

interface Pill {
  readonly amount: HTMLElement;
  readonly fill: HTMLElement;
}

/**
 * Boom Beach-style HUD: level badge + name + XP (top-left), resource pills with
 * storage bars (top-right), round menu buttons (left) and big corner buttons.
 * All numbers come from GameState; buttons emit UiAction intents.
 */
export class Hud implements IPanel {
  private readonly root = el('div', 'hud');
  private readonly level = el('div', 'hud-level');
  private readonly name = el('div', 'hud-name');
  private readonly xpFill = el('div', 'hud-xp-fill');
  private readonly gems = el('span', 'hud-gem-amount');
  private readonly pills = new Map<Resource, Pill>();
  private readonly sceneLabel = el('div', 'hud-scene');
  private readonly defend = el('button', 'hud-defend');
  private readonly defendSub = el('span', 'hud-defend-sub');

  constructor(private readonly bus: IEventBus, private readonly state: GameState) {}

  mount(root: HTMLElement): void {
    const profile = el('div', 'hud-profile');
    const xp = el('div', 'hud-xp');
    xp.appendChild(this.xpFill);
    const meta = el('div', 'hud-meta');
    meta.append(this.name, xp, el('div', 'hud-title', 'God of Goa'));
    profile.append(this.level, meta);

    const res = el('div', 'hud-res');
    for (const r of RESOURCES) res.appendChild(this.pill(r));
    const gem = el('div', 'hud-pill gem');
    gem.append(el('span', 'hud-icon', '💎'), this.gems, this.button('', '+', 'hud-plus', 'settings'));
    res.appendChild(gem);

    const side = el('div', 'hud-side');
    side.append(
      this.button('Missions', '📜', 'hud-round', 'missions'),
      this.button('History', '📖', 'hud-round', 'chronicle'),
      this.button('Sound', '🔊', 'hud-round', 'mute'),
      this.button('Help', '💡', 'hud-round', 'help'),
    );
    const left = el('div', 'hud-corner left');
    left.append(this.button('Map', '🧭', 'hud-big map', 'map'), this.button('Army', '⚔️', 'hud-big army', 'army'));
    const right = el('div', 'hud-corner right');
    right.append(this.button('Home', '🏝️', 'hud-big home', 'home'), this.button('Build', '🔨', 'hud-big build', 'build'));
    // The one big call to action: start the next defense mission.
    this.defend.type = 'button';
    this.defend.append(el('span', 'hud-defend-title', '🛡️ DEFEND'), this.defendSub);
    this.defend.addEventListener('click', () => this.bus.emit('UiAction', { action: 'attack' }));
    this.root.append(profile, res, side, left, right, this.defend, this.sceneLabel);
    root.appendChild(this.root);
    this.update();
  }

  /** Called ≤ 4 Hz. */
  update(): void {
    const e = this.state.economy;
    this.level.textContent = String(e.level());
    this.name.textContent = this.state.profile.name;
    this.xpFill.style.width = `${(e.levelProgress() * 100).toFixed(1)}%`;
    this.gems.textContent = String(e.gems);
    const next = nextMission(this.state.campaign.completed);
    this.defendSub.textContent = next ? `Mission ${next.order}: ${next.name}` : 'Goa is free! Replay any island';
    for (const r of RESOURCES) {
      const p = this.pills.get(r);
      if (!p) continue;
      const cap = e.capacity(r);
      p.amount.textContent = e.res[r].toLocaleString('en-US');
      p.fill.style.width = `${Math.min(100, (e.res[r] / Math.max(1, cap)) * 100).toFixed(1)}%`;
    }
  }

  setScene(scene: 'home' | 'battle' | 'map', label: string): void {
    this.root.dataset['scene'] = scene;
    document.body.dataset['scene'] = scene;
    this.sceneLabel.textContent = label;
  }

  private pill(r: Resource): HTMLElement {
    const p = el('div', `hud-pill ${r}`);
    const amount = el('span', 'hud-amount');
    const bar = el('div', 'hud-cap');
    const fill = el('div', 'hud-cap-fill');
    bar.appendChild(fill);
    p.append(el('span', 'hud-icon', ICON[r]), amount, bar);
    p.title = r;
    this.pills.set(r, { amount, fill });
    return p;
  }

  private button(label: string, icon: string, cls: string, action: UiActionName): HTMLElement {
    const b = el('button', cls);
    b.type = 'button';
    b.append(el('span', 'hud-btn-icon', icon));
    if (label) b.append(el('span', 'hud-btn-label', label));
    b.addEventListener('click', () => this.bus.emit('UiAction', { action }));
    return b;
  }
}
