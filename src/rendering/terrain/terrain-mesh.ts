import { BufferAttribute, Color, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { ISLAND_CENTER, ISLAND_RADIUS, TERRAIN_ORIGIN, TERRAIN_RES, TERRAIN_SIZE } from '../../core/config/world.config';
import { fbm, smoothstep, valueNoise } from '../../world/noise';
import type { Point, WorldLayout } from '../../world/world-layout';

const SEABED = new Color('#d9c48e');
const SAND_WET = new Color('#d8bd7f');
const SAND = new Color('#f2dca0');
const GRASS = new Color('#79bf45');
const GRASS_LIGHT = new Color('#9ad154');
const JUNGLE = new Color('#4d9235');
const ROCK = new Color('#b98a5e');
const LATERITE = new Color('#b8643c');
const PATH = new Color('#e2c487');

/**
 * Island ground as one mesh: heights from the layout, colours painted per vertex
 * (sand, grass, jungle floor, laterite rock on slopes, sandy village paths).
 * Rebuilt only when the island changes.
 */
export function buildTerrainMesh(layout: WorldLayout): Mesh {
  const geo = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_RES, TERRAIN_RES);
  geo.rotateX(-Math.PI / 2);
  geo.translate(TERRAIN_ORIGIN + TERRAIN_SIZE / 2, 0, TERRAIN_ORIGIN + TERRAIN_SIZE / 2);
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const noise = valueNoise(layout.style.seed + 99);
  const c = new Color();
  const N = TERRAIN_RES + 1;
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v);
    const y = pos.getZ(v);
    const i = Math.round((x - TERRAIN_ORIGIN) / (TERRAIN_SIZE / TERRAIN_RES));
    const j = Math.round((y - TERRAIN_ORIGIN) / (TERRAIN_SIZE / TERRAIN_RES));
    const h = layout.heights[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))] ?? 0;
    pos.setY(v, h);
    paint(c, layout, noise, x, y, h);
    colors[v * 3] = c.r;
    colors[v * 3 + 1] = c.g;
    colors[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  slopeTint(geo);
  const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}

function paint(c: Color, layout: WorldLayout, noise: ReturnType<typeof valueNoise>, x: number, y: number, h: number): void {
  const n = fbm(noise, x * 0.06, y * 0.06);
  if (h < -0.2) {
    c.copy(SEABED).multiplyScalar(0.85 + n * 0.2);
    return;
  }
  if (h < 0.75) {
    c.copy(SAND_WET).lerp(SAND, smoothstep(-0.1, 0.5, h)).multiplyScalar(0.94 + n * 0.1);
    return;
  }
  const R = ISLAND_RADIUS * layout.style.size;
  const edge = Math.max(Math.abs(x - ISLAND_CENTER), Math.abs(y - ISLAND_CENTER)) / R;
  c.copy(GRASS).lerp(GRASS_LIGHT, n);
  c.lerp(JUNGLE, smoothstep(0.55, 0.85, edge) * 0.8);
  c.lerp(SAND, smoothstep(1.2, 0.75, h) * 0.6); // grass fades into sand at the beach
  if (h > 6) c.lerp(JUNGLE, 0.5);
  const p = pathFactor(layout.paths, x, y);
  if (p > 0) c.lerp(PATH, p);
}

/** Distance-based blend toward the sandy path colour. */
function pathFactor(paths: readonly (readonly Point[])[], x: number, y: number): number {
  let best = Infinity;
  for (const path of paths) {
    for (let k = 0; k < path.length - 1; k++) {
      const a = path[k];
      const b = path[k + 1];
      if (!a || !b) continue;
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)));
      best = Math.min(best, Math.hypot(a.x + vx * t - x, a.y + vy * t - y));
    }
  }
  return smoothstep(3.2, 1.6, best) * 0.85;
}

/** Steep faces read as laterite rock, the red stone of the Goan coast. */
function slopeTint(geo: PlaneGeometry): void {
  const nrm = geo.getAttribute('normal');
  const col = geo.getAttribute('color');
  const pos = geo.getAttribute('position');
  const c = new Color();
  for (let v = 0; v < nrm.count; v++) {
    const steep = smoothstep(0.88, 0.62, nrm.getY(v));
    if (steep <= 0 || pos.getY(v) < 0.4) continue;
    c.setRGB(col.getX(v), col.getY(v), col.getZ(v)).lerp(pos.getY(v) > 4 ? ROCK : LATERITE, steep);
    col.setXYZ(v, c.r, c.g, c.b);
  }
}
