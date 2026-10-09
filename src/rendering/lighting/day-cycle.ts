import { Color, Vector3 } from 'three';
import type { WeatherKind } from '../../types/weather';

/** Lighting state for one moment of the (always Tuesday) day. */
export interface LightState {
  readonly sunDir: Vector3;
  readonly sunColor: Color;
  sunIntensity: number;
  readonly hemiSky: Color;
  readonly hemiGround: Color;
  hemiIntensity: number;
  readonly skyTop: Color;
  readonly horizon: Color;
  night: number;
  fogDensity: number;
  /** Overall brightness multiplier for custom shaders (ocean). */
  light: number;
}

interface Key {
  readonly min: number;
  readonly top: string;
  readonly horizon: string;
  readonly sun: string;
}

const KEYS: readonly Key[] = [
  { min: 0, top: '#0a1430', horizon: '#1c2a52', sun: '#7f96d8' },
  { min: 330, top: '#1a2450', horizon: '#3a3f6a', sun: '#8f9ad8' },
  { min: 390, top: '#5a7ac8', horizon: '#ffb07a', sun: '#ffae6a' }, // Goan sunrise
  { min: 480, top: '#3d9be0', horizon: '#cdeeff', sun: '#fff1d6' },
  { min: 720, top: '#2f8fe0', horizon: '#d8f2ff', sun: '#ffffff' },
  { min: 1020, top: '#3a8ed8', horizon: '#ffe6b8', sun: '#ffe2b0' },
  { min: 1110, top: '#5a6ab8', horizon: '#ff9a5a', sun: '#ff8a4a' }, // sunset over the Arabian Sea
  { min: 1200, top: '#1e2558', horizon: '#6a4a7a', sun: '#a08ad8' },
  { min: 1290, top: '#0a1430', horizon: '#1c2a52', sun: '#7f96d8' },
  { min: 1440, top: '#0a1430', horizon: '#1c2a52', sun: '#7f96d8' },
];

const WEATHER_DIM: Readonly<Record<WeatherKind, number>> = {
  clear: 1, cloudy: 0.85, rain: 0.62, storm: 0.45, snow: 0.85, fog: 0.75, windy: 0.95, hail: 0.6,
};
const tA = new Color();
const tB = new Color();

export function createLightState(): LightState {
  return {
    sunDir: new Vector3(0.4, 0.8, 0.3),
    sunColor: new Color(1, 1, 1),
    sunIntensity: 2.6,
    hemiSky: new Color('#bfe2ff'),
    hemiGround: new Color('#6a7a4a'),
    hemiIntensity: 1.1,
    skyTop: new Color(),
    horizon: new Color(),
    night: 0,
    fogDensity: 0.0012,
    light: 1,
  };
}

/** Computes the light for a time, the voice-editable sun tint and the weather (allocation-free). */
export function computeLight(out: LightState, minutes: number, sunTint: { r: number; g: number; b: number }, sunHidden: boolean, weather: WeatherKind, intensity: number): void {
  let a: Key = KEYS[0] ?? { min: 0, top: '#000', horizon: '#000', sun: '#fff' };
  let b: Key = a;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const k0 = KEYS[i];
    const k1 = KEYS[i + 1];
    if (k0 && k1 && minutes >= k0.min && minutes <= k1.min) {
      a = k0;
      b = k1;
      break;
    }
  }
  const t = b.min === a.min ? 0 : (minutes - a.min) / (b.min - a.min);
  out.skyTop.copy(tA.set(a.top)).lerp(tB.set(b.top), t);
  out.horizon.copy(tA.set(a.horizon)).lerp(tB.set(b.horizon), t);
  out.sunColor.copy(tA.set(a.sun)).lerp(tB.set(b.sun), t);
  // Day arc: rises in the east (+x), sets over the Arabian Sea in the west.
  const dayT = (minutes - 360) / 840;
  const isDay = dayT > 0 && dayT < 1;
  const ang = isDay ? dayT * Math.PI : (((minutes - 1200 + 1440) % 1440) / 600) * Math.PI;
  out.sunDir.set(Math.cos(ang), Math.max(0.12, Math.sin(ang)), 0.35).normalize();
  const elevation = Math.sin(Math.min(Math.PI, Math.max(0, ang)));
  out.night = isDay ? 0 : 1;
  const tint = tA.setRGB(sunTint.r * sunTint.r, sunTint.g * sunTint.g, sunTint.b * sunTint.b); // tint is display space
  // A coloured sun tints the whole island ("turn the sun red").
  out.sunColor.multiply(tint);
  out.skyTop.lerp(tB.copy(tint).multiply(out.skyTop), 0.35);
  out.horizon.lerp(tB.copy(tint).multiplyScalar(0.9), 0.3);
  const dim = 1 - (1 - WEATHER_DIM[weather]) * Math.min(1, intensity * 1.2);
  const hidden = sunHidden ? 0.25 : 1;
  out.sunIntensity = (isDay ? 0.6 + 2.4 * elevation : 0.45) * dim * hidden;
  out.hemiIntensity = (isDay ? 0.55 + 0.75 * elevation : 0.35) * (0.6 + 0.4 * dim);
  out.hemiSky.copy(out.skyTop).lerp(tB.set('#ffffff'), 0.45);
  out.hemiGround.set(isDay ? '#7a8a52' : '#2a3048');
  out.skyTop.multiplyScalar(dim);
  out.horizon.multiplyScalar(0.55 + 0.45 * dim);
  out.fogDensity = weather === 'fog' ? 0.006 * intensity + 0.0012 : weather === 'rain' || weather === 'storm' ? 0.0022 : 0.0011;
  out.light = (isDay ? 0.55 + 0.45 * elevation : 0.35) * dim;
}
