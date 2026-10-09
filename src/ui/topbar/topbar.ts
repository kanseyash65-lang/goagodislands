import { formatClock, type IClock } from '../../core/time/clock';
import type { KindRegistry } from '../../entities/definitions/kinds';
import type { EntityManager } from '../../entities/entity-manager';
import type { IMoodState } from '../../systems/normalcy/normalcy-system';
import { WEATHER_ICON, WEATHER_LABEL } from '../../types/weather';
import type { WorldParams } from '../../world/world-params';
import { el, type IPanel } from '../dom';

const TWITCH_DROP = 2;

/** ☀ 10:42 Tue · ⛅ Clear · 👥 14 · NORMALCY ▓▓▓░ · CHAOS (refreshed ≤ 4 Hz). */
export class TopBar implements IPanel {
  private readonly root = el('div', 'topbar');
  private readonly time = el('span', 'tb-item');
  private readonly weather = el('span', 'tb-item');
  private readonly pop = el('span', 'tb-item');
  private readonly normalFill = el('div', 'meter-fill');
  private readonly normalMeter = el('div', 'meter');
  private readonly normalPct = el('span', 'tb-pct');
  private readonly chaosFill = el('div', 'meter-fill chaos');
  private lastNormalcy = 100;

  constructor(
    private readonly clock: IClock,
    private readonly params: WorldParams,
    private readonly mood: IMoodState,
    private readonly em: EntityManager,
    private readonly kinds: KindRegistry,
  ) {}

  mount(root: HTMLElement): void {
    const chaosMeter = el('div', 'meter small');
    chaosMeter.appendChild(this.chaosFill);
    this.normalMeter.appendChild(this.normalFill);
    const normal = el('span', 'tb-item tb-meter');
    normal.append(el('span', 'tb-label', 'NORMALCY'), this.normalMeter, this.normalPct);
    const chaos = el('span', 'tb-item tb-meter');
    chaos.append(el('span', 'tb-label', 'CHAOS'), chaosMeter);
    this.root.append(el('span', 'tb-title', 'AVERAGE TUESDAY'), this.time, this.weather, this.pop, normal, chaos);
    root.appendChild(this.root);
  }

  update(): void {
    const night = this.clock.minutes < 360 || this.clock.minutes >= 1200;
    this.time.textContent = `${night ? '☾' : '☀'} ${formatClock(this.clock.minutes)} Tue${this.clock.frozen ? ' ⏸' : this.clock.timeScale > 1 ? ' ⏩' : ''}`;
    this.weather.textContent = `${WEATHER_ICON[this.params.weather]} ${WEATHER_LABEL[this.params.weather]}`;
    const humans = new Set(this.kinds.kindsWithTag('human'));
    let people = 0;
    for (let i = 0; i < this.em.highWater; i++) if (this.em.alive[i] === 1 && humans.has(this.em.kind[i] ?? -1)) people++;
    this.pop.textContent = `👥 ${people} · 🐾 ${this.em.count}`;
    const n = this.mood.normalcy;
    this.normalFill.style.width = `${n.toFixed(1)}%`;
    this.normalPct.textContent = `${Math.round(n)}%`;
    if (this.lastNormalcy - n > TWITCH_DROP) {
      this.normalMeter.classList.remove('twitch');
      void this.normalMeter.offsetWidth;
      this.normalMeter.classList.add('twitch');
    }
    this.lastNormalcy = n;
    this.chaosFill.style.width = `${(this.mood.chaos * 10).toFixed(1)}%`;
  }
}
