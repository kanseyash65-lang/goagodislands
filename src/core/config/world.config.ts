/**
 * World dimensions (3D island). Entity ground coords (x, y) live in [0, WORLD_SIZE];
 * the renderer maps them to 3D (x, height, y). 1 unit ≈ 1 metre.
 */
export const WORLD_SIZE = 256;
export const WORLD_W = WORLD_SIZE;
export const WORLD_H = WORLD_SIZE;

/** Terrain mesh extends past the island so the seabed is visible through shallow water. */
export const TERRAIN_ORIGIN = -96;
export const TERRAIN_SIZE = 448;
export const TERRAIN_RES = 192;

export const ISLAND_CENTER = 128;
export const ISLAND_RADIUS = 74;
export const WATER_LEVEL = 0;
export const PLATEAU_HEIGHT = 1.6;
export const BEACH_HEIGHT = 0.45;

/** Coarse grid used for walkability and building placement. */
export const TILE = 4;
export const MAP_TILES_W = WORLD_SIZE / TILE;
export const MAP_TILES_H = WORLD_SIZE / TILE;

/** Altitude ceiling for floating entities. */
export const Z_MAX = 30;
export const Z_SCALE = 1;

export const DEFAULT_SEED = 20261028;
export const ENTITY_CAPACITY = 8192;
