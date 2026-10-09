import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Euler,
  Float32BufferAttribute, IcosahedronGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Placement + mask options for one model part. */
export interface PartOpts {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly rx?: number;
  readonly ry?: number;
  readonly rz?: number;
  readonly sx?: number;
  readonly sy?: number;
  readonly sz?: number;
  /** Recolourable by voice (walls, shirts, leaves). */
  readonly tint?: boolean;
  /** Limb pivot height; sign picks the side (walk swing). */
  readonly limb?: number;
  /** Wind sway: weight grows with height above `base`. */
  readonly sway?: { readonly base: number; readonly k: number };
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpP = new Vector3();
const tmpS = new Vector3();
const tmpC = new Color();

/**
 * Builds a low-poly model from primitives (flat-shaded, vertex-coloured) and
 * merges it into one geometry with the attributes the world material expects.
 * Models face +Z; y = 0 is the ground.
 */
export class ModelBuilder {
  private readonly parts: BufferGeometry[] = [];

  box(w: number, h: number, d: number, color: string, o: PartOpts = {}): this {
    return this.add(new BoxGeometry(w, h, d), color, o);
  }

  cyl(rTop: number, rBot: number, h: number, seg: number, color: string, o: PartOpts = {}): this {
    return this.add(new CylinderGeometry(rTop, rBot, h, seg), color, o);
  }

  cone(r: number, h: number, seg: number, color: string, o: PartOpts = {}): this {
    return this.add(new ConeGeometry(r, h, seg), color, o);
  }

  sphere(r: number, color: string, o: PartOpts = {}, w = 8, h = 6): this {
    return this.add(new SphereGeometry(r, w, h), color, o);
  }

  ico(r: number, color: string, o: PartOpts = {}, detail = 0): this {
    return this.add(new IcosahedronGeometry(r, detail), color, o);
  }

  dodeca(r: number, color: string, o: PartOpts = {}): this {
    return this.add(new DodecahedronGeometry(r, 0), color, o);
  }

  torus(r: number, tube: number, color: string, o: PartOpts = {}): this {
    return this.add(new TorusGeometry(r, tube, 6, 16), color, o);
  }

  /** Four-sided hip roof (pyramid) – the classic Goan tiled roof. */
  hipRoof(w: number, d: number, h: number, color: string, o: PartOpts = {}): this {
    const g = new ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    return this.add(g, color, { ...o, sx: (o.sx ?? 1) * w, sy: (o.sy ?? 1) * h, sz: (o.sz ?? 1) * d });
  }

  /** Gable roof: a triangular prism spanning x. */
  gable(w: number, d: number, h: number, color: string, o: PartOpts = {}): this {
    const x = w / 2;
    const z = d / 2;
    // prettier-ignore
    const v = [
      -x, 0, -z, -x, 0, z, -x, h, 0, // west gable end
      x, 0, z, x, 0, -z, x, h, 0, // east gable end
      -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0, // south slope
      x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0, // north slope
    ];
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    return this.add(g, color, o);
  }

  /** Appends another builder's parts (e.g. a shared human body). */
  merge(other: ModelBuilder): this {
    for (const p of other.parts) this.parts.push(p.clone());
    return this;
  }

  build(): BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    if (!g) throw new Error('model merge failed');
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  private add(geo: BufferGeometry, color: string, o: PartOpts): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv');
    tmpE.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ'); // roll, then pitch, then yaw
    tmpQ.setFromEuler(tmpE);
    tmpP.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    tmpS.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    g.applyMatrix4(tmpM.compose(tmpP, tmpQ, tmpS));
    g.computeVertexNormals();
    const n = g.getAttribute('position').count;
    tmpC.set(color);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = tmpC.r;
      colors[i * 3 + 1] = tmpC.g;
      colors[i * 3 + 2] = tmpC.b;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.setAttribute('aTint', new Float32BufferAttribute(new Float32Array(n).fill(o.tint ? 1 : 0), 1));
    g.setAttribute('aLimb', new Float32BufferAttribute(new Float32Array(n).fill(o.limb ?? 0), 1));
    const sway = new Float32Array(n);
    if (o.sway) {
      const pos = g.getAttribute('position');
      for (let i = 0; i < n; i++) sway[i] = Math.max(0, pos.getY(i) - o.sway.base) * o.sway.k;
    }
    g.setAttribute('aSway', new Float32BufferAttribute(sway, 1));
    this.parts.push(g);
    return this;
  }
}
