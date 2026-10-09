import type { EventBus } from '../core/events/event-bus';
import type { FrameStats } from '../core/perf/frame-stats';
import type { WorldBundle } from '../core/world-bundle';
import type { CameraInput } from '../rendering/camera/camera-input';
import type { CameraRig } from '../rendering/camera/camera-rig';
import type { GameState } from '../gameplay/state/game-state';
import { Hud } from './hud/hud';
import { GodLabel } from './god-label/god-label';
import type { BattleController } from '../gameplay/battle/battle-controller';
import { BattleHud } from './battle/battle-hud';
import { ResultsPanel } from './battle/results-panel';
import { ScoutMarkers } from './battle/scout-markers';
import { ArchipelagoMap } from './map/archipelago-map';
import type { Renderer3D } from '../rendering/renderer3d';
import type { IChronicle } from '../systems/memory/chronicle';
import type { IMoodState } from '../systems/normalcy/normalcy-system';
import type { SystemRunner } from '../systems/system-runner';
import { BubbleLayer } from './bubbles/bubble-layer';
import { ChroniclePanel } from './chronicle-panel/chronicle-panel';
import { CommandBar } from './command-bar/command-bar';
import { DebugOverlay } from './debug/debug-overlay';
import { NewspaperPanel } from './newspaper/newspaper-panel';
import { StartScreen } from './title-card/start-screen';
import { Coach } from './battle/coach';
import { Autopilot } from './demo/autopilot';
import { AboutPanel } from './about/about-panel';
import type { MissionStory } from '../gameplay/battle/mission-story';
import { ToastLayer } from './toasts/toast-layer';
import { TopBar } from './topbar/topbar';
import { STATS_REFRESH_MS } from '../core/config/ui.config';
import type { BuildService } from '../gameplay/base/build-service';
import { ArmyPanel } from './army/army-panel';
import { BuildPanel } from './build/build-panel';

export interface UiDeps {
  readonly bus: EventBus;
  readonly world: WorldBundle;
  readonly rig: CameraRig;
  readonly renderer: Renderer3D;
  readonly stats: FrameStats;
  readonly sim: SystemRunner;
  readonly mood: IMoodState;
  readonly chronicle: IChronicle;
  readonly debug: boolean;
  readonly state: GameState;
  readonly battle: BattleController;
  readonly builder: BuildService;
  readonly story: MissionStory;
}

export interface UiHandles {
  readonly commandBar: CommandBar;
  readonly newspaper: NewspaperPanel;
  readonly hud: Hud;
  readonly battleHud: BattleHud;
  readonly map: ArchipelagoMap;
  cameraInput?: CameraInput;
  update(): void;
}

/** Mounts every panel; per-frame work is limited to bubbles + waveform, stats at ≤ 4 Hz. */
export function mountUi(root: HTMLElement, d: UiDeps): UiHandles {
  const commandBar = new CommandBar(d.bus, d.world.rng.cosmetic);
  const topbar = new TopBar(d.world.clock, d.world.params, d.mood, d.world.em, d.world.kinds);
  const bubbles = new BubbleLayer(d.bus, d.world.em, d.rig, () => ({ w: d.renderer.cssWidth, h: d.renderer.cssHeight }), (x, y) => d.renderer.groundAt(x, y));
  const debug = new DebugOverlay(d.bus, d.stats, d.sim, d.debug);
  const newspaper = new NewspaperPanel(d.bus, {
    chronicle: d.chronicle, mood: d.mood, params: d.world.params, clock: d.world.clock, em: d.world.em, rng: d.world.rng.cosmetic,
    capture: (cb) => d.renderer.requestCapture(cb),
  });
  const hud = new Hud(d.bus, d.state);
  const godLabel = new GodLabel(d.renderer.god, d.rig, d.state, () => ({ w: d.renderer.cssWidth, h: d.renderer.cssHeight }));
  const battleHud = new BattleHud(d.bus, d.battle, d.state);
  const coach = new Coach(d.bus, d.battle);
  const map = new ArchipelagoMap(d.bus, d.state);
  const markers = new ScoutMarkers(d.battle, d.rig, () => ({ w: d.renderer.cssWidth, h: d.renderer.cssHeight }), (x, y) => d.renderer.groundAt(x, y));
  const panels = [bubbles, godLabel, hud, topbar, new ChroniclePanel(d.bus), new ToastLayer(d.bus), debug, commandBar, newspaper, battleHud, markers, coach, new ResultsPanel(d.bus, d.state, d.battle, d.story), map, new ArmyPanel(d.bus, d.state), new BuildPanel(d.bus, d.state, d.builder),
    new AboutPanel(d.bus), new Autopilot(d.bus, d.battle, commandBar), new StartScreen(d.bus, d.rig, d.renderer.god, d.state)];
  for (const p of panels) p.mount(root);
  let lastStats = 0;
  return {
    commandBar,
    newspaper,
    hud,
    battleHud,
    map,
    update(): void {
      bubbles.update();
      markers.update();
      godLabel.update();
      commandBar.update();
      const now = performance.now();
      if (now - lastStats >= STATS_REFRESH_MS) {
        lastStats = now;
        topbar.update();
        hud.update();
        battleHud.update();
        coach.update();
        debug.update();
      }
    },
  };
}
