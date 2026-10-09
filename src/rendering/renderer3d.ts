import {
  ACESFilmicToneMapping, Color, DirectionalLight, FogExp2, HemisphereLight, PCFShadowMap, Scene, WebGLRenderer,
  type Mesh,
} from 'three';
import { MAX_HEALTH_BARS, MAX_LABELS, MAX_PARTICLES, PIXEL_RATIO_MAX, SHADOW_EXTENT, SHADOW_MAP_SIZE } from '../core/config/render.config';
import { ISLAND_CENTER } from '../core/config/world.config';
import type { KindRegistry } from '../entities/definitions/kinds';
import type { KindTables } from '../entities/definitions/mobility-codes';
import type { EntityManager } from '../entities/entity-manager';
import type { LabelRegistry } from '../entities/labels/label-registry';
import type { WeatherKind } from '../types/weather';
import { heightAt, type WorldLayout } from '../world/world-layout';
import type { WorldParams } from '../world/world-params';
import type { CameraRig } from './camera/camera-rig';
import { ParticleSystem } from './fx/particles3d';
import { GodAvatar } from './god/god-avatar';
import { HealthBars } from './hud3d/health-bars';
import { LabelSprites } from './hud3d/label-sprites';
import { computeLight, createLightState } from './lighting/day-cycle';
import { createWorldMaterial, createWorldUniforms, type WorldUniforms } from './materials/world-material';
import type { ModelCatalog } from './models/model-catalog';
import { SkyDome } from './sky/sky-dome';
import { EntitySync3D } from './sync/entity-sync3d';
import { buildTerrainMesh } from './terrain/terrain-mesh';
import { Ocean } from './water/ocean';

export type CaptureCallback = (frame: HTMLCanvasElement) => void;

const FLASH_DECAY = 6;
const LIGHT_DISTANCE = 320;

export interface EnvInput {
  readonly minutes: number;
  readonly sun: { r: number; g: number; b: number };
  readonly sunHidden: boolean;
  readonly sea: { r: number; g: number; b: number };
  readonly weather: WeatherKind;
  readonly intensity: number;
  readonly wind: number;
}

/**
 * Three.js scene for the 3D island: soft sun shadows, hemisphere sky light,
 * fog, sky dome, transparent ocean, terrain, instanced world models,
 * particles, health bars, labels and the floating god.
 */
export class Renderer3D {
  readonly gl: WebGLRenderer;
  readonly scene = new Scene();
  readonly particles: ParticleSystem;
  readonly sync: EntitySync3D;
  readonly god: GodAvatar;
  readonly uniforms: WorldUniforms;
  cssWidth = 1;
  cssHeight = 1;
  private readonly sun = new DirectionalLight('#ffffff', 2.6);
  private readonly hemi = new HemisphereLight('#bfe2ff', '#6a7a4a', 1.1);
  private readonly sky = new SkyDome();
  private readonly ocean: Ocean;
  private readonly light = createLightState();
  private readonly fog = new FogExp2('#cdeeff', 0.0011);
  private terrain: Mesh;
  private layout: WorldLayout;
  private flashLevel = 0;
  private captures: CaptureCallback[] = [];
  private time = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly rig: CameraRig,
    catalog: ModelCatalog,
    em: EntityManager,
    kinds: KindRegistry,
    tables: KindTables,
    layout: WorldLayout,
    params: WorldParams,
    labels: LabelRegistry,
    playerName: string,
  ) {
    this.gl = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFShadowMap;
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    host.appendChild(this.gl.domElement);
    this.layout = layout;
    this.scene.fog = this.fog;
    this.scene.background = new Color('#cdeeff');
    this.setupLights();
    this.ocean = new Ocean(layout);
    this.terrain = buildTerrainMesh(layout);
    this.scene.add(this.sky.mesh, this.ocean.mesh, this.terrain);
    this.uniforms = createWorldUniforms();
    const material = createWorldMaterial(this.uniforms);
    this.particles = new ParticleSystem(MAX_PARTICLES, this.scene);
    const bars = new HealthBars(MAX_HEALTH_BARS);
    this.scene.add(bars.mesh);
    this.sync = new EntitySync3D(this.scene, material, catalog, em, kinds, tables, layout, params, bars, new LabelSprites(this.scene, labels, MAX_LABELS));
    this.god = new GodAvatar(playerName);
    this.scene.add(this.god.root, this.god.beamMesh);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
  }

  /** Swaps the island (scene switch): new terrain mesh, ocean depth map and sync heights. */
  setLayout(layout: WorldLayout): void {
    this.layout = layout;
    this.scene.remove(this.terrain);
    this.terrain.geometry.dispose();
    this.terrain = buildTerrainMesh(layout);
    this.scene.add(this.terrain);
    this.ocean.setLayout(layout);
    this.sync.setLayout(layout);
  }

  groundAt(x: number, y: number): number {
    return Math.max(0, heightAt(this.layout, x, y));
  }

  flash(amount: number): void {
    this.flashLevel = Math.max(this.flashLevel, amount);
  }

  requestCapture(cb: CaptureCallback): void {
    this.captures.push(cb);
  }

  updateEnvironment(e: EnvInput, dt: number): void {
    const L = this.light;
    computeLight(L, e.minutes, e.sun, e.sunHidden, e.weather, e.intensity);
    this.flashLevel *= Math.exp(-FLASH_DECAY * dt);
    const f = this.flashLevel;
    this.sun.color.copy(L.sunColor);
    this.sun.intensity = L.sunIntensity + f * 3;
    this.sun.position.set(ISLAND_CENTER + L.sunDir.x * LIGHT_DISTANCE, L.sunDir.y * LIGHT_DISTANCE, ISLAND_CENTER + L.sunDir.z * LIGHT_DISTANCE);
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiIntensity + f * 2;
    const su = this.sky.uniforms;
    su.uTop.value.copy(L.skyTop);
    su.uHorizon.value.copy(L.horizon);
    su.uSunDir.value.copy(L.sunDir);
    su.uSunColor.value.copy(L.sunColor);
    su.uNight.value = L.night;
    this.fog.color.copy(L.horizon);
    this.fog.density = L.fogDensity;
    (this.scene.background as Color).copy(L.horizon);
    const ou = this.ocean.uniforms;
    ou.uSunDir.value.copy(L.sunDir);
    ou.uSunColor.value.copy(L.sunColor).multiplyScalar(L.sunIntensity / 2.6);
    ou.uFogColor.value.copy(L.horizon);
    ou.uFogDensity.value = L.fogDensity;
    ou.uLight.value = L.light + f;
    ou.uTint.value.setRGB(e.sea.r * e.sea.r, e.sea.g * e.sea.g, e.sea.b * e.sea.b);
    this.uniforms.uWind.value = 0.18 + e.wind * 0.06;
  }

  render(now: number, dt: number): number {
    this.time += dt;
    this.uniforms.uTime.value = now;
    this.ocean.uniforms.uTime.value = now;
    this.sky.mesh.position.set(this.rig.camera.position.x, 0, this.rig.camera.position.z);
    this.god.update(dt, this.rig.camera.position.x, this.rig.camera.position.z, (x, y) => this.groundAt(x, y));
    this.gl.info.reset();
    this.gl.render(this.scene, this.rig.camera);
    if (this.captures.length > 0) this.flushCaptures();
    return this.gl.info.render.calls;
  }

  private setupLights(): void {
    const s = this.sun;
    s.castShadow = true;
    s.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    const cam = s.shadow.camera;
    cam.left = -SHADOW_EXTENT;
    cam.right = SHADOW_EXTENT;
    cam.top = SHADOW_EXTENT;
    cam.bottom = -SHADOW_EXTENT;
    cam.near = 10;
    cam.far = 800;
    s.shadow.bias = -0.0006;
    s.shadow.normalBias = 0.04;
    s.target.position.set(ISLAND_CENTER, 0, ISLAND_CENTER);
    this.scene.add(s, s.target, this.hemi);
  }

  private flushCaptures(): void {
    const src = this.gl.domElement;
    const copy = document.createElement('canvas');
    copy.width = src.width;
    copy.height = src.height;
    copy.getContext('2d')?.drawImage(src, 0, 0); // same task as the render, so the buffer is intact
    const cbs = this.captures;
    this.captures = [];
    for (const cb of cbs) cb(copy);
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.cssWidth = w;
    this.cssHeight = h;
    this.gl.setSize(w, h);
    this.rig.setAspect(w / h);
  }
}
