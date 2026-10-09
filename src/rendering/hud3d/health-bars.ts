import { BufferAttribute, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial } from 'three';

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iData; // fill, width, team, highlight
varying vec2 vUv;
varying vec4 vData;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float w = iData.y;
  vec3 wp = iPos + right * position.x * w + up * position.y * w * 0.16;
  vUv = uv;
  vData = iData;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const FRAG = /* glsl */ `
varying vec2 vUv;
varying vec4 vData;
void main() {
  vec2 b = min(vUv, 1.0 - vUv);
  if (b.x < 0.02 || b.y < 0.12) { gl_FragColor = vec4(0.08, 0.06, 0.06, 1.0); return; }
  vec3 full = vData.z > 1.5 ? vec3(0.92, 0.22, 0.2) : vec3(0.35, 0.9, 0.3);
  vec3 low = vec3(1.0, 0.75, 0.1);
  vec3 col = mix(low, full, smoothstep(0.25, 0.6, vData.x));
  if (vUv.x > vData.x) col = vec3(0.18, 0.14, 0.14);
  col += vData.w * 0.25;
  gl_FragColor = vec4(col, 1.0);
}`;

/** One instanced draw for every visible health bar. */
export class HealthBars {
  readonly mesh: Mesh;
  private count = 0;
  private readonly pos: Float32Array;
  private readonly data: Float32Array;
  private readonly posAttr: InstancedBufferAttribute;
  private readonly dataAttr: InstancedBufferAttribute;
  private readonly geo: InstancedBufferGeometry;

  constructor(private readonly capacity: number) {
    const geo = new InstancedBufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(capacity * 3);
    this.data = new Float32Array(capacity * 4);
    this.posAttr = new InstancedBufferAttribute(this.pos, 3);
    this.dataAttr = new InstancedBufferAttribute(this.data, 4);
    this.posAttr.setUsage(DynamicDrawUsage);
    this.dataAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute('iPos', this.posAttr);
    geo.setAttribute('iData', this.dataAttr);
    this.geo = geo;
    this.mesh = new Mesh(geo, new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, transparent: true }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  begin(): void {
    this.count = 0;
  }

  push(x: number, y: number, z: number, fill: number, width: number, team: number, highlight: number): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.data[i * 4] = Math.max(0, Math.min(1, fill));
    this.data[i * 4 + 1] = width;
    this.data[i * 4 + 2] = team;
    this.data[i * 4 + 3] = highlight;
  }

  commit(): void {
    for (const a of [this.posAttr, this.dataAttr]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.count * a.itemSize);
      a.needsUpdate = true;
    }
    this.geo.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
  }
}
