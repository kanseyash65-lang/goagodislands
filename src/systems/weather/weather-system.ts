import {
  CLOUD_ALTITUDE, ITEM_RAIN_ALTITUDE, ITEM_RAIN_PER_SEC, WEATHER_TRANSITION_PER_SEC, WIND_DEFAULT, WIND_WINDY,
} from '../../core/config/sim.config';
import type { IEventBus } from '../../core/events/event-bus';
import type { IRng } from '../../core/rng/mulberry32';
import type { IViewInfo } from '../../core/services/view-info';
import type { EntityFactory } from '../../entities/factory/entity-factory';
import { ENTITY_FLAG, type EntityManager } from '../../entities/entity-manager';
import type { WeatherKind } from '../../types/weather';
import type { WorldParams } from '../../world/world-params';
import type { ISystem } from '../system-runner';

const TARGET_INTENSITY: Readonly<Record<WeatherKind, number>> = {
  clear: 0, cloudy: 0.25, rain: 0.8, storm: 1, snow: 0.8, fog: 0.75, windy: 0.15, hail: 0.9,
};
const LIGHTNING_PER_SEC = 0.12;
const LIGHTNING_FLASH = 0.55;
const ITEM_RAIN_SPREAD = 0.35;

/**
 * Eases weather intensity toward the commanded state, drives wind, storm
 * lightning, and comedic item rain ("rain pizza").
 * Events out: ImpactRequested (lightning flash).
 */
export class WeatherSystem implements ISystem {
  readonly name = 'weather';
  private itemAcc = 0;

  constructor(
    private readonly em: EntityManager,
    private readonly params: WorldParams,
    private readonly factory: EntityFactory,
    private readonly view: IViewInfo,
    private readonly bus: IEventBus,
    private readonly rng: IRng,
    private readonly realTime: () => number,
  ) {}

  step(dt: number, t: number): void {
    const p = this.params;
    const target = TARGET_INTENSITY[p.weather];
    const d = target - p.weatherIntensity;
    p.weatherIntensity += Math.sign(d) * Math.min(Math.abs(d), WEATHER_TRANSITION_PER_SEC * dt);
    const wantWind = p.weather === 'windy' || p.weather === 'storm' ? WIND_WINDY : WIND_DEFAULT;
    p.windX += (wantWind - p.windX) * Math.min(1, dt);

    if (p.weather === 'storm' && this.rng.chance(LIGHTNING_PER_SEC * dt)) {
      const x = this.view.centerX + this.rng.range(-0.4, 0.4) * this.view.viewWidth;
      const y = this.view.centerY + this.rng.range(-0.4, 0.4) * this.view.viewHeight;
      this.bus.defer('ImpactRequested', { x, y, magnitude: 2, flash: LIGHTNING_FLASH });
    }
    if (p.itemRainKind >= 0 && t < p.itemRainUntil) this.rainItems(dt);
    else if (p.itemRainKind >= 0) p.itemRainKind = -1;
  }

  private rainItems(dt: number): void {
    const p = this.params;
    this.itemAcc += ITEM_RAIN_PER_SEC * dt;
    while (this.itemAcc >= 1) {
      this.itemAcc -= 1;
      const x = this.view.centerX + this.rng.range(-ITEM_RAIN_SPREAD, ITEM_RAIN_SPREAD) * this.view.viewWidth;
      const y = this.view.centerY + this.rng.range(-ITEM_RAIN_SPREAD, ITEM_RAIN_SPREAD) * this.view.viewHeight;
      const opts = p.itemRainLabel >= 0
        ? { z: ITEM_RAIN_ALTITUDE + this.rng.range(0, CLOUD_ALTITUDE * 0.3), popAt: this.realTime(), label: p.itemRainLabel }
        : { z: ITEM_RAIN_ALTITUDE + this.rng.range(0, CLOUD_ALTITUDE * 0.3), popAt: this.realTime() };
      const id = this.factory.spawn(p.itemRainKind, x, y, opts);
      if (id >= 0) {
        this.em.flags[id] = (this.em.flags[id] ?? 0) | ENTITY_FLAG.DEBRIS;
        this.em.rotVel[id] = this.rng.range(-3, 3);
      }
    }
  }
}
