import {
  NEWSPAPER_AUTO_CLOSE_MS, NEWSPAPER_COOLDOWN_MS, NEWSPAPER_MAGNITUDE_THRESHOLD,
} from '../../core/config/ui.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { IRng } from '../../core/rng/mulberry32';
import type { IClock } from '../../core/time/clock';
import type { EntityManager } from '../../entities/entity-manager';
import type { IChronicle } from '../../systems/memory/chronicle';
import { generateFrontPage, type FrontPage } from '../../systems/newspaper/front-page-generator';
import type { IMoodState } from '../../systems/normalcy/normalcy-system';
import type { WorldParams } from '../../world/world-params';
import type { SpecialEdition } from '../../gameplay/battle/mission-story';
import { el, type IPanel } from '../dom';
import { paintFrontPage, sepiaPhoto } from './front-page-painter';

/** Lets the big moment land (reactions, camera) before the presses roll. */
const PRESS_DELAY_MS = 1300;
const COPIED_MS = 1500;

export interface NewspaperSources {
  readonly chronicle: IChronicle;
  readonly mood: IMoodState;
  readonly params: WorldParams;
  readonly clock: IClock;
  readonly em: EntityManager;
  readonly rng: IRng;
  /** Grabs the next rendered frame for the photo. */
  readonly capture: (cb: (frame: HTMLCanvasElement) => void) => void;
}

/**
 * The Daily Tuesday (02 §7.1): slides in after any command with magnitude > 7
 * (or on "show the newspaper"). Download PNG, copy caption, close.
 * Events in: CommandExecuted, NewspaperRequested, NewspaperClosed.
 */
export class NewspaperPanel implements IPanel {
  private readonly root = el('div', 'newspaper');
  private readonly canvas = el('canvas', 'front-page');
  private readonly copyBtn = el('button', 'np-btn', 'Copy caption');
  private page: FrontPage | undefined;
  private edition = 0;
  private lastShown = -Infinity;
  private pressTimer = 0;
  private closeTimer = 0;
  private hovered = false;
  /** No surprise front pages mid-battle: they would cover the fight. Still printable on request. */
  private inBattle = false;

  constructor(private readonly bus: IEventBus, private readonly src: NewspaperSources) {
    bus.on('SceneChanged', ({ scene }) => { this.inBattle = scene === 'battle'; });
    bus.on('CommandExecuted', ({ command }) => {
      if (this.inBattle || command.magnitude <= NEWSPAPER_MAGNITUDE_THRESHOLD) return;
      if (performance.now() - this.lastShown < NEWSPAPER_COOLDOWN_MS) return;
      window.clearTimeout(this.pressTimer); // a bigger chain keeps resetting until it settles
      this.pressTimer = window.setTimeout(() => this.print(), PRESS_DELAY_MS);
    });
    bus.on('NewspaperRequested', ({ special }) => this.print(special));
    bus.on('NewspaperClosed', () => this.close());
  }

  mount(root: HTMLElement): void {
    const download = el('button', 'np-btn primary', '⬇ Download PNG');
    const close = el('button', 'np-btn', 'Close');
    for (const b of [download, this.copyBtn, close]) b.type = 'button';
    download.addEventListener('click', () => void this.download());
    this.copyBtn.addEventListener('click', () => void this.copyCaption());
    close.addEventListener('click', () => this.close());
    const bar = el('div', 'np-actions');
    bar.append(download, this.copyBtn, close);
    this.root.append(this.canvas, bar);
    this.root.setAttribute('aria-hidden', 'true');
    this.root.addEventListener('pointerenter', () => { this.hovered = true; });
    this.root.addEventListener('pointerleave', () => { this.hovered = false; });
    root.appendChild(this.root);
  }

  isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  /** PNG of the current front page (used by the download button and tests). */
  exportBlob(): Promise<Blob | null> {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
  }

  private print(special?: SpecialEdition): void {
    window.clearTimeout(this.pressTimer);
    this.lastShown = performance.now();
    this.edition++;
    const page = generateFrontPage(this.gather(), this.src.rng);
    // A mission edition keeps the date, weather and classifieds but tells the story of your defense.
    this.page = special ? { ...page, ...special, dateLine: page.dateLine.replace('PRICE: ONE CHICKEN', 'PRICE: ONE FENI') } : page;
    paintFrontPage(this.canvas, this.page, undefined);
    this.open();
    // The photo is the next rendered frame, toned sepia, then the page is repainted.
    this.src.capture((frame) => {
      if (this.page) paintFrontPage(this.canvas, this.page, sepiaPhoto(frame));
    });
  }

  private gather(): Parameters<typeof generateFrontPage>[0] {
    const { chronicle, mood, params, clock, em, rng } = this.src;
    const lead = chronicle.latestBig(NEWSPAPER_MAGNITUDE_THRESHOLD);
    const others = chronicle.entries.filter((e) => e !== lead).slice(-3).reverse().map((e) => e.text);
    const names = [...em.names.values()];
    const base = { others, weather: params.weather, normalcy: mood.normalcy, day: clock.day, edition: this.edition, witness: names.length > 0 ? rng.pick(names) : 'a local' };
    return lead
      ? { ...base, lead: { text: lead.result.text, reaction: lead.result.reaction, subject: lead.result.subject, affected: lead.result.affected } }
      : base;
  }

  private open(): void {
    this.root.classList.add('open');
    this.root.setAttribute('aria-hidden', 'false');
    window.clearTimeout(this.closeTimer);
    const tick = (): void => {
      if (this.hovered) this.closeTimer = window.setTimeout(tick, NEWSPAPER_AUTO_CLOSE_MS / 4);
      else this.close();
    };
    this.closeTimer = window.setTimeout(tick, NEWSPAPER_AUTO_CLOSE_MS);
  }

  private close(): void {
    window.clearTimeout(this.closeTimer);
    this.root.classList.remove('open');
    this.root.setAttribute('aria-hidden', 'true');
  }

  private async download(): Promise<void> {
    const blob = await this.exportBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = `the-daily-tuesday-${this.edition}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  private async copyCaption(): Promise<void> {
    if (!this.page) return;
    try {
      await navigator.clipboard.writeText(this.page.caption);
      this.copyBtn.textContent = 'Copied ✓';
    } catch {
      this.bus.emit('ToastRequested', { text: 'The clipboard is shy today. Try the download instead.' });
    }
    window.setTimeout(() => { this.copyBtn.textContent = 'Copy caption'; }, COPIED_MS);
  }
}
