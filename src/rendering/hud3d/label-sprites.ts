import { CanvasTexture, Sprite, SpriteMaterial, type Scene } from 'three';
import type { LabelRegistry } from '../../entities/labels/label-registry';

const FONT = '800 40px ui-rounded, "Segoe UI", system-ui, sans-serif';

/**
 * Floating name tags for Improv "Things" ("pineapple"). One texture per label
 * slot (repainted only when its text changes) and a pool of sprites placed each frame.
 */
export class LabelSprites {
  private readonly textures: (CanvasTexture | null)[];
  private readonly texts: string[];
  private readonly pool: Sprite[] = [];
  private used = 0;

  constructor(private readonly scene: Scene, private readonly labels: LabelRegistry, private readonly max: number) {
    this.textures = new Array<CanvasTexture | null>(labels.texts.length).fill(null);
    this.texts = new Array<string>(labels.texts.length).fill('');
  }

  begin(): void {
    this.used = 0;
  }

  push(slot: number, x: number, y: number, z: number): void {
    if (this.used >= this.max) return;
    const tex = this.textureFor(slot);
    if (!tex) return;
    let s = this.pool[this.used];
    if (!s) {
      s = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false }));
      s.renderOrder = 9;
      this.pool.push(s);
      this.scene.add(s);
    }
    const mat = s.material;
    if (mat.map !== tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
    s.position.set(x, y, z);
    s.scale.set(5, 1.25, 1);
    s.visible = true;
    this.used++;
  }

  commit(): void {
    for (let i = this.used; i < this.pool.length; i++) {
      const s = this.pool[i];
      if (s) s.visible = false;
    }
  }

  private textureFor(slot: number): CanvasTexture | null {
    const text = this.labels.texts[slot] ?? '';
    if (!text) return null;
    if (this.texts[slot] === text && this.textures[slot]) return this.textures[slot] ?? null;
    this.textures[slot]?.dispose();
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      g.font = FONT;
      const w = Math.min(240, g.measureText(text).width + 30);
      g.fillStyle = 'rgba(40, 28, 48, 0.88)';
      g.beginPath();
      g.roundRect((256 - w) / 2, 8, w, 48, 22);
      g.fill();
      g.fillStyle = '#fff6e0';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 128, 34, 220);
    }
    const tex = new CanvasTexture(c);
    this.textures[slot] = tex;
    this.texts[slot] = text;
    return tex;
  }
}
