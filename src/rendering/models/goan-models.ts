import { ModelBuilder } from './model-builder';

/**
 * Goan architecture: Portuguese-style houses (colourful lime-washed walls, white
 * trim, red Mangalore-tile hip roofs, balcão porches), a white chapel, beach
 * shacks, laterite fort and well, lighthouse, jetty and fishing canoes.
 */
const TILE = '#c4532f';
const TILE_DARK = '#a8442a';
const TRIM = '#fbf6ea';
const LATERITE = '#b8643c';
const LATERITE_DARK = '#9a5030';
const WOOD = '#8a5a34';
const SHUTTER = '#2f8a6a';

function windowFrame(m: ModelBuilder, x: number, y: number, z: number, ry = 0): void {
  m.box(0.9, 1.1, 0.08, TRIM, { x, y, z, ry });
  m.box(0.62, 0.8, 0.1, SHUTTER, { x, y, z, ry });
}

/** Goan house; `wide` gives the larger residence variant. */
export function goanHouse(wide = false): ModelBuilder {
  const w = wide ? 6.4 : 5.4;
  const d = wide ? 5.2 : 4.6;
  const m = new ModelBuilder()
    .box(w + 0.4, 0.5, d + 0.4, TRIM, { y: 0.25 })
    .box(w, 3, d, '#ffffff', { y: 2, tint: true })
    .box(w + 0.1, 0.25, d + 0.1, TRIM, { y: 3.55 })
    .hipRoof(w + 1.2, d + 1.2, 2.2, TILE, { y: 4.75 })
    .box(1.1, 1.9, 0.1, WOOD, { y: 1.45, z: d / 2 + 0.05 })
    .box(1.4, 0.18, 0.12, TRIM, { y: 2.5, z: d / 2 + 0.06 });
  windowFrame(m, -w * 0.3, 2.1, d / 2 + 0.05);
  windowFrame(m, w * 0.3, 2.1, d / 2 + 0.05);
  windowFrame(m, w / 2 + 0.05, 2.1, 0, Math.PI / 2);
  windowFrame(m, -w / 2 - 0.05, 2.1, 0, Math.PI / 2);
  // balcão: a small pillared porch with benches, typical of Goan homes
  m.box(w * 0.55, 0.35, 1.6, TRIM, { y: 0.67, z: d / 2 + 0.8 });
  for (const sx of [-1, 1]) m.box(0.22, 2.1, 0.22, TRIM, { x: sx * w * 0.25, y: 1.85, z: d / 2 + 1.45 });
  m.hipRoof(w * 0.62, 1.9, 0.7, TILE_DARK, { y: 3.25, z: d / 2 + 0.85 });
  return m;
}

export function chapel(): ModelBuilder {
  const m = new ModelBuilder()
    .box(5.2, 0.5, 9.4, '#e8e2d4', { y: 0.25 })
    .box(4.6, 4.6, 8.6, '#ffffff', { y: 2.8, z: -0.2, tint: true })
    .gable(9, 4.9, 2, TILE, { y: 5.1, z: -0.2, ry: Math.PI / 2 })
    .box(5.6, 7, 0.6, '#ffffff', { y: 3.5, z: 4.1, tint: true }) // baroque facade
    .gable(0.62, 5.6, 1.8, '#ffffff', { y: 7, z: 4.1, ry: Math.PI / 2, tint: true })
    .box(5.8, 0.25, 0.7, '#6aa0d8', { y: 5.2, z: 4.1 })
    .box(1.4, 2.6, 0.12, WOOD, { y: 1.8, z: 4.42 })
    .cyl(0.5, 0.5, 0.12, 12, '#6aa0d8', { y: 5.9, z: 4.42, rx: Math.PI / 2 })
    .box(0.14, 1.1, 0.14, '#e8c040', { y: 9.3, z: 4.1 })
    .box(0.6, 0.14, 0.14, '#e8c040', { y: 9.45, z: 4.1 });
  for (const sx of [-1, 1]) {
    m.box(1.1, 8.4, 1.1, '#ffffff', { x: sx * 2.9, y: 4.2, z: 4.0, tint: true });
    m.cone(0.75, 1.3, 4, TILE, { x: sx * 2.9, y: 9.05, z: 4.0, ry: Math.PI / 4 });
  }
  return m;
}

export function shack(): ModelBuilder {
  const m = new ModelBuilder().box(4.2, 0.3, 3.6, '#c9a46a', { y: 0.35 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.cyl(0.12, 0.12, 2.8, 6, '#b8945a', { x: sx * 1.9, y: 1.7, z: sz * 1.6 });
  return m
    .hipRoof(5.4, 4.8, 1.8, '#d8c27a', { y: 3.9 })
    .box(3.2, 1.0, 0.6, '#ffffff', { y: 1.0, z: 1.3, tint: true })
    .box(0.06, 1.6, 0.06, '#7a5a3a', { x: 2.4, y: 4.5, z: 2 })
    .box(0.9, 0.5, 0.04, '#ffffff', { x: 2.85, y: 5, z: 2, tint: true })
    .box(0.9, 0.8, 0.9, '#3a8acf', { x: -1.2, y: 0.9, z: -0.8 });
}

export function market(): ModelBuilder {
  const m = new ModelBuilder().box(4.6, 0.9, 2.4, WOOD, { y: 0.95 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.16, 2.8, 0.16, '#6a4628', { x: sx * 2.2, y: 1.4, z: sz * 1.1 });
  for (let s = 0; s < 5; s++) m.box(0.92, 0.12, 3, s % 2 ? TRIM : '#ffffff', { x: -1.84 + s * 0.92, y: 2.95, rx: -0.15, tint: s % 2 === 0 });
  const fruit = ['#e8344a', '#f2c230', '#5cbf3a', '#f08a2a', '#9ad0e8'];
  fruit.forEach((c, i) => m.sphere(0.26, c, { x: -1.6 + i * 0.8, y: 1.6, z: 0.3 }, 6, 4));
  return m;
}

export function well(): ModelBuilder {
  return new ModelBuilder()
    .cyl(1.1, 1.2, 1.1, 10, LATERITE, { y: 0.55 })
    .cyl(0.85, 0.85, 0.05, 10, '#2f6a8a', { y: 1.08 })
    .box(0.14, 2.2, 0.14, WOOD, { x: 1, y: 1.6 })
    .box(0.14, 2.2, 0.14, WOOD, { x: -1, y: 1.6 })
    .gable(1.4, 2.6, 0.7, TILE, { y: 2.7, ry: Math.PI / 2 });
}

export function windmill(): ModelBuilder {
  return new ModelBuilder()
    .cyl(1.6, 2.3, 7, 10, '#ffffff', { y: 3.5, tint: true })
    .cone(2, 2, 10, TILE, { y: 8 })
    .box(1, 1.8, 0.1, WOOD, { y: 0.9, z: 2.1 })
    .box(0.6, 0.7, 0.1, SHUTTER, { y: 4.5, z: 1.85 });
}

/** Windmill sails: the pivot (hub) is at the origin, sails in the local XY plane. */
export function windmillSails(): ModelBuilder {
  const m = new ModelBuilder()
    .cyl(0.35, 0.35, 0.8, 8, WOOD, { rx: Math.PI / 2 })
    .sphere(0.4, '#5a3a22', { z: 0.4 }, 6, 4);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    m.box(0.16, 4.6, 0.12, WOOD, { x: Math.sin(a) * 2.3, y: Math.cos(a) * 2.3, z: 0.25, rz: -a });
    m.box(0.95, 3.6, 0.05, '#f2eadb', { x: Math.sin(a) * 2.6 + Math.cos(a) * 0.5, y: Math.cos(a) * 2.6 - Math.sin(a) * 0.5, z: 0.3, rz: -a });
  }
  return m;
}

export function lighthouse(): ModelBuilder {
  const m = new ModelBuilder().cyl(2.2, 2.6, 1, 12, LATERITE, { y: 0.5 });
  for (let s = 0; s < 5; s++) m.cyl(1.55 - s * 0.12, 1.65 - s * 0.12, 2.2, 12, s % 2 ? '#ffffff' : '#ffffff', { y: 2.1 + s * 2.2, tint: s % 2 === 0 });
  return m
    .cyl(1.6, 1.6, 0.25, 12, '#2a2a2a', { y: 12.2 })
    .cyl(0.9, 0.9, 1.3, 8, '#fff2a0', { y: 13 })
    .cone(1.2, 1.2, 8, '#c4532f', { y: 14.25 });
}

export function fortTower(): ModelBuilder {
  const m = new ModelBuilder()
    .cyl(2.8, 3.3, 5.5, 12, LATERITE, { y: 2.75 })
    .cyl(3, 3, 0.4, 12, LATERITE_DARK, { y: 5.6 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    m.box(0.9, 0.9, 0.6, LATERITE, { x: Math.sin(a) * 2.75, y: 6.2, z: Math.cos(a) * 2.75, ry: a });
  }
  return m.box(1.2, 1.4, 0.2, '#3a2a20', { y: 1.5, z: 3.2 });
}

export function jetty(): ModelBuilder {
  const m = new ModelBuilder().box(2.8, 0.25, 22, '#a8784a', { y: 0.65, z: 11 });
  for (let z = 1; z < 22; z += 3.5) for (const sx of [-1, 1]) m.cyl(0.14, 0.14, 3, 6, '#6a4628', { x: sx * 1.3, y: -0.6, z });
  for (let z = 0; z < 22; z += 1.1) m.box(2.9, 0.06, 0.08, '#7a5634', { y: 0.79, z });
  return m;
}

export function fishingBoat(): ModelBuilder {
  return new ModelBuilder()
    .box(1.3, 0.7, 5.2, '#ffffff', { y: 0.35, tint: true })
    .cone(0.65, 1.4, 4, '#ffffff', { y: 0.35, z: 3.3, rx: Math.PI / 2, ry: Math.PI / 4, sx: 1, sz: 0.55, tint: true })
    .cone(0.65, 1, 4, '#ffffff', { y: 0.35, z: -3.1, rx: -Math.PI / 2, ry: Math.PI / 4, sz: 0.55, tint: true })
    .box(1.1, 0.1, 4.6, '#7a5634', { y: 0.68 })
    .box(3.2, 0.08, 0.1, '#7a5634', { x: 1.4, y: 0.8, z: 0.8 })
    .box(3.2, 0.08, 0.1, '#7a5634', { x: 1.4, y: 0.8, z: -0.8 })
    .box(0.25, 0.25, 3.4, '#d8c8a0', { x: 3, y: 0.3 }) // outrigger float
    .box(0.9, 0.25, 0.9, '#c9b07a', { y: 0.85, z: -1.2 }); // folded nets
}
