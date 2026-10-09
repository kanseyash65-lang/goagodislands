/** Combat tunables (Boom Beach-inspired, original numbers). */
export const BATTLE_SECONDS = 180;
export const ENERGY_START = 12;
export const ENERGY_PER_BUILDING = 2;
export const ENERGY_MAX = 60;

export const ABILITY_COST = { artillery: 3, flare: 2, medkit: 3, shield: 4, barrage: 6 } as const;
/** Each use of an ability raises its next cost (keeps battles tactical). */
export const ABILITY_COST_STEP = 1;
export const ARTILLERY_DAMAGE = 380;
export const ARTILLERY_RADIUS = 5;
export const BARRAGE_SHELLS = 8;
export const BARRAGE_DAMAGE = 160;
export const BARRAGE_RADIUS = 14;
export const FLARE_SECONDS = 12;
export const MEDKIT_HEAL_PER_SEC = 60;
export const MEDKIT_SECONDS = 6;
export const MEDKIT_RADIUS = 7;
export const SHIELD_SECONDS = 6;
export const SHIELD_RADIUS = 7;

export const UNIT_THINK_SECONDS = 0.25;
export const AGGRO_RADIUS = 26;
export const SEPARATION_RADIUS = 1.1;
export const LANDING_STAGGER = 0.12;
export const TROOP_SPREAD = 3;
export const VICTORY_CHAIN_DELAY = 0.12;
export const DEFENSE_TURN_SPEED = 4;
export const REVEAL_RADIUS = 30;
export const MINE_TRIGGER_RADIUS = 2.5;
export const ESCAPE_SECONDS = 45;
export const HIT_FLASH_SECONDS = 0.12;
export const LEVEL_HP_STEP = 0.25;
export const LEVEL_DAMAGE_STEP = 0.2;
