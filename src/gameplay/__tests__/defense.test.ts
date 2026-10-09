import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buyUpgrade, upgradeCost, UPGRADES } from '../army/upgrades';
import { EXTRA_VILLAGERS_MAX, extraVillagers } from '../base/build-service';
import { MISSIONS } from '../missions/mission-defs';
import { MissionStory, starsFor } from '../battle/mission-story';
import { EventBus } from '../../core/events/event-bus';
import { GameState } from '../state/game-state';

/** Minimal in-memory localStorage so saves can round-trip under node. */
function stubStorage(): Map<string, string> {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
  return m;
}

describe('defense campaign', () => {
  it('every mission is a god-powered village defense with waves and villagers', () => {
    expect(MISSIONS).toHaveLength(7);
    for (const m of MISSIONS) {
      expect(m.mode).toBe('village');
      expect(m.waves?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(m.island.villagers).toBeGreaterThan(0);
      expect(m.objectives.some((o) => o.type === 'defeat-raiders')).toBe(true);
      expect(m.island.structures.some((p) => p.team === 1)).toBe(true);
    }
  });

  it('the final mission brings the Commander', () => {
    const last = MISSIONS[MISSIONS.length - 1];
    expect(last?.waves?.some((w) => w.troops.some((t) => t.kind === 'commander'))).toBe(true);
    expect(last?.objectives.some((o) => o.type === 'boss')).toBe(true);
  });
});

describe('army upgrades and homes', () => {
  let store: Map<string, string>;
  beforeEach(() => { store = stubStorage(); });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('costs scale with the level being bought, and buying spends and saves', () => {
    const s = GameState.fresh();
    const training = UPGRADES.find((u) => u.id === 'training');
    if (!training) throw new Error('training upgrade missing');
    expect(upgradeCost(training, 0)).toEqual({ gold: 600, timber: 400 });
    expect(upgradeCost(training, 2)).toEqual({ gold: 1800, timber: 1200 });
    const gold = s.economy.res.gold;
    expect(buyUpgrade(s, training).ok).toBe(true);
    expect(s.upgrades.training).toBe(1);
    expect(s.economy.res.gold).toBe(gold - 600);
    expect(store.size).toBeGreaterThan(0);
  });

  it('refuses an upgrade you cannot afford', () => {
    const s = GameState.fresh();
    const guards = UPGRADES.find((u) => u.id === 'guards');
    if (!guards) throw new Error('guards upgrade missing');
    s.economy.res.gold = 0;
    expect(buyUpgrade(s, guards).ok).toBe(false);
    expect(s.upgrades.guards).toBe(0);
  });

  it('built homes add defenders, capped', () => {
    const s = GameState.fresh();
    expect(extraVillagers(s)).toBe(0);
    s.base.add('house', 100, 100);
    s.base.add('residence', 110, 110);
    expect(extraVillagers(s)).toBe(3);
    for (let i = 0; i < 20; i++) s.base.add('house', 120, 120);
    expect(extraVillagers(s)).toBe(EXTRA_VILLAGERS_MAX);
  });

  it('an old v1 save keeps resources but restarts the defense campaign', () => {
    const s = GameState.fresh();
    s.economy.res.gold = 4321;
    s.campaign.completed.push('m1', 'm2');
    s.save();
    const key = [...store.keys()].find((k) => k.endsWith('.save'));
    if (!key) throw new Error('no save written');
    const old = JSON.parse(store.get(key) ?? '{}') as Record<string, unknown>;
    store.set(key, JSON.stringify({ ...old, version: 1 }));
    const loaded = GameState.load();
    expect(loaded.economy.res.gold).toBe(4321);
    expect(loaded.campaign.completed).toEqual([]);
  });
});

describe('mission story', () => {
  it('rates three stars only for a flawless defense', () => {
    expect(starsFor(0, 4, 15, 16)).toBe(3);
    expect(starsFor(2, 4, 10, 16)).toBe(2);
    expect(starsFor(4, 4, 3, 16)).toBe(1);
  });

  it('headlines the most spectacular deed', () => {
    const bus = new EventBus();
    const story = new MissionStory(bus, () => 16);
    const m1 = MISSIONS[0];
    if (!m1) throw new Error('no mission');
    bus.emit('SceneChanged', { scene: 'battle', island: m1.name });
    story.tally.rains = 1;
    expect(story.edition(m1, 14, 0, 3).headline).toContain('RAIN');
    story.tally.chickens = 9;
    const page = story.edition(m1, 14, 0, 3);
    expect(page.headline).toBe('GOD TURNS 9 PIRATES INTO CHICKENS AT CALANGUTE');
    expect(page.subhead).toContain('★★★');
  });
});
