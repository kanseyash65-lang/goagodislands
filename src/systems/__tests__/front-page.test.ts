import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng/mulberry32';
import { generateFrontPage, tuesdayDate, type NewsInput } from '../newspaper/front-page-generator';

const base: NewsInput = {
  lead: { text: 'Gravity has been deleted.', reaction: 'gravityOff', subject: 'gravity', affected: 0 },
  others: ['500 chickens appeared.', 'The sun is now green.'],
  weather: 'rain',
  normalcy: 12.4,
  day: 1,
  edition: 3,
  witness: 'Martha Plum',
};

describe('The Daily Tuesday', () => {
  it('writes a deadpan front page for the lead event', () => {
    const p = generateFrontPage(base, createRng(1));
    expect(p.masthead).toBe('THE DAILY TUESDAY');
    expect(p.headline).toBe(p.headline.toUpperCase());
    expect(p.headline).toMatch(/GRAVITY|LADDER|FLOATS|UP AND DOWN/);
    expect(p.lead).toContain('gravity has been deleted.');
    expect(p.lead).toContain('12%');
    expect(p.stories.map((s) => s.title)).toEqual(['500 CHICKENS APPEARED', 'THE SUN IS NOW GREEN']);
    expect(p.quote).toContain('Martha Plum');
    expect(p.weather).toMatch(/^Rain\. Chance of .+: \d+%\.$/);
    expect(p.caption).toContain(p.headline);
  });
  it('fills subject and count slots', () => {
    const p = generateFrontPage({ ...base, lead: { text: '500 chickens appeared.', reaction: 'chickens', subject: 'chickens', affected: 500 } }, createRng(2));
    expect(p.headline).not.toMatch(/\{[SN]\}/);
  });
  it('handles a quiet day without a lead', () => {
    const { lead: _lead, ...rest } = base;
    expect(generateFrontPage({ ...rest, others: [] }, createRng(3)).headline).toBe('NOTHING HAPPENED; RESIDENTS RELIEVED');
  });
  it('dates: every day is a Tuesday, one week apart', () => {
    expect(tuesdayDate(1)).toBe('TUESDAY, 6 OCTOBER · YEAR 1');
    expect(tuesdayDate(2)).toBe('TUESDAY, 13 OCTOBER · YEAR 1');
    expect(tuesdayDate(5)).toBe('TUESDAY, 3 NOVEMBER · YEAR 1');
    expect(tuesdayDate(14)).toBe('TUESDAY, 5 JANUARY · YEAR 2');
  });
});
