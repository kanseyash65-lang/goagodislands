import type { IEventBus } from '../../core/events/event-bus';
import { GOD_POWERS } from '../../data/god-powers';
import { buyUpgrade, upgradeCost, UPGRADES } from '../../gameplay/army/upgrades';
import { extraVillagers } from '../../gameplay/base/build-service';
import { GUARDS_PER_LEVEL, TRAINING_DMG_STEP, TRAINING_HP_STEP, VILLAGER_HP_MUL } from '../../gameplay/battle/battle-controller';
import { formatCost } from '../../gameplay/economy/economy';
import type { GameState } from '../../gameplay/state/game-state';
import { VILLAGERS } from '../../gameplay/units/unit-stats';
import { el } from '../dom';
import { Sheet } from '../sheet';

const VILLAGER_ICON: Readonly<Record<string, string>> = { fisherman: '🎣', farmer: '🌾', vendor: '🥥', tourist: '🩴', elder: '👴', child: '🧒' };

/**
 * Army: upgrade your defenders (training, guards), see the villager roster
 * with their real mission stats, and the god powers you can say.
 */
export class ArmyPanel extends Sheet {
  constructor(bus: IEventBus, private readonly state: GameState) {
    super(bus, 'army', '⚔️ Army & God Powers');
  }

  protected render(): void {
    this.renderUpgrades();
    this.renderRoster();
    this.renderPowers();
  }

  private renderUpgrades(): void {
    const sec = this.section('Upgrades', 'They apply to every defense mission.');
    const grid = el('div', 'sheet-grid two');
    for (const u of UPGRADES) {
      const level = this.state.upgrades[u.id];
      const maxed = level >= u.maxLevel;
      const cost = upgradeCost(u, level);
      const card = el('div', 'sheet-card');
      const pips = el('div', 'pips');
      for (let i = 0; i < u.maxLevel; i++) pips.appendChild(el('span', i < level ? 'on' : ''));
      card.append(el('div', 'sheet-card-icon', u.icon), el('div', 'sheet-card-title', `${u.label} · Lv ${level}`), pips, el('div', 'sheet-card-text', u.perLevel));
      card.appendChild(this.button(maxed ? 'Max level' : `Upgrade · ${formatCost(cost)}`, 'green', maxed || !this.state.economy.canAfford(cost), () => {
        const res = buyUpgrade(this.state, u);
        this.bus.emit('ToastRequested', { text: res.text });
        this.bus.emit('ResourcesChanged', {});
      }));
      grid.appendChild(card);
    }
    sec.appendChild(grid);
  }

  private renderRoster(): void {
    const t = this.state.upgrades.training;
    const extra = extraVillagers(this.state);
    const guards = this.state.upgrades.guards * GUARDS_PER_LEVEL;
    const sec = this.section('Your defenders', `+${extra} extra villagers from homes you built · ${guards} guards on watch`);
    const grid = el('div', 'sheet-grid roster');
    for (const v of Object.values(VILLAGERS)) {
      const hp = Math.round(v.hp * VILLAGER_HP_MUL * (1 + TRAINING_HP_STEP * t));
      const dmg = v.weapon ? Math.round(v.weapon.damage * (1 + TRAINING_DMG_STEP * t)) : 0;
      const card = el('div', 'roster-card');
      card.append(
        el('div', 'roster-icon', VILLAGER_ICON[v.kind] ?? '🧑'),
        el('div', 'roster-name', v.kind),
        el('div', 'roster-stats', `❤ ${hp}  ${dmg > 0 ? `⚔ ${dmg}` : '🙈 hides'}`),
        el('div', 'roster-role', v.role),
      );
      grid.appendChild(card);
    }
    sec.appendChild(grid);
  }

  private renderPowers(): void {
    const sec = this.section('God powers', 'Say these with your voice (Wispr Flow) or tap them during a mission.');
    const list = el('div', 'power-list');
    for (const p of GOD_POWERS) {
      const row = el('div', 'power-row');
      row.append(el('span', 'power-icon', p.icon), el('span', 'power-words', `“${p.words}”`), el('span', 'power-help', p.help));
      list.appendChild(row);
    }
    sec.appendChild(list);
  }
}
