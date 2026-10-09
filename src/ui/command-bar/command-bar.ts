import { AUTO_SUBMIT_MS, MAX_INPUT_CHARS } from '../../core/config/command.config';
import { RECENT_COMMANDS, SUGGESTION_ROTATE_MS } from '../../core/config/ui.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { IRng } from '../../core/rng/mulberry32';
import { describeCommand, type CommandSource } from '../../commands/types';
import { GOD_POWERS } from '../../data/god-powers';
import { TIPS } from '../../data/tips';
import { clear, el, type IPanel } from '../dom';

const WAVE_BARS = 7;
const WAVE_DECAY = 0.86;
const RIBBON_MS = 6000;
const SUGGESTIONS = 3;
const BURST_CHARS = 4;
const HOME_PLACEHOLDER = 'Say anything. Try: make it sunset in Goa';
/** During a mission the placeholder cycles through the god powers you can say. */
const POWER_HINT_MS = 2600;
const TYPE_MS = 45;
const TYPE_HOLD_MS = 350;

/**
 * Always-focused command input built for Wispr Flow: dictated text lands here,
 * auto-submits after the transcript stops changing, Enter submits, Escape clears.
 * Shows a "Reality heard" ribbon, suggestion chips and recent commands.
 */
export class CommandBar implements IPanel {
  readonly input: HTMLInputElement;
  private readonly root = el('div', 'cmdbar');
  private readonly ribbon = el('div', 'heard');
  private readonly ring = el('div', 'ring');
  private readonly wave = el('div', 'wave');
  private readonly suggestions = el('div', 'suggestions');
  private readonly recent = el('div', 'recent');
  private readonly bars: HTMLElement[] = [];
  private readonly levels = new Array<number>(WAVE_BARS).fill(0);
  private readonly recentList: string[] = [];
  private timer = 0;
  private ribbonTimer = 0;
  private burst = false;
  private inBattle = false;
  private hintIndex = 0;
  /** While the coach waits for a phrase, the placeholder shows exactly that phrase. */
  private coachWords: string | null = null;

  constructor(private readonly bus: IEventBus, private readonly rng: IRng) {
    this.input = el('input', 'cmd-input');
    this.input.type = 'text';
    this.input.maxLength = MAX_INPUT_CHARS;
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.placeholder = HOME_PLACEHOLDER;
    this.input.setAttribute('aria-label', 'Command reality');
    for (let i = 0; i < WAVE_BARS; i++) this.bars.push(this.wave.appendChild(el('span')));
    bus.on('CommandParsed', ({ raw, commands }) => this.showHeard(raw, commands.map(describeCommand)));
    bus.on('CommandExecuted', ({ command }) => {
      if (command.note && command.chainIndex === 0) this.highlightHint(command.note.replace(/^Try:\s*/, ''));
    });
    bus.on('HelpRequested', () => this.rotateSuggestions(true));
    bus.on('CoachChanged', ({ words }) => {
      this.coachWords = words;
      this.showPowerHint();
    });
    bus.on('SceneChanged', ({ scene }) => {
      this.inBattle = scene === 'battle';
      this.hintIndex = 0;
      this.showPowerHint();
      this.rotateSuggestions(false);
    });
  }

  mount(root: HTMLElement): void {
    const row = el('div', 'cmdbar-row');
    row.append(el('span', 'mic', '🎙'), this.input, this.ring, this.wave);
    this.root.append(this.ribbon, row, this.suggestions, this.recent);
    root.appendChild(this.root);
    this.input.addEventListener('input', (e) => this.onInput(e));
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('blur', () => window.setTimeout(() => this.focus(), 0));
    window.addEventListener('focus', () => this.focus());
    document.addEventListener('pointerup', () => this.focus());
    this.rotateSuggestions(false);
    window.setInterval(() => this.rotateSuggestions(false), SUGGESTION_ROTATE_MS);
    window.setInterval(() => this.showPowerHint(), POWER_HINT_MS);
    this.focus();
  }

  focus(): void {
    if (document.activeElement !== this.input) this.input.focus({ preventScroll: true });
  }

  isEmpty(): boolean {
    return this.input.value.trim().length === 0;
  }

  /** Per-frame: waveform decay (cheap: 7 style writes). */
  update(): void {
    for (let i = 0; i < WAVE_BARS; i++) {
      const v = (this.levels[i] ?? 0) * WAVE_DECAY;
      this.levels[i] = v;
      const bar = this.bars[i];
      if (bar) bar.style.transform = `scaleY(${(0.15 + v).toFixed(3)})`;
    }
  }

  /** Demo mode: types a phrase like a live transcript (waveform and all), then submits it as voice. */
  typeOut(text: string): Promise<void> {
    window.clearTimeout(this.timer);
    return new Promise((done) => {
      let n = 0;
      const tick = (): void => {
        n++;
        this.input.value = text.slice(0, n);
        for (let i = 0; i < WAVE_BARS; i++) this.levels[i] = Math.min(1, (this.levels[i] ?? 0) + 0.3 + this.rng.next() * 0.5);
        if (n < text.length) {
          window.setTimeout(tick, TYPE_MS);
          return;
        }
        window.setTimeout(() => {
          this.submit(text, 'voice');
          done();
        }, TYPE_HOLD_MS);
      };
      tick();
    });
  }

  submit(text: string, source: CommandSource): void {
    window.clearTimeout(this.timer);
    this.ring.classList.remove('counting');
    const raw = text.trim().slice(0, MAX_INPUT_CHARS);
    this.input.value = '';
    this.burst = false;
    if (raw.length === 0) return;
    this.remember(raw);
    this.bus.emit('CommandSubmitted', { raw, source });
  }

  private onInput(e: Event): void {
    const data = (e as InputEvent).data ?? '';
    if (data.length >= BURST_CHARS) this.burst = true; // dictation tools insert whole phrases at once
    for (let i = 0; i < WAVE_BARS; i++) this.levels[i] = Math.min(1, (this.levels[i] ?? 0) + 0.35 + this.rng.next() * 0.5);
    window.clearTimeout(this.timer);
    this.ring.classList.remove('counting');
    if (this.isEmpty()) return;
    void this.ring.offsetWidth; // restart the countdown animation
    this.ring.classList.add('counting');
    this.timer = window.setTimeout(() => this.submit(this.input.value, this.burst ? 'voice' : 'text'), AUTO_SUBMIT_MS);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submit(this.input.value, this.burst ? 'voice' : 'text');
    } else if (e.key === 'Escape') {
      window.clearTimeout(this.timer);
      this.ring.classList.remove('counting');
      this.input.value = '';
      this.bus.emit('NewspaperClosed', {});
    }
  }

  private showHeard(raw: string, parts: readonly string[]): void {
    clear(this.ribbon);
    this.ribbon.append(el('span', 'heard-label', 'Reality heard: '), el('span', 'heard-raw', `"${raw.slice(0, 120)}"`), el('span', 'heard-arrow', '  →  '), el('span', 'heard-parse', parts.join('  ⟶  ')));
    this.ribbon.classList.add('show');
    window.clearTimeout(this.ribbonTimer);
    this.ribbonTimer = window.setTimeout(() => this.ribbon.classList.remove('show'), RIBBON_MS);
  }

  private remember(raw: string): void {
    const i = this.recentList.indexOf(raw);
    if (i >= 0) this.recentList.splice(i, 1);
    this.recentList.unshift(raw);
    this.recentList.length = Math.min(this.recentList.length, RECENT_COMMANDS);
    clear(this.recent);
    if (this.recentList.length === 0) return;
    this.recent.appendChild(el('span', 'label', 'recent:'));
    for (const r of this.recentList) this.recent.appendChild(this.chip(r, 'recent-chip'));
  }

  private showPowerHint(): void {
    if (!this.inBattle) {
      this.input.placeholder = HOME_PLACEHOLDER;
      return;
    }
    if (this.coachWords) {
      this.input.placeholder = `Say: "${this.coachWords}"`;
      return;
    }
    const p = GOD_POWERS[this.hintIndex++ % GOD_POWERS.length];
    if (p) this.input.placeholder = `Say: "${p.words}"`;
  }

  private rotateSuggestions(flash: boolean): void {
    clear(this.suggestions);
    this.suggestions.appendChild(el('span', 'label', 'try saying:'));
    const picked = new Set<string>();
    const pool = this.inBattle ? GOD_POWERS.map((p) => p.words) : TIPS;
    while (picked.size < Math.min(SUGGESTIONS, pool.length)) picked.add(this.rng.pick(pool));
    for (const t of picked) this.suggestions.appendChild(this.chip(t, 'chip'));
    if (flash) this.suggestions.classList.add('flash');
    window.setTimeout(() => this.suggestions.classList.remove('flash'), 900);
  }

  private highlightHint(hint: string): void {
    const chip = this.chip(hint, 'chip hint');
    this.suggestions.insertBefore(chip, this.suggestions.children[1] ?? null);
    while (this.suggestions.children.length > SUGGESTIONS + 1) this.suggestions.lastElementChild?.remove();
  }

  private chip(text: string, cls: string): HTMLElement {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', () => this.submit(text, 'suggestion'));
    return b;
  }
}
