import { CLOUD_ALTITUDE } from '../core/config/sim.config';
import { ISLAND_CENTER, ISLAND_RADIUS, WORLD_H, WORLD_W } from '../core/config/world.config';
import type { IRng } from '../core/rng/mulberry32';
import { footprintOf } from '../gameplay/economy/building-catalog';
import { overlapsBuilding, spawnStructure, type SpawnDeps } from '../gameplay/spawn/structures';
import type { BaseBuilding } from '../gameplay/base/home-base';
import type { IslandContent, Placement } from './island-specs';
import { heightAt, isWater, type Point, type WorldLayout } from './world-layout';

const VILLAGER_ROLES: readonly string[] = ['fisherman', 'fisherman', 'farmer', 'farmer', 'vendor', 'vendor', 'tourist', 'tourist', 'child', 'child', 'elder', 'fisherman', 'vendor', 'tourist'];
const ANIMALS: readonly string[] = ['cow', 'cow', 'cow', 'dog', 'dog', 'cat', 'crow', 'crow', 'crow'];
const PALMS = 150;
const BANANAS = 30;
const BUSHES = 45;
const HIBISCUS = 24;
const ROCKS = 26;
const CLIFFS = 14;
const CLOUDS = 9;

/** World position of a placement (fractions of radius from centre). */
export function placementPoint(pl: Pick<Placement, 'fx' | 'fy'>, size = 1): Point {
  return { x: ISLAND_CENTER + pl.fx * ISLAND_RADIUS * size, y: ISLAND_CENTER + pl.fy * ISLAND_RADIUS * size };
}

/**
 * Structures, then the Goan village life, jungle, rocks, sky and environment entities.
 * With a player base, its saved buildings replace the content's team-1 placements.
 * Returns entity id → base building uid for the player's buildings.
 */
export function populateIsland(content: IslandContent, layout: WorldLayout, d: SpawnDeps, base?: readonly BaseBuilding[]): Map<number, number> {
  const owned = new Map<number, number>();
  for (const pl of content.structures) {
    if (base && (pl.team ?? 0) === 1) continue;
    const pt = placementPoint(pl, content.style.size);
    spawnStructure(d, pl.kind, pt.x, pt.y, { team: pl.team ?? 0, level: pl.level ?? 1, rot: pl.rot ?? 0 });
  }
  for (const b of base ?? []) {
    const id = spawnStructure(d, b.kind, b.x, b.y, { team: 1, level: b.level, rot: b.rot });
    if (id >= 0) owned.set(id, b.uid);
  }
  populateNature(layout, d, content.jungle);
  populateLife(layout, d, content.villagers, content.animals);
  populateSky(d);
  return owned;
}

export function populateSky(d: SpawnDeps): void {
  const spawn = (kind: string, x: number, y: number, z = 0): number => d.factory.spawn(d.kinds.id(kind), x, y, { z });
  // Clouds drift over the sea around the island, high enough not to hide the village.
  for (let i = 0; i < CLOUDS; i++) {
    const a = (i / CLOUDS) * Math.PI * 2 + d.rng.range(-0.3, 0.3);
    const r = ISLAND_RADIUS * d.rng.range(1.5, 2.4);
    const id = spawn('cloud', ISLAND_CENTER + Math.cos(a) * r, ISLAND_CENTER + Math.sin(a) * r, CLOUD_ALTITUDE + d.rng.range(0, 14));
    if (id >= 0) d.em.scale[id] = d.rng.range(1.2, 2);
  }
  spawn('sun', ISLAND_CENTER, ISLAND_CENTER);
  spawn('moon', ISLAND_CENTER, ISLAND_CENTER);
  spawn('sea', ISLAND_CENTER, ISLAND_CENTER);
}

function populateLife(layout: WorldLayout, d: SpawnDeps, villagers: number, animals: number): void {
  for (let i = 0; i < villagers; i++) {
    const role = VILLAGER_ROLES[i % VILLAGER_ROLES.length] ?? 'fisherman';
    const home = role === 'tourist' || role === 'fisherman' ? layout.anchors.beach ?? layout.village : layout.village;
    const p = landPoint(layout, d.rng, home.x, home.y, 26);
    const id = d.factory.spawn(d.kinds.id(role), p.x, p.y);
    if (id >= 0) {
      d.em.homeX[id] = home.x;
      d.em.homeY[id] = home.y;
    }
  }
  for (let i = 0; i < animals; i++) {
    const kind = ANIMALS[i % ANIMALS.length] ?? 'cow';
    const home = kind === 'cow' ? layout.anchors.beach ?? layout.village : layout.village;
    const p = landPoint(layout, d.rng, home.x, home.y, 22);
    const id = d.factory.spawn(d.kinds.id(kind), p.x, p.y);
    if (id >= 0) {
      d.em.homeX[id] = home.x;
      d.em.homeY[id] = home.y;
    }
  }
}

/**
 * Jungle: dense coconut palms along the back and edges, palms lining the
 * beach, banana plants and hibiscus near houses, rocks and cliffs on the shore.
 */
export function populateNature(layout: WorldLayout, d: SpawnDeps, density: number): void {
  const R = ISLAND_RADIUS * layout.style.size;
  const tryPlace = (kind: string, n: number, weight: (fx: number, fy: number, h: number) => number): void => {
    for (let placed = 0, tries = 0; placed < n && tries < n * 12; tries++) {
      const x = ISLAND_CENTER + d.rng.range(-1.1, 1.1) * R;
      const y = ISLAND_CENTER + d.rng.range(-1.1, 1.1) * R;
      const h = heightAt(layout, x, y);
      if (h < 0.3) continue;
      if (d.rng.next() > weight((x - ISLAND_CENTER) / R, (y - ISLAND_CENTER) / R, h)) continue;
      if (overlapsBuilding(d, x, y, footprintOf(kind) + 0.6)) continue;
      const id = d.factory.spawn(d.kinds.id(kind), x, y);
      if (id >= 0) d.em.rot[id] = d.rng.range(0, Math.PI * 2);
      placed++;
    }
  };
  const edge = (fx: number, fy: number): number => Math.max(Math.abs(fx), Math.abs(fy));
  const back = (fx: number, fy: number): number => Math.max(0, -fx, -fy);
  tryPlace('cliff', CLIFFS, (fx, fy) => (edge(fx, fy) > 0.82 && fx < 0.45 ? 1 : 0));
  tryPlace('palm', Math.round(PALMS * density), (fx, fy) => {
    const e = edge(fx, fy);
    const beachLine = fx > 0.55 && fx < 0.8 ? 0.7 : 0;
    return Math.min(1, Math.max(beachLine, (e - 0.55) * 2.4 + back(fx, fy) * 1.2));
  });
  tryPlace('banana', Math.round(BANANAS * density), (fx, fy) => (edge(fx, fy) > 0.45 ? 0.8 : 0.15));
  tryPlace('bush', Math.round(BUSHES * density), (fx, fy) => (edge(fx, fy) > 0.5 ? 0.9 : 0.25));
  tryPlace('hibiscus', HIBISCUS, (fx, fy) => (edge(fx, fy) < 0.7 ? 0.7 : 0.1));
  tryPlace('rock', ROCKS, (fx, fy) => (edge(fx, fy) > 0.7 ? 0.9 : 0.1));
}

/** Random walkable point near (cx, cy). */
export function landPoint(layout: WorldLayout, rng: IRng, cx: number, cy: number, radius: number): Point {
  for (let t = 0; t < 14; t++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * radius;
    const x = Math.min(WORLD_W - 2, Math.max(2, cx + Math.cos(a) * r));
    const y = Math.min(WORLD_H - 2, Math.max(2, cy + Math.sin(a) * r));
    if (!isWater(layout, x, y)) return { x, y };
  }
  return { x: cx, y: cy };
}
