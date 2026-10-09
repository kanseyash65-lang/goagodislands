import { ISLAND_CENTER, ISLAND_RADIUS } from '../../core/config/world.config';
import type { BaseBuilding } from '../../gameplay/base/home-base';
import { generateLayout, heightAt, type WorldLayout } from '../../world/world-layout';
import { HOME_ISLAND } from '../../world/island-specs';

const PX = 168;
const SHALLOW = 0.12;
const SAND = 0.7;
const HILL = 4;
const BUILDING_DOT = 3;
const HQ_DOT = 5;
/** Half-width of the framed area: the island plus a ring of sea. */
const VIEW = ISLAND_RADIUS * 1.25;
const toPx = (w: number): number => ((w - (ISLAND_CENTER - VIEW)) / (2 * VIEW)) * PX;
const toWorld = (p: number): number => ISLAND_CENTER - VIEW + (p / PX) * 2 * VIEW;

/** Top-down terrain colour by height: sea, shallows, beach, grass, jungle hills. */
function colourAt(h: number): [number, number, number] {
  if (h <= -1.5) return [20, 104, 170];
  if (h <= SHALLOW) return [56, 170, 205];
  if (h <= SAND) return [242, 220, 160];
  if (h <= HILL) return [95, 174, 62];
  return [58, 128, 48];
}

/**
 * A small top-down map of your home island: terrain from the same height
 * field the 3D world uses, plus a dot for every building you own.
 * The terrain is rendered once and cached; dots are redrawn each time.
 */
export class IslandMinimap {
  readonly canvas = document.createElement('canvas');
  private terrain: HTMLCanvasElement | null = null;
  private layout: WorldLayout | null = null;

  constructor() {
    this.canvas.width = PX;
    this.canvas.height = PX;
    this.canvas.className = 'minimap-canvas';
  }

  draw(buildings: readonly BaseBuilding[]): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    g.drawImage(this.terrainImage(), 0, 0);
    for (const b of buildings) {
      const hq = b.kind === 'hq';
      const r = hq ? HQ_DOT : BUILDING_DOT;
      g.fillStyle = hq ? '#ffd23f' : '#ffffff';
      g.strokeStyle = '#13304f';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(toPx(b.x), toPx(b.y), r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  private terrainImage(): HTMLCanvasElement {
    if (this.terrain) return this.terrain;
    const c = document.createElement('canvas');
    c.width = PX;
    c.height = PX;
    const g = c.getContext('2d');
    this.layout ??= generateLayout(HOME_ISLAND.style);
    if (g) {
      const img = g.createImageData(PX, PX);
      for (let y = 0; y < PX; y++) {
        for (let x = 0; x < PX; x++) {
          const [r, gr, b] = colourAt(heightAt(this.layout, toWorld(x), toWorld(y)));
          const i = (y * PX + x) * 4;
          img.data[i] = r;
          img.data[i + 1] = gr;
          img.data[i + 2] = b;
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    }
    this.terrain = c;
    return c;
  }
}
