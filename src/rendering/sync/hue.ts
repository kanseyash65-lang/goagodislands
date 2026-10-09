const OUT = { r: 1, g: 1, b: 1 };

/**
 * Fully saturated hue (0..1) → rgb, writing into a shared object so the
 * per-frame rainbow tint allocates nothing. Callers must copy the fields.
 */
export function hueToRgb(h: number): { readonly r: number; readonly g: number; readonly b: number } {
  const x = h * 6;
  OUT.r = clamp01(Math.abs(x - 3) - 1);
  OUT.g = clamp01(2 - Math.abs(x - 2));
  OUT.b = clamp01(2 - Math.abs(x - 4));
  return OUT;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
