import { MAX_CHAIN_LENGTH } from '../../core/config/command.config';
import { LEX } from './lexicon';

const CHAIN_WORDS = /\s*,?\s*\b(?:and then|then|after that|afterwards|and also|followed by)\b\s*/g;

/**
 * Splits one dictation into chained commands (05 §10):
 * ";" (sentence ends), "then"/"after that"/…, and "," or "and" only when the
 * right-hand side starts with a known verb (so "ducks and cows" stays one).
 */
export function splitChain(normalized: string): string[] {
  const parts: string[] = [];
  for (const sentence of normalized.split(';')) {
    for (const piece of sentence.split(CHAIN_WORDS)) {
      parts.push(...splitOnVerbBoundaries(piece));
    }
  }
  return parts
    .map((p) => p.replace(/,/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_CHAIN_LENGTH);
}

function splitOnVerbBoundaries(piece: string): string[] {
  const out: string[] = [];
  const tokens = piece.replace(/,/g, ' , ').split(/\s+/).filter((t) => t.length > 0);
  let cur: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] ?? '';
    if ((t === ',' || t === 'and') && cur.length > 0 && startsCommand(tokens, i + 1)) {
      out.push(cur.join(' '));
      cur = [];
      continue;
    }
    cur.push(t);
  }
  if (cur.length > 0) out.push(cur.join(' '));
  return out;
}

function startsCommand(tokens: readonly string[], i: number): boolean {
  let j = i;
  while (tokens[j] === ',' || tokens[j] === 'and') j++;
  const clean = tokens.slice(j, j + 4).map((t) => t.replace(/'/g, ''));
  if (clean.length === 0) return false;
  const verb = LEX.verbs.match(clean, 0);
  return verb !== undefined || LEX.meta.match(clean, 0) !== undefined || (clean[0] === 'everyone' && clean.length > 1);
}
