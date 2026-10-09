/** 0..1 color triple used for tints and lighting. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export const WHITE: Rgb = { r: 1, g: 1, b: 1 };

export function rgb(r: number, g: number, b: number): Rgb {
  return { r, g, b };
}

/** Parses "#rrggbb" into an Rgb (0..1). Invalid input returns white. */
export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || m[1] === undefined) return WHITE;
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function rgbToCss(c: Rgb): string {
  const to = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${to(c.r)}, ${to(c.g)}, ${to(c.b)})`;
}

/** HSL (0..1 each) to Rgb. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number): number => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0), g: f(8), b: f(4) };
}
