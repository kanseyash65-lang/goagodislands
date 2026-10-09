import { createLogger } from '../core/logger/logger';

const log = createLogger('audio');
const MASTER_GAIN = 0.55;
const MUTE_KEY = 'goa-god-islands.muted';

/**
 * One AudioContext, a master gain into a compressor (no clipping when 20
 * cannons fire), and a shared noise buffer. Unlocks on the first user gesture
 * (browsers block audio until then). Every call is guarded: no audio, no crash.
 */
export class AudioManager {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noise: AudioBuffer | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // storage blocked: default to sound on
    }
    const unlock = (): void => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running' && !this.muted;
  }

  unlock(): void {
    try {
      if (!this.ctx) {
        const ctx = new AudioContext();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : MASTER_GAIN;
        master.connect(comp).connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
        this.noise = makeNoise(ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) {
      log.warn('audio unavailable', err);
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.05);
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // non-fatal
    }
    return this.muted;
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
