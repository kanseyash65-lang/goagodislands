/** Behaviour/action states shared by AI, renderer (read-only) and commands. */
export const STATE = {
  IDLE: 0,
  WALK: 1,
  WORK: 2,
  SLEEP: 3,
  DANCE: 4,
  PANIC: 5,
  FLOAT: 6,
  PRAY: 7,
  CELEBRATE: 8,
  SPIN: 9,
  JUMP: 10,
  RUN: 11,
  SING: 12,
  CALM: 13,
} as const;

export type StateId = (typeof STATE)[keyof typeof STATE];

export type Behavior =
  | 'dance' | 'panic' | 'sleep' | 'celebrate' | 'pray' | 'sing' | 'work'
  | 'run' | 'jump' | 'spin' | 'float' | 'calm' | 'fight';

export const BEHAVIOR_STATE: Readonly<Record<Behavior, StateId>> = {
  dance: STATE.DANCE,
  panic: STATE.PANIC,
  sleep: STATE.SLEEP,
  celebrate: STATE.CELEBRATE,
  pray: STATE.PRAY,
  sing: STATE.SING,
  work: STATE.WORK,
  run: STATE.RUN,
  jump: STATE.JUMP,
  spin: STATE.SPIN,
  float: STATE.FLOAT,
  calm: STATE.CALM,
  fight: STATE.PANIC, // comic: "fighting" is just flailing
};

export const MOODS = ['neutral', 'happy', 'sad', 'angry', 'scared', 'excited', 'confused', 'inspired', 'sleepy', 'resigned'] as const;
export type Mood = (typeof MOODS)[number];

export function moodIndex(m: Mood): number {
  return MOODS.indexOf(m);
}
