import {
  AdditiveBlending, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Sprite, SpriteMaterial, type Object3D,
} from 'three';
import { GOD_ALTITUDE } from '../../core/config/render.config';
import { ISLAND_CENTER, ISLAND_RADIUS } from '../../core/config/world.config';
import { ModelBuilder } from '../models/model-builder';

const CAST_SECONDS = 1.3;
const BEAM_SECONDS = 0.9;
const BOB = 1.2;
/** How quickly the god glides to a new hover spot (per second). */
const GLIDE = 1.5;
/** Intro: the god starts this high above its hover height and floats down. */
const DESCENT_HEIGHT = 70;
const DESCENT_RATE = 0.9;
const ARM_REST = 0.15;
const ARM_RAISED = -2.4;

/** Robed figure (body) and its two arms, built from the shared model builder. */
function godBody(): ModelBuilder {
  return new ModelBuilder()
    .ico(4.2, '#ffffff', { y: -1.2, sy: 0.45 }, 1)
    .ico(3, '#f4f6fa', { x: 3, y: -1.4, z: 0.6, sy: 0.4 }, 1)
    .ico(2.8, '#f4f6fa', { x: -3, y: -1.3, z: -0.4, sy: 0.4 }, 1)
    .cone(2.1, 4.2, 12, '#f29a2e', { y: 1.4 }) // saffron robe
    .cyl(1.0, 1.4, 1.3, 12, '#fff6e6', { y: 3.6 })
    .torus(1.15, 0.12, '#f2c230', { y: 3.05, rx: Math.PI / 2 })
    .sphere(0.85, '#e8b48a', { y: 4.85 }, 12, 8)
    .sphere(0.12, '#20181a', { x: 0.3, y: 5.0, z: 0.75 }, 6, 4)
    .sphere(0.12, '#20181a', { x: -0.3, y: 5.0, z: 0.75 }, 6, 4)
    .box(0.5, 0.1, 0.05, '#c86a5a', { y: 4.55, z: 0.82 })
    .cone(0.85, 0.9, 8, '#f2c230', { y: 5.95 }) // crown
    .cyl(0.9, 0.9, 0.18, 10, '#f2c230', { y: 5.55 })
    .sphere(0.16, '#e8344a', { y: 5.6, z: 0.88 }, 6, 4);
}

function godArm(): ModelBuilder {
  return new ModelBuilder().cyl(0.26, 0.3, 1.9, 8, '#fff6e6', { y: -0.95 }).sphere(0.28, '#e8b48a', { y: -1.95 }, 8, 6);
}

/** Canvas texture with the god's name, floating above the halo. */
function nameSprite(text: string): Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  if (g) {
    g.font = '900 52px ui-rounded, "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#3a2a10';
    g.strokeText(text, 256, 50);
    g.fillStyle = '#ffd84a';
    g.fillText(text, 256, 50);
  }
  const s = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), depthWrite: false, transparent: true }));
  s.scale.set(16, 3, 1);
  return s;
}

/**
 * The player, as the god of Goa: floats above the island on a cloud, bobs,
 * and on every command raises both arms and fires a golden beam at the spot
 * reality changed. Purely presentational (reads events, never mutates sim).
 */
export class GodAvatar {
  readonly root = new Group();
  private readonly figure = new Group();
  private readonly leftArm: Mesh;
  private readonly rightArm: Mesh;
  private readonly halo: Mesh;
  private readonly beam: Mesh;
  private label: Sprite;
  private time = 0;
  private castT = 0;
  private beamT = 0;
  private beamX = 0;
  private beamY = 0;
  private readonly homeX = ISLAND_CENTER - ISLAND_RADIUS * 0.15;
  private readonly homeY = ISLAND_CENTER - ISLAND_RADIUS * 0.15;
  private descent = 0;
  private targetX = this.homeX;
  private targetY = this.homeY;

  constructor(name: string) {
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: new Color('#ffb84a'), emissiveIntensity: 0.12 });
    const body = new Mesh(godBody().build(), mat);
    this.leftArm = new Mesh(godArm().build(), mat);
    this.rightArm = new Mesh(godArm().build(), mat);
    this.leftArm.position.set(1.25, 4.1, 0);
    this.rightArm.position.set(-1.25, 4.1, 0);
    this.halo = new Mesh(new CylinderGeometry(1.9, 1.9, 0.08, 32, 1, true), new MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.85, blending: AdditiveBlending, side: 2 }));
    this.halo.position.set(0, 5.3, -0.9);
    this.halo.rotation.x = Math.PI / 2 - 0.25;
    for (const m of [body, this.leftArm, this.rightArm] as Object3D[]) m.castShadow = true;
    this.figure.add(body, this.leftArm, this.rightArm, this.halo);
    this.figure.scale.setScalar(2.2);
    this.label = nameSprite(name);
    this.label.position.set(0, 13, 0);
    this.beam = new Mesh(new CylinderGeometry(0.6, 1.4, 1, 12, 1, true), new MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    this.label.visible = false; // the crisp HTML name tag (ui/god-label) replaces the sprite
    this.root.add(this.figure, this.label);
    this.root.position.set(this.homeX, GOD_ALTITUDE, this.homeY);
  }

  /** Beam is added to the scene separately (it spans world space). */
  get beamMesh(): Mesh {
    return this.beam;
  }

  setName(name: string): void {
    this.root.remove(this.label);
    this.label = nameSprite(name);
    this.label.position.set(0, 13, 0);
    this.label.visible = false;
    this.root.add(this.label);
  }

  /** Intro: drop in from high in the sky. */
  descend(): void {
    this.descent = DESCENT_HEIGHT;
  }

  /** Glide to hover over (x, y); no argument returns to the home spot. */
  hoverOver(x = this.homeX, y = this.homeY): void {
    this.targetX = x;
    this.targetY = y;
  }

  /** World position just above the crown (for the HTML name tag). */
  headPosition(out: { x: number; y: number; z: number }): void {
    out.x = this.root.position.x;
    out.y = this.root.position.y + 15;
    out.z = this.root.position.z;
  }

  /** Strike a pose and send a beam to (x, y) at ground height h. */
  cast(x: number, y: number): void {
    this.castT = CAST_SECONDS;
    this.beamT = BEAM_SECONDS;
    this.beamX = x;
    this.beamY = y;
  }

  update(dt: number, cameraX: number, cameraZ: number, groundAt: (x: number, y: number) => number): void {
    this.time += dt;
    this.castT = Math.max(0, this.castT - dt);
    this.beamT = Math.max(0, this.beamT - dt);
    const r = this.root;
    this.descent *= Math.exp(-DESCENT_RATE * dt);
    r.position.y = GOD_ALTITUDE + this.descent + Math.sin(this.time * 1.1) * BOB;
    const glide = Math.min(1, GLIDE * dt);
    r.position.x += (this.targetX - r.position.x) * glide;
    r.position.z += (this.targetY - r.position.z) * glide;
    // Face the camera so the player always sees their own face.
    this.figure.rotation.y = Math.atan2(cameraX - r.position.x, cameraZ - r.position.z);
    const casting = this.castT > 0;
    const k = casting ? Math.min(1, (CAST_SECONDS - this.castT) * 8) : 0;
    const arm = ARM_REST + (ARM_RAISED - ARM_REST) * k;
    this.leftArm.rotation.set(arm * 0.35, 0, arm * -0.9);
    this.rightArm.rotation.set(arm * 0.35, 0, arm * 0.9);
    this.halo.scale.setScalar(1 + (casting ? 0.25 * Math.sin(this.time * 20) : 0.05 * Math.sin(this.time * 2)));
    const bm = this.beam.material as MeshBasicMaterial;
    bm.opacity = this.beamT > 0 ? (this.beamT / BEAM_SECONDS) * 0.75 : 0;
    this.beam.visible = this.beamT > 0;
    if (this.beam.visible) {
      const sx = r.position.x;
      const sy = r.position.y + 8;
      const sz = r.position.z;
      const ex = this.beamX;
      const ey = groundAt(this.beamX, this.beamY);
      const ez = this.beamY;
      const len = Math.hypot(ex - sx, ey - sy, ez - sz);
      this.beam.position.set((sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2);
      this.beam.scale.set(1 + (1 - this.beamT / BEAM_SECONDS), len, 1 + (1 - this.beamT / BEAM_SECONDS));
      this.beam.lookAt(ex, ey, ez);
      this.beam.rotateX(Math.PI / 2);
    }
  }

  /** World position of the god's hands (rune bursts start here). */
  handsPosition(out: { x: number; y: number; z: number }): void {
    out.x = this.root.position.x;
    out.y = this.root.position.y + 8;
    out.z = this.root.position.z;
  }
}
