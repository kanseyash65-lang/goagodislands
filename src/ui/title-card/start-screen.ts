import { drawPixelText, measurePixelText, PIXEL_GLYPH_HEIGHT } from '../../assets/fonts/pixel-font';
import { CAMERA_DIST_MAX, CAMERA_DIST_START, CAMERA_PITCH, CAMERA_PITCH_MAX, CAMERA_YAW } from '../../core/config/render.config';
import { ISLAND_CENTER } from '../../core/config/world.config';
import type { IEventBus } from '../../core/events/event-bus';
import { nextMission } from '../../gameplay/missions/mission-defs';
import type { GameState } from '../../gameplay/state/game-state';
import type { CameraRig } from '../../rendering/camera/camera-rig';
import type { GodAvatar } from '../../rendering/god/god-avatar';
import { el, type IPanel } from '../dom';

const LOGO_SCALE = 8;
const LOGO_PAD = 16;
/** The opening sweep: from high above the sea, circling down onto the village. */
const SWEEP_YAW = 1.9;
const SWEEP_EASE = 0.42;
const SWEEP_SECONDS = 9;
const HOME_X = ISLAND_CENTER + 10;
const HOME_Y = ISLAND_CENTER + 6;
const STORY = ['Raiders are sailing for Goa.', 'The villagers cannot stop them alone.', 'But they have you.'];
/** When the menu appears if nobody skips (ms). */
const MENU_AT_MS = 5200;

/**
 * The first thing a player sees after loading: a letterboxed cinematic
 * (camera sweep, the god descending, the logo and a three-line story), then a
 * main menu whose big button starts the next defense mission.
 */
export class StartScreen implements IPanel {
  private readonly root = el('div', 'start');
  private readonly menuSub = el('span', 'start-play-sub');
  private menuTimer = 0;
  private open = false;

  constructor(
    private readonly bus: IEventBus,
    private readonly rig: CameraRig,
    private readonly god: GodAvatar,
    private readonly state: GameState,
  ) {
    bus.on('IntroRequested', ({ demo }) => this.play(demo));
    bus.on('CommandSubmitted', () => { if (this.open) this.close(); });
  }

  mount(root: HTMLElement): void {
    const bars = [el('div', 'start-bar top'), el('div', 'start-bar bottom')];
    const story = el('div', 'start-story');
    STORY.forEach((line, i) => {
      const p = el('p', '', line);
      p.style.animationDelay = `${1.6 + i * 0.9}s`;
      if (i === STORY.length - 1) p.classList.add('gold');
      story.appendChild(p);
    });
    const menu = el('div', 'start-menu');
    const play = el('button', 'start-play');
    play.type = 'button';
    play.append(el('span', 'start-play-title', '🛡️ DEFEND THE VILLAGE'), this.menuSub);
    play.addEventListener('click', () => this.choose('attack'));
    const row = el('div', 'start-row');
    row.append(
      this.small('🏝️ Explore my island', () => this.close()),
      this.small('🎬 Watch the demo', () => this.choose('demo')),
      this.small('ℹ️ How it’s made', () => this.bus.emit('UiAction', { action: 'about' })),
    );
    menu.append(play, row, el('div', 'start-hint', '🎙 Speak with Wispr Flow, type, or tap. The island understands plain English.'));
    this.root.append(...bars, this.logo(), story, menu);
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (e) => {
      if (!(e.target instanceof HTMLButtonElement)) this.showMenu();
    });
    root.appendChild(this.root);
  }

  private play(demo: boolean): void {
    const next = nextMission(this.state.campaign.completed);
    this.menuSub.textContent = next ? `Mission ${next.order} · ${next.name} · about 3 minutes` : 'Goa is free · replay any mission';
    this.open = true;
    this.root.hidden = false;
    document.body.classList.add('intro');
    this.root.classList.remove('menu');
    this.rig.snapView(ISLAND_CENTER, ISLAND_CENTER, CAMERA_DIST_MAX * 1.1, CAMERA_YAW + SWEEP_YAW, CAMERA_PITCH_MAX);
    this.rig.glideTo(HOME_X, HOME_Y, CAMERA_DIST_START, CAMERA_YAW, CAMERA_PITCH, SWEEP_EASE, SWEEP_SECONDS);
    this.god.descend();
    window.clearTimeout(this.menuTimer);
    if (demo) {
      this.menuTimer = window.setTimeout(() => this.choose('demo'), MENU_AT_MS);
      return;
    }
    this.menuTimer = window.setTimeout(() => this.showMenu(), MENU_AT_MS);
  }

  private showMenu(): void {
    window.clearTimeout(this.menuTimer);
    this.root.classList.add('menu');
  }

  private choose(action: 'attack' | 'demo'): void {
    this.close();
    this.bus.emit('UiAction', { action });
  }

  private close(): void {
    if (!this.open) return;
    this.open = false;
    window.clearTimeout(this.menuTimer);
    this.root.classList.add('gone');
    document.body.classList.remove('intro');
    window.setTimeout(() => {
      this.root.hidden = true;
      this.root.classList.remove('gone', 'menu');
    }, 700);
  }

  private small(label: string, fn: () => void): HTMLButtonElement {
    const b = el('button', 'start-small', label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  private logo(): HTMLCanvasElement {
    const lines = ['GOA GOD', 'ISLANDS'];
    const w = Math.max(...lines.map((l) => measurePixelText(l, LOGO_SCALE))) + LOGO_PAD * 2;
    const lineH = (PIXEL_GLYPH_HEIGHT + 3) * LOGO_SCALE;
    const canvas = el('canvas', 'start-logo');
    canvas.width = w;
    canvas.height = lineH * lines.length + LOGO_PAD * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      lines.forEach((l, i) => {
        const x = (w - measurePixelText(l, LOGO_SCALE)) / 2;
        drawPixelText(ctx, l, x, LOGO_PAD + i * lineH, LOGO_SCALE, i === 0 ? '#fff6e0' : '#ffd25e', '#3b2b3f');
      });
    }
    return canvas;
  }
}
