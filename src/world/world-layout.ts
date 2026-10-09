import {
  BEACH_HEIGHT, ISLAND_CENTER, ISLAND_RADIUS, MAP_TILES_H, MAP_TILES_W, PLATEAU_HEIGHT, TERRAIN_ORIGIN, TERRAIN_RES,
  TERRAIN_SIZE, TILE, WORLD_H, WORLD_W,
} from '../core/config/world.config';
import { fbm, smoothstep, valueNoise } from './noise';

/**
 * Seeded island layout: heightmap, walk/build grids, beach landing line and named
 * anchors. Pure data shared by the terrain mesh, ocean shader, AI, combat,
 * build mode and the command engine ("near the beach").
 * The beach always faces east (toward the default camera); jungle hills sit at the back.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface IslandStyle {
  readonly seed: number;
  /** Radius multiplier (0.75–1.15). */
  readonly size: number;
  /** Superellipse exponent: higher = squarer island. */
  readonly roundness: number;
  /** Height of the jungle hills at the back. */
  readonly hills: number;
  /** Carve a hidden cove into the north shore. */
  readonly cove?: boolean;
}

export interface WorldLayout {
  readonly style: IslandStyle;
  readonly heights: Float32Array;
  readonly walkable: Uint8Array;
  readonly buildable: Uint8Array;
  /** Shoreline points on the east beach where landing craft can land (north → south). */
  readonly landing: readonly Point[];
  readonly village: Point;
  readonly anchors: Readonly<Record<string, Point>>;
  readonly paths: readonly (readonly Point[])[];
}

const N = TERRAIN_RES + 1;
const CELL = TERRAIN_SIZE / TERRAIN_RES;

export const HOME_STYLE: IslandStyle = { seed: 20261028, size: 1, roundness: 3.4, hills: 13 };

export function generateLayout(style: IslandStyle): WorldLayout {
  const heights = buildHeights(style);
  const R = ISLAND_RADIUS * style.size;
  const c = ISLAND_CENTER;
  const at = (fx: number, fy: number): Point => ({ x: c + R * fx, y: c + R * fy });
  const village = at(0.12, 0.12);
  const partial = { heights };
  const landing = findLanding(partial, R);
  const mid = landing[Math.floor(landing.length / 2)] ?? at(0.9, 0);
  const anchors: Record<string, Point> = {
    center: at(0, 0), middle: at(0, 0), village, beach: { x: mid.x - 6, y: mid.y }, shore: mid,
    jetty: at(0.98, 0.42), sea: at(1.5, 0.1), north: at(-0.1, -0.62), south: at(0.05, 0.66),
    east: at(0.62, 0), west: at(-0.6, 0.05), hill: at(-0.55, -0.5), jungle: at(-0.62, 0.35),
    fort: at(-0.35, -0.55), chapel: at(-0.05, 0.42), lighthouse: at(0.62, -0.72), market: at(0.32, 0.1),
    cove: at(-0.05, -0.9), forest: at(-0.62, 0.35), coast: mid,
  };
  const paths = [
    [village, anchors.beach ?? village],
    [village, anchors.chapel ?? village],
    [village, anchors.fort ?? village],
    [village, { x: (anchors.jetty?.x ?? 0) - 10, y: anchors.jetty?.y ?? 0 }],
  ];
  return { style, heights, walkable: grid(heights, (h) => h > 0.18), buildable: grid(heights, (h, s) => h > 0.9 && h < 4.5 && s < 0.35), landing, village, anchors, paths };
}

function buildHeights(style: IslandStyle): Float32Array {
  const noise = valueNoise(style.seed);
  const detail = valueNoise(style.seed + 7);
  const h = new Float32Array(N * N);
  const R = ISLAND_RADIUS * style.size;
  const p = style.roundness;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = TERRAIN_ORIGIN + i * CELL;
      const y = TERRAIN_ORIGIN + j * CELL;
      const nx = (x - ISLAND_CENTER) / R;
      const ny = (y - ISLAND_CENTER) / R;
      let d = Math.pow(Math.pow(Math.abs(nx), p) + Math.pow(Math.abs(ny), p), 1 / p);
      d += (fbm(noise, x * 0.018, y * 0.018) - 0.5) * 0.22;
      if (style.cove) d += smoothstep(0.22, 0, Math.abs(nx)) * smoothstep(-0.45, -0.95, ny) * 0.5;
      const land = smoothstep(1.0, 0.84, d);
      const east = smoothstep(0.3, 0.7, nx) * (1 - smoothstep(0.7, 1.05, Math.abs(ny)));
      const shoreBand = smoothstep(0.55, 0.95, d);
      let surface = PLATEAU_HEIGHT + (fbm(detail, x * 0.05, y * 0.05) - 0.5) * 0.5;
      surface = surface * (1 - shoreBand * east) + BEACH_HEIGHT * shoreBand * east;
      surface += shoreBand * (1 - east) * 1.6 * fbm(detail, x * 0.09, y * 0.09); // rocky shores elsewhere
      const back = Math.max(smoothstep(-0.25, -0.8, nx), smoothstep(-0.3, -0.85, ny));
      surface += style.hills * back * (0.35 + 0.65 * fbm(noise, x * 0.03 + 9, y * 0.03)) * (1 - smoothstep(0.88, 1.0, d));
      const seabed = -1.2 - smoothstep(0.95, 1.7, d) * 9;
      h[j * N + i] = seabed * (1 - land) + surface * land;
    }
  }
  return h;
}

/** Bilinear terrain height at a ground point. */
export function heightAt(l: { readonly heights: Float32Array }, x: number, y: number): number {
  const fx = Math.min(N - 1.001, Math.max(0, (x - TERRAIN_ORIGIN) / CELL));
  const fy = Math.min(N - 1.001, Math.max(0, (y - TERRAIN_ORIGIN) / CELL));
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const hs = l.heights;
  const a = hs[j * N + i] ?? 0;
  const b = hs[j * N + i + 1] ?? 0;
  const c = hs[(j + 1) * N + i] ?? 0;
  const d = hs[(j + 1) * N + i + 1] ?? 0;
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

function slopeAt(l: { readonly heights: Float32Array }, x: number, y: number): number {
  const e = TILE * 0.5;
  return Math.max(Math.abs(heightAt(l, x + e, y) - heightAt(l, x - e, y)), Math.abs(heightAt(l, x, y + e) - heightAt(l, x, y - e))) / (2 * e);
}

function grid(heights: Float32Array, ok: (h: number, slope: number) => boolean): Uint8Array {
  const g = new Uint8Array(MAP_TILES_W * MAP_TILES_H);
  const l = { heights };
  for (let ty = 0; ty < MAP_TILES_H; ty++) {
    for (let tx = 0; tx < MAP_TILES_W; tx++) {
      const x = (tx + 0.5) * TILE;
      const y = (ty + 0.5) * TILE;
      g[ty * MAP_TILES_W + tx] = ok(heightAt(l, x, y), slopeAt(l, x, y)) ? 1 : 0;
    }
  }
  return g;
}

/** Marches west from the sea along the east side to find where the beach starts. */
function findLanding(l: { readonly heights: Float32Array }, R: number): Point[] {
  const out: Point[] = [];
  for (let fy = -0.55; fy <= 0.55; fy += 0.05) {
    const y = ISLAND_CENTER + R * fy;
    for (let x = ISLAND_CENTER + R * 1.5; x > ISLAND_CENTER; x -= 1) {
      if (heightAt(l, x, y) > 0.05) {
        out.push({ x, y });
        break;
      }
    }
  }
  return out;
}

export function isWater(l: WorldLayout, x: number, y: number): boolean {
  return heightAt(l, x, y) <= 0.12;
}

export function isWalkable(l: WorldLayout, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return false;
  return l.walkable[Math.floor(y / TILE) * MAP_TILES_W + Math.floor(x / TILE)] === 1;
}

export function isBuildable(l: WorldLayout, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return false;
  return l.buildable[Math.floor(y / TILE) * MAP_TILES_W + Math.floor(x / TILE)] === 1;
}
