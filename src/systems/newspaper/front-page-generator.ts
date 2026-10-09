import type { ReactionKind } from '../../core/events/event-types';
import type { IRng } from '../../core/rng/mulberry32';
import { REACTION_LINES } from '../../data/dialogue';
import { ABSURD_CHANCES, BRIEFS, CLASSIFIEDS, HEADLINES, LEAD_TEMPLATES, STORY_TAILS, SUBHEADS } from '../../data/headlines';
import { WEATHER_LABEL, type WeatherKind } from '../../types/weather';

/** Everything the newspaper needs, gathered by the UI from read-only sources. */
export interface NewsInput {
  readonly lead?: { readonly text: string; readonly reaction: ReactionKind; readonly subject: string; readonly affected: number };
  readonly others: readonly string[];
  readonly weather: WeatherKind;
  readonly normalcy: number;
  readonly day: number;
  readonly edition: number;
  readonly witness: string;
}

export interface FrontPage {
  readonly masthead: string;
  readonly dateLine: string;
  readonly headline: string;
  readonly subhead: string;
  readonly lead: string;
  readonly quote: string;
  readonly stories: readonly { readonly title: string; readonly body: string }[];
  readonly weather: string;
  readonly classified: string;
  readonly briefs: readonly string[];
  readonly caption: string;
}

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const FIRST_TUESDAY = { month: 9, day: 6 }; // 6 October: the first Tuesday on record
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const STORY_TITLE_MAX = 42;
const BRIEF_COUNT = 4;

function pickDistinct(pool: readonly string[], n: number, rng: IRng): string[] {
  const out = new Set<string>();
  for (let guard = 0; out.size < Math.min(n, pool.length) && guard < 50; guard++) out.add(rng.pick(pool));
  return [...out];
}

/**
 * In-world date. Every game day is a Tuesday, so each new day jumps a week:
 * "TUESDAY, 6 OCTOBER", then "TUESDAY, 13 OCTOBER"…
 */
export function tuesdayDate(day: number): string {
  let m = FIRST_TUESDAY.month;
  let d = FIRST_TUESDAY.day + (Math.max(1, day) - 1) * 7;
  let year = 1;
  while (d > (DAYS_IN_MONTH[m] ?? 30)) {
    d -= DAYS_IN_MONTH[m] ?? 30;
    m++;
    if (m > 11) {
      m = 0;
      year++;
    }
  }
  return `TUESDAY, ${d} ${MONTHS[m] ?? 'OCTOBER'} · YEAR ${year}`;
}

function fill(t: string, subject: string, n: number): string {
  return t.split('{S}').join(subject).split('{N}').join(String(n));
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function storyTitle(text: string): string {
  const first = text.split(/[.!?]/)[0] ?? text;
  return (first.length > STORY_TITLE_MAX ? `${first.slice(0, STORY_TITLE_MAX - 1)}…` : first).toUpperCase();
}

/** Writes the front page. Pure + deterministic for a given rng state. */
export function generateFrontPage(input: NewsInput, rng: IRng): FrontPage {
  const lead = input.lead;
  const reaction = lead?.reaction ?? 'generic';
  const subject = lead?.subject || 'something';
  const pool = HEADLINES[reaction] ?? HEADLINES.generic ?? ['Average Tuesday reported'];
  const headline = lead ? fill(rng.pick(pool), subject, lead.affected).toUpperCase() : 'NOTHING HAPPENED; RESIDENTS RELIEVED';
  const leadText = lead
    ? rng.pick(LEAD_TEMPLATES).replace('{T}', lowerFirst(lead.text)).replace('{P}', String(Math.round(input.normalcy)))
    : 'A quiet day. Residents are suspicious of it.';
  const quoteBank = REACTION_LINES[reaction].length > 0 ? REACTION_LINES[reaction] : REACTION_LINES.generic;
  const quote = `"${fill(rng.pick(quoteBank).split('{thing}').join(subject), subject, lead?.affected ?? 0)}" — ${input.witness}`;
  const stories = input.others.slice(0, 3).map((t) => ({ title: storyTitle(t), body: `${t} ${rng.pick(STORY_TAILS)}` }));
  const weather = `${WEATHER_LABEL[input.weather]}. Chance of ${rng.pick(ABSURD_CHANCES)}: ${rng.int(12, 97)}%.`;
  return {
    masthead: 'THE DAILY TUESDAY',
    dateLine: `${tuesdayDate(input.day)} · EDITION NO. ${input.edition} · PRICE: ONE CHICKEN`,
    headline,
    subhead: rng.pick(SUBHEADS),
    lead: leadText,
    quote,
    stories,
    weather,
    classified: rng.pick(CLASSIFIEDS),
    briefs: pickDistinct(BRIEFS, BRIEF_COUNT, rng),
    caption: `THE DAILY TUESDAY: ${headline}. #GoaGodIslands #BuiltByVoice`,
  };
}
