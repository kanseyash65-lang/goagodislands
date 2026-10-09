/** A line someone is currently saying (may or may not be on screen). */
export interface BubbleCandidate {
  readonly id: number;
  readonly text: string;
  readonly priority: number;
  readonly bornAt: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Picks which bubbles to show (03 §13): at most `cap`, closest to the latest
 * event first, then higher drama, then newest. Duplicate lines show once.
 * Pure function so the policy is unit-tested.
 */
export function selectBubbles(cands: readonly BubbleCandidate[], eventX: number, eventY: number, cap: number): number[] {
  const ranked = cands
    .map((c) => ({ c, d: Math.hypot(c.x - eventX, c.y - eventY) }))
    .sort((a, b) => a.d - b.d || b.c.priority - a.c.priority || b.c.bornAt - a.c.bornAt);
  const out: number[] = [];
  const texts = new Set<string>();
  for (const { c } of ranked) {
    if (out.length >= cap) break;
    if (texts.has(c.text)) continue;
    texts.add(c.text);
    out.push(c.id);
  }
  return out;
}

export interface ScreenRect {
  readonly id: number;
  x: number;
  y: number;
  readonly w: number;
  readonly h: number;
}

const GAP = 4;

/**
 * Pushes overlapping bubbles upward so none cover each other.
 * `y` is the bubble's bottom edge (its tail); rects are mutated in place.
 */
export function resolveOverlaps(rects: ScreenRect[]): void {
  rects.sort((a, b) => b.y - a.y); // lowest on screen first: it keeps its spot
  for (let i = 1; i < rects.length; i++) {
    const r = rects[i];
    if (!r) continue;
    for (let j = 0; j < i; j++) {
      const o = rects[j];
      if (!o) continue;
      const overlapX = Math.abs(r.x - o.x) < (r.w + o.w) / 2 + GAP;
      const overlapY = r.y > o.y - o.h - GAP && r.y - r.h < o.y + GAP;
      if (overlapX && overlapY) r.y = o.y - o.h - GAP;
    }
  }
}
