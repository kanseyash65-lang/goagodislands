import type { AudioManager } from './audio-manager';

/**
 * Synthesised sound recipes (oscillators, filtered noise, envelopes).
 * No audio files: every sound is built when played.
 */
type Shape = OscillatorType;

export class Sfx {
  private lastPlayed = new Map<string, number>();

  constructor(private readonly a: AudioManager) {}

  /** Drops a sound if the same one played less than `gap` seconds ago (polyphony cap). */
  private throttle(key: string, gap: number): boolean {
    const ctx = this.a.ctx;
    if (!ctx || !this.a.ready) return false;
    const t = ctx.currentTime;
    if (t - (this.lastPlayed.get(key) ?? -1) < gap) return false;
    this.lastPlayed.set(key, t);
    return true;
  }

  private tone(shape: Shape, f0: number, f1: number, dur: number, gain: number, delay = 0): void {
    const ctx = this.a.ctx;
    const out = this.a.master;
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = shape;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(type: BiquadFilterType, f0: number, f1: number, dur: number, gain: number, q = 0.8, delay = 0): void {
    const ctx = this.a.ctx;
    const out = this.a.master;
    const buf = this.a.noise;
    if (!ctx || !out || !buf) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  whoosh(): void {
    if (!this.throttle('whoosh', 0.15)) return;
    this.noise('bandpass', 300, 3200, 0.45, 0.35, 1.2);
    [523, 659, 784].forEach((f, i) => this.tone('sine', f, f, 0.18, 0.08, 0.08 + i * 0.06));
  }

  cast(): void {
    if (!this.throttle('cast', 0.3)) return;
    [784, 988, 1175, 1568].forEach((f, i) => this.tone('triangle', f, f * 1.01, 0.5, 0.06, i * 0.07));
    this.tone('sine', 110, 55, 0.6, 0.2);
  }

  pop(count: number): void {
    if (!this.throttle('pop', 0.05)) return;
    const n = Math.min(8, Math.max(1, count));
    for (let i = 0; i < n; i++) {
      const f = 500 + Math.random() * 500;
      this.tone('sine', f, f * 0.4, 0.09, 0.12, i * 0.05);
    }
  }

  gun(heavy: boolean): void {
    // Sparse, short pops: dozens of rifles must never blur into a hiss.
    if (!this.throttle(heavy ? 'mg' : 'gun', heavy ? 0.22 : 0.16)) return;
    this.noise('bandpass', 1400, 700, 0.035, heavy ? 0.09 : 0.06, 1.4);
    this.tone('triangle', heavy ? 140 : 220, 70, 0.06, 0.07);
  }

  cannon(): void {
    if (!this.throttle('cannon', 0.3)) return;
    this.tone('sine', 95, 38, 0.45, 0.45);
    this.noise('lowpass', 1200, 200, 0.35, 0.3);
  }

  explosion(big: boolean): void {
    if (!this.throttle(big ? 'boom' : 'pop-boom', big ? 0.25 : 0.18)) return;
    this.noise('lowpass', big ? 1400 : 2200, 90, big ? 1.1 : 0.4, big ? 0.55 : 0.25);
    this.tone('sine', big ? 70 : 120, 30, big ? 0.9 : 0.3, big ? 0.5 : 0.2);
  }

  lightning(): void {
    if (!this.throttle('lightning', 0.08)) return;
    this.noise('highpass', 4000, 1500, 0.12, 0.4, 0.5);
    this.noise('lowpass', 400, 60, 2.2, 0.45, 0.6, 0.12);
    this.tone('sine', 55, 30, 1.4, 0.35, 0.1);
  }

  /** Rain arriving: a soft swell that fades out (never a loop). */
  splashHiss(): void {
    if (!this.throttle('hiss', 2)) return;
    this.noise('bandpass', 1800, 4200, 1.6, 0.1, 0.5);
  }

  crackle(): void {
    if (!this.throttle('crackle', 0.25)) return;
    this.noise('bandpass', 2400, 1200, 0.04, 0.07, 2);
    this.noise('bandpass', 1600, 900, 0.03, 0.05, 2, 0.06);
  }

  victory(): void {
    if (!this.throttle('fanfare', 1)) return;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, i === 5 ? 0.9 : 0.22, 0.14, i * 0.16));
  }

  defeat(): void {
    if (!this.throttle('fanfare', 1)) return;
    [392, 349, 311, 262].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.4, 0.06, i * 0.3));
  }

  click(): void {
    if (!this.throttle('click', 0.03)) return;
    this.tone('sine', 900, 700, 0.05, 0.08);
  }

  alarm(): void {
    if (!this.throttle('alarm', 2)) return;
    [660, 880, 660, 880].forEach((f, i) => this.tone('square', f, f, 0.16, 0.05, i * 0.2));
  }
}
