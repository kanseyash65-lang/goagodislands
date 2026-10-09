import {
  BUBBLE_FADE_MS, BUBBLE_LIFETIME_MS, BUBBLE_MAX_ZOOMED_IN, BUBBLE_MAX_ZOOMED_OUT, BUBBLE_POOL_SIZE,
  BUBBLE_ZOOMED_OUT_VIEW_H,
} from '../../core/config/ui.config';
import type { IEventBus } from '../../core/events/event-bus';
import { SHOUT_PRIORITY } from '../../gameplay/battle/shouts';
import type { EntityManager } from '../../entities/entity-manager';
import type { CameraRig } from '../../rendering/camera/camera-rig';
import { el, type IPanel } from '../dom';
import { resolveOverlaps, selectBubbles, type BubbleCandidate, type ScreenRect } from './bubble-selection';

const HEAD_HEIGHT = 2.6;
const RESELECT_MS = 250;

interface Line {
  readonly id: number;
  readonly text: string;
  readonly priority: number;
  readonly bornAt: number;
  readonly expiresAt: number;
}

interface Slot {
  readonly node: HTMLElement;
  id: number;
  text: string;
  w: number;
  h: number;
  hideAt: number;
}

/**
 * Speech bubbles as an HTML overlay. Holds every active line, but shows only the
 * best few (4 when zoomed out) nearest the latest event, fades them in/out,
 * and stacks them so they never overlap.
 */
export class BubbleLayer implements IPanel {
  private readonly root = el('div', 'bubbles');
  private readonly slots: Slot[] = [];
  private readonly lines = new Map<number, Line>();
  private readonly p = { x: 0, y: 0 };
  private readonly rects: ScreenRect[] = [];
  private eventX = 0;
  private eventY = 0;
  private shown: number[] = [];
  private lastSelect = 0;
  private dirty = false;
  /** Villagers keep quiet during a mission so the fight stays readable. */
  private muted = false;

  constructor(
    bus: IEventBus,
    private readonly em: EntityManager,
    private readonly cam: CameraRig,
    private readonly size: () => { w: number; h: number },
    private readonly groundAt: (x: number, y: number) => number,
  ) {
    this.eventX = cam.centerX;
    this.eventY = cam.centerY;
    // Mid-mission only the villagers' battle shouts get through.
    bus.on('DialogueSpoken', ({ id, text, priority }) => { if (!this.muted || priority >= SHOUT_PRIORITY) this.add(id, text, priority); });
    bus.on('SceneChanged', ({ scene }) => {
      this.muted = scene === 'battle';
      this.lines.clear();
      this.dirty = true;
    });
    bus.on('CommandExecuted', ({ result }) => {
      if (!result.hasFocus) return;
      this.eventX = result.focusX;
      this.eventY = result.focusY;
      this.dirty = true;
    });
  }

  mount(root: HTMLElement): void {
    for (let i = 0; i < BUBBLE_POOL_SIZE; i++) {
      const node = el('div', 'bubble');
      node.hidden = true;
      this.root.appendChild(node);
      this.slots.push({ node, id: -1, text: '', w: 0, h: 0, hideAt: 0 });
    }
    root.appendChild(this.root);
  }

  /** Bubbles allowed on screen right now. */
  cap(): number {
    return this.cam.viewHeight > BUBBLE_ZOOMED_OUT_VIEW_H ? BUBBLE_MAX_ZOOMED_OUT : BUBBLE_MAX_ZOOMED_IN;
  }

  update(): void {
    const now = performance.now();
    for (const [id, l] of this.lines) {
      if (now > l.expiresAt || !this.em.isAlive(id)) {
        this.lines.delete(id);
        this.dirty = true;
      }
    }
    if (this.dirty || now - this.lastSelect > RESELECT_MS) this.select(now);
    this.place(now);
  }

  private add(id: number, text: string, priority: number): void {
    const now = performance.now();
    this.lines.set(id, { id, text, priority, bornAt: now, expiresAt: now + BUBBLE_LIFETIME_MS });
    if (priority > 1 && this.shown.length === 0) {
      // Without a command focus, the first dramatic line becomes "the latest event".
      const p = this.anchor(id);
      this.eventX = p.x;
      this.eventY = p.y;
    }
    this.dirty = true;
  }

  private select(now: number): void {
    this.dirty = false;
    this.lastSelect = now;
    const cands: BubbleCandidate[] = [];
    for (const l of this.lines.values()) {
      const p = this.anchor(l.id);
      cands.push({ id: l.id, text: l.text, priority: l.priority, bornAt: l.bornAt, x: p.x, y: p.y });
    }
    this.shown = selectBubbles(cands, this.eventX, this.eventY, this.cap());
    for (const s of this.slots) {
      if (s.id >= 0 && !this.shown.includes(s.id)) this.fadeOut(s, now);
    }
    for (const id of this.shown) {
      if (this.slots.some((s) => s.id === id && s.hideAt === 0)) continue;
      const slot = this.slots.find((s) => s.id < 0) ?? this.slots.find((s) => s.hideAt > 0);
      const line = this.lines.get(id);
      if (slot && line) this.fadeIn(slot, id, line.text);
    }
  }

  private fadeIn(s: Slot, id: number, text: string): void {
    s.id = id;
    s.hideAt = 0;
    if (s.text !== text) {
      s.text = text;
      s.node.textContent = text;
    }
    s.node.hidden = false;
    s.w = s.node.offsetWidth;
    s.h = s.node.offsetHeight;
    // Next frame so the fade transition runs; skip if it was deselected meanwhile.
    requestAnimationFrame(() => {
      if (s.id === id && s.hideAt === 0) s.node.classList.add('visible');
    });
  }

  private fadeOut(s: Slot, now: number): void {
    if (s.hideAt > 0) return;
    s.node.classList.remove('visible');
    s.hideAt = now + BUBBLE_FADE_MS;
  }

  private place(now: number): void {
    const { w, h } = this.size();
    this.rects.length = 0;
    for (const s of this.slots) {
      if (s.id < 0) continue;
      if (s.hideAt > 0 && now >= s.hideAt) {
        s.id = -1;
        s.hideAt = 0;
        s.node.hidden = true;
        continue;
      }
      const line = this.lines.get(s.id);
      if (line && s.hideAt === 0 && line.expiresAt - now < BUBBLE_FADE_MS) this.fadeOut(s, now);
      const a = this.anchor(s.id);
      const visible = this.cam.project(a.x, a.h, a.y, w, h, this.p);
      if (!visible) this.p.y = -1000;
      this.rects.push({ id: s.id, x: this.p.x, y: this.p.y, w: s.w, h: s.h });
    }
    resolveOverlaps(this.rects);
    for (const r of this.rects) {
      const s = this.slots.find((x) => x.id === r.id);
      if (s) s.node.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  /** World point just above a speaker's head (follows altitude when floating). */
  private anchor(id: number): { x: number; y: number; h: number } {
    const x = this.em.x[id] ?? 0;
    const y = this.em.y[id] ?? 0;
    return { x, y, h: this.groundAt(x, y) + (this.em.z[id] ?? 0) + HEAD_HEIGHT * (this.em.scale[id] ?? 1) };
  }
}
