import { MAX_INPUT_CHARS } from '../../core/config/command.config';
import { convertNumberWords, QUANTITY_PHRASES } from './number-words';

/**
 * Cleans messy dictated speech (Wispr Flow output): case, punctuation,
 * fillers, self-corrections, spelling variants, homophones, number words.
 * Sentence punctuation becomes ";" so the splitter can chain it. Never throws.
 */
const SELF_CORRECTION = /\b(?:no wait|no no|wait no|actually no|actually|i mean|scratch that|sorry i mean|correction|or rather|no sorry)\b[,]?/g;

const SPELLING: readonly [RegExp, string][] = [
  [/\bcolour/g, 'color'], [/\bgrey\b/g, 'gray'], [/\bcentre\b/g, 'center'],
  [/\bson\b/g, 'sun'], [/\bsuns\b/g, 'sun'], [/\bdocks?\b/g, 'ducks'], [/\bgravity's\b/g, 'gravity'],
  [/\bchicken's\b/g, 'chickens'], [/\bchickens'\b/g, 'chickens'], [/\bkitchens\b/g, 'chickens'],
  [/\bvillage errs\b/g, 'villagers'], [/\bbirds eye\b/g, "bird's eye"], [/\bthe moon's\b/g, 'the moon'],
];

const PHRASES: readonly [RegExp, string][] = [
  [/\bget rid of\b/g, 'delete'], [/\blet there be\b/g, 'spawn'], [/\bgive birth to\b/g, 'spawn'],
  [/\bmake it so that\b/g, 'make'], [/\bmake (?:there be|it so)\b/g, 'make'], [/\bthere should be\b/g, 'spawn'],
  [/\bi want to see\b/g, 'spawn'], [/\bwhat if\b/g, ''], [/\bhow about\b/g, ''],
  [/\bturn (?:it|everything) up\b/g, 'make everything bigger'],
];

const LEADING_FILLERS = /^(?:um+|uh+|erm|hmm+|okay|ok|hey|so|please|kindly|just|now|and|oh|well|alright|right|yo|dear|can you|could you|would you|will you|can we|could we|i want you to|i'd like you to|i would like you to|i need you to|let's|lets|let us|go ahead and|reality|god|universe|tuesday|computer)\b[\s,]*/;
const INLINE_FILLERS = /\b(?:please|kindly|um+|uh+|you know|basically|literally|thanks|thank you)\b/g;

export function normalize(raw: string): string {
  let s = String(raw ?? '').slice(0, MAX_INPUT_CHARS);
  // eslint-free control-char strip; emoji/symbols become spaces.
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').toLowerCase();
  s = s.replace(/[‘’ʼ`]/g, "'").replace(/[“”"]/g, ' ');
  s = s.replace(/(\d),(\d{3})/g, '$1$2');
  s = s.replace(/[.!?]+(?=\s|$)/g, ';').replace(/[^\p{L}\p{N}\s,;'-]/gu, ' ');
  s = applySelfCorrection(s);
  for (const [re, rep] of SPELLING) s = s.replace(re, rep);
  for (const [re, rep] of PHRASES) s = s.replace(re, rep);
  for (const [re, rep] of QUANTITY_PHRASES) s = s.replace(re, rep);
  s = s.replace(INLINE_FILLERS, ' ');
  s = s
    .split(';')
    .map((part) => cleanPart(part))
    .filter((p) => p.length > 0)
    .join(' ; ');
  return s.replace(/\s+/g, ' ').trim();
}

function applySelfCorrection(s: string): string {
  let last = -1;
  let lastLen = 0;
  for (const m of s.matchAll(SELF_CORRECTION)) {
    last = m.index ?? -1;
    lastLen = m[0].length;
  }
  if (last < 0) return s;
  const after = s.slice(last + lastLen).trim();
  return after.length > 0 ? after : s.slice(0, last);
}

function cleanPart(part: string): string {
  let p = part.replace(/\s+/g, ' ').trim();
  for (let guard = 0; guard < 6; guard++) {
    const next = p.replace(LEADING_FILLERS, '').trim();
    if (next === p) break;
    p = next;
  }
  p = p.replace(/^[,\s'-]+|[,\s'-]+$/g, '');
  const tokens = p.split(/\s+/).filter((t) => t.length > 0);
  return convertNumberWords(tokens).join(' ').replace(/\s+,/g, ',');
}
