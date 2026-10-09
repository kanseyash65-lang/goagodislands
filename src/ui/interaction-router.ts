import type { IEventBus } from '../core/events/event-bus';
import type { WorldBundle } from '../core/world-bundle';
import { ENTITY_FLAG } from '../entities/entity-manager';
import type { BattleController } from '../gameplay/battle/battle-controller';
import type { SceneManager } from '../gameplay/scene/scene-manager';
import type { CameraRig } from '../rendering/camera/camera-rig';
import type { Renderer3D } from '../rendering/renderer3d';
import type { BattleHud } from './battle/battle-hud';

const PICK_RADIUS = 5;

/** Something else (build mode) may claim clicks first. */
export interface ClickClaimer {
  handleClick(x: number, y: number): boolean;
  handleHover?(x: number, y: number): void;
}

/**
 * Turns a tap on the 3D island into the right action: deploy a squad, fire an
 * armed ability, place a defense kit item, scout a jungle marker, build, or
 * select a building/unit.
 */
export class InteractionRouter {
  claimer: ClickClaimer | null = null;
  private readonly p = { x: 0, y: 0 };

  constructor(
    private readonly rig: CameraRig,
    private readonly renderer: Renderer3D,
    private readonly world: WorldBundle,
    private readonly battle: BattleController,
    private readonly hud: BattleHud,
    private readonly scenes: SceneManager,
    private readonly bus: IEventBus,
  ) {}

  hover(px: number, py: number): void {
    if (!this.claimer?.handleHover) return;
    if (this.rig.screenToGround(px, py, this.renderer.cssWidth, this.renderer.cssHeight, this.p)) this.claimer.handleHover(this.p.x, this.p.y);
  }

  click(px: number, py: number): void {
    if (!this.rig.screenToGround(px, py, this.renderer.cssWidth, this.renderer.cssHeight, this.p)) return;
    const { x, y } = this.p;
    if (this.claimer?.handleClick(x, y)) return;
    if (this.scenes.scene === 'battle' && this.battle.active && this.battleClick(x, y)) return;
    this.select(x, y);
  }

  private battleClick(x: number, y: number): boolean {
    const b = this.battle;
    const armed = this.hud.armed;
    if (armed?.type === 'ability') {
      const reason = b.useAbility(armed.name, x, y);
      if (reason) this.bus.emit('ToastRequested', { text: reason });
      else this.hud.disarm();
      return true;
    }
    if (armed?.type === 'kit') {
      if (!b.placeKit(armed.kind, x, y)) this.bus.emit('ToastRequested', { text: 'Cannot place that here.' });
      return true;
    }
    if (b.phase === 'scouting' && b.scoutMarkers.length > 0 && b.scoutAt(x, y)) {
      this.bus.emit('ToastRequested', { text: 'Defense spotted!' });
      return true;
    }
    const index = armed?.type === 'squad' ? armed.index : b.squads.findIndex((s) => !s.deployed);
    if (index < 0 || !b.canDeploy()) return false;
    const ok = b.phase === 'prep' ? b.positionSquad(index, x, y) : b.deploy(index, x, y);
    if (ok) this.hud.disarm();
    return ok;
  }

  private select(x: number, y: number): void {
    const em = this.world.em;
    let best = -1;
    let bestD = PICK_RADIUS;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1 || em.hasFlag(i, ENTITY_FLAG.HIDDEN)) continue;
      const d = Math.hypot((em.x[i] ?? 0) - x, (em.y[i] ?? 0) - y) - ((em.maxHp[i] ?? 0) > 0 ? 1.5 : 0);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.renderer.sync.selected = best;
    this.bus.emit('EntitySelected', { id: best });
  }
}
