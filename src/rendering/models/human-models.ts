import { ModelBuilder } from './model-builder';

/** Low-poly people: villagers and soldiers. Torso is tintable (role / team colour). */
const SKIN = ['#e8b48a', '#c98e62', '#a8714a', '#8a5a3a'] as const;
const HIP = 0.9;
const SHOULDER = 1.52;

interface BodyOpts {
  readonly skin: string;
  readonly legs: string;
  readonly shoes?: string;
  readonly bulk?: number;
  readonly longShirt?: boolean;
}

/** Shared body: legs and arms carry limb pivots so the shader can animate walking. */
function body(o: BodyOpts): ModelBuilder {
  const b = o.bulk ?? 1;
  const m = new ModelBuilder();
  for (const side of [1, -1]) {
    m.box(0.22 * b, 0.86, 0.25, o.legs, { x: 0.13 * side * b, y: 0.43, limb: HIP * side });
    m.box(0.25 * b, 0.12, 0.34, o.shoes ?? '#3a2a20', { x: 0.13 * side * b, y: 0.06, z: 0.04, limb: HIP * side });
    m.box(0.15, 0.62, 0.17, '#ffffff', { x: 0.37 * side * b, y: 1.2, tint: true, limb: -SHOULDER * side });
    m.box(0.13, 0.13, 0.14, o.skin, { x: 0.37 * side * b, y: 0.84, limb: -SHOULDER * side });
  }
  m.box(0.58 * b, o.longShirt ? 0.9 : 0.64, 0.34 * b, '#ffffff', { y: o.longShirt ? 1.06 : 1.2, tint: true });
  m.box(0.36, 0.38, 0.34, o.skin, { y: 1.74 });
  m.box(0.07, 0.07, 0.02, '#20181a', { x: 0.08, y: 1.78, z: 0.175 });
  m.box(0.07, 0.07, 0.02, '#20181a', { x: -0.08, y: 1.78, z: 0.175 });
  return m;
}

export function fisherman(): ModelBuilder {
  return body({ skin: SKIN[2], legs: '#3a5a8a' })
    .box(0.4, 0.12, 0.42, '#1f4f8a', { y: 1.98 })
    .box(0.4, 0.04, 0.2, '#1f4f8a', { y: 1.93, z: 0.25 })
    .box(0.5, 0.06, 0.5, '#c9b07a', { y: 1.2, z: -0.28, rx: 0.3 }); // net bundle
}

export function farmer(): ModelBuilder {
  return body({ skin: SKIN[1], legs: '#6a5a3a' })
    .cone(0.62, 0.35, 10, '#e2c46a', { y: 2.06 })
    .box(0.1, 0.9, 0.1, '#7a5a3a', { x: 0.45, y: 1.1, z: 0.2 }); // toddy-tapper's pole
}

export function vendor(): ModelBuilder {
  return body({ skin: SKIN[1], legs: '#8a2a4a', longShirt: true })
    .box(0.42, 0.14, 0.4, '#e84a7a', { y: 1.98 })
    .cyl(0.34, 0.26, 0.2, 10, '#b88a4a', { y: 2.15 }) // basket of fish on the head
    .box(0.36, 0.06, 0.12, '#9ad0e8', { y: 2.27, rz: 0.2 });
}

export function tourist(): ModelBuilder {
  return body({ skin: '#f2c8a8', legs: '#f2c8a8', shoes: '#ffffff' })
    .box(0.6, 0.2, 0.36, '#3a7ac8', { y: 0.95 }) // shorts
    .cyl(0.42, 0.42, 0.04, 12, '#f2e2b0', { y: 1.95 })
    .cyl(0.2, 0.22, 0.18, 10, '#f2e2b0', { y: 2.05 })
    .box(0.34, 0.07, 0.03, '#101010', { y: 1.78, z: 0.18 }); // sunglasses
}

export function child(): ModelBuilder {
  return body({ skin: SKIN[0], legs: '#3a6aa8' }).box(0.38, 0.12, 0.36, '#2a1a12', { y: 1.95 });
}

export function elder(): ModelBuilder {
  return body({ skin: SKIN[2], legs: '#e8e2d0', longShirt: true })
    .box(0.38, 0.1, 0.36, '#e8e8e8', { y: 1.95 })
    .box(0.06, 1.1, 0.06, '#7a5a3a', { x: 0.48, y: 0.55, z: 0.15 });
}

function soldier(o: BodyOpts): ModelBuilder {
  return body(o)
    .sphere(0.25, '#4a5a3a', { y: 1.93, sy: 0.72 }, 8, 4)
    .box(0.42, 0.42, 0.18, '#5a4a32', { y: 1.25, z: -0.25 }); // backpack
}

export function rifleman(): ModelBuilder {
  return soldier({ skin: SKIN[1], legs: '#4a5236' })
    .box(0.08, 0.1, 0.9, '#2a2622', { x: 0.2, y: 1.18, z: 0.38 });
}

export function heavy(): ModelBuilder {
  return soldier({ skin: SKIN[2], legs: '#3a3f2c', bulk: 1.35 })
    .box(0.74, 0.5, 0.42, '#3a3f2c', { y: 1.35 })
    .cyl(0.09, 0.09, 1.1, 6, '#1a1a1a', { x: 0.28, y: 1.15, z: 0.5, rx: Math.PI / 2 })
    .box(0.2, 0.22, 0.4, '#2a2622', { x: 0.28, y: 1.15, z: 0.05 });
}

export function rocketeer(): ModelBuilder {
  return soldier({ skin: SKIN[0], legs: '#4a5236' })
    .cyl(0.12, 0.12, 1.2, 8, '#5a6a3a', { x: 0.3, y: 1.62, z: 0.1, rx: Math.PI / 2 })
    .cyl(0.14, 0.1, 0.12, 8, '#c84a2a', { x: 0.3, y: 1.62, z: 0.72, rx: Math.PI / 2 });
}

export function medic(): ModelBuilder {
  return soldier({ skin: SKIN[1], legs: '#e8e8e8' })
    .box(0.12, 0.34, 0.03, '#2fb84a', { y: 1.25, z: 0.18 })
    .box(0.34, 0.12, 0.03, '#2fb84a', { y: 1.25, z: 0.18 })
    .box(0.3, 0.26, 0.22, '#f2f2f2', { x: -0.38, y: 0.95, z: 0.05 });
}

export function engineer(): ModelBuilder {
  return body({ skin: SKIN[2], legs: '#5a4a32' })
    .sphere(0.26, '#f2a020', { y: 1.93, sy: 0.7 }, 8, 4)
    .box(0.6, 0.06, 0.06, '#f2a020', { y: 1.92, z: 0.2 })
    .box(0.42, 0.46, 0.22, '#c84a2a', { y: 1.25, z: -0.27 }) // demolition pack
    .box(0.08, 0.5, 0.08, '#7a7a80', { x: 0.42, y: 0.95, z: 0.15, rx: 0.4 });
}

export function commander(): ModelBuilder {
  return body({ skin: SKIN[0], legs: '#2a2a2a', bulk: 1.15, longShirt: true })
    .box(0.42, 0.12, 0.42, '#b82a2a', { y: 1.98, rz: 0.15 })
    .box(0.2, 0.06, 0.32, '#e8c040', { x: 0.36, y: 1.5 })
    .box(0.2, 0.06, 0.32, '#e8c040', { x: -0.36, y: 1.5 })
    .box(0.8, 1.1, 0.06, '#7a1a1a', { y: 1.0, z: -0.24 })
    .cyl(0.13, 0.13, 1.2, 8, '#3a3a3a', { x: 0.32, y: 1.62, z: 0.1, rx: Math.PI / 2 });
}
