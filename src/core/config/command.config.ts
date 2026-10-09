/** Command-engine tunables. */
export const MAX_INPUT_CHARS = 500;
export const AUTO_SUBMIT_MS = 900;
export const CHAIN_STAGGER_MS = 450;
export const IMPROV_CONFIDENCE = 0.35;
export const PRONOUN_TTL_SECONDS = 30;
export const DEFAULT_THING_COUNT = 5;
export const SPAWN_MAX_PER_COMMAND = 600;
export const MAX_CHAIN_LENGTH = 6;
export const MAGNITUDE_MAX = 10;
export const RESULT_ID_SAMPLE = 64; // ids kept on a result for focus/juice
export const SPAWN_SPREAD_PER_SQRT = 1.8;
export const SPAWN_SPREAD_MIN = 3;
/** Destructive commands wait this long for "yes" before expiring. */
export const CONFIRM_TTL_MS = 15000;
/** Destroying more of your own stuff than this needs a spoken "yes". */
export const CONFIRM_OWN_THRESHOLD = 1;
export const RESOURCE_GIFT_MAX = 100000;
