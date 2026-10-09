import { LABEL_SLOTS } from '../../core/config/render.config';

/**
 * Text labels for Improv "Things" (e.g. "pineapple"). Holds a small fixed set of
 * slots with LRU reuse; the renderer paints slot text into the atlas lazily,
 * using `version` to detect changes.
 */
export class LabelRegistry {
  readonly texts: string[] = new Array<string>(LABEL_SLOTS).fill('');
  version = 0;
  private readonly lastUsed: number[] = new Array<number>(LABEL_SLOTS).fill(0);
  private tick = 0;

  /** Returns the slot for a word, assigning (and possibly evicting) one if needed. */
  slotFor(word: string): number {
    const text = word.trim().slice(0, 18);
    this.tick++;
    let slot = this.texts.indexOf(text);
    if (slot < 0) {
      slot = this.oldestSlot();
      this.texts[slot] = text;
      this.version++;
    }
    this.lastUsed[slot] = this.tick;
    return slot;
  }

  private oldestSlot(): number {
    let best = 0;
    let bestTick = Infinity;
    for (let i = 0; i < LABEL_SLOTS; i++) {
      const t = this.lastUsed[i] ?? 0;
      if (t < bestTick) {
        bestTick = t;
        best = i;
      }
    }
    return best;
  }
}
