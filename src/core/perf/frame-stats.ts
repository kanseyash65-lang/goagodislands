/** Rolling per-section frame timings for the debug overlay and profiling. */
export type PerfSection = 'frame' | 'sim' | 'sync' | 'juice' | 'fx' | 'render' | 'ui';

const SECTIONS: readonly PerfSection[] = ['frame', 'sim', 'sync', 'juice', 'fx', 'render', 'ui'];
const EMA = 0.08;

function zeroes(): Record<PerfSection, number> {
  return { frame: 0, sim: 0, sync: 0, juice: 0, fx: 0, render: 0, ui: 0 };
}

export class FrameStats {
  readonly ms = zeroes();
  readonly peak = zeroes();
  fps = 60;
  entities = 0;
  drawnSprites = 0;
  particles = 0;
  drawCalls = 0;
  private readonly starts = zeroes();

  begin(s: PerfSection): void {
    this.starts[s] = performance.now();
  }

  end(s: PerfSection): void {
    this.add(s, performance.now() - this.starts[s]);
  }

  /** Adds an externally measured duration (ms) for a section. */
  add(s: PerfSection, dur: number): void {
    this.ms[s] += (dur - this.ms[s]) * EMA;
    this.peak[s] = Math.max(this.peak[s] * 0.995, dur);
  }

  tickFps(dtSeconds: number): void {
    if (dtSeconds > 0) this.fps += (1 / dtSeconds - this.fps) * EMA;
  }

  resetPeaks(): void {
    for (const s of SECTIONS) this.peak[s] = 0;
  }
}
