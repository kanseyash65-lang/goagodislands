import type { Command, CommandSource } from '../../commands/types';
import type { Rgb } from '../../types/rgb';
import type { WeatherKind } from '../../types/weather';
import type { SpecialEdition } from '../../gameplay/battle/mission-story';

/** Dialogue bank keys used to pick NPC reaction lines. */
export type ReactionKind =
  | 'sky' | 'gravityOff' | 'gravityReverse' | 'gravityOn' | 'chickens' | 'spawnMany' | 'spawn'
  | 'rain' | 'snow' | 'weather' | 'itemRain' | 'dance' | 'behavior' | 'time' | 'improv' | 'dragon'
  | 'destroy' | 'size' | 'color' | 'blessing' | 'harm' | 'disaster' | 'generic' | 'none';

/** What an effect reports back for the log, camera, juice, dialogue and newspaper. */
export interface EffectResult {
  readonly text: string;
  readonly focusX: number;
  readonly focusY: number;
  readonly hasFocus: boolean;
  /** Sample of affected entity ids (capped). */
  readonly ids: readonly number[];
  readonly affected: number;
  readonly reaction: ReactionKind;
  /** Display word for headlines ("chickens", "green", "pineapple"). */
  readonly subject: string;
  readonly improvised: boolean;
}

export type UiActionName =
  | 'map' | 'build' | 'army' | 'missions' | 'home' | 'attack' | 'settings' | 'help' | 'chronicle'
  | 'scout' | 'close-panels' | 'start-mission' | 'retreat' | 'mute' | 'pause' | 'demo' | 'about' | 'skip-coach';

/** Event payloads (immutable facts, past tense). */
export interface GameEvents {
  CommandSubmitted: { readonly raw: string; readonly source: CommandSource };
  CommandParsed: { readonly raw: string; readonly commands: readonly Command[] };
  CommandExecuted: { readonly command: Command; readonly result: EffectResult };
  EntitiesSpawned: { readonly ids: readonly number[]; readonly count: number; readonly kind: string; readonly x: number; readonly y: number };
  EntitiesDestroyed: { readonly count: number; readonly kind: string; readonly points: readonly number[] };
  PropertyChanged: { readonly ids: readonly number[]; readonly property: string };
  SunColorChanged: { readonly color: Rgb };
  WeatherChanged: { readonly weather: WeatherKind };
  GravityChanged: { readonly gravity: number };
  CameraRequested: { readonly action: 'zoom-in' | 'zoom-out' | 'overview' | 'focus'; readonly x: number; readonly y: number };
  ImpactRequested: { readonly x: number; readonly y: number; readonly magnitude: number; readonly flash: number };
  DialogueSpoken: { readonly id: number; readonly text: string; readonly priority: number };
  ChronicleEntryAdded: { readonly text: string; readonly magnitude: number; readonly minutes: number; readonly day: number };
  /** Print a front page; `special` is a front page written about one mission (the victory edition). */
  NewspaperRequested: { readonly special?: SpecialEdition };
  NewspaperClosed: Record<string, never>;
  DebugToggled: Record<string, never>;
  HelpRequested: Record<string, never>;
  ToastRequested: { readonly text: string };
  // Combat facts (rendering/audio react; systems never call the renderer)
  ShotFired: { readonly kind: string; readonly fx: number; readonly fy: number; readonly fz: number; readonly tx: number; readonly ty: number; readonly tz: number; readonly team: number };
  ExplosionHappened: { readonly x: number; readonly y: number; readonly z: number; readonly radius: number; readonly big: boolean };
  BuildingDestroyed: { readonly id: number; readonly kind: string; readonly team: number; readonly x: number; readonly y: number };
  UnitKilled: { readonly id: number; readonly kind: string; readonly team: number; readonly x: number; readonly y: number };
  SceneChanged: { readonly scene: 'home' | 'battle' | 'map'; readonly island: string };
  UiAction: { readonly action: UiActionName; readonly arg?: string };
  ResourcesChanged: Record<string, never>;
  EntitySelected: { readonly id: number };
  BattleEnded: { readonly victory: boolean; readonly missionId: string; readonly reason: string };
  BattleChanged: Record<string, never>;
  LightningStruck: { readonly x: number; readonly y: number };
  /** Slow the simulation to `scale` for `seconds` of real time (dramatic moments, coaching). */
  SlowMoRequested: { readonly scale: number; readonly seconds: number };
  PauseChanged: { readonly paused: boolean };
  /** The coach is waiting for these words (null when not coaching): the command bar suggests them. */
  CoachChanged: { readonly words: string | null };
  /** Loading finished and the player tapped Begin: play the opening cinematic (or go straight to the demo). */
  IntroRequested: { readonly demo: boolean };
  /** A short villager shout over the battle (Konkani line + English). */
  ShoutRequested: { readonly text: string };
}

export type GameEventName = keyof GameEvents;
