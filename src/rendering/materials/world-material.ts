import { MeshStandardMaterial, type IUniform } from 'three';

/** Uniforms shared by every world model (time drives sway, wind its strength). */
export interface WorldUniforms {
  readonly uTime: IUniform<number>;
  readonly uWind: IUniform<number>;
}

export function createWorldUniforms(): WorldUniforms {
  return { uTime: { value: 0 }, uWind: { value: 0.25 } };
}

const VERT_DECL = /* glsl */ `
#include <common>
attribute float aTint;
attribute float aLimb;
attribute float aSway;
attribute vec3 iAnim; // x: walk phase, y: swing amplitude, z: hit flash 0..1
uniform float uTime;
uniform float uWind;
varying float vFlash;
`;

/** Limb swing around a pivot (|aLimb| = pivot height, sign = side) and wind sway. */
const VERT_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
vFlash = iAnim.z;
if (aLimb != 0.0) {
  float side = sign(aLimb);
  float pivot = abs(aLimb);
  float swing = sin(iAnim.x) * iAnim.y * side;
  float d = pivot - position.y;
  transformed.z += swing * d;
  transformed.y += abs(swing) * d * 0.12;
}
if (aSway > 0.0) {
  vec4 origin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float ph = origin.x * 0.13 + origin.z * 0.17;
  float gust = 0.6 + 0.4 * sin(uTime * 0.35 + ph * 0.5);
  transformed.x += sin(uTime * 1.4 + ph) * aSway * uWind * gust;
  transformed.z += cos(uTime * 1.1 + ph) * aSway * uWind * 0.6 * gust;
}
`;

/** Instance colour only tints vertices whose aTint mask is 1 (walls, shirts, leaves). */
const VERT_COLOR = /* glsl */ `
vColor = vec4(1.0);
#ifdef USE_COLOR
vColor.rgb *= color.rgb;
#endif
#ifdef USE_INSTANCING_COLOR
vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor.xyz, aTint);
#endif
`;

/**
 * One material for all instanced world models: vertex colours (procedural
 * art), tint masks, walking limbs, palm sway and a white hit flash.
 */
export function createWorldMaterial(u: WorldUniforms): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms['uTime'] = u.uTime;
    shader.uniforms['uWind'] = u.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERT_DECL)
      .replace('#include <begin_vertex>', VERT_BEGIN)
      .replace('#include <color_vertex>', VERT_COLOR);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFlash;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), vFlash * 0.75);');
  };
  mat.customProgramCacheKey = () => 'world-material-v1';
  return mat;
}
