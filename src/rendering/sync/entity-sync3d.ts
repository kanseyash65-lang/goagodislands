import { Matrix4, Vector3, type Material, type Scene } from 'three';
import { HIT_FLASH_SECONDS } from '../../core/config/combat.config';
import { WINDMILL_SPIN } from '../../core/config/render.config';
import type { KindRegistry } from '../../entities/definitions/kinds';
import { MOB, type KindTables } from '../../entities/definitions/mobility-codes';
import { ENTITY_FLAG, type EntityManager } from '../../entities/entity-manager';
import { footprintOf } from '../../gameplay/economy/building-catalog';
import { STATE } from '../../types/behavior';
import { heightAt, type WorldLayout } from '../../world/world-layout';
import type { WorldParams } from '../../world/world-params';
import type { JuiceState } from '../fx/juice-director';
import type { HealthBars } from '../hud3d/health-bars';
import type { LabelSprites } from '../hud3d/label-sprites';
import { InstancedLayer } from '../layers/instanced-layer';
import type { Attachment, ModelCatalog } from '../models/model-catalog';
import { hueToRgb } from './hue';

const WALK_FREQ = 9;
const TURN_RATE = 10;
const LIE_DOWN = -1.4;
const RUBBLE_BASE = 2.8;
const LABEL_GAP = 1.2;
const BAR_GAP = 0.9;
const BOAT_BOB = 0.18;

interface KindVisual {
  readonly body: InstancedLayer | undefined;
  readonly height: number;
  readonly attach: readonly { readonly layer: InstancedLayer; readonly a: Attachment }[];
}

const mParent = new Matrix4();
const mLocal = new Matrix4();
const mOut = new Matrix4();
const vScale = new Vector3();

/**
 * Renderer-side, read-only sync: entity columns → instanced meshes.
 * Never mutates simulation state (facing memory lives here).
 */
export class EntitySync3D {
  juice: JuiceState | null = null;
  selected = -1;
  drawn = 0;
  private readonly layers = new Map<string, InstancedLayer>();
  private readonly visuals: KindVisual[];
  private readonly heading: Float32Array;
  private readonly rubble: InstancedLayer | undefined;
  private layout: WorldLayout;
  private readonly names: readonly string[];

  constructor(
    scene: Scene,
    material: Material,
    private readonly catalog: ModelCatalog,
    private readonly em: EntityManager,
    kinds: KindRegistry,
    private readonly tables: KindTables,
    layout: WorldLayout,
    private readonly params: WorldParams,
    private readonly bars: HealthBars,
    private readonly labels: LabelSprites,
  ) {
    this.layout = layout;
    this.names = kinds.defs.map((d) => d.name);
    for (const [key, geo] of catalog.geometries) this.layers.set(key, new InstancedLayer(geo, material, scene));
    this.visuals = kinds.defs.map((d) => {
      const km = catalog.kindModel(d.name);
      if (!km) return { body: undefined, height: 2, attach: [] };
      const attach = km.attachments.flatMap((a) => {
        const layer = this.layers.get(a.model);
        return layer ? [{ layer, a }] : [];
      });
      return { body: this.layers.get(km.body), height: catalog.height(km.body), attach };
    });
    this.rubble = this.layers.get('rubble');
    this.heading = new Float32Array(em.capacity);
  }

  setLayout(layout: WorldLayout): void {
    this.layout = layout;
  }

  sync(now: number, dt: number): void {
    for (const l of this.layers.values()) l.begin();
    this.bars.begin();
    this.labels.begin();
    const em = this.em;
    let drawn = 0;
    for (let i = 0; i < em.highWater; i++) {
      if (em.alive[i] !== 1) continue;
      const k = em.kind[i] ?? 0;
      const mob = this.tables.mobility[k] ?? MOB.STATIC;
      if (mob === MOB.CELESTIAL || mob === MOB.ENV) continue;
      if (((em.flags[i] ?? 0) & ENTITY_FLAG.HIDDEN) !== 0) continue;
      if ((em.opacity[i] ?? 1) <= 0.01) continue;
      this.drawOne(i, k, mob, now, dt);
      drawn++;
    }
    for (const l of this.layers.values()) l.commit();
    this.bars.commit();
    this.labels.commit();
    this.drawn = drawn;
  }

  private drawOne(i: number, k: number, mob: number, now: number, dt: number): void {
    const em = this.em;
    const vis = this.visuals[k];
    if (!vis?.body) return;
    const x = em.x[i] ?? 0;
    const y = em.y[i] ?? 0;
    const z = em.z[i] ?? 0;
    const ground = heightAt(this.layout, x, y);
    let base = mob === MOB.CLOUD ? 0 : ground;
    if (mob === MOB.BOAT || (mob === MOB.STATIC && ground < 0.1)) base = Math.max(ground, 0) + Math.sin(now * 1.6 + i) * BOAT_BOB;
    const s0 = em.scale[i] ?? 1;
    if (((em.flags[i] ?? 0) & ENTITY_FLAG.DESTROYED) !== 0) {
      const s = footprintOf(this.kindName(k)) / RUBBLE_BASE;
      this.rubble?.push(x, base, y, em.rot[i] ?? 0, 0, s, s * 0.8, s, 1, 1, 1, 0, 0, 0);
      return;
    }
    const moving = mob === MOB.VILLAGER || mob === MOB.ANIMAL || mob === MOB.TROOP || mob === MOB.FLYER || mob === MOB.BOAT;
    let yaw = em.rot[i] ?? 0;
    if (moving) yaw = this.updateHeading(i, dt) + yaw;
    const st = em.state[i] ?? STATE.IDLE;
    const anim = em.animTime[i] ?? 0;
    let roll = 0;
    let bob = 0;
    let amp = 0;
    if (moving && mob !== MOB.BOAT) {
      const walking = st === STATE.WALK || st === STATE.RUN || st === STATE.PANIC || Math.hypot(em.vx[i] ?? 0, em.vy[i] ?? 0) > 0.05;
      const dancing = st === STATE.DANCE || st === STATE.CELEBRATE || st === STATE.SING;
      if (walking) {
        amp = st === STATE.PANIC || st === STATE.RUN ? 0.85 : 0.55;
        bob = Math.abs(Math.sin(anim * WALK_FREQ)) * 0.08;
      } else if (dancing) {
        amp = 1;
        bob = Math.abs(Math.sin(anim * 9)) * 0.35;
        yaw += Math.sin(anim * 3) * 0.6;
      }
      if (st === STATE.SLEEP && mob === MOB.VILLAGER) roll = LIE_DOWN;
      if (z > 0.6 && this.params.gravity <= 0) roll = Math.sin(now * 1.3 + i) * 0.6;
    }
    let sx = s0;
    let sy = s0;
    const juice = this.juice;
    if (juice && juice.active[i] === 1) {
      sx *= juice.sx[i] ?? 1;
      sy *= juice.sy[i] ?? 1;
    }
    const py = base + z + bob;
    let r = em.tintR[i] ?? 1;
    let g = em.tintG[i] ?? 1;
    let b = em.tintB[i] ?? 1;
    if (((em.flags[i] ?? 0) & ENTITY_FLAG.RAINBOW) !== 0) {
      const c = hueToRgb((now * 0.35 + i * 0.07) % 1);
      r = c.r; g = c.g; b = c.b;
    }
    if ((em.glow[i] ?? 0) > 0) {
      const p = 1.25 + Math.sin(now * 5 + i) * 0.25;
      r *= p; g *= p; b *= p;
    }
    const hitAge = now - (em.hitTime[i] ?? -1000);
    const flash = hitAge < HIT_FLASH_SECONDS ? 1 - hitAge / HIT_FLASH_SECONDS : 0;
    // Tints are authored in display space; the shader works in linear light.
    vis.body.push(x, py, y, yaw, roll, sx, sy, sx, r * r, g * g, b * b, anim * WALK_FREQ, amp, flash);
    if (vis.attach.length > 0) this.drawAttachments(vis, i, x, py, y, yaw, sx, now);
    const top = py + vis.height * sy;
    const maxHp = em.maxHp[i] ?? 0;
    if (maxHp > 0 && ((em.hp[i] ?? 0) < maxHp || i === this.selected)) {
      const width = mob === MOB.STATIC ? Math.max(3, footprintOf(this.kindName(k)) * 1.1) : 1.6;
      this.bars.push(x, top + BAR_GAP, y, (em.hp[i] ?? 0) / maxHp, width, em.team[i] ?? 0, i === this.selected ? 1 : 0);
    }
    const slot = em.labelSlot[i] ?? -1;
    if (slot >= 0) this.labels.push(slot, x, top + LABEL_GAP, y);
  }

  private drawAttachments(vis: KindVisual, i: number, x: number, py: number, y: number, yaw: number, s: number, now: number): void {
    mParent.makeRotationY(yaw).scale(vScale.set(s, s, s)).setPosition(x, py, y);
    for (const { layer, a } of vis.attach) {
      if (a.mode === 'aim') mLocal.makeRotationY((this.em.aimYaw[i] ?? 0) - yaw);
      else if (a.mode === 'spinZ') mLocal.makeRotationZ(-now * WINDMILL_SPIN * (0.5 + this.params.windX * 0.25) * a.speed);
      else mLocal.makeRotationY(now * a.speed);
      mLocal.setPosition(a.offset[0], a.offset[1], a.offset[2]);
      mOut.multiplyMatrices(mParent, mLocal);
      layer.pushM4(mOut, 1, 1, 1);
    }
  }

  private updateHeading(i: number, dt: number): number {
    const vx = this.em.vx[i] ?? 0;
    const vy = this.em.vy[i] ?? 0;
    let h = this.heading[i] ?? 0;
    if (vx * vx + vy * vy > 0.0004) {
      const want = Math.atan2(vx, vy);
      let d = want - h;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      h += d * Math.min(1, dt * TURN_RATE);
      this.heading[i] = h;
    }
    return h;
  }

  private kindName(k: number): string {
    return this.names[k] ?? '';
  }
}
