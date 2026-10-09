import type { CommandManager } from '../commands/command-manager';
import type { CameraRig } from '../rendering/camera/camera-rig';
import type { FxDirector } from '../rendering/fx/fx-director';
import type { JuiceDirector } from '../rendering/fx/juice-director';
import type { Renderer3D } from '../rendering/renderer3d';
import type { SystemRunner } from '../systems/system-runner';
import type { UiHandles } from '../ui/ui-root';
import { LOW_FPS_THRESHOLD } from './config/render.config';
import { MAX_FRAME_DT, MAX_STEPS_PER_FRAME, SIM_STEP } from './config/sim.config';
import type { EventBus } from './events/event-bus';
import type { FrameStats } from './perf/frame-stats';
import type { WorldBundle } from './world-bundle';

export interface LoopDeps {
  readonly world: WorldBundle;
  readonly bus: EventBus;
  readonly stats: FrameStats;
  readonly rig: CameraRig;
  readonly renderer: Renderer3D;
  readonly fx: FxDirector;
  readonly juice: JuiceDirector;
  readonly sim: SystemRunner;
  readonly always: SystemRunner;
  readonly manager: CommandManager;
  readonly ui: UiHandles;
}

const LOW_FPS_SECONDS = 3;
const MIN_TIME_SCALE = 0.05;
const REDUCED_PARTICLE_BUDGET = 2500;
const WHITE = { r: 1, g: 1, b: 1 };

/** Extra per-step work owned by gameplay (combat, economy, battle) registered later. */
export type StepHook = (dt: number, t: number) => void;

/**
 * Main loop (07 §6): commands → fixed-step sim (50 ms) → camera → entity sync
 * → environment → render → UI. The renderer never mutates simulation state.
 */
export class GameLoop {
  readonly hooks: StepHook[] = [];
  private last = 0;
  private acc = 0;
  private lowFpsFor = 0;
  private readonly cache = new Map<string, number>();
  /** Slow motion: sim speed and the real time it ends. */
  private slowScale = 1;
  private slowUntil = 0;
  private paused = false;

  constructor(private readonly d: LoopDeps) {
    d.bus.on('SlowMoRequested', ({ scale, seconds }) => {
      this.slowScale = Math.min(1, Math.max(MIN_TIME_SCALE, scale));
      this.slowUntil = performance.now() + seconds * 1000;
    });
    d.bus.on('UiAction', ({ action }) => {
      if (action !== 'pause') return;
      this.paused = !this.paused;
      d.bus.emit('PauseChanged', { paused: this.paused });
    });
  }

  /** Current sim speed: 0 paused, < 1 in slow motion. */
  timeScale(now: number): number {
    if (this.paused) return 0;
    return now < this.slowUntil ? this.slowScale : 1;
  }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const { stats } = this.d;
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    stats.begin('frame');
    stats.tickFps(dt);
    this.d.manager.update(now);
    this.stepSim(dt * this.timeScale(now));
    this.d.bus.flush();
    this.d.ui.cameraInput?.update(dt);
    this.d.rig.update(dt);
    this.draw(dt, now / 1000);
    stats.begin('ui');
    this.d.ui.update();
    stats.end('ui');
    stats.end('frame');
    this.watchFps(dt);
  };

  /** Debug/test: runs the simulation forward without rendering (works while the tab is hidden). */
  advance(seconds: number): void {
    const steps = Math.round(seconds / SIM_STEP);
    for (let n = 0; n < steps; n++) {
      this.d.manager.update(performance.now());
      this.acc += SIM_STEP;
      this.stepSim(0);
      this.d.bus.flush();
    }
  }

  private stepSim(dt: number): void {
    const { world, stats } = this.d;
    stats.begin('sim');
    this.acc += dt;
    let steps = 0;
    while (this.acc >= SIM_STEP && steps < MAX_STEPS_PER_FRAME) {
      if (!world.clock.frozen) {
        world.clock.advance(SIM_STEP);
        this.d.sim.step(SIM_STEP, world.clock.simTime);
        for (const h of this.hooks) h(SIM_STEP, world.clock.simTime);
      }
      this.d.always.step(SIM_STEP, world.clock.simTime);
      this.acc -= SIM_STEP;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0; // drop backlog rather than spiral
    stats.end('sim');
  }

  private draw(dt: number, nowS: number): void {
    const { world, stats, renderer } = this.d;
    this.d.juice.update();
    stats.add('juice', this.d.juice.takeMs());
    stats.begin('sync');
    renderer.sync.sync(nowS, dt);
    stats.end('sync');
    stats.drawnSprites = renderer.sync.drawn;
    stats.begin('fx');
    this.d.fx.update(dt);
    renderer.particles.update(dt);
    stats.end('fx');
    stats.particles = renderer.particles.count;
    stats.entities = world.em.count;
    renderer.updateEnvironment({
      minutes: world.clock.minutes,
      sun: this.tintOf('sun'),
      sunHidden: (world.em.opacity[this.idOf('sun')] ?? 1) < 0.5,
      sea: this.tintOf('sea'),
      weather: world.params.weather,
      intensity: world.params.weatherIntensity,
      wind: world.params.windX,
    }, dt);
    stats.begin('render');
    stats.drawCalls = renderer.render(nowS, dt);
    stats.end('render');
  }

  /** Environment entities (sun, sea) are looked up once and re-validated after scene changes. */
  private idOf(kind: string): number {
    const { em, kinds } = this.d.world;
    const k = kinds.id(kind);
    const cached = this.cache.get(kind) ?? -1;
    if (cached >= 0 && em.alive[cached] === 1 && em.kind[cached] === k) return cached;
    const id = em.collect((i) => em.kind[i] === k)[0] ?? -1;
    this.cache.set(kind, id);
    return id;
  }

  private tintOf(kind: string): { r: number; g: number; b: number } {
    const i = this.idOf(kind);
    if (i < 0) return WHITE;
    const em = this.d.world.em;
    return { r: em.tintR[i] ?? 1, g: em.tintG[i] ?? 1, b: em.tintB[i] ?? 1 };
  }

  /** Auto quality fallback: sustained low FPS shrinks the particle budget silently. */
  private watchFps(dt: number): void {
    if (this.d.stats.fps < LOW_FPS_THRESHOLD) this.lowFpsFor += dt;
    else this.lowFpsFor = 0;
    const ps = this.d.renderer.particles;
    if (this.lowFpsFor > LOW_FPS_SECONDS && ps.budget > REDUCED_PARTICLE_BUDGET) ps.budget = REDUCED_PARTICLE_BUDGET;
  }
}
