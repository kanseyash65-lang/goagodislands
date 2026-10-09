import {
  CEILING_BOUNCE, GRAVITY_ACCEL, GROUND_BOUNCE, ZERO_G_DAMPING,
} from '../../core/config/sim.config';
import { Z_MAX } from '../../core/config/world.config';
import type { KindTables } from '../../entities/definitions/mobility-codes';
import type { EntityManager } from '../../entities/entity-manager';
import type { WorldParams } from '../../world/world-params';
import type { ISystem } from '../system-runner';

const LANDING_SPEED = 40;
const ROT_SETTLE = 0.9;

/**
 * 2.5D altitude: integrates z/vz under the global gravity law.
 * gravity 0 → leftover velocity drifts (damped); negative → things rise to the
 * ceiling; positive → cartoon falls with a small bounce.
 */
export class ZPhysicsSystem implements ISystem {
  readonly name = 'physics-z';

  constructor(
    private readonly em: EntityManager,
    private readonly tables: KindTables,
    private readonly params: WorldParams,
  ) {}

  step(dt: number): void {
    const em = this.em;
    const g = this.params.gravity;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1) continue;
      if (this.tables.physics[em.kind[i] ?? 0] !== 1 || (em.parent[i] ?? -1) >= 0) continue;
      let z = em.z[i] ?? 0;
      let vz = em.vz[i] ?? 0;
      if (z <= 0 && vz === 0 && g > 0) {
        this.settleRotation(i, dt);
        continue; // resting on the ground: the common case, kept cheap
      }
      if (g === 0) vz *= ZERO_G_DAMPING;
      else vz -= g * GRAVITY_ACCEL * dt;
      z += vz * dt;
      if (z < 0) {
        z = 0;
        vz = vz < -LANDING_SPEED && g > 0 ? -vz * GROUND_BOUNCE : g === 0 ? Math.abs(vz) * GROUND_BOUNCE : 0;
      } else if (z > Z_MAX) {
        z = Z_MAX;
        vz = -Math.abs(vz) * CEILING_BOUNCE;
      }
      em.z[i] = z;
      em.vz[i] = vz;
      em.rot[i] = (em.rot[i] ?? 0) + (em.rotVel[i] ?? 0) * dt;
    }
  }

  /** Landed entities stop tumbling (unless commanded to spin). */
  private settleRotation(i: number, dt: number): void {
    const em = this.em;
    const rv = em.rotVel[i] ?? 0;
    if (rv !== 0 && em.override[i] !== 0) {
      em.rot[i] = (em.rot[i] ?? 0) + rv * dt; // commanded spin keeps going on the ground
      return;
    }
    if (rv !== 0) em.rotVel[i] = 0;
    if (em.rotVel[i] === 0 && em.rot[i] !== 0) {
      const r = (em.rot[i] ?? 0) * ROT_SETTLE;
      em.rot[i] = Math.abs(r) < 0.01 ? 0 : r;
    }
  }
}
