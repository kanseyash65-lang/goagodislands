import {
  POP_DURATION, POP_GROW_TIME, POP_SQUASH_RATIO, POP_WOBBLE_AMPLITUDE, POP_WOBBLE_DAMPING, POP_WOBBLE_FREQ,
} from '../../core/config/juice.config';

export interface PopScale {
  sx: number;
  sy: number;
}

/**
 * Squash & stretch for a freshly spawned sprite: grows in fast, overshoots tall
 * and thin (stretch), rebounds short and wide (squash), and settles to 1.
 * Writes into `out` (no allocation). Returns false once the pop is over.
 */
export function popScale(age: number, out: PopScale): boolean {
  if (age < 0 || age >= POP_DURATION) return false;
  const a = Math.min(1, age / POP_GROW_TIME);
  const appear = 1 - (1 - a) * (1 - a) * (1 - a);
  const wobble = POP_WOBBLE_AMPLITUDE * Math.exp(-POP_WOBBLE_DAMPING * age) * Math.sin(POP_WOBBLE_FREQ * age);
  out.sy = appear * (1 + wobble);
  out.sx = appear * (1 - wobble * POP_SQUASH_RATIO);
  return true;
}
