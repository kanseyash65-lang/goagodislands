import { RESOURCES } from '../economy/building-catalog';
import { MISSIONS, type MissionDef } from '../missions/mission-defs';
import type { GameState } from '../state/game-state';

const REPLAY_FACTOR = 0.3;

export interface RewardSummary {
  readonly firstClear: boolean;
  readonly lines: readonly string[];
  readonly unlocked: readonly string[];
}

/** A mission is playable once the previous one (by order) is complete. */
export function isAvailable(state: GameState, m: MissionDef): boolean {
  if (m.order === 1) return true;
  const prev = MISSIONS.find((x) => x.order === m.order - 1);
  return prev ? state.campaign.completed.includes(prev.id) : true;
}

/** Pays the reward (full on first clear, 30% on replays), unlocks and discovers the next island. */
export function grantVictory(state: GameState, m: MissionDef): RewardSummary {
  const first = !state.campaign.completed.includes(m.id);
  const f = first ? 1 : REPLAY_FACTOR;
  const lines: string[] = [];
  for (const r of RESOURCES) {
    const v = Math.round((m.reward[r] ?? 0) * f);
    if (v <= 0) continue;
    const added = state.economy.add(r, v);
    lines.push(added > 0 ? `+${added.toLocaleString('en-US')} ${r}` : `${r} storage full`);
  }
  const gems = Math.round((m.reward.gems ?? 0) * f);
  if (gems > 0) {
    state.economy.gems += gems;
    lines.push(`+${gems} gems`);
  }
  state.economy.addXp(m.reward.xp * f);
  lines.push(`+${Math.round(m.reward.xp * f)} XP`);
  const unlocked: string[] = [];
  if (first) {
    state.campaign.completed.push(m.id);
    for (const u of m.unlocks) if (state.unlock(u)) unlocked.push(u);
    const next = MISSIONS.find((x) => x.order === m.order + 1);
    if (next && !state.campaign.discovered.includes(next.id)) state.campaign.discovered.push(next.id);
  }
  state.campaign.stars[m.id] = Math.max(state.campaign.stars[m.id] ?? 0, 1);
  state.syncArmy();
  state.save();
  return { firstClear: first, lines, unlocked };
}

/** Defeat still pays a little XP so trying is never wasted. */
export function grantDefeat(state: GameState): void {
  state.economy.addXp(40);
  state.save();
}

export function campaignComplete(state: GameState): boolean {
  return MISSIONS.every((m) => state.campaign.completed.includes(m.id));
}
