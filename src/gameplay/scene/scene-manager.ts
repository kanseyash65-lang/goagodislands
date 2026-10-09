import { ISLAND_CENTER, ISLAND_RADIUS } from '../../core/config/world.config';
import { CAMERA_DIST_START } from '../../core/config/render.config';
import type { IEventBus } from '../../core/events/event-bus';
import { loadIsland, type WorldBundle } from '../../core/world-bundle';
import type { CameraRig } from '../../rendering/camera/camera-rig';
import type { Renderer3D } from '../../rendering/renderer3d';
import { HOME_ISLAND } from '../../world/island-specs';
import type { BattleController } from '../battle/battle-controller';
import type { CombatSystem } from '../combat/combat-system';
import { missionById, type MissionDef } from '../missions/mission-defs';
import type { GameState } from '../state/game-state';
import { isAvailable } from '../campaign/campaign';

export type SceneName = 'home' | 'battle';

/**
 * Sails between islands: swaps the world (entities + layout), the terrain and
 * ocean depth, resets combat, frames the camera and tells everyone.
 * Production keeps running while away (it reads the HomeBase data).
 */
export class SceneManager {
  scene: SceneName = 'home';
  islandName = 'Home Island';

  constructor(
    private readonly world: WorldBundle,
    private readonly renderer: Renderer3D,
    private readonly rig: CameraRig,
    private readonly combat: CombatSystem,
    private readonly battle: BattleController,
    private readonly state: GameState,
    private readonly bus: IEventBus,
  ) {}

  goHome(): void {
    if (this.battle.active) this.battle.end();
    this.state.save();
    loadIsland(this.world, HOME_ISLAND, this.state.base.buildings);
    this.renderer.setLayout(this.world.layout);
    this.combat.reset();
    this.scene = 'home';
    this.islandName = 'Home Island';
    this.rig.snap(ISLAND_CENTER + 10, ISLAND_CENTER + 6, CAMERA_DIST_START);
    this.bus.emit('SceneChanged', { scene: 'home', island: this.islandName });
  }

  /** Loads a mission island. Returns a reason when it cannot start. */
  startMission(id: string, scoutOnly = false): string | null {
    const m = missionById(id);
    if (!m) return `There is no island called ${id}.`;
    if (!isAvailable(this.state, m)) return `${m.name} is still under fog. Finish the previous mission first.`;
    this.load(m, scoutOnly);
    return null;
  }

  private load(m: MissionDef, scoutOnly: boolean): void {
    this.state.save();
    loadIsland(this.world, m.island);
    this.renderer.setLayout(this.world.layout);
    this.scene = 'battle';
    this.islandName = m.name;
    const size = m.island.style.size;
    this.rig.snap(ISLAND_CENTER + ISLAND_RADIUS * 0.35 * size, ISLAND_CENTER, CAMERA_DIST_START * size);
    this.battle.begin(m, scoutOnly);
    this.bus.emit('SceneChanged', { scene: 'battle', island: m.name });
  }
}
