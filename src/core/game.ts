import { AudioManager } from '../audio/audio-manager';
import { SoundDirector } from '../audio/sound-director';
import { MusicDirector } from '../audio/music';
import { MissionStory } from '../gameplay/battle/mission-story';
import { ShoutDirector } from '../gameplay/battle/shouts';
import { CommandManager } from '../commands/command-manager';
import { CommandContext } from '../commands/context/command-context';
import type { EffectServices } from '../commands/executor/effect-services';
import { createDefaultRegistry, Executor } from '../commands/executor/executor';
import { BuildService } from '../gameplay/base/build-service';
import { BattleController } from '../gameplay/battle/battle-controller';
import { nextMission, MISSIONS } from '../gameplay/missions/mission-defs';
import { CombatSystem } from '../gameplay/combat/combat-system';
import { FireSystem } from '../gameplay/fire/fire-system';
import { ENTITY_FLAG } from '../entities/entity-manager';
import { SceneManager } from '../gameplay/scene/scene-manager';
import { GameState } from '../gameplay/state/game-state';
import { InteractionRouter } from '../ui/interaction-router';
import { CameraInput } from '../rendering/camera/camera-input';
import { CameraRig } from '../rendering/camera/camera-rig';
import { FxDirector } from '../rendering/fx/fx-director';
import { JuiceDirector } from '../rendering/fx/juice-director';
import { buildModelCatalog } from '../rendering/models/model-catalog';
import { Renderer3D } from '../rendering/renderer3d';
import { BrainSystem } from '../systems/ai/brain-system';
import { DialogueSystem } from '../systems/dialogue/dialogue-system';
import { Chronicle } from '../systems/memory/chronicle';
import { MovementSystem } from '../systems/movement/movement-system';
import { NormalcySystem } from '../systems/normalcy/normalcy-system';
import { ZPhysicsSystem } from '../systems/physics-z/z-physics-system';
import { SystemRunner } from '../systems/system-runner';
import { WeatherSystem } from '../systems/weather/weather-system';
import { mountUi, type UiHandles } from '../ui/ui-root';
import { CAMERA_DIST_START, CAMERA_PITCH as CAMERA_PITCH_DEFAULT, CAMERA_YAW as CAMERA_YAW_DEFAULT } from './config/render.config';
import { DEFAULT_SEED, ISLAND_CENTER } from './config/world.config';
import { EventBus } from './events/event-bus';
import { GameLoop } from './game-loop';
import { createLogger } from './logger/logger';
import { FrameStats } from './perf/frame-stats';
import { createWorld, type WorldBundle } from './world-bundle';

const log = createLogger('game');
const AUTOSAVE_MS = 10000;
/** Fire crackles are rolled at 10 Hz. */
const SOUND_TICK_MS = 100;
/** Mission hover spot relative to the camera target: beside the village, in view but not over it. */
const GOD_BATTLE_DX = 22;
const GOD_BATTLE_DY = -2;
/** Mission fly-in camera: start out over the sea, low and wide. */
const FLY_IN_OFFSET = 70;
const FLY_IN_DIST = 1.4;
const FLY_IN_YAW = -0.9;
const FLY_IN_PITCH = 0.55;
const FLY_IN_EASE = 1.1;
const FLY_IN_SECONDS = 4;

/**
 * Composition root: the only place that knows every concrete class.
 * World → models → 3D renderer → systems → command engine → UI → loop.
 */
export class Game {
  private constructor(readonly world: WorldBundle, readonly loop: GameLoop, readonly ui: UiHandles, readonly bus: EventBus) {}

  /** After the loading screen: the opening cinematic and main menu (or straight into the demo). */
  playIntro(demo: boolean): void {
    this.bus.emit('IntroRequested', { demo });
  }

  static start(stage: HTMLElement, uiRoot: HTMLElement): Game | undefined {
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get('seed') ?? DEFAULT_SEED) || DEFAULT_SEED;
    const state = params.has('newgame') ? GameState.fresh() : GameState.load();
    const world = createWorld(seed, state.base.buildings);
    const bus = new EventBus();
    const stats = new FrameStats();
    const realTime = (): number => performance.now() / 1000;
    const rig = new CameraRig(ISLAND_CENTER + 10, ISLAND_CENTER + 6);
    rig.snap(ISLAND_CENTER + 10, ISLAND_CENTER + 6, CAMERA_DIST_START);
    rig.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: Renderer3D;
    try {
      renderer = new Renderer3D(stage, rig, buildModelCatalog(), world.em, world.kinds, world.tables, world.layout, world.params, world.labels, `${state.profile.name} · God of Goa`);
    } catch (err) {
      log.error('WebGL unavailable', err);
      uiRoot.innerHTML = '<div class="fatal">This island needs WebGL to render.<br>Please try a recent Chrome, Edge or Firefox.</div>';
      return undefined;
    }
    const groundAt = (x: number, y: number): number => renderer.groundAt(x, y);
    const juice = new JuiceDirector(world.em, renderer.particles, world.rng.cosmetic, realTime, groundAt, bus);
    renderer.sync.juice = juice;
    const fx = new FxDirector(renderer.particles, rig, world.em, world.tables, world.params, world.rng.cosmetic, groundAt, (o) => renderer.god.handsPosition(o), bus);


    const sim = new SystemRunner();
    sim.add(new BrainSystem(world.em, world.tables, world, world.params, world.clock, world.rng.ai));
    sim.add(new MovementSystem(world.em, world.tables, world, world.params));
    sim.add(new ZPhysicsSystem(world.em, world.tables, world.params));
    sim.add(new WeatherSystem(world.em, world.params, world.factory, rig, bus, world.rng.weather, realTime));
    const combat = new CombatSystem(world.em, world.kinds, world.tables, world, bus, world.rng.ai, realTime);
    sim.add(combat);
    const fire = new FireSystem(world.em, world.params, bus, world.rng.weather, (id, amount) => combat.damage(id, amount), (id) => combat.tables.isBuilding[world.em.kind[id] ?? 0] === 1);
    sim.add(fire);
    combat.igniter = (x, y, radius) => {
      const em = world.em;
      for (let i = 0; i < em.highWater; i++) {
        if (em.alive[i] !== 1 || (em.team[i] ?? 0) === 2 || em.hasFlag(i, ENTITY_FLAG.DESTROYED)) continue;
        if (Math.hypot((em.x[i] ?? 0) - x, (em.y[i] ?? 0) - y) <= radius + (combat.tables.footprint[em.kind[i] ?? 0] ?? 0)) fire.ignite(i);
      }
    };
    const battle = new BattleController(world, combat, bus, state, realTime, fire);
    sim.add({ name: 'battle', step: (dt, t) => battle.step(dt, t) });
    const scenes = new SceneManager(world, renderer, rig, combat, battle, state, bus);
    const always = new SystemRunner();
    const mood = new NormalcySystem(bus);
    always.add(new DialogueSystem(world.em, world.tables, bus, rig, world.clock, world.rng.ai));
    always.add(mood);
    // Resources change only through missions, rewards and god gifts (no passive trickle).
    const chronicle = new Chronicle(bus, world.clock);

    const context = new CommandContext();
    let manager: CommandManager | undefined;
    const services: EffectServices = {
      em: world.em, kinds: world.kinds, factory: world.factory, props: world.props, params: world.params,
      clock: world.clock, bus, rng: world.rng.improv, view: rig, labels: world.labels, context, realTime,
      get layout() { return world.layout; },
      powers: {
        inBattle: () => battle.active,
        damage: (id, amount) => combat.damage(id, amount),
        ignite: (id) => fire.ignite(id),
        extinguishAll: () => fire.extinguishAll(),
        burning: () => fire.count,
      },
      schedule: (s, fn) => manager?.schedule(s, fn),
    };
    const executor = new Executor(createDefaultRegistry(), services);
    manager = new CommandManager(bus, executor, context, () => world.em.names.values());

    const builder = new BuildService(world, state, bus, () => scenes.scene === 'home', realTime);
    const story = new MissionStory(bus, () => battle.villageStats().villagers);
    new ShoutDirector(bus, world.em, combat.tables, world.rng.cosmetic);
    const ui = mountUi(uiRoot, { bus, world, rig, renderer, stats, sim, mood, chronicle, debug: params.has('debug'), state, battle, builder, story });
    fx.projectiles = combat.view;
    ui.cameraInput = new CameraInput(renderer.gl.domElement, rig, () => ui.commandBar.isEmpty(), () => ui.commandBar.focus());
    const router = new InteractionRouter(rig, renderer, world, battle, ui.battleHud, scenes, bus);
    ui.cameraInput.onClick = (x, y) => router.click(x, y);
    ui.cameraInput.onHover = (x, y) => router.hover(x, y);
    wireScenes(bus, scenes, battle, ui, context, state);
    wireCamera(bus, rig, renderer);

    const audio = new AudioManager();
    const sound = new SoundDirector(audio, bus, () => fire.count);
    new MusicDirector(audio, bus);
    window.setInterval(() => sound.update(SOUND_TICK_MS / 1000), SOUND_TICK_MS);
    const loop = new GameLoop({ world, bus, stats, rig, renderer, fx, juice, sim, always, manager, ui });
    loop.start();
    window.setInterval(() => state.save(), AUTOSAVE_MS);
    window.addEventListener('beforeunload', () => state.save());
    const game = new Game(world, loop, ui, bus);
    if (params.has('debug')) exposeDebugHandle(game, stats, ui, rig, battle);
    return game;
  }
}

/** HUD buttons → scene changes and battle actions. */
function wireScenes(bus: EventBus, scenes: SceneManager, battle: BattleController, ui: UiHandles, context: CommandContext, state: GameState): void {
  bus.on('UiAction', ({ action, arg }) => {
    if (action === 'home') scenes.goHome();
    else if (action === 'attack') {
      const m = nextMission(state.campaign.completed) ?? MISSIONS[MISSIONS.length - 1];
      const reason = m ? scenes.startMission(m.id) : 'No missions.';
      if (reason) bus.emit('ToastRequested', { text: reason });
    }
    else if (action === 'start-mission' || action === 'scout') {
      const reason = scenes.startMission(arg ?? '', action === 'scout');
      if (reason) bus.emit('ToastRequested', { text: reason });
    } else if (action === 'retreat') battle.retreat();
    else if (action === 'help') bus.emit('HelpRequested', {});
  });
  bus.on('SceneChanged', ({ scene, island }) => {
    context.clear();
    ui.hud.setScene(scene, scene === 'battle' ? `⚔ ${island}` : '');
  });
}

/** Impact Cam, god beam and voice camera commands. */
function wireCamera(bus: EventBus, rig: CameraRig, renderer: Renderer3D): void {
  bus.on('CommandExecuted', ({ command, result }) => {
    if (command.magnitude <= 0) return;
    const x = result.hasFocus ? result.focusX : rig.centerX;
    const y = result.hasFocus ? result.focusY : rig.centerY;
    rig.impact(x, y, command.magnitude, result.hasFocus);
    renderer.god.cast(x, y);
  });
  bus.on('ImpactRequested', ({ x, y, magnitude, flash }) => {
    rig.impact(x, y, magnitude, false);
    renderer.flash(flash);
  });
  // In a mission the god hovers in front of the village so you can see yourself defending it.
  bus.on('SceneChanged', ({ scene }) => {
    if (scene === 'battle') {
      renderer.god.hoverOver(rig.centerX + GOD_BATTLE_DX, rig.centerY + GOD_BATTLE_DY);
      // Fly in from the raiders' side of the sea, low and wide, then settle over the village.
      const x = rig.centerX;
      const y = rig.centerY;
      const dist = rig.distance;
      rig.snapView(x + FLY_IN_OFFSET, y, dist * FLY_IN_DIST, CAMERA_YAW_DEFAULT + FLY_IN_YAW, FLY_IN_PITCH);
      rig.glideTo(x, y, dist, CAMERA_YAW_DEFAULT, CAMERA_PITCH_DEFAULT, FLY_IN_EASE, FLY_IN_SECONDS);
    } else renderer.god.hoverOver();
  });
  bus.on('CameraRequested', ({ action, x, y }) => {
    if (action === 'zoom-in') rig.zoomIn();
    else if (action === 'zoom-out') rig.zoomOut();
    else if (action === 'overview') rig.overview();
    else rig.focus(x, y);
  });
}

/** `?debug` only: a read-only handle for profiling from DevTools. */
function exposeDebugHandle(game: Game, stats: FrameStats, ui: UiHandles, rig: CameraRig, battle: BattleController): void {
  Object.assign(window, {
    __averageTuesday: {
      stats,
      entities: () => game.world.em.count,
      camera: () => ({ x: rig.centerX, y: rig.centerY, distance: rig.distance, viewHeight: rig.viewHeight }),
      say: (text: string) => ui.commandBar.submit(text, 'text'),
      newspaper: () => ({ open: ui.newspaper.isOpen(), pngBytes: ui.newspaper.exportBlob().then((b) => b?.size ?? 0) }),
      action: (action: string, arg?: string) => game.bus.emit('UiAction', { action: action as never, ...(arg ? { arg } : {}) }),
      battle: () => ({ phase: battle.phase, energy: battle.energy, timeLeft: Math.round(battle.timeLeft), reason: battle.endReason, objectives: battle.objectives.map((o) => `${o.def.type}:${o.progress}/${o.target}${o.done ? ' done' : ''}${o.failed ? ' FAILED' : ''}`) }),
      landAll: () => battle.deployAll(),
      village: () => battle.villageStats(),
      advance: (seconds: number) => game.loop.advance(seconds),
      units: () => {
        const em = game.world.em;
        const out: string[] = [];
        for (let i = 0; i < em.highWater; i++) if (em.alive[i] === 1 && (em.team[i] ?? 0) !== 0) out.push(`${game.world.kinds.def(em.kind[i] ?? 0)?.name}#${i} t${em.team[i]} ${Math.round(em.hp[i] ?? 0)}/${Math.round(em.maxHp[i] ?? 0)} ->${em.targetId[i]} @${Math.round(em.x[i] ?? 0)},${Math.round(em.y[i] ?? 0)} f${em.flags[i]}`);
        return out;
      },
      where: (kind: string) => {
        const em = game.world.em;
        const k = game.world.kinds.id(kind);
        const pts: [number, number][] = [];
        for (let i = 0; i < em.count; i++) if (em.kind[i] === k) pts.push([Math.round(em.x[i] ?? 0), Math.round(em.y[i] ?? 0)]);
        return pts;
      },
      ability: (name: string, x: number, y: number) => battle.useAbility(name as never, x, y),
    },
  });
}
