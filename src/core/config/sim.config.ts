/** Simulation tunables (3D scale: 1 unit ≈ 1 m). All gameplay numbers live here, not in systems. */
export const SIM_STEP = 0.05; // fixed sim step (s)
export const MAX_FRAME_DT = 0.1; // clamp for long frames (s)
export const MAX_STEPS_PER_FRAME = 4;

export const GAME_MINUTES_PER_SECOND = 1;
export const START_MINUTES = 9 * 60 + 30; // 09:30, Tuesday
export const MINUTES_PER_DAY = 1440;

export const GRAVITY_ACCEL = 38; // units / s^2 at gravity = 1
export const ZERO_G_DRIFT_IMPULSE = 6; // upward nudge when gravity is deleted
export const ZERO_G_DAMPING = 0.995;
export const CEILING_BOUNCE = 0.35;
export const GROUND_BOUNCE = 0.3;
export const HOP_IMPULSE = 9;

export const AI_THINK_MIN = 0.5;
export const AI_THINK_MAX = 1.2;
export const VILLAGER_WANDER_RADIUS = 30;
export const ANIMAL_WANDER_RADIUS = 14;
export const ARRIVE_DISTANCE = 0.8;
export const PANIC_SPEED_MUL = 2.4;
export const RUN_SPEED_MUL = 2;
export const NIGHT_START_MIN = 21 * 60;
export const NIGHT_END_MIN = 6 * 60;
export const RAIN_SPEED_MUL = 0.8;

export const DEFAULT_BEHAVIOR_SECONDS = 14;
export const WEATHER_TRANSITION_PER_SEC = 0.35;
export const ITEM_RAIN_SECONDS = 9;
export const ITEM_RAIN_PER_SEC = 14;
export const ITEM_RAIN_ALTITUDE = 34;
export const WIND_DEFAULT = 1;
export const WIND_WINDY = 6;
export const CLOUD_SPEED_MUL = 0.6;
export const CLOUD_ALTITUDE = 62;

export const NORMALCY_START = 85;
export const NORMALCY_RECOVERY_PER_SEC = 0.35;
export const NORMALCY_HIT_PER_MAGNITUDE = 3.2;
export const NOVELTY_DECAY = 0.6;
export const CHAOS_DECAY_PER_SEC = 0.97;
export const CHAOS_GAIN_PER_MAGNITUDE = 0.45;

export const SYSTEM_MAX_FAILURES = 3;
export const SYSTEM_COOLDOWN_SECONDS = 10;
