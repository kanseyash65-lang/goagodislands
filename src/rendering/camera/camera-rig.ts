import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import {
  BOUNDS_PAD, CAMERA_DIST_MAX, CAMERA_DIST_MIN, CAMERA_DIST_START, CAMERA_EASE, CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR,
  CAMERA_PITCH, CAMERA_PITCH_MAX, CAMERA_PITCH_MIN, CAMERA_YAW, PUNCH_DECAY, PUNCH_PER_MAGNITUDE, SHAKE_DECAY,
  SHAKE_PER_MAGNITUDE, USER_PAUSE_SECONDS, ZOOM_STEP,
} from '../../core/config/render.config';
import { WORLD_H, WORLD_W } from '../../core/config/world.config';
import type { IViewInfo } from '../../core/services/view-info';

const SHAKE_FREQ = 37;
const FOCUS_DIST = 110;
const GROUND_Y = 1.5;
const tmp = new Vector3();
const ndc = new Vector2();
const ray = new Raycaster();
const ground = new Plane(new Vector3(0, 1, 0), -GROUND_Y);

/**
 * Elevated strategy camera (Boom Beach-style diamond view): target on the ground,
 * distance, yaw and pitch, all eased. Impact Cam shake + dolly punch. Never
 * fights the user: after a manual drag, auto-framing pauses.
 */
export class CameraRig implements IViewInfo {
  readonly camera: PerspectiveCamera;
  centerX: number;
  centerY: number;
  viewWidth = 200;
  viewHeight = 200;
  distance = CAMERA_DIST_START;
  yaw = CAMERA_YAW;
  pitch = CAMERA_PITCH;
  reducedMotion = false;
  private targetX: number;
  private targetY: number;
  private targetDist = CAMERA_DIST_START;
  private targetYaw = CAMERA_YAW;
  private targetPitch = CAMERA_PITCH;
  private shake = 0;
  private punch = 0;
  private time = 0;
  private userPausedUntil = 0;
  /** Cinematic moves use a slower ease for a while. */
  private ease = CAMERA_EASE;
  private easeUntil = 0;

  constructor(startX: number, startY: number) {
    this.camera = new PerspectiveCamera(CAMERA_FOV, 16 / 9, CAMERA_NEAR, CAMERA_FAR);
    this.centerX = this.targetX = startX;
    this.centerY = this.targetY = startY;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = Math.max(0.2, aspect);
    this.camera.updateProjectionMatrix();
  }

  /** World units per CSS pixel at the target (for drag panning). */
  unitsPerPixel(cssHeight: number): number {
    const h = 2 * this.distance * Math.tan((this.camera.fov * Math.PI) / 360);
    return h / Math.max(1, cssHeight);
  }

  panScreen(dxPx: number, dyPx: number, cssHeight: number, byUser: boolean): void {
    const upp = this.unitsPerPixel(cssHeight) * 1.2;
    // Ground "right" is (cos, -sin) and "away" is (-sin, -cos) for the current yaw;
    // the world follows the cursor, so the target moves the opposite way.
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const sp = Math.sin(this.pitch);
    const wx = (-dxPx * c - (dyPx * s) / sp) * upp;
    const wy = (dxPx * s - (dyPx * c) / sp) * upp;
    this.panBy(wx, wy, byUser);
  }

  panBy(dx: number, dy: number, byUser: boolean): void {
    this.targetX += dx;
    this.targetY += dy;
    if (byUser) this.userPausedUntil = this.time + USER_PAUSE_SECONDS;
  }

  orbit(dYaw: number, dPitch: number): void {
    this.targetYaw += dYaw;
    this.targetPitch = Math.min(CAMERA_PITCH_MAX, Math.max(CAMERA_PITCH_MIN, this.targetPitch + dPitch));
    this.userPausedUntil = this.time + USER_PAUSE_SECONDS;
  }

  zoomBy(factor: number): void {
    this.targetDist = Math.min(CAMERA_DIST_MAX, Math.max(CAMERA_DIST_MIN, this.targetDist * factor));
  }

  zoomIn(): void { this.zoomBy(1 / (ZOOM_STEP * ZOOM_STEP * ZOOM_STEP)); }
  zoomOut(): void { this.zoomBy(ZOOM_STEP * ZOOM_STEP * ZOOM_STEP); }

  overview(): void {
    this.targetX = WORLD_W / 2;
    this.targetY = WORLD_H / 2;
    this.targetDist = CAMERA_DIST_MAX * 0.8;
    this.targetYaw = CAMERA_YAW;
    this.targetPitch = CAMERA_PITCH;
  }

  focus(x: number, y: number, dist = FOCUS_DIST): void {
    this.targetX = x;
    this.targetY = y;
    this.targetDist = Math.min(CAMERA_DIST_MAX, Math.max(CAMERA_DIST_MIN, dist));
  }

  /** Cinematic: jump to a full view (position, distance, angle) without easing. */
  snapView(x: number, y: number, dist: number, yaw: number, pitch: number): void {
    this.snap(x, y, dist);
    this.yaw = this.targetYaw = yaw;
    this.pitch = this.targetPitch = pitch;
  }

  /** Cinematic: glide to a full view with a custom (usually slower) ease for `seconds`. */
  glideTo(x: number, y: number, dist: number, yaw: number, pitch: number, ease: number, seconds: number): void {
    this.targetX = x;
    this.targetY = y;
    this.targetDist = dist;
    this.targetYaw = yaw;
    this.targetPitch = pitch;
    this.ease = ease;
    this.easeUntil = this.time + seconds;
  }

  /** Jump without easing (scene switches). */
  snap(x: number, y: number, dist: number): void {
    this.centerX = this.targetX = x;
    this.centerY = this.targetY = y;
    this.distance = this.targetDist = dist;
  }

  impact(x: number, y: number, magnitude: number, frame: boolean): void {
    if (!this.reducedMotion) {
      this.shake = Math.max(this.shake, magnitude * SHAKE_PER_MAGNITUDE);
      this.punch = Math.max(this.punch, magnitude * PUNCH_PER_MAGNITUDE);
    }
    const userBusy = this.time < this.userPausedUntil;
    const offscreen = Math.hypot(x - this.centerX, y - this.centerY) > this.viewHeight * 0.4;
    if (frame && offscreen && !userBusy) {
      this.targetX = x;
      this.targetY = y;
    }
  }

  update(dt: number): void {
    this.time += dt;
    const k = 1 - Math.exp(-(this.time < this.easeUntil ? this.ease : CAMERA_EASE) * dt);
    this.targetX = Math.min(WORLD_W + BOUNDS_PAD, Math.max(-BOUNDS_PAD, this.targetX));
    this.targetY = Math.min(WORLD_H + BOUNDS_PAD, Math.max(-BOUNDS_PAD, this.targetY));
    this.centerX += (this.targetX - this.centerX) * k;
    this.centerY += (this.targetY - this.centerY) * k;
    this.distance += (this.targetDist - this.distance) * k;
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
    this.shake *= Math.exp(-SHAKE_DECAY * dt);
    this.punch *= Math.exp(-PUNCH_DECAY * dt);
    const d = this.distance * (1 - this.punch);
    const s = this.shake;
    const sx = Math.sin(this.time * SHAKE_FREQ) * s;
    const sz = Math.cos(this.time * SHAKE_FREQ * 1.3) * s;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(this.centerX + Math.sin(this.yaw) * cp * d + sx, Math.sin(this.pitch) * d, this.centerY + Math.cos(this.yaw) * cp * d + sz);
    this.camera.lookAt(this.centerX + sx, 0, this.centerY + sz);
    this.viewHeight = 2 * d * Math.tan((this.camera.fov * Math.PI) / 360) / Math.sin(this.pitch);
    this.viewWidth = this.viewHeight * this.camera.aspect;
  }

  /** Projects a 3D point to CSS pixels. Returns false when behind the camera. */
  project(x: number, y: number, z: number, cssW: number, cssH: number, out: { x: number; y: number }): boolean {
    tmp.set(x, y, z).project(this.camera);
    out.x = (tmp.x * 0.5 + 0.5) * cssW;
    out.y = (-tmp.y * 0.5 + 0.5) * cssH;
    return tmp.z < 1;
  }

  /** CSS pixel → ground point (world x, y) on the island plateau plane. */
  screenToGround(px: number, py: number, cssW: number, cssH: number, out: { x: number; y: number }): boolean {
    ndc.set((px / cssW) * 2 - 1, -(py / cssH) * 2 + 1);
    ray.setFromCamera(ndc, this.camera);
    if (!ray.ray.intersectPlane(ground, tmp)) return false;
    out.x = tmp.x;
    out.y = tmp.z;
    return true;
  }
}
