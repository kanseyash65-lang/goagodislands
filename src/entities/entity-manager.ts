import { ENTITY_CAPACITY } from '../core/config/world.config';

/**
 * Struct-of-arrays entity storage. Components are plain typed-array columns
 * indexed by a dense entity id; ids are recycled through a free list.
 * Systems mutate columns; the renderer only reads them.
 */
export class EntityManager {
  readonly capacity: number;
  /** One past the highest id ever used; iterate `0..highWater` and check `alive`. */
  highWater = 0;
  count = 0;

  readonly alive: Uint8Array;
  readonly kind: Uint16Array;
  // Transform + velocity
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  readonly rot: Float32Array;
  readonly rotVel: Float32Array;
  // Render component (data only)
  readonly scale: Float32Array;
  readonly tintR: Float32Array;
  readonly tintG: Float32Array;
  readonly tintB: Float32Array;
  readonly opacity: Float32Array;
  readonly glow: Float32Array;
  /** Bit flags, see ENTITY_FLAG. */
  readonly flags: Uint8Array;
  readonly variant: Uint8Array;
  readonly spawnTime: Float32Array;
  readonly labelSlot: Int16Array;
  readonly parent: Int32Array;
  /** Altitude offset above the parent (accessories such as a tiny hat). */
  readonly attachDz: Float32Array;
  // Brain
  readonly speedMul: Float32Array;
  readonly state: Uint8Array;
  readonly override: Uint8Array;
  readonly overrideUntil: Float32Array;
  readonly thinkAt: Float32Array;
  readonly targetX: Float32Array;
  readonly targetY: Float32Array;
  readonly homeX: Float32Array;
  readonly homeY: Float32Array;
  readonly animTime: Float32Array;
  readonly mood: Uint8Array;
  // Combat (teams: 0 neutral, 1 player, 2 enemy)
  readonly team: Uint8Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly level: Uint8Array;
  readonly cooldown: Float32Array;
  readonly targetId: Int32Array;
  readonly dmgMul: Float32Array;
  /** Turret aim (radians), separate from the building's placement yaw in `rot`. */
  readonly aimYaw: Float32Array;
  /** Real time of the last hit (drives the white hit flash). */
  readonly hitTime: Float32Array;
  /** Display names (villagers); sparse. */
  readonly names = new Map<number, string>();

  private readonly freeList: number[] = [];

  constructor(capacity = ENTITY_CAPACITY) {
    this.capacity = capacity;
    const f = (): Float32Array => new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);
    this.kind = new Uint16Array(capacity);
    this.x = f(); this.y = f(); this.z = f();
    this.vx = f(); this.vy = f(); this.vz = f();
    this.rot = f(); this.rotVel = f();
    this.scale = f();
    this.tintR = f(); this.tintG = f(); this.tintB = f();
    this.opacity = f(); this.glow = f();
    this.flags = new Uint8Array(capacity);
    this.variant = new Uint8Array(capacity);
    this.spawnTime = f();
    this.labelSlot = new Int16Array(capacity);
    this.parent = new Int32Array(capacity);
    this.attachDz = f();
    this.speedMul = f();
    this.state = new Uint8Array(capacity);
    this.override = new Uint8Array(capacity);
    this.overrideUntil = f();
    this.thinkAt = f();
    this.targetX = f(); this.targetY = f();
    this.homeX = f(); this.homeY = f();
    this.animTime = f();
    this.mood = new Uint8Array(capacity);
    this.team = new Uint8Array(capacity);
    this.hp = f();
    this.maxHp = f();
    this.level = new Uint8Array(capacity);
    this.cooldown = f();
    this.targetId = new Int32Array(capacity);
    this.dmgMul = f();
    this.aimYaw = f();
    this.hitTime = f();
  }

  /** Allocates an id with zeroed/neutral columns. Returns -1 when full. */
  create(kindId: number, x: number, y: number): number {
    const id = this.freeList.pop() ?? (this.highWater < this.capacity ? this.highWater++ : -1);
    if (id < 0) return -1;
    this.alive[id] = 1;
    this.kind[id] = kindId;
    this.x[id] = x; this.y[id] = y; this.z[id] = 0;
    this.vx[id] = 0; this.vy[id] = 0; this.vz[id] = 0;
    this.rot[id] = 0; this.rotVel[id] = 0;
    this.scale[id] = 1;
    this.tintR[id] = 1; this.tintG[id] = 1; this.tintB[id] = 1;
    this.opacity[id] = 1; this.glow[id] = 0;
    this.flags[id] = 0; this.variant[id] = 0;
    this.spawnTime[id] = -1000;
    this.labelSlot[id] = -1;
    this.parent[id] = -1;
    this.attachDz[id] = 0;
    this.speedMul[id] = 1;
    this.state[id] = 0; this.override[id] = 0; this.overrideUntil[id] = 0;
    this.thinkAt[id] = 0;
    this.targetX[id] = x; this.targetY[id] = y;
    this.homeX[id] = x; this.homeY[id] = y;
    this.animTime[id] = 0;
    this.mood[id] = 0;
    this.team[id] = 0;
    this.hp[id] = 0;
    this.maxHp[id] = 0;
    this.level[id] = 1;
    this.cooldown[id] = 0;
    this.targetId[id] = -1;
    this.dmgMul[id] = 1;
    this.aimYaw[id] = 0;
    this.hitTime[id] = -1000;
    this.count++;
    return id;
  }

  destroy(id: number): void {
    if (id < 0 || id >= this.highWater || this.alive[id] !== 1) return;
    this.alive[id] = 0;
    this.names.delete(id);
    this.freeList.push(id);
    this.count--;
  }

  isAlive(id: number): boolean {
    return id >= 0 && id < this.highWater && this.alive[id] === 1;
  }

  hasFlag(id: number, flag: number): boolean {
    return ((this.flags[id] ?? 0) & flag) !== 0;
  }

  setFlag(id: number, flag: number, on: boolean): void {
    this.flags[id] = on ? (this.flags[id] ?? 0) | flag : (this.flags[id] ?? 0) & ~flag;
  }

  /** Destroys every entity (scene switch). */
  clear(): void {
    this.alive.fill(0);
    this.names.clear();
    this.freeList.length = 0;
    this.highWater = 0;
    this.count = 0;
  }

  /** Collects ids of alive entities matching a predicate (commands only, never per frame). */
  collect(pred: (id: number) => boolean, out: number[] = []): number[] {
    for (let i = 0; i < this.highWater; i++) {
      if (this.alive[i] === 1 && pred(i)) out.push(i);
    }
    return out;
  }
}

/** Bit flags stored in `EntityManager.flags`. */
export const ENTITY_FLAG = {
  RAINBOW: 1,
  NO_SHADOW: 2,
  /** Spawned by item-rain: villagers treat it as weather debris. */
  DEBRIS: 4,
  /** Building reduced to rubble (kept for the scene, ignored by combat). */
  DESTROYED: 8,
  /** Not rendered until revealed (mines, undiscovered jungle defenses). */
  HIDDEN: 16,
  /** Inspected during scouting. */
  SCOUTED: 32,
  /** On fire (fire system); the renderer draws flames. */
  BURNING: 64,
} as const;
