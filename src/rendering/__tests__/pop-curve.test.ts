import { describe, expect, it } from 'vitest';
import { POP_DURATION } from '../../core/config/juice.config';
import { popScale } from '../fx/pop-curve';

describe('squash & stretch pop', () => {
  const out = { sx: 0, sy: 0 };
  it('starts invisible and grows in', () => {
    expect(popScale(0, out)).toBe(true);
    expect(out.sy).toBe(0);
  });
  it('stretches tall and thin, then squashes short and wide', () => {
    popScale(0.06, out);
    expect(out.sy).toBeGreaterThan(out.sx);
    popScale(0.19, out);
    expect(out.sx).toBeGreaterThan(out.sy);
  });
  it('settles near 1 and then stops', () => {
    popScale(POP_DURATION - 0.01, out);
    expect(Math.abs(out.sx - 1)).toBeLessThan(0.1);
    expect(popScale(POP_DURATION, out)).toBe(false);
    expect(popScale(-1, out)).toBe(false);
  });
});
