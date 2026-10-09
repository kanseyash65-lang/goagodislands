import { WIND_DEFAULT } from '../core/config/sim.config';
import type { WeatherKind } from '../types/weather';

/**
 * Global, voice-editable world parameters ("laws of reality").
 * Commands write these; systems and the renderer read them.
 */
export class WorldParams {
  gravity = 1;
  /** Weather the world is transitioning toward. */
  weather: WeatherKind = 'clear';
  /** Current precipitation/fog intensity 0..1 (eased by the weather system). */
  weatherIntensity = 0;
  /** Kind id falling from the sky during comedic item rain (-1 = none). */
  itemRainKind = -1;
  itemRainLabel = -1;
  itemRainUntil = 0;
  windX = WIND_DEFAULT;
  windY = 0;
}
