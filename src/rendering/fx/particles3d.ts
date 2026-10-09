import {
  AdditiveBlending, BufferAttribute, CanvasTexture, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, NormalBlending, ShaderMaterial, type Scene,
} from 'three';

/** Sprite cells in the procedural particle texture. */
export const CELL = { SOFT: 0, SPARK: 1, RING: 2, STREAK: 3 } as const;
/** Orientation: camera-facing, flat on the ground, or upright (rain streaks). */
export const FACE = { CAMERA: 0, GROUND: 1, UPRIGHT: 2 } as const;

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iColor;
attribute vec3 iMisc; // rot, cell, face
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  if (iMisc.z > 0.5 && iMisc.z < 1.5) { right = vec3(1.0, 0.0, 0.0); up = vec3(0.0, 0.0, -1.0); }
  if (iMisc.z > 1.5) { up = vec3(0.0, 1.0, 0.0); }
  float c = cos(iMisc.x);
  float s = sin(iMisc.x);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  vec3 wp = iPos + right * p.x * iSize.x + up * p.y * iSize.y + vec3(0.0, iMisc.z > 0.5 && iMisc.z < 1.5 ? 0.06 : 0.0, 0.0);
  vUv = vec2((uv.x + iMisc.y) * 0.25, uv.y);
  vColor = iColor;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uTex;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uTex, vUv);
  float a = t.a * vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb * t.rgb, a);
  #include <colorspace_fragment>
}`;

function particleTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const radial = (cx: number, inner: string): void => {
      const gr = g.createRadialGradient(cx, 32, 0, cx, 32, 30);
      gr.addColorStop(0, inner);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(cx - 32, 0, 64, 64);
    };
    radial(32, 'rgba(255,255,255,1)');
    radial(96, 'rgba(255,255,255,0.5)');
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? 7 : 28;
      g.lineTo(96 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(160, 32, 26, 0, Math.PI * 2);
    g.stroke();
    const lin = g.createLinearGradient(0, 4, 0, 60);
    lin.addColorStop(0, 'rgba(255,255,255,0)');
    lin.addColorStop(0.5, 'rgba(255,255,255,1)');
    lin.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lin;
    g.fillRect(222, 4, 4, 56);
  }
  return new CanvasTexture(c);
}

class ParticleBatch {
  readonly mesh: Mesh;
  count = 0;
  readonly pos: Float32Array;
  readonly size: Float32Array;
  readonly color: Float32Array;
  readonly misc: Float32Array;
  private readonly attrs: InstancedBufferAttribute[];
  private readonly geo: InstancedBufferGeometry;

  constructor(readonly capacity: number, tex: CanvasTexture, additive: boolean) {
    const geo = new InstancedBufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity * 2);
    this.color = new Float32Array(capacity * 4);
    this.misc = new Float32Array(capacity * 3);
    const mk = (n: string, a: Float32Array, s: number): InstancedBufferAttribute => {
      const at = new InstancedBufferAttribute(a, s);
      at.setUsage(DynamicDrawUsage);
      geo.setAttribute(n, at);
      return at;
    };
    this.attrs = [mk('iPos', this.pos, 3), mk('iSize', this.size, 2), mk('iColor', this.color, 4), mk('iMisc', this.misc, 3)];
    geo.instanceCount = 0;
    this.geo = geo;
    this.mesh = new Mesh(geo, new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTex: { value: tex } },
      transparent: true, depthWrite: false, blending: additive ? AdditiveBlending : NormalBlending,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 5;
  }

  commit(): void {
    for (const a of this.attrs) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.count * a.itemSize);
      a.needsUpdate = true;
    }
    this.geo.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
  }
}

/**
 * Pooled 3D particles (struct-of-arrays, swap-remove, no per-frame allocation).
 * Rejects new particles beyond the budget instead of growing.
 */
export class ParticleSystem {
  count = 0;
  budget: number;
  private readonly f: Float32Array[];
  // column indices into `f`
  private static readonly X = 0; private static readonly Y = 1; private static readonly Z = 2;
  private static readonly VX = 3; private static readonly VY = 4; private static readonly VZ = 5;
  private static readonly LIFE = 6; private static readonly MAX = 7; private static readonly S0 = 8; private static readonly S1 = 9;
  private static readonly R = 10; private static readonly G = 11; private static readonly B = 12; private static readonly A = 13;
  private static readonly ROT = 14; private static readonly RV = 15; private static readonly GRAV = 16; private static readonly DRAG = 17;
  private static readonly STRETCH = 18; private static readonly CELL = 19; private static readonly FACE = 20; private static readonly ADD = 21;
  private static readonly COLS = 22;
  private readonly normal: ParticleBatch;
  private readonly additive: ParticleBatch;

  constructor(readonly capacity: number, scene: Scene) {
    this.budget = capacity;
    this.f = Array.from({ length: ParticleSystem.COLS }, () => new Float32Array(capacity));
    const tex = particleTexture();
    this.normal = new ParticleBatch(capacity, tex, false);
    this.additive = new ParticleBatch(capacity, tex, true);
    scene.add(this.normal.mesh, this.additive.mesh);
  }

  /** Emits one particle; returns its index for `style`, or -1 when over budget. */
  emit(cell: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, r: number, g: number, b: number, a: number): number {
    if (this.count >= this.budget) return -1;
    const i = this.count++;
    const f = this.f;
    const set = (c: number, v: number): void => { (f[c] as Float32Array)[i] = v; };
    set(ParticleSystem.X, x); set(ParticleSystem.Y, y); set(ParticleSystem.Z, z);
    set(ParticleSystem.VX, vx); set(ParticleSystem.VY, vy); set(ParticleSystem.VZ, vz);
    set(ParticleSystem.LIFE, life); set(ParticleSystem.MAX, life); set(ParticleSystem.S0, s0); set(ParticleSystem.S1, s1);
    set(ParticleSystem.R, r); set(ParticleSystem.G, g); set(ParticleSystem.B, b); set(ParticleSystem.A, a);
    set(ParticleSystem.ROT, 0); set(ParticleSystem.RV, 0); set(ParticleSystem.GRAV, 0); set(ParticleSystem.DRAG, 0);
    set(ParticleSystem.STRETCH, 1); set(ParticleSystem.CELL, cell); set(ParticleSystem.FACE, FACE.CAMERA); set(ParticleSystem.ADD, 0);
    return i;
  }

  /** Optional motion/look for a just-emitted particle. */
  style(i: number, o: { gravity?: number; drag?: number; additive?: boolean; face?: number; rot?: number; rotVel?: number; stretch?: number }): void {
    if (i < 0) return;
    const f = this.f;
    if (o.gravity !== undefined) (f[ParticleSystem.GRAV] as Float32Array)[i] = o.gravity;
    if (o.drag !== undefined) (f[ParticleSystem.DRAG] as Float32Array)[i] = o.drag;
    if (o.additive) (f[ParticleSystem.ADD] as Float32Array)[i] = 1;
    if (o.face !== undefined) (f[ParticleSystem.FACE] as Float32Array)[i] = o.face;
    if (o.rot !== undefined) (f[ParticleSystem.ROT] as Float32Array)[i] = o.rot;
    if (o.rotVel !== undefined) (f[ParticleSystem.RV] as Float32Array)[i] = o.rotVel;
    if (o.stretch !== undefined) (f[ParticleSystem.STRETCH] as Float32Array)[i] = o.stretch;
  }

  update(dt: number): void {
    const f = this.f;
    const life = f[ParticleSystem.LIFE] as Float32Array;
    const x = f[ParticleSystem.X] as Float32Array, y = f[ParticleSystem.Y] as Float32Array, z = f[ParticleSystem.Z] as Float32Array;
    const vx = f[ParticleSystem.VX] as Float32Array, vy = f[ParticleSystem.VY] as Float32Array, vz = f[ParticleSystem.VZ] as Float32Array;
    const grav = f[ParticleSystem.GRAV] as Float32Array, drag = f[ParticleSystem.DRAG] as Float32Array;
    const rot = f[ParticleSystem.ROT] as Float32Array, rv = f[ParticleSystem.RV] as Float32Array;
    let i = 0;
    while (i < this.count) {
      const l = (life[i] ?? 0) - dt;
      if (l <= 0) {
        this.removeAt(i);
        continue;
      }
      life[i] = l;
      const k = 1 - (drag[i] ?? 0) * dt;
      vx[i] = (vx[i] ?? 0) * k;
      vz[i] = (vz[i] ?? 0) * k;
      vy[i] = ((vy[i] ?? 0) - (grav[i] ?? 0) * dt) * k;
      x[i] = (x[i] ?? 0) + (vx[i] ?? 0) * dt;
      y[i] = (y[i] ?? 0) + (vy[i] ?? 0) * dt;
      z[i] = (z[i] ?? 0) + (vz[i] ?? 0) * dt;
      rot[i] = (rot[i] ?? 0) + (rv[i] ?? 0) * dt;
      i++;
    }
    this.draw();
  }

  private draw(): void {
    const f = this.f;
    this.normal.count = 0;
    this.additive.count = 0;
    for (let i = 0; i < this.count; i++) {
      const b = (f[ParticleSystem.ADD] as Float32Array)[i] === 1 ? this.additive : this.normal;
      const n = b.count++;
      const t = 1 - ((f[ParticleSystem.LIFE] as Float32Array)[i] ?? 0) / ((f[ParticleSystem.MAX] as Float32Array)[i] || 1);
      const s0 = (f[ParticleSystem.S0] as Float32Array)[i] ?? 1;
      const size = s0 + (((f[ParticleSystem.S1] as Float32Array)[i] ?? 1) - s0) * t;
      const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      b.pos[n * 3] = (f[ParticleSystem.X] as Float32Array)[i] ?? 0;
      b.pos[n * 3 + 1] = (f[ParticleSystem.Y] as Float32Array)[i] ?? 0;
      b.pos[n * 3 + 2] = (f[ParticleSystem.Z] as Float32Array)[i] ?? 0;
      b.size[n * 2] = size;
      b.size[n * 2 + 1] = size * ((f[ParticleSystem.STRETCH] as Float32Array)[i] ?? 1);
      b.color[n * 4] = (f[ParticleSystem.R] as Float32Array)[i] ?? 1;
      b.color[n * 4 + 1] = (f[ParticleSystem.G] as Float32Array)[i] ?? 1;
      b.color[n * 4 + 2] = (f[ParticleSystem.B] as Float32Array)[i] ?? 1;
      b.color[n * 4 + 3] = ((f[ParticleSystem.A] as Float32Array)[i] ?? 1) * fade;
      b.misc[n * 3] = (f[ParticleSystem.ROT] as Float32Array)[i] ?? 0;
      b.misc[n * 3 + 1] = (f[ParticleSystem.CELL] as Float32Array)[i] ?? 0;
      b.misc[n * 3 + 2] = (f[ParticleSystem.FACE] as Float32Array)[i] ?? 0;
    }
    this.normal.commit();
    this.additive.commit();
  }

  private removeAt(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const col of this.f) col[i] = col[last] ?? 0;
  }
}
