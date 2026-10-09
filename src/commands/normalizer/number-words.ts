/** Number words → digits ("five hundred" → "500", "a hundred and fifty" → "150"). */
const UNITS: Readonly<Record<string, number>> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Readonly<Record<string, number>> = { hundred: 100, thousand: 1000, million: 1_000_000 };

/** Quantity phrases (05 §4). Longest first. "a ton/a million" caps at 1000. */
export const QUANTITY_PHRASES: readonly [RegExp, string][] = [
  [/\bhalf a dozen\b/g, '6'],
  [/\b(?:a )?couple(?: of)?\b/g, '2'],
  [/\ba few\b/g, '3'],
  [/\bseveral\b/g, '6'],
  [/\bdozens of\b/g, '36'],
  [/\bhundreds of\b/g, '300'],
  [/\bthousands of\b/g, '1000'],
  [/\b(?:a ton of|tons of|a million|millions of|a gazillion|a zillion|a bazillion|a bajillion|infinite|infinity)\b/g, '1000'],
  [/\b(?:a bunch of|bunch of|lots of|a lot of|loads of|plenty of|heaps of|a load of|many|a swarm of|a herd of|a flock of|an army of)\b/g, '25'],
  [/\ba dozen\b/g, '12'],
];

/** Converts runs of number words in a token list into digit tokens. */
export function convertNumberWords(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i] ?? '';
    const next = tokens[i + 1] ?? '';
    const startsNumber = t in UNITS || t in SCALES || ((t === 'a' || t === 'an') && next in SCALES);
    if (!startsNumber) {
      out.push(t);
      i++;
      continue;
    }
    let total = 0;
    let current = 0;
    let used = 0;
    while (i < tokens.length) {
      const w = tokens[i] ?? '';
      const after = tokens[i + 1] ?? '';
      if (w in UNITS) current += UNITS[w] ?? 0;
      else if (w === 'hundred') current = (current || 1) * 100;
      else if (w in SCALES) {
        total += (current || 1) * (SCALES[w] ?? 1);
        current = 0;
      } else if ((w === 'a' || w === 'an') && used === 0 && after in SCALES) current = 0;
      else if (w === 'and' && used > 0 && (after in UNITS)) { /* "a hundred and fifty" */ }
      else break;
      used++;
      i++;
    }
    out.push(String(total + current));
  }
  return mergeDozens(out);
}

/** "2 dozen" → "24", lone "dozen" → "12". */
function mergeDozens(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if ((t === 'dozen' || t === 'dozens') && prev !== undefined && /^\d+$/.test(prev)) out[out.length - 1] = String(Number(prev) * 12);
    else if (t === 'dozen') out.push('12');
    else out.push(t);
  }
  return out;
}
