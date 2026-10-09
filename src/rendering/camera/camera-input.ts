import { ARROW_PAN_SPEED, ORBIT_SPEED, ZOOM_STEP } from '../../core/config/render.config';
import type { CameraRig } from './camera-rig';

const WHEEL_NORMALIZE = 100;
const DRAG_THRESHOLD_PX = 5;

/** Fired on a click (not a drag) with the CSS pixel position. */
export type ClickHandler = (px: number, py: number) => void;
/** Fired while the pointer moves without dragging (build-mode ghost). */
export type HoverHandler = (px: number, py: number) => void;

/**
 * Left-drag pans, right-drag orbits, wheel zooms, click selects/places.
 * Arrow keys pan only while `arrowsAllowed()` (the command bar is empty),
 * because the command bar keeps keyboard focus for Wispr Flow.
 */
export class CameraInput {
  onClick: ClickHandler | null = null;
  onHover: HoverHandler | null = null;
  private button = -1;
  private lastX = 0;
  private lastY = 0;
  private moved = 0;
  private readonly keys = new Set<string>();

  constructor(
    private readonly el: HTMLElement,
    private readonly rig: CameraRig,
    private readonly arrowsAllowed: () => boolean,
    private readonly onPointerUp: () => void,
  ) {
    el.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    window.addEventListener('blur', () => this.keys.clear());
  }

  update(dt: number): void {
    if (this.keys.size === 0) return;
    if (!this.arrowsAllowed()) {
      this.keys.clear();
      return;
    }
    const d = this.rig.distance * ARROW_PAN_SPEED * dt * 60;
    const dx = (this.keys.has('ArrowRight') ? d : 0) - (this.keys.has('ArrowLeft') ? d : 0);
    const dy = (this.keys.has('ArrowDown') ? d : 0) - (this.keys.has('ArrowUp') ? d : 0);
    if (dx !== 0 || dy !== 0) this.rig.panScreen(-dx * 0.05, -dy * 0.05, this.el.clientHeight, true);
  }

  private readonly down = (e: PointerEvent): void => {
    this.button = e.button;
    this.moved = 0;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private readonly move = (e: PointerEvent): void => {
    const rect = this.el.getBoundingClientRect();
    if (this.button < 0) {
      this.onHover?.(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.moved += Math.abs(dx) + Math.abs(dy);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (this.moved <= DRAG_THRESHOLD_PX) return;
    if (this.button === 2) this.rig.orbit(-dx * ORBIT_SPEED, dy * ORBIT_SPEED);
    else this.rig.panScreen(dx, dy, this.el.clientHeight, true);
  };

  private readonly up = (e: PointerEvent): void => {
    if (this.button < 0) return;
    const wasClick = this.moved <= DRAG_THRESHOLD_PX && this.button === 0;
    this.button = -1;
    if (wasClick) {
      const rect = this.el.getBoundingClientRect();
      this.onClick?.(e.clientX - rect.left, e.clientY - rect.top);
    }
    this.onPointerUp();
  };

  private readonly wheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.rig.zoomBy(Math.pow(ZOOM_STEP, e.deltaY / WHEEL_NORMALIZE));
  };

  private readonly keyDown = (e: KeyboardEvent): void => {
    if (e.key.startsWith('Arrow') && this.arrowsAllowed()) {
      this.keys.add(e.key);
      e.preventDefault();
    }
  };
}
