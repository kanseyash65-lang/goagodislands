import { ModelBuilder } from './model-builder';

/** Coconut palms, banana plants, bushes, hibiscus, rocks, laterite cliffs, clouds, beach cows. */
export function palm(): ModelBuilder {
  const m = new ModelBuilder();
  const segs = 6;
  let x = 0;
  let y = 0;
  for (let s = 0; s < segs; s++) {
    const h = 1.35;
    const lean = 0.07 + s * 0.035;
    m.cyl(0.24 - s * 0.022, 0.28 - s * 0.022, h, 7, s % 2 === 0 ? '#9a7450' : '#8a6644', { x: x + Math.sin(lean) * h * 0.5, y: y + h * 0.5, rz: -lean, sway: { base: 0, k: 0.035 } });
    x += Math.sin(lean) * h;
    y += Math.cos(lean) * h * 0.98;
  }
  const fronds = 8;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2;
    const droop = 0.55 + (f % 2) * 0.25;
    m.box(0.5, 0.06, 3.4, '#ffffff', { x: x + Math.sin(a) * 1.5, y: y - 0.25, z: Math.cos(a) * 1.5, ry: a, rx: droop, tint: true, sway: { base: 3, k: 0.11 } });
    m.box(0.9, 0.04, 2.2, '#e8f2d8', { x: x + Math.sin(a) * 1.3, y: y - 0.2, z: Math.cos(a) * 1.3, ry: a, rx: droop - 0.05, tint: true, sway: { base: 3, k: 0.11 } });
  }
  for (let c = 0; c < 3; c++) {
    const a = c * 2.1;
    m.sphere(0.22, '#6a4a22', { x: x + Math.sin(a) * 0.3, y: y - 0.45, z: Math.cos(a) * 0.3, sway: { base: 3, k: 0.1 } }, 6, 4);
  }
  return m;
}

export function banana(): ModelBuilder {
  const m = new ModelBuilder().cyl(0.22, 0.28, 1.8, 7, '#7a8a3a', { y: 0.9, sway: { base: 0, k: 0.03 } });
  for (let l = 0; l < 6; l++) {
    const a = (l / 6) * Math.PI * 2 + 0.3;
    m.box(0.9, 0.05, 2.1, '#ffffff', { x: Math.sin(a) * 0.9, y: 2.1, z: Math.cos(a) * 0.9, ry: a, rx: 0.6, tint: true, sway: { base: 1.5, k: 0.14 } });
  }
  return m.box(0.3, 0.5, 0.3, '#e8d84a', { x: 0.3, y: 1.6, z: 0.2 });
}

export function bush(): ModelBuilder {
  return new ModelBuilder()
    .ico(0.9, '#ffffff', { y: 0.7, tint: true, sway: { base: 0.3, k: 0.05 } })
    .ico(0.7, '#e8f0e0', { x: 0.7, y: 0.5, z: 0.2, tint: true, sway: { base: 0.3, k: 0.05 } })
    .ico(0.65, '#f2f8ea', { x: -0.6, y: 0.5, z: -0.2, tint: true, sway: { base: 0.3, k: 0.05 } });
}

export function hibiscus(): ModelBuilder {
  const m = new ModelBuilder()
    .ico(0.8, '#4e9a3a', { y: 0.65, sway: { base: 0.3, k: 0.05 } })
    .ico(0.6, '#5aa842', { x: 0.55, y: 0.5, z: 0.1, sway: { base: 0.3, k: 0.05 } });
  for (let f = 0; f < 7; f++) {
    const a = f * 0.9;
    m.sphere(0.17, '#ffffff', { x: Math.sin(a) * 0.7, y: 0.75 + (f % 3) * 0.2, z: Math.cos(a) * 0.7, tint: true }, 5, 4);
  }
  return m;
}

export function rock(): ModelBuilder {
  return new ModelBuilder()
    .dodeca(0.9, '#ffffff', { y: 0.35, sy: 0.6, tint: true })
    .dodeca(0.5, '#e8e4dc', { x: 0.7, y: 0.2, z: 0.3, sy: 0.6, tint: true });
}

export function cliff(): ModelBuilder {
  return new ModelBuilder()
    .dodeca(4, '#d4a878', { y: 2.2, sy: 0.85 })
    .dodeca(3, '#c09068', { x: 3.2, y: 1.6, z: 1.5, sy: 0.9 })
    .dodeca(2.6, '#e0b88a', { x: -2.8, y: 1.4, z: -1.2 })
    .dodeca(1.8, '#b88a62', { x: 1.2, y: 4.6, z: -0.6 })
    .ico(1.6, '#5a9a3a', { x: -0.6, y: 5.2, z: 0.4, sy: 0.5 });
}

export function cloud(): ModelBuilder {
  return new ModelBuilder()
    .ico(5, '#ffffff', { y: 0, sy: 0.6, tint: true }, 1)
    .ico(4, '#ffffff', { x: 5, y: -0.6, z: 1, sy: 0.55, tint: true }, 1)
    .ico(3.6, '#ffffff', { x: -4.8, y: -0.8, z: -0.6, sy: 0.55, tint: true }, 1)
    .ico(3, '#f4f6fa', { x: 1.5, y: 1.6, z: -1.2, sy: 0.6, tint: true }, 1);
}

function quadruped(len: number, h: number, w: number, color: string, leg: string): ModelBuilder {
  const m = new ModelBuilder().box(w, h * 0.45, len, color, { y: h * 0.72, tint: true });
  const lx = w * 0.32;
  const lz = len * 0.36;
  const pivot = h * 0.55;
  m.box(w * 0.18, h * 0.55, w * 0.18, leg, { x: lx, y: h * 0.27, z: lz, limb: pivot });
  m.box(w * 0.18, h * 0.55, w * 0.18, leg, { x: -lx, y: h * 0.27, z: lz, limb: -pivot });
  m.box(w * 0.18, h * 0.55, w * 0.18, leg, { x: lx, y: h * 0.27, z: -lz, limb: -pivot });
  m.box(w * 0.18, h * 0.55, w * 0.18, leg, { x: -lx, y: h * 0.27, z: -lz, limb: pivot });
  return m;
}

/** Goan beach cow: humped, white-cream, unbothered by everything. */
export function cow(): ModelBuilder {
  return quadruped(1.7, 1.25, 0.72, '#ffffff', '#d8d0c0')
    .box(0.5, 0.36, 0.5, '#ffffff', { y: 1.28, z: 0.4, tint: true }) // hump
    .box(0.42, 0.42, 0.55, '#f2ece2', { y: 1.15, z: 1.0 })
    .box(0.3, 0.2, 0.2, '#e8a8a0', { y: 1.02, z: 1.3 })
    .cone(0.06, 0.3, 5, '#d8c8a0', { x: 0.16, y: 1.48, z: 0.95, rz: -0.4 })
    .cone(0.06, 0.3, 5, '#d8c8a0', { x: -0.16, y: 1.48, z: 0.95, rz: 0.4 })
    .box(0.06, 0.6, 0.06, '#d8d0c0', { y: 0.85, z: -0.9, rx: 0.3 });
}

export function dog(): ModelBuilder {
  return quadruped(0.9, 0.6, 0.32, '#ffffff', '#a07850')
    .box(0.28, 0.28, 0.34, '#ffffff', { y: 0.7, z: 0.52, tint: true })
    .box(0.08, 0.14, 0.06, '#7a5a3a', { x: 0.1, y: 0.88, z: 0.48 })
    .box(0.08, 0.14, 0.06, '#7a5a3a', { x: -0.1, y: 0.88, z: 0.48 })
    .box(0.06, 0.06, 0.4, '#ffffff', { y: 0.62, z: -0.55, rx: -0.7, tint: true });
}

export function cat(): ModelBuilder {
  return quadruped(0.6, 0.42, 0.22, '#ffffff', '#d8a070')
    .box(0.22, 0.2, 0.22, '#ffffff', { y: 0.5, z: 0.36, tint: true })
    .cone(0.05, 0.1, 4, '#ffffff', { x: 0.07, y: 0.65, z: 0.36, tint: true })
    .cone(0.05, 0.1, 4, '#ffffff', { x: -0.07, y: 0.65, z: 0.36, tint: true })
    .box(0.04, 0.04, 0.45, '#ffffff', { y: 0.55, z: -0.42, rx: -1, tint: true });
}

export function crow(): ModelBuilder {
  return new ModelBuilder()
    .box(0.22, 0.2, 0.5, '#ffffff', { tint: true })
    .box(0.9, 0.04, 0.3, '#ffffff', { y: 0.05, tint: true, sway: { base: -1, k: 0.15 } })
    .box(0.16, 0.16, 0.16, '#ffffff', { y: 0.06, z: 0.3, tint: true })
    .cone(0.04, 0.14, 4, '#d8a040', { y: 0.05, z: 0.44, rx: Math.PI / 2 });
}

/** Spawn-only animals (not part of the default village). */
export function chicken(): ModelBuilder {
  return new ModelBuilder()
    .box(0.06, 0.32, 0.06, '#f2a03a', { x: 0.1, y: 0.16, limb: 0.32 })
    .box(0.06, 0.32, 0.06, '#f2a03a', { x: -0.1, y: 0.16, limb: -0.32 })
    .sphere(0.32, '#ffffff', { y: 0.5, sz: 1.2, tint: true }, 8, 6)
    .sphere(0.17, '#ffffff', { y: 0.82, z: 0.26, tint: true }, 8, 6)
    .cone(0.06, 0.14, 4, '#f2a03a', { y: 0.8, z: 0.45, rx: Math.PI / 2 })
    .box(0.06, 0.14, 0.14, '#e2403a', { y: 1.0, z: 0.24 })
    .box(0.06, 0.24, 0.2, '#ffffff', { y: 0.62, z: -0.36, rx: -0.6, tint: true });
}

export function duck(): ModelBuilder {
  return new ModelBuilder()
    .box(0.07, 0.24, 0.07, '#f2a03a', { x: 0.1, y: 0.12, limb: 0.24 })
    .box(0.07, 0.24, 0.07, '#f2a03a', { x: -0.1, y: 0.12, limb: -0.24 })
    .sphere(0.34, '#ffffff', { y: 0.42, sz: 1.3, sy: 0.8, tint: true }, 8, 6)
    .sphere(0.17, '#ffffff', { y: 0.72, z: 0.3, tint: true }, 8, 6)
    .box(0.14, 0.05, 0.2, '#f2a03a', { y: 0.68, z: 0.48 });
}

/** A big, slightly sad dragon. Treated by villagers with administrative concern. */
export function dragon(): ModelBuilder {
  const m = quadruped(4.2, 2.6, 1.6, '#ffffff', '#2f8a7a')
    .box(1.2, 1.1, 1.3, '#ffffff', { y: 2.6, z: 2.4, tint: true })
    .box(0.8, 0.5, 0.9, '#e8d08a', { y: 2.3, z: 3.1 })
    .cone(0.16, 0.7, 5, '#f2e2b0', { x: 0.35, y: 3.4, z: 2.2, rx: -0.4 })
    .cone(0.16, 0.7, 5, '#f2e2b0', { x: -0.35, y: 3.4, z: 2.2, rx: -0.4 })
    .sphere(0.14, '#1a1a1a', { x: 0.36, y: 2.8, z: 3.0 }, 6, 4)
    .sphere(0.14, '#1a1a1a', { x: -0.36, y: 2.8, z: 3.0 }, 6, 4)
    .box(0.4, 0.4, 2.6, '#ffffff', { y: 1.7, z: -3, rx: 0.3, tint: true });
  for (const side of [1, -1]) {
    m.box(3.2, 0.1, 1.8, '#d8f0e8', { x: side * 2.2, y: 2.9, z: 0.2, rz: side * 0.35, tint: true, sway: { base: 2.5, k: 0.25 } });
  }
  return m;
}
