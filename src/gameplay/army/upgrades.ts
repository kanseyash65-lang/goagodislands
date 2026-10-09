import type { Cost } from '../economy/building-catalog';
import type { GameState, Upgrades } from '../state/game-state';

/** The two Army-panel upgrades: villager training and village guards. */
export interface UpgradeSpec {
  readonly id: keyof Upgrades;
  readonly icon: string;
  readonly label: string;
  readonly maxLevel: number;
  readonly perLevel: string;
  readonly baseCost: Cost;
}

export const UPGRADES: readonly UpgradeSpec[] = [
  { id: 'training', icon: '🥋', label: 'Train Villagers', maxLevel: 5, perLevel: '+20% villager HP and +15% damage per level', baseCost: { gold: 600, timber: 400 } },
  { id: 'guards', icon: '🪖', label: 'Village Guards', maxLevel: 3, perLevel: '+2 riflemen on watch at the start of every mission', baseCost: { gold: 900, timber: 700 } },
];

/** Cost of the next level: base cost times the level you are buying. */
export function upgradeCost(spec: UpgradeSpec, current: number): Cost {
  const out: Cost = {};
  for (const [r, v] of Object.entries(spec.baseCost)) out[r as keyof Cost] = (v ?? 0) * (current + 1);
  return out;
}

/** Buys one level if possible. Returns a message for the player. */
export function buyUpgrade(state: GameState, spec: UpgradeSpec): { ok: boolean; text: string } {
  const level = state.upgrades[spec.id];
  if (level >= spec.maxLevel) return { ok: false, text: `${spec.label} is already at max level.` };
  const cost = upgradeCost(spec, level);
  if (!state.economy.spend(cost)) return { ok: false, text: `Need ${state.economy.shortfall(cost)}.` };
  state.upgrades[spec.id] = level + 1;
  state.save();
  return { ok: true, text: `${spec.icon} ${spec.label} is now level ${level + 1}.` };
}
