import type { ProjectileKind } from '../units/unit-stats';

/** In-flight projectiles (shells, rockets, mortar rounds). Instant weapons never enter the pool. */
export interface IProjectileView {
  readonly count: number;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly ph: Float32Array;
  readonly kindCode: Uint8Array;
}

export const PROJ_CODE: Readonly<Record<ProjectileKind, number>> = {
  bullet: 0, shell: 1, rocket: 2, mortar: 3, snipe: 4, melee: 5, flame: 6,
};

const SPEED: Readonly<Record<ProjectileKind, number>> = { bullet: 0, shell: 70, rocket: 34, mortar: 0, snipe: 0, melee: 0, flame: 30 };
const ARC: Readonly<Record<ProjectileKind, number>> = { bullet: 0, shell: 2, rocket: 0.6, mortar: 14, snipe: 0, melee: 0, flame: 0.2 };
const MORTAR_FLIGHT = 1.6;

/** Arrival callback: impact point, damage, splash, team and the original target. */
export type ImpactFn = (x: number, y: number, h: number, damage: number, splash: number, team: number, target: number, kind: number) => void;

/** Fixed-capacity struct-of-arrays pool (no per-shot allocation). */
export class ProjectilePool implements IProjectileView {
  count = 0;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly ph: Float32Array;
  readonly kindCode: Uint8Array;
  private readonly sx: Float32Array;
  private readonly sy: Float32Array;
  private readonly sh: Float32Array;
  private readonly ex: Float32Array;
  private readonly ey: Float32Array;
  private readonly eh: Float32Array;
  private readonly t: Float32Array;
  private readonly dur: Float32Array;
  private readonly arc: Float32Array;
  private readonly dmg: Float32Array;
  private readonly splash: Float32Array;
  private readonly team: Uint8Array;
  private readonly target: Int32Array;
  /** Float columns cached so swap-remove allocates nothing. */
  private readonly cols: Float32Array[];

  constructor(readonly capacity: number) {
    const f = (): Float32Array => new Float32Array(capacity);
    this.px = f(); this.py = f(); this.ph = f();
    this.sx = f(); this.sy = f(); this.sh = f();
    this.ex = f(); this.ey = f(); this.eh = f();
    this.t = f(); this.dur = f(); this.arc = f(); this.dmg = f(); this.splash = f();
    this.kindCode = new Uint8Array(capacity);
    this.team = new Uint8Array(capacity);
    this.target = new Int32Array(capacity);
    this.cols = [this.px, this.py, this.ph, this.sx, this.sy, this.sh, this.ex, this.ey, this.eh, this.t, this.dur, this.arc, this.dmg, this.splash];
  }

  /** Launches a projectile from (sx, sy, sh) to (ex, ey, eh). Returns false when full. */
  launch(kind: ProjectileKind, sx: number, sy: number, sh: number, ex: number, ey: number, eh: number, damage: number, splash: number, team: number, target: number): boolean {
    if (this.count >= this.capacity) return false;
    const i = this.count++;
    const dist = Math.hypot(ex - sx, ey - sy, eh - sh);
    this.sx[i] = sx; this.sy[i] = sy; this.sh[i] = sh;
    this.ex[i] = ex; this.ey[i] = ey; this.eh[i] = eh;
    this.px[i] = sx; this.py[i] = sy; this.ph[i] = sh;
    this.t[i] = 0;
    this.dur[i] = kind === 'mortar' ? MORTAR_FLIGHT : Math.max(0.05, dist / (SPEED[kind] || 60));
    this.arc[i] = ARC[kind];
    this.dmg[i] = damage;
    this.splash[i] = splash;
    this.team[i] = team;
    this.target[i] = target;
    this.kindCode[i] = PROJ_CODE[kind];
    return true;
  }

  update(dt: number, onImpact: ImpactFn): void {
    let i = 0;
    while (i < this.count) {
      const t = (this.t[i] ?? 0) + dt;
      const d = this.dur[i] ?? 1;
      if (t >= d) {
        onImpact(this.ex[i] ?? 0, this.ey[i] ?? 0, this.eh[i] ?? 0, this.dmg[i] ?? 0, this.splash[i] ?? 0, this.team[i] ?? 0, this.target[i] ?? -1, this.kindCode[i] ?? 0);
        this.removeAt(i);
        continue;
      }
      this.t[i] = t;
      const k = t / d;
      this.px[i] = (this.sx[i] ?? 0) + ((this.ex[i] ?? 0) - (this.sx[i] ?? 0)) * k;
      this.py[i] = (this.sy[i] ?? 0) + ((this.ey[i] ?? 0) - (this.sy[i] ?? 0)) * k;
      this.ph[i] = (this.sh[i] ?? 0) + ((this.eh[i] ?? 0) - (this.sh[i] ?? 0)) * k + Math.sin(k * Math.PI) * (this.arc[i] ?? 0);
      i++;
    }
  }

  clear(): void {
    this.count = 0;
  }

  private removeAt(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const a of this.cols) a[i] = a[last] ?? 0;
    this.kindCode[i] = this.kindCode[last] ?? 0;
    this.team[i] = this.team[last] ?? 0;
    this.target[i] = this.target[last] ?? -1;
  }
}
