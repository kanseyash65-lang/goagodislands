import type { IEventBus } from '../core/events/event-bus';
import type { AudioManager } from './audio-manager';

/** One looping theme: tempo, beats per bar, chord roots (Hz) and a melody in scale steps. */
interface Theme {
  readonly bpm: number;
  readonly beats: number;
  readonly chords: readonly (readonly number[])[];
  /** One entry per beat across the whole loop; -1 = rest. Indexes into `scale`. */
  readonly melody: readonly number[];
  readonly scale: readonly number[];
  readonly drums: boolean;
}

const D4 = 293.66;
const st = (n: number): number => D4 * Math.pow(2, n / 12);
/** D major and D minor scales, two octaves from D4. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16].map(st);
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15].map(st);
const triad = (root: number, minor: boolean): number[] => [st(root), st(root + (minor ? 3 : 4)), st(root + 7)];

/** Home: a lilting Goan mando waltz in D major (I – V – vi – IV). */
const HOME: Theme = {
  bpm: 104,
  beats: 3,
  chords: [triad(0, false), triad(7, false), triad(-3, true), triad(5, false)],
  melody: [4, 5, 4, 7, -1, 6, 5, 4, 2, 4, -1, -1],
  scale: MAJOR,
  drums: false,
};

/** Battle: driving D minor (i – VI – VII – V) with tabla-like drums. */
const BATTLE: Theme = {
  bpm: 132,
  beats: 4,
  chords: [triad(0, true), triad(-4, false), triad(-2, false), triad(-5, false)],
  melody: [7, -1, 6, 4, 5, -1, 4, 2, 4, -1, 2, 1, 0, -1, -1, -1],
  scale: MINOR,
  drums: true,
};

const MUSIC_GAIN = 0.075;
const LOOKAHEAD_S = 0.25;
const TICK_MS = 80;
const FADE_S = 1.2;

/**
 * Procedural background music: a tiny step sequencer scheduling short plucked
 * notes and soft drums ahead of time. No audio files, no noise beds; it fades
 * between the home and battle themes on scene changes.
 */
export class MusicDirector {
  private gain: GainNode | null = null;
  private theme: Theme = HOME;
  private nextAt = 0;
  private step = 0;

  constructor(private readonly audio: AudioManager, bus: IEventBus) {
    bus.on('SceneChanged', ({ scene }) => this.switchTo(scene === 'battle' ? BATTLE : HOME));
    bus.on('BattleEnded', () => this.switchTo(HOME));
    window.setInterval(() => this.schedule(), TICK_MS);
  }

  private switchTo(theme: Theme): void {
    if (theme === this.theme) return;
    const ctx = this.audio.ctx;
    if (this.gain && ctx) {
      const g = this.gain.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.linearRampToValueAtTime(0.0001, ctx.currentTime + FADE_S / 2);
      g.linearRampToValueAtTime(MUSIC_GAIN, ctx.currentTime + FADE_S);
      this.nextAt = ctx.currentTime + FADE_S / 2;
    }
    this.theme = theme;
    this.step = 0;
  }

  private schedule(): void {
    const ctx = this.audio.ctx;
    const master = this.audio.master;
    if (!ctx || !master || ctx.state !== 'running') return;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.gain.gain.linearRampToValueAtTime(MUSIC_GAIN, ctx.currentTime + FADE_S * 2);
      this.gain.connect(master);
      this.nextAt = ctx.currentTime + 0.1;
    }
    const beat = 60 / this.theme.bpm;
    while (this.nextAt < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextAt, beat);
      this.step = (this.step + 1) % this.theme.melody.length;
      this.nextAt += beat;
    }
  }

  private playStep(step: number, t: number, beat: number): void {
    const th = this.theme;
    const inBar = step % th.beats;
    const chord = th.chords[Math.floor(step / th.beats) % th.chords.length] ?? [];
    const root = chord[0] ?? D4;
    if (inBar === 0) this.pluck(root / 2, t, beat * th.beats * 0.9, 0.55, 'triangle');
    else for (const f of chord) this.pluck(f, t, beat * 0.7, 0.16, 'triangle');
    const m = th.melody[step] ?? -1;
    const note = th.scale[m];
    if (m >= 0 && note) this.pluck(note * 2, t, beat * 0.9, 0.22, 'sine');
    if (th.drums) {
      if (inBar === 0 || inBar === 2) this.drum(t, 120, 55, 0.5, 0.18);
      else this.drum(t, 520, 300, 0.18, 0.05);
      this.drum(t + beat / 2, 640, 380, 0.08, 0.04);
    }
  }

  private pluck(freq: number, t: number, dur: number, vol: number, shape: OscillatorType): void {
    const ctx = this.audio.ctx;
    if (!ctx || !this.gain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = shape;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(t: number, f0: number, f1: number, vol: number, dur: number): void {
    const ctx = this.audio.ctx;
    if (!ctx || !this.gain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
