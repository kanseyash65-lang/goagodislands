/** "Juice" tunables: spawn pop, shock rings, sparkles, runes (3D scale). */
export const POP_DURATION = 0.45; // seconds of squash & stretch after spawn
export const POP_GROW_TIME = 0.1;
export const POP_WOBBLE_AMPLITUDE = 0.38;
export const POP_WOBBLE_DAMPING = 7.5;
export const POP_WOBBLE_FREQ = 24;
export const POP_SQUASH_RATIO = 0.8; // x moves opposite to y (volume-ish preservation)
export const SPAWN_HOP_VZ = 7;

export const RING_LIFETIME = 0.45;
export const RING_START_SIZE = 0.6;
export const RING_END_SIZE = 5;
export const RINGS_PER_COMMAND_MAX = 14;

export const SPARKLES_PER_ENTITY = 3;
export const SPARKLES_PER_COMMAND_MAX = 160;
export const SPARKLE_LIFETIME = 0.7;
export const SPARKLE_SPEED = 5;

export const RUNES_PER_SUBMIT = 14;
export const RUNE_LIFETIME = 1.1;
export const RUNE_HOMING = 4;

export const POOF_PER_ENTITY = 2;
export const POOF_PER_COMMAND_MAX = 120;
export const CONFETTI_PER_SEC = 5;
