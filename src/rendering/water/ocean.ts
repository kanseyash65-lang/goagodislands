import {
  Color, DataTexture, LinearFilter, Mesh, PlaneGeometry, RedFormat, ShaderMaterial, UnsignedByteType, Vector3, type IUniform,
} from 'three';
import { OCEAN_SEGMENTS, OCEAN_SIZE } from '../../core/config/render.config';
import { ISLAND_CENTER, TERRAIN_ORIGIN, TERRAIN_RES, TERRAIN_SIZE } from '../../core/config/world.config';
import type { WorldLayout } from '../../world/world-layout';

const VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying float vWave;
float wave(vec2 p) {
  return sin(p.x * 0.09 + uTime * 0.9) * 0.18 + sin(p.y * 0.07 - uTime * 0.7) * 0.16
       + sin((p.x + p.y) * 0.2 + uTime * 1.7) * 0.06;
}
void main() {
  vec3 p = position;
  float w = wave(p.xz);
  p.y += w;
  vWave = w;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const HEIGHT_MIN = -12;
const HEIGHT_RANGE = 28;

const FRAG = /* glsl */ `
#define HEIGHT_MIN ${HEIGHT_MIN.toFixed(1)}
#define HEIGHT_RANGE ${HEIGHT_RANGE.toFixed(1)}
uniform float uTime;
uniform sampler2D uHeights;
uniform vec2 uTerrainOrigin;
uniform float uTerrainSize;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uTint;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uLight;
varying vec3 vWorld;
varying float vWave;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 uv = (vWorld.xz - uTerrainOrigin) / uTerrainSize;
  float ground = -12.0;
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ground = texture2D(uHeights, uv).r * HEIGHT_RANGE + HEIGHT_MIN;
  float depth = max(0.0, vWorld.y - ground);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 7.0, depth)) * uTint;
  // Foam where waves meet the shore, plus drifting streaks.
  float n = noise(vWorld.xz * 0.35 + vec2(uTime * 0.3, uTime * 0.2));
  float shore = smoothstep(1.3, 0.0, depth) * (0.55 + 0.45 * sin(depth * 5.0 - uTime * 2.2 + n * 3.0));
  float foam = clamp(shore, 0.0, 1.0) * smoothstep(0.1, 0.5, n + 0.3);
  // Normal from wave derivatives for sun glints.
  vec3 nrm = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (nrm.y < 0.0) nrm = -nrm;
  vec3 view = normalize(cameraPosition - vWorld);
  float spec = pow(max(0.0, dot(reflect(-uSunDir, nrm), view)), 90.0);
  float fres = pow(1.0 - max(0.0, dot(view, vec3(0.0, 1.0, 0.0))), 3.0);
  col = mix(col, vec3(0.75, 0.88, 0.95) * uTint, fres * 0.35);
  col *= uLight;
  col += uSunColor * spec * 1.2;
  col = mix(col, vec3(1.0), foam * 0.85 * uLight);
  float alpha = mix(0.55, 0.96, smoothstep(0.0, 4.0, depth));
  alpha = max(alpha, foam);
  float dist = length(cameraPosition - vWorld);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export interface OceanUniforms {
  readonly uTime: IUniform<number>;
  readonly uShallow: IUniform<Color>;
  readonly uDeep: IUniform<Color>;
  readonly uTint: IUniform<Color>;
  readonly uSunDir: IUniform<Vector3>;
  readonly uSunColor: IUniform<Color>;
  readonly uFogColor: IUniform<Color>;
  readonly uFogDensity: IUniform<number>;
  readonly uLight: IUniform<number>;
}

/**
 * Arabian Sea: animated waves, turquoise shallows over sand fading to deep blue,
 * shoreline foam, sun glints, fresnel. Depth comes from the terrain heightmap,
 * so the water is see-through over the beach. `uTint` is the voice-editable sea colour.
 */
export class Ocean {
  readonly mesh: Mesh;
  readonly uniforms: OceanUniforms & { uHeights: IUniform<DataTexture> };

  constructor(layout: WorldLayout) {
    const geo = new PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEGMENTS, OCEAN_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    geo.translate(ISLAND_CENTER, 0, ISLAND_CENTER);
    this.uniforms = {
      uTime: { value: 0 },
      uHeights: { value: heightTexture(layout) },
      uShallow: { value: new Color('#3fe0d0') },
      uDeep: { value: new Color('#0c6fa8') },
      uTint: { value: new Color(1, 1, 1) },
      uSunDir: { value: new Vector3(0.5, 0.8, 0.3) },
      uSunColor: { value: new Color(1, 0.95, 0.85) },
      uFogColor: { value: new Color('#bfe6ff') },
      uFogDensity: { value: 0.0009 },
      uLight: { value: 1 },
    };
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...this.uniforms, uTerrainOrigin: { value: [TERRAIN_ORIGIN, TERRAIN_ORIGIN] }, uTerrainSize: { value: TERRAIN_SIZE } },
      transparent: true,
    });
    this.mesh = new Mesh(geo, mat);
    this.mesh.renderOrder = 2;
  }

  setLayout(layout: WorldLayout): void {
    this.uniforms.uHeights.value.dispose();
    this.uniforms.uHeights.value = heightTexture(layout);
  }
}

/** Heights packed into 8 bits (no float-texture extension needed). */
function heightTexture(layout: WorldLayout): DataTexture {
  const N = TERRAIN_RES + 1;
  const data = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) data[i] = Math.round(Math.min(1, Math.max(0, ((layout.heights[i] ?? 0) - HEIGHT_MIN) / HEIGHT_RANGE)) * 255);
  const tex = new DataTexture(data, N, N, RedFormat, UnsignedByteType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
