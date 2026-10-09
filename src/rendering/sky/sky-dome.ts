import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3, type IUniform } from 'three';
import { SKY_RADIUS } from '../../core/config/render.config';
import { ISLAND_CENTER } from '../../core/config/world.config';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
  float s = max(0.0, dot(vDir, uSunDir));
  col += uSunColor * (pow(s, 600.0) * 4.0 + pow(s, 18.0) * 0.35);
  float star = step(0.9975, hash(floor(vDir * 420.0))) * uNight * smoothstep(0.05, 0.4, h);
  col += vec3(star);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface SkyUniforms {
  readonly uTop: IUniform<Color>;
  readonly uHorizon: IUniform<Color>;
  readonly uSunDir: IUniform<Vector3>;
  readonly uSunColor: IUniform<Color>;
  readonly uNight: IUniform<number>;
}

/** Gradient sky with sun disc/glow and stars at night; follows the camera horizon. */
export class SkyDome {
  readonly mesh: Mesh;
  readonly uniforms: SkyUniforms = {
    uTop: { value: new Color('#3d9be0') },
    uHorizon: { value: new Color('#cdeeff') },
    uSunDir: { value: new Vector3(0.4, 0.7, 0.3).normalize() },
    uSunColor: { value: new Color(1, 0.9, 0.7) },
    uNight: { value: 0 },
  };

  constructor() {
    const mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...this.uniforms }, side: BackSide, depthWrite: false });
    this.mesh = new Mesh(new SphereGeometry(SKY_RADIUS, 32, 16), mat);
    this.mesh.position.set(ISLAND_CENTER, 0, ISLAND_CENTER);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }
}
