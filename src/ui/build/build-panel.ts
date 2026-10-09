import type { IEventBus } from '../../core/events/event-bus';
import { BUILD_MENU, extraVillagers, type BuildService } from '../../gameplay/base/build-service';
import { buildingSpec } from '../../gameplay/economy/building-catalog';
import { formatCost } from '../../gameplay/economy/economy';
import type { GameState } from '../../gameplay/state/game-state';
import { el } from '../dom';
import { Sheet } from '../sheet';

/**
 * Build: upgrade the HQ and place Goan buildings on your home island.
 * Homes add defenders to every mission, so building pays off in battle.
 */
export class BuildPanel extends Sheet {
  constructor(bus: IEventBus, private readonly state: GameState, private readonly builder: BuildService) {
    super(bus, 'build', '🔨 Build Your Village');
  }

  protected render(): void {
    this.renderHq();
    this.renderMenu();
  }

  private renderHq(): void {
    const level = this.state.base.hqLevel();
    const sec = this.section('Headquarters', `Level ${level}. Upgrading raises building limits and unlocks walls.`);
    const cost = this.builder.hqUpgradeCost();
    const row = el('div', 'sheet-card wide');
    row.append(el('div', 'sheet-card-icon', '🏛️'), el('div', 'sheet-card-title', `Headquarters · Lv ${level}`));
    row.appendChild(this.button(cost ? `Upgrade · ${formatCost(cost)}` : 'Max level', 'primary', !cost || !this.state.economy.canAfford(cost), () => this.builder.upgradeHq()));
    sec.appendChild(row);
  }

  private renderMenu(): void {
    const sec = this.section('Buildings', `Your homes send ${extraVillagers(this.state)} extra villagers to every defense.`);
    const grid = el('div', 'sheet-grid three');
    for (const opt of BUILD_MENU) {
      const spec = buildingSpec(opt.kind);
      if (!spec) continue;
      const why = this.builder.blocker(opt.kind);
      const card = el('div', `sheet-card${why ? ' blocked' : ''}`);
      card.append(
        el('div', 'sheet-card-icon', opt.icon),
        el('div', 'sheet-card-title', spec.label),
        el('div', 'sheet-card-count', `${this.state.base.count(opt.kind)} / ${this.builder.limit(opt.kind)}`),
        el('div', 'sheet-card-text', opt.perk),
      );
      card.appendChild(this.button(`Build · ${this.builder.describeCost(opt.kind)}`, 'green', why !== null, () => {
        // Close on success so the new building's pop-in is visible.
        if (this.builder.build(opt.kind).ok) this.bus.emit('UiAction', { action: 'close-panels' });
      }));
      if (why) card.appendChild(el('div', 'sheet-card-why', why));
      grid.appendChild(card);
    }
    sec.appendChild(grid);
  }
}
