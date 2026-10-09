import { LEVEL_DAMAGE_STEP, LEVEL_HP_STEP } from '../../core/config/combat.config';

/** Original troop and defense stats (data, not code). */
export type ProjectileKind = 'bullet' | 'shell' | 'rocket' | 'mortar' | 'snipe' | 'melee' | 'flame';
export type TargetPref = 'units' | 'buildings' | 'any';

export interface WeaponStats {
  readonly range: number;
  readonly damage: number;
  /** Seconds between shots. */
  readonly interval: number;
  readonly projectile: ProjectileKind;
  readonly splash: number;
  readonly minRange: number;
  readonly targets: TargetPref;
}

export interface TroopStats {
  readonly kind: string;
  readonly hp: number;
  /** Landing-craft space each one uses. */
  readonly space: number;
  readonly weapon?: WeaponStats;
  /** Heal per second to the most hurt ally in range (medics). */
  readonly heal?: number;
  readonly role: string;
}

export interface DefenseStats {
  readonly kind: string;
  readonly hp: number;
  readonly weapon?: WeaponStats;
  readonly mine?: { readonly radius: number; readonly damage: number; readonly splash: number };
  readonly bunker?: { readonly kind: string; readonly count: number; readonly trigger: number };
}

const w = (range: number, damage: number, interval: number, projectile: ProjectileKind, targets: TargetPref, splash = 0, minRange = 0): WeaponStats =>
  ({ range, damage, interval, projectile, splash, minRange, targets });

export const TROOPS: Readonly<Record<string, TroopStats>> = {
  rifleman: { kind: 'rifleman', hp: 140, space: 1, weapon: w(9, 16, 0.7, 'bullet', 'any'), role: 'Cheap, fast, good in numbers.' },
  heavy: { kind: 'heavy', hp: 650, space: 4, weapon: w(7, 10, 0.25, 'bullet', 'any'), role: 'Soaks damage. Shreds infantry.' },
  rocketeer: { kind: 'rocketeer', hp: 150, space: 2, weapon: w(17, 70, 2.2, 'rocket', 'any', 1.5), role: 'Long range, slow rockets.' },
  medic: { kind: 'medic', hp: 170, space: 3, heal: 26, role: 'Heals the most hurt ally nearby.' },
  engineer: { kind: 'engineer', hp: 240, space: 3, weapon: w(1.8, 95, 1, 'melee', 'buildings'), role: 'Plants charges. Wrecks buildings.' },
  /** Summoned by voice in a mission ('summon a dragon'): breathes fire on raiders. */
  dragon: { kind: 'dragon', hp: 2400, space: 10, weapon: w(10, 85, 1.2, 'flame', 'units', 3), role: 'A Goan sea dragon. On your side.' },
  commander: { kind: 'commander', hp: 4200, space: 12, weapon: w(16, 120, 1.4, 'rocket', 'any', 3), role: 'Enemy commander. Very rude.' },
};

/**
 * Villagers defend their homes when the village is attacked (team 1 in the
 * village-defense mission). Weak on purpose: they need their god's help.
 */
export const VILLAGERS: Readonly<Record<string, TroopStats>> = {
  fisherman: { kind: 'fisherman', hp: 100, space: 1, weapon: w(1.8, 14, 0.9, 'melee', 'units'), role: 'Fights with an oar.' },
  farmer: { kind: 'farmer', hp: 100, space: 1, weapon: w(2, 16, 1, 'melee', 'units'), role: 'Fights with a pitchfork.' },
  vendor: { kind: 'vendor', hp: 90, space: 1, weapon: w(7, 8, 1.3, 'bullet', 'units'), role: 'Throws coconuts.' },
  tourist: { kind: 'tourist', hp: 80, space: 1, weapon: w(6, 5, 1.5, 'bullet', 'units'), role: 'Throws flip-flops.' },
  elder: { kind: 'elder', hp: 80, space: 1, weapon: w(2, 9, 1.4, 'melee', 'units'), role: 'Walking stick, strong opinions.' },
  child: { kind: 'child', hp: 60, space: 1, role: 'Hides behind the chapel.' },
};

export const DEFENSES: Readonly<Record<string, DefenseStats>> = {
  hq: { kind: 'hq', hp: 2600, weapon: w(14, 18, 1, 'bullet', 'units') },
  cannon: { kind: 'cannon', hp: 1000, weapon: w(20, 120, 2.6, 'shell', 'units') },
  'machine-gun': { kind: 'machine-gun', hp: 800, weapon: w(12, 8, 0.16, 'bullet', 'units') },
  mortar: { kind: 'mortar', hp: 900, weapon: w(28, 80, 3.8, 'mortar', 'units', 3.2, 7) },
  'sniper-tower': { kind: 'sniper-tower', hp: 750, weapon: w(24, 60, 1.8, 'snipe', 'units') },
  mine: { kind: 'mine', hp: 1, mine: { radius: 2.5, damage: 180, splash: 3.5 } },
  bunker: { kind: 'bunker', hp: 1600, bunker: { kind: 'rifleman', count: 5, trigger: 16 } },
  cage: { kind: 'cage', hp: 500 },
  'supply-depot': { kind: 'supply-depot', hp: 1200 },
  wall: { kind: 'wall', hp: 900 },
};

/** Generic hit points for buildings without combat stats (economy, Goan village). */
export const DEFAULT_BUILDING_HP = 900;

export function levelHp(base: number, level: number): number {
  return Math.round(base * (1 + LEVEL_HP_STEP * (Math.max(1, level) - 1)));
}

export function levelDamage(base: number, level: number): number {
  return base * (1 + LEVEL_DAMAGE_STEP * (Math.max(1, level) - 1));
}

export function weaponOf(kindName: string): WeaponStats | undefined {
  return TROOPS[kindName]?.weapon ?? DEFENSES[kindName]?.weapon ?? VILLAGERS[kindName]?.weapon;
}

export function baseHpOf(kindName: string): number {
  return TROOPS[kindName]?.hp ?? DEFENSES[kindName]?.hp ?? DEFAULT_BUILDING_HP;
}
