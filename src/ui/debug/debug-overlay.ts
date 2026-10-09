import type { IEventBus } from '../../core/events/event-bus';
import type { FrameStats, PerfSection } from '../../core/perf/frame-stats';
import type { SystemRunner } from '../../systems/system-runner';
import { el, type IPanel } from '../dom';

const SECTIONS: readonly PerfSection[] = ['frame', 'sim', 'sync', 'juice', 'fx', 'render', 'ui'];

/** FPS, frame ms per section, entities, draw calls, particles, per-system ms. Toggle: ` key or "debug". */
export class DebugOverlay implements IPanel {
  private readonly root = el('pre', 'debug');
  private visible: boolean;

  constructor(bus: IEventBus, private readonly stats: FrameStats, private readonly systems: SystemRunner, startVisible: boolean) {
    this.visible = startVisible;
    bus.on('DebugToggled', () => this.toggle());
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') {
        e.preventDefault(); // keep the backtick out of the command bar
        this.toggle();
      }
    });
  }

  mount(root: HTMLElement): void {
    this.root.hidden = !this.visible;
    root.appendChild(this.root);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.hidden = !this.visible;
  }

  update(): void {
    if (!this.visible) return;
    const s = this.stats;
    const lines = [
      `FPS ${s.fps.toFixed(0)}   frame ${s.ms.frame.toFixed(2)} ms (peak ${s.peak.frame.toFixed(1)})`,
      ...SECTIONS.slice(1).map((k) => `  ${k.padEnd(6)} ${s.ms[k].toFixed(3)} ms   peak ${s.peak[k].toFixed(2)}`),
      `entities ${s.entities}   drawn ${s.drawnSprites}   particles ${s.particles}`,
      `draw calls ${s.drawCalls}`,
      'systems:',
      ...this.systems.timings().map((t) => `  ${t.name.padEnd(10)} ${t.ms.toFixed(3)} ms`),
    ];
    this.root.textContent = lines.join('\n');
  }
}
