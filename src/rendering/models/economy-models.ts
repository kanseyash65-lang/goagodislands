import { goanHouse } from './goan-models';
import { ModelBuilder } from './model-builder';

/** Resource, storage and army buildings, plus boats and props. */
const WOOD = '#8a5a34';
const ROOF = '#c4532f';
const STEEL = '#4a4f56';

export function residence(): ModelBuilder {
  return goanHouse(true).cyl(0.5, 0.5, 0.12, 12, '#f2c230', { x: 2.2, y: 4.2, z: 2.75, rx: Math.PI / 2 });
}

export function sawmill(): ModelBuilder {
  const m = new ModelBuilder().box(6, 0.3, 5, '#8a6a44', { y: 0.15 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.25, 3, 0.25, WOOD, { x: sx * 2.6, y: 1.6, z: sz * 2.1 });
  m.gable(6, 5, 1.5, '#7a5a3a', { y: 3.1 });
  for (let i = 0; i < 4; i++) m.cyl(0.35, 0.35, 3.6, 8, '#a8784a', { x: -1.2 + (i % 2) * 0.7, y: 0.6 + Math.floor(i / 2) * 0.6, z: 1, rz: Math.PI / 2 });
  return m.cyl(1, 1, 0.08, 16, '#c8ccd2', { x: 1.6, y: 1.5, z: -0.6, rx: Math.PI / 2 }).box(1.6, 1, 1.4, WOOD, { x: 1.6, y: 0.6, z: -0.6 });
}

export function quarry(): ModelBuilder {
  const m = new ModelBuilder().cyl(3.2, 3.6, 0.6, 9, '#a8583a', { y: 0.3 });
  const blocks: readonly [number, number, number][] = [[-1, 0.9, -0.6], [0.4, 0.9, -1], [-0.4, 1.7, -0.8], [1.2, 0.9, 0.6], [-1.4, 0.9, 1]];
  for (const [x, y, z] of blocks) m.box(1.1, 0.8, 0.8, '#c4643c', { x, y, z, ry: x });
  return m.box(0.2, 4.4, 0.2, WOOD, { x: 2, y: 2.2, z: 1.6 }).box(2.8, 0.18, 0.18, WOOD, { x: 0.8, y: 4.3, z: 1.6 }).box(0.04, 1.6, 0.04, '#2a2a2a', { x: -0.4, y: 3.4, z: 1.6 });
}

export function ironMine(): ModelBuilder {
  return new ModelBuilder()
    .dodeca(3, '#8a8478', { y: 1.4, sy: 0.75 })
    .box(1.8, 2, 1.4, '#2a2622', { y: 1.0, z: 2 })
    .box(2.2, 0.3, 0.3, WOOD, { y: 2.1, z: 2.6 })
    .box(0.3, 2, 0.3, WOOD, { x: 1, y: 1.0, z: 2.6 })
    .box(0.3, 2, 0.3, WOOD, { x: -1, y: 1.0, z: 2.6 })
    .box(1.2, 0.8, 1.6, STEEL, { x: 0.3, y: 0.6, z: 4 })
    .box(1.1, 0.3, 1.5, '#5a6270', { x: 0.3, y: 1.1, z: 4 });
}

function warehouse(roof: string, goods: (m: ModelBuilder) => void): ModelBuilder {
  const m = new ModelBuilder().box(5, 0.3, 4.4, '#9a9488', { y: 0.15 }).box(4.4, 2.8, 3.8, '#ffffff', { y: 1.7, tint: true }).gable(4.8, 4.2, 1.4, roof, { y: 3.1 });
  m.box(1.6, 2, 0.1, '#5a4a3a', { y: 1.3, z: 1.95 });
  goods(m);
  return m;
}

export function vault(): ModelBuilder {
  return new ModelBuilder()
    .box(5, 0.4, 5, '#8f8b82', { y: 0.2 })
    .box(4.2, 3.2, 4.2, '#ffffff', { y: 2, tint: true })
    .box(4.6, 0.4, 4.6, '#e8c040', { y: 3.8 })
    .cyl(1, 1, 0.3, 14, '#c8ccd2', { y: 2, z: 2.15, rx: Math.PI / 2 })
    .box(0.8, 0.12, 0.12, '#4a4f56', { y: 2, z: 2.35 })
    .cyl(0.5, 0.5, 0.3, 10, '#f2c230', { x: 1.2, y: 4.2 });
}

export function timberStore(): ModelBuilder {
  return warehouse('#7a5a3a', (m) => {
    for (let i = 0; i < 3; i++) m.cyl(0.3, 0.3, 3, 8, '#a8784a', { x: 2.8, y: 0.4 + i * 0.55, z: -1 + i * 0.3, rx: Math.PI / 2 });
  });
}

export function stoneStore(): ModelBuilder {
  return warehouse(ROOF, (m) => {
    m.box(1, 0.8, 1, '#c4643c', { x: 2.9, y: 0.5, z: -0.8 }).box(1, 0.8, 1, '#c4643c', { x: 2.9, y: 0.5, z: 0.6 });
  });
}

export function metalStore(): ModelBuilder {
  return warehouse('#5a6270', (m) => {
    m.box(1.4, 0.4, 0.8, '#9aa4b0', { x: 2.9, y: 0.4, z: -0.6 }).box(1.4, 0.4, 0.8, '#9aa4b0', { x: 2.9, y: 0.8, z: -0.4 });
  });
}

export function armory(): ModelBuilder {
  return new ModelBuilder()
    .box(6.4, 0.4, 5.4, '#8f8b82', { y: 0.2 })
    .box(6, 3.4, 5, '#d8d0bc', { y: 2.1 })
    .hipRoof(6.8, 5.8, 1.8, '#ffffff', { y: 4.7, tint: true })
    .box(2.2, 2.4, 0.1, '#3a3f46', { y: 1.6, z: 2.55 })
    .box(0.16, 1.4, 0.1, '#2a2622', { x: 2, y: 1.4, z: 2.6, rz: 0.3 })
    .box(0.16, 1.4, 0.1, '#2a2622', { x: 2.4, y: 1.4, z: 2.6, rz: 0.3 });
}

export function barracks(): ModelBuilder {
  const m = new ModelBuilder().box(7, 0.25, 6, '#a89c7a', { y: 0.12 });
  for (const sx of [-1.6, 1.6]) m.gable(2.6, 5, 2.4, '#ffffff', { x: sx, y: 0.25, ry: Math.PI / 2, tint: true });
  return m.box(0.1, 4.5, 0.1, '#d8d8d8', { x: 3, y: 2.25, z: 2.6 }).box(1.4, 0.8, 0.05, '#ffffff', { x: 3.7, y: 4, z: 2.6, tint: true });
}

export function dock(): ModelBuilder {
  const m = new ModelBuilder().box(4, 0.3, 10, '#a8784a', { y: 0.55, z: 3 });
  for (let z = -1; z < 8; z += 3) for (const sx of [-1, 1]) m.cyl(0.15, 0.15, 3, 6, '#6a4628', { x: sx * 1.8, y: -0.5, z });
  return m.box(0.2, 1.6, 0.2, '#6a4628', { x: 1.8, y: 1.4, z: -1.8 }).box(0.2, 1.6, 0.2, '#6a4628', { x: -1.8, y: 1.4, z: -1.8 }).box(4, 0.5, 0.2, '#ffffff', { y: 2.2, z: -1.8, tint: true });
}

export function radarBase(): ModelBuilder {
  return new ModelBuilder().box(3, 0.4, 3, '#8f8b82', { y: 0.2 }).cyl(0.35, 0.55, 3.4, 8, '#d8dde6', { y: 2 }).box(1.4, 1.2, 1.4, '#ffffff', { y: 1, tint: true });
}

/** Radar dish: pivot at origin, spins around Y. */
export function radarDish(): ModelBuilder {
  return new ModelBuilder()
    .cyl(1.5, 0.3, 0.6, 12, '#e8ecf2', { y: 0.2, z: 0.3, rx: -1.2 })
    .box(0.1, 0.1, 1, '#4a4f56', { y: 0.4, z: 0.9 });
}

export function landingCraft(): ModelBuilder {
  return new ModelBuilder()
    .box(3.2, 1.2, 6.4, '#ffffff', { y: 0.2, tint: true })
    .box(2.6, 0.2, 5.6, '#6a7078', { y: 0.82 })
    .box(3.2, 1.5, 0.25, '#7a8088', { y: 0.7, z: 3.3, rx: 0.25 })
    .box(1.2, 1, 1, '#5a6068', { y: 1.4, z: -2.6 });
}

export function gunboat(): ModelBuilder {
  return new ModelBuilder()
    .box(5, 2, 16, '#7a8088', { y: 0 })
    .cone(2.5, 4, 4, '#7a8088', { y: 0, z: 10, rx: Math.PI / 2, ry: Math.PI / 4, sx: 1, sz: 0.7 })
    .box(5.05, 0.4, 16, '#ffffff', { y: 0.9, tint: true })
    .box(3.4, 3, 4.4, '#d8dce2', { y: 2.4, z: -3 })
    .box(2.6, 1.6, 3, '#c8ccd2', { y: 4.6, z: -3.2 })
    .cyl(0.25, 0.25, 4, 6, '#3a3f46', { y: 6.5, z: -3.6 })
    .cyl(1.1, 1.3, 0.8, 10, '#5a6068', { y: 1.4, z: 4 })
    .cyl(0.3, 0.38, 3.2, 8, '#3a3f46', { y: 1.8, z: 5.6, rx: Math.PI / 2 - 0.2 });
}

export function thing(): ModelBuilder {
  return new ModelBuilder()
    .ico(0.9, '#ffffff', { y: 0.9, sy: 0.85, tint: true }, 1)
    .sphere(0.16, '#ffffff', { x: 0.3, y: 1.1, z: 0.72 }, 6, 4)
    .sphere(0.16, '#ffffff', { x: -0.3, y: 1.1, z: 0.72 }, 6, 4)
    .sphere(0.08, '#1a1a1a', { x: 0.3, y: 1.1, z: 0.85 }, 6, 4)
    .sphere(0.08, '#1a1a1a', { x: -0.3, y: 1.1, z: 0.85 }, 6, 4);
}

export function crate(): ModelBuilder {
  return new ModelBuilder().box(1.2, 1.2, 1.2, '#ffffff', { y: 0.6, tint: true }).box(1.25, 0.15, 1.25, '#7a5634', { y: 0.6 });
}

export function coin(): ModelBuilder {
  return new ModelBuilder().cyl(0.45, 0.45, 0.12, 12, '#ffffff', { y: 0.5, rx: Math.PI / 2, tint: true });
}

export function pizza(): ModelBuilder {
  return new ModelBuilder().cone(0.9, 0.12, 3, '#ffd25e', { y: 0.1 }).sphere(0.15, '#c8402e', { x: 0.2, y: 0.18 }, 6, 3).sphere(0.15, '#c8402e', { x: -0.25, y: 0.18, z: 0.2 }, 6, 3);
}

export function fish(): ModelBuilder {
  return new ModelBuilder()
    .sphere(0.4, '#ffffff', { y: 0.3, sz: 2, sy: 0.7, tint: true }, 8, 5)
    .cone(0.3, 0.4, 4, '#ffffff', { y: 0.3, z: -0.95, rx: -Math.PI / 2, sx: 0.3, tint: true });
}
