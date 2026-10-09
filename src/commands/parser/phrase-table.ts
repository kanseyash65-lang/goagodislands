/**
 * Longest-match phrase lookup over token arrays, with plural fallback and
 * Damerau-Levenshtein fuzzy matching for single words (05 §6).
 */
export interface PhraseMatch<T> {
  readonly value: T;
  readonly len: number;
  readonly key: string;
  readonly fuzzy: boolean;
}

export class PhraseTable<T> {
  private readonly map = new Map<string, T>();
  private readonly singles: string[] = [];
  readonly maxLen: number;

  constructor(entries: readonly (readonly [string, T])[]) {
    let max = 1;
    for (const [k, v] of entries) {
      if (!this.map.has(k)) this.map.set(k, v);
      const n = k.split(' ').length;
      max = Math.max(max, n);
      if (n === 1) this.singles.push(k);
    }
    this.maxLen = max;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): T | undefined {
    return this.map.get(key);
  }

  /** Exact longest match starting at `start` (plural "s"/"es" stripped for single words). */
  match(tokens: readonly string[], start: number): PhraseMatch<T> | undefined {
    for (let len = Math.min(this.maxLen, tokens.length - start); len >= 1; len--) {
      const key = tokens.slice(start, start + len).join(' ');
      const v = this.map.get(key);
      if (v !== undefined) return { value: v, len, key, fuzzy: false };
    }
    const t = tokens[start];
    if (t === undefined) return undefined;
    for (const base of singularForms(t)) {
      const v = this.map.get(base);
      if (v !== undefined) return { value: v, len: 1, key: base, fuzzy: false };
    }
    return undefined;
  }

  /** Fuzzy single-word match: distance ≤ 2 for words ≥ 5 chars, ≤ 1 for 4 chars. */
  fuzzy(token: string): PhraseMatch<T> | undefined {
    const maxD = token.length >= 5 ? 2 : token.length === 4 ? 1 : 0;
    if (maxD === 0) return undefined;
    let best: string | undefined;
    let bestD = maxD + 1;
    for (const k of this.singles) {
      if (Math.abs(k.length - token.length) > maxD || k.length < 4) continue;
      const d = damerauLevenshtein(token, k, bestD);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best === undefined) return undefined;
    const v = this.map.get(best);
    return v === undefined ? undefined : { value: v, len: 1, key: best, fuzzy: true };
  }
}

export function singularForms(t: string): string[] {
  const out: string[] = [];
  if (t.endsWith('ies') && t.length > 4) out.push(`${t.slice(0, -3)}y`);
  if (t.endsWith('es') && t.length > 3) out.push(t.slice(0, -2));
  if (t.endsWith('s') && t.length > 3) out.push(t.slice(0, -1));
  return out;
}

/** Optimal-string-alignment distance with an early-exit bound. */
export function damerauLevenshtein(a: string, b: string, bound = Infinity): number {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) >= bound) return bound;
  let prev2 = new Array<number>(m + 1).fill(0);
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  let cur = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (prev2[j - 2] ?? 0) + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin >= bound) return bound;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[m] ?? bound;
}
