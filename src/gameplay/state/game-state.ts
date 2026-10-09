import { HomeBase, type BaseBuilding } from '../base/home-base';
import { RESOURCES, type Resource } from '../economy/building-catalog';
import { Economy } from '../economy/economy';
import { loadProfile, saveProfile, type Profile } from '../profile';
import { TROOPS } from '../units/unit-stats';

/** Campaign progress (missions, unlocks, archipelago discovery). */
export interface CampaignState {
  completed: string[];
  stars: Record<string, number>;
  unlocked: string[];
  discovered: string[];
  customIslands: { id: string; name: string; x: number; y: number; seed: number }[];
}

const SAVE_KEY = 'goa-god-islands.save';
/** v2: the campaign became 7 defense missions; v1 saves keep resources and base but restart the campaign. */
const SAVE_VERSION = 2;
const OLD_CAMPAIGN_VERSION = 1;
const STARTING_UNLOCKS = ['rifleman', 'artillery', 'flare'];

interface SaveData {
  readonly version: number;
  readonly resources: Record<Resource, number>;
  readonly gems: number;
  readonly xp: number;
  readonly base: BaseBuilding[];
  readonly campaign: CampaignState;
  readonly army: string[];
  readonly upgrades?: Upgrades;
}

/** Army-panel upgrades that change every defense mission. */
export interface Upgrades {
  /** Villager training: tougher, harder-hitting villagers. */
  training: number;
  /** Village guards: riflemen already on watch when a mission starts. */
  guards: number;
}

/**
 * Everything that persists between sessions: profile, home base, economy,
 * campaign and army. Saved to localStorage (guarded: storage may be blocked).
 */
export class GameState {
  readonly profile: Profile;
  readonly base: HomeBase;
  readonly economy: Economy;
  readonly campaign: CampaignState;
  /** Troop kind per landing craft (one entry per dock). */
  army: string[];
  readonly upgrades: Upgrades;

  private constructor(profile: Profile, base: HomeBase, data: SaveData | null) {
    this.profile = profile;
    this.base = base;
    this.economy = new Economy(base);
    const fresh: CampaignState = { completed: [], stars: {}, unlocked: [...STARTING_UNLOCKS], discovered: ['home', 'm1'], customIslands: [] };
    this.campaign = data && data.version === SAVE_VERSION ? data.campaign : fresh;
    this.upgrades = { training: data?.upgrades?.training ?? 0, guards: data?.upgrades?.guards ?? 0 };
    this.army = data?.army ?? [];
    if (data) {
      for (const r of RESOURCES) this.economy.res[r] = Math.max(0, data.resources[r] ?? 0);
      this.economy.gems = data.gems;
      this.economy.xp = data.xp;
    }
    this.syncArmy();
  }

  static load(): GameState {
    const data = readSave();
    return new GameState(loadProfile(), data ? HomeBase.restore(data.base) : HomeBase.fresh(), data);
  }

  static fresh(): GameState {
    return new GameState(loadProfile(), HomeBase.fresh(), null);
  }

  isUnlocked(id: string): boolean {
    return this.campaign.unlocked.includes(id);
  }

  unlock(id: string): boolean {
    if (this.isUnlocked(id)) return false;
    this.campaign.unlocked.push(id);
    return true;
  }

  /** One squad per dock; new docks default to riflemen. */
  syncArmy(): void {
    const docks = Math.max(1, this.base.count('dock'));
    while (this.army.length < docks) this.army.push('rifleman');
    this.army.length = docks;
    this.army = this.army.map((k) => (TROOPS[k] && this.isUnlocked(k) ? k : 'rifleman'));
  }

  /** Landing-craft space: 6 + 2 per barracks level. */
  craftCapacity(): number {
    return 6 + 2 * this.base.levelOf('barracks');
  }

  /** Armory bonus as a troop level (1 + armory level). */
  troopLevel(): number {
    return 1 + this.base.levelOf('armory');
  }

  save(): void {
    const data: SaveData = {
      version: SAVE_VERSION,
      resources: { ...this.economy.res },
      gems: this.economy.gems,
      xp: this.economy.xp,
      base: this.base.buildings.map((b) => ({ ...b })),
      campaign: this.campaign,
      army: this.army,
      upgrades: this.upgrades,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage blocked (file:// or private mode): progress lasts for this session only.
    }
    saveProfile(this.profile);
  }

  static wipe(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // nothing to wipe
    }
  }
}

function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d: unknown = JSON.parse(raw);
    if (!isSave(d)) return null;
    return d;
  } catch {
    return null;
  }
}

/** Shape check: malformed saves are ignored rather than crashing the game. */
function isSave(d: unknown): d is SaveData {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return (o['version'] === SAVE_VERSION || o['version'] === OLD_CAMPAIGN_VERSION) && Array.isArray(o['base']) && typeof o['resources'] === 'object' && typeof o['campaign'] === 'object' && Array.isArray(o['army']);
}
