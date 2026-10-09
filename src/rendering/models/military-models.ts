import { ModelBuilder } from './model-builder';

/**
 * Military structures. Team colour is the tint (player blue / enemy red-brown).
 * Turrets are separate models with their pivot at the origin, so they can aim.
 */
const CONCRETE = '#b8b4aa';
const CONCRETE_DARK = '#8f8b82';
const SAND = '#c8b07a';
const STEEL = '#4a4f56';
const LATERITE = '#b8643c';

function sandbagRing(m: ModelBuilder, r: number, y: number): void {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    m.box(1.1, 0.5, 0.6, i % 2 ? SAND : '#b89c6a', { x: Math.sin(a) * r, y, z: Math.cos(a) * r, ry: a });
  }
}

export function hq(): ModelBuilder {
  const m = new ModelBuilder()
    .box(10.5, 0.6, 10.5, CONCRETE_DARK, { y: 0.3 })
    .box(9, 3.6, 9, LATERITE, { y: 2.4 })
    .box(6.6, 3, 6.6, '#ffffff', { y: 5.7, tint: true })
    .box(7.2, 0.4, 7.2, CONCRETE, { y: 7.4 })
    .box(1.8, 2.4, 0.2, '#3a2a20', { y: 1.8, z: 4.55 })
    .box(0.12, 6, 0.12, '#d8d8d8', { x: 2.6, y: 10.4, z: 2.6 })
    .box(2.2, 1.3, 0.06, '#ffffff', { x: 3.7, y: 12.6, z: 2.6, tint: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.box(1.2, 0.9, 0.7, LATERITE, { x: Math.sin(a) * 4.3, y: 4.6, z: Math.cos(a) * 4.3, ry: a });
  }
  for (const [x, z] of [[-1.6, 3.32], [1.6, 3.32]] as const) m.box(1, 1.1, 0.08, '#8ac8f0', { x, y: 5.9, z });
  return m;
}

export function cannonBase(): ModelBuilder {
  return new ModelBuilder()
    .cyl(2.4, 2.7, 1, 10, CONCRETE_DARK, { y: 0.5 })
    .cyl(2.2, 2.2, 0.2, 10, '#ffffff', { y: 1.05, tint: true });
}

export function cannonTurret(): ModelBuilder {
  return new ModelBuilder()
    .box(1.8, 0.9, 2, '#ffffff', { y: 0.45, tint: true })
    .cyl(0.42, 0.55, 3.2, 10, STEEL, { y: 1, z: 1.4, rx: Math.PI / 2 - 0.12 })
    .cyl(0.6, 0.6, 0.3, 10, '#2a2d32', { y: 1, z: 0, rx: Math.PI / 2 });
}

export function machineGunBase(): ModelBuilder {
  const m = new ModelBuilder().cyl(2, 2.2, 0.4, 10, CONCRETE_DARK, { y: 0.2 });
  sandbagRing(m, 1.7, 0.65);
  return m;
}

export function machineGunTurret(): ModelBuilder {
  return new ModelBuilder()
    .cyl(0.2, 0.3, 1, 6, STEEL, { y: 0.5 })
    .box(1.5, 1, 0.12, '#ffffff', { y: 1.2, z: 0.4, tint: true })
    .box(0.18, 0.2, 1.8, '#26292e', { y: 1.15, z: 0.9 })
    .box(0.4, 0.3, 0.5, STEEL, { y: 1.15, z: 0.1 });
}

export function mortarBase(): ModelBuilder {
  const m = new ModelBuilder().cyl(2.1, 2.3, 0.4, 10, CONCRETE_DARK, { y: 0.2 });
  sandbagRing(m, 1.8, 0.65);
  return m.box(0.7, 0.5, 0.7, '#6a5a3a', { x: 1, y: 0.6, z: -0.8 });
}

export function mortarTurret(): ModelBuilder {
  return new ModelBuilder()
    .cyl(0.5, 0.6, 0.4, 8, '#ffffff', { y: 0.4, tint: true })
    .cyl(0.32, 0.42, 1.9, 8, STEEL, { y: 1.2, z: 0.35, rx: 0.5 });
}

export function sniperTower(): ModelBuilder {
  const m = new ModelBuilder();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.25, 6.2, 0.25, '#7a5634', { x: sx * 1.2, y: 3.1, z: sz * 1.2, rx: sz * -0.04, rz: sx * 0.04 });
  m.box(3.2, 0.25, 3.2, '#8a6440', { y: 6.2 });
  for (const s of [-1, 1]) {
    m.box(3.2, 0.9, 0.12, '#ffffff', { y: 6.8, z: s * 1.55, tint: true });
    m.box(0.12, 0.9, 3.2, '#ffffff', { x: s * 1.55, y: 6.8, tint: true });
  }
  return m.hipRoof(3.8, 3.8, 1.2, '#5a4a32', { y: 8.6 }).box(0.12, 1.6, 0.12, '#7a5634', { x: 1.4, y: 7.4, z: 1.4 });
}

export function sniperTurret(): ModelBuilder {
  return new ModelBuilder().box(0.1, 0.1, 1.4, '#1a1a1a', { y: 7, z: 0.9 }).sphere(0.22, '#4a5a3a', { y: 7.15 }, 6, 4);
}

export function mine(): ModelBuilder {
  return new ModelBuilder().cyl(0.6, 0.7, 0.18, 10, '#4a4a40', { y: 0.09 }).sphere(0.12, '#ff3a2a', { y: 0.2 }, 6, 4);
}

export function bunker(): ModelBuilder {
  return new ModelBuilder()
    .sphere(3.2, CONCRETE, { y: 0, sy: 0.62 }, 12, 6)
    .box(2.4, 0.4, 0.4, '#1a1a1a', { y: 1.2, z: 2.8 })
    .box(1.4, 1.6, 0.2, '#2a2a2a', { y: 0.8, z: -2.9 })
    .box(0.1, 3, 0.1, '#d8d8d8', { x: 1.6, y: 2.6 })
    .box(1.3, 0.8, 0.05, '#ffffff', { x: 2.25, y: 3.6, tint: true });
}

export function cage(): ModelBuilder {
  const m = new ModelBuilder().box(3.2, 0.3, 3.2, '#7a5634', { y: 0.15 }).box(3.4, 0.25, 3.4, '#9a7a40', { y: 3 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    m.cyl(0.07, 0.07, 2.8, 5, '#b8945a', { x: Math.sin(a) * 1.5, y: 1.55, z: Math.cos(a) * 1.5 });
  }
  return m.box(0.5, 0.6, 0.4, '#e8a87a', { y: 0.6 }).box(0.36, 0.36, 0.34, '#c98e62', { y: 1.1 });
}

export function supplyDepot(): ModelBuilder {
  const m = new ModelBuilder().box(5, 0.3, 4, '#7a6a4a', { y: 0.15 });
  const crates: readonly [number, number, number][] = [[-1.2, 0.8, -0.8], [0.4, 0.8, -0.9], [-0.4, 2.2, -0.8], [1.5, 0.8, 0.8]];
  for (const [x, y, z] of crates) m.box(1.4, 1.4, 1.4, '#b8864a', { x, y, z });
  for (const x of [-1.6, -0.9]) m.cyl(0.45, 0.45, 1.3, 10, '#ffffff', { x, y: 0.95, z: 1.2, tint: true });
  return m.box(3.6, 0.1, 2.6, '#ffffff', { y: 3.1, z: -0.8, rx: 0.15, tint: true });
}

export function wall(): ModelBuilder {
  return new ModelBuilder()
    .box(3.6, 2.2, 1.6, LATERITE, { y: 1.1 })
    .box(0.9, 0.6, 1.7, '#a8583a', { x: -1.2, y: 2.5 })
    .box(0.9, 0.6, 1.7, '#a8583a', { x: 1.2, y: 2.5 });
}

/** Generic debris left when a building is destroyed. */
export function rubble(): ModelBuilder {
  const m = new ModelBuilder().cyl(2.8, 3.2, 0.35, 9, '#5a5248', { y: 0.17 });
  const bits: readonly [number, number, number, number][] = [[0.8, 0.5, 0.4, 0.9], [-1, 0.4, -0.5, 0.7], [0.2, 0.5, -1.2, 0.8], [-0.6, 0.7, 0.9, 0.6], [1.4, 0.3, -0.7, 0.5]];
  for (const [x, y, z, r] of bits) m.dodeca(r, '#6e655a', { x, y, z });
  return m.box(2.6, 0.18, 0.2, '#4a3a2a', { y: 0.5, rz: 0.3, ry: 0.6 }).box(2.2, 0.18, 0.2, '#3a2e22', { y: 0.6, rz: -0.25, ry: -0.9 });
}
