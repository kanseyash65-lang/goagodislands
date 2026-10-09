import { describe, expect, it } from 'vitest';
import { resolveOverlaps, selectBubbles, type BubbleCandidate, type ScreenRect } from '../bubbles/bubble-selection';

const cand = (id: number, x: number, text = `line ${id}`, priority = 1, bornAt = id): BubbleCandidate => ({ id, text, priority, bornAt, x, y: 0 });

describe('bubble selection', () => {
  it('caps to 4 and prefers the ones closest to the latest event', () => {
    const cands = [cand(1, 500), cand(2, 10), cand(3, 300), cand(4, 20), cand(5, 40), cand(6, 30)];
    expect(selectBubbles(cands, 0, 0, 4)).toEqual([2, 4, 6, 5]);
  });
  it('breaks distance ties by drama, then recency', () => {
    expect(selectBubbles([cand(1, 10, 'a', 1), cand(2, 10, 'b', 3)], 0, 0, 1)).toEqual([2]);
    expect(selectBubbles([cand(1, 10, 'a', 1, 5), cand(2, 10, 'b', 1, 9)], 0, 0, 1)).toEqual([2]);
  });
  it('never shows the same line twice', () => {
    expect(selectBubbles([cand(1, 1, 'same'), cand(2, 2, 'same'), cand(3, 3, 'other')], 0, 0, 4)).toEqual([1, 3]);
  });
});

describe('overlap resolution', () => {
  it('stacks overlapping bubbles instead of covering', () => {
    const rects: ScreenRect[] = [{ id: 1, x: 100, y: 200, w: 120, h: 30 }, { id: 2, x: 110, y: 195, w: 120, h: 30 }];
    resolveOverlaps(rects);
    const [lower, upper] = rects;
    expect(upper && lower && upper.y <= lower.y - lower.h).toBe(true);
  });
  it('leaves distant bubbles alone', () => {
    const rects: ScreenRect[] = [{ id: 1, x: 0, y: 200, w: 100, h: 30 }, { id: 2, x: 400, y: 200, w: 100, h: 30 }];
    resolveOverlaps(rects);
    expect(rects.map((r) => r.y)).toEqual([200, 200]);
  });
});
