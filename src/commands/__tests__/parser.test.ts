import { describe, expect, it } from 'vitest';
import { parseTranscript, type ParseContext } from '../parser/parser';
import type { Command } from '../types';

let nextId = 1;
const ctx = (hasLastTarget = false): ParseContext => ({ names: ['Martha', 'Borin'], hasLastTarget, nextId: () => nextId++ });
const one = (text: string, last = false): Command => {
  const cmds = parseTranscript(text, 'text', ctx(last));
  expect(cmds.length).toBeGreaterThan(0);
  return cmds[0] as Command;
};
const kindOf = (c: Command): string | undefined => (c.target.type === 'kind' ? c.target.kind : c.target.type === 'tag' ? `#${c.target.tag}` : undefined);
const colorOf = (c: Command): string | undefined => (c.value?.type === 'color' ? c.value.name : undefined);

describe('sky / colour variants → same command', () => {
  const variants = ['turn the sun green', 'make the sun green', 'change the sun to green', 'color the sun green', 'sun green',
    'Turn the sun green.', 'um, turn the sun green please', 'Reality, make the sun green!', 'paint the sun green', 'turn the son green'];
  it.each(variants)('%s', (text) => {
    const c = one(text);
    expect(c.intent).toBe('modify');
    expect(kindOf(c)).toBe('sun');
    expect(c.property).toBe('color');
    expect(colorOf(c)).toBe('green');
  });
  it('sky purple → sun colour (world tint)', () => {
    const c = one('make the sky purple');
    expect(kindOf(c)).toBe('sun');
    expect(colorOf(c)).toBe('purple');
  });
  it('colour modifiers', () => expect(colorOf(one('make the cows dark blue'))).toBe('dark blue'));
  it('rainbow special', () => {
    const c = one('make the chickens rainbow');
    expect(c.value?.type === 'color' && c.value.special).toBe('rainbow');
  });
  it('invisible special', () => expect(one('make the houses invisible').value).toMatchObject({ special: 'invisible' }));
  it('colour alone recolours the sky', () => expect(kindOf(one('purple'))).toBe('sun'));
});

describe('numbers & spawning', () => {
  const cases: [string, string, number][] = [
    ['spawn 500 chickens', 'chicken', 500], ['spawn fifty chickens', 'chicken', 50], ['a hundred ducks', 'duck', 100],
    ['two dozen cows', 'cow', 24], ['spawn five hundred chickens', 'chicken', 500], ['add 10 cows', 'cow', 10],
    ['summon a dragon', 'dragon', 1], ['a dragon', 'dragon', 1], ['spawn a couple of cows', 'cow', 2],
    ['spawn a few fish', 'fish', 3], ['create several dogs', 'dog', 6], ['spawn a dozen cats', 'cat', 12],
    ['make 20 ducks', 'duck', 20], ['build a fort', 'fort-tower', 1], ['build 5 houses', 'house', 5],
    ['spawn three thousand chickens', 'chicken', 600], ['spawn a ton of chickens', 'chicken', 600],
    ['let there be 30 cows', 'cow', 30], ['twenty five birds', 'crow', 25], ['spawn a hundred and fifty ducks', 'duck', 150],
    ['spawn chickens', 'chicken', 8], ['spawn 1,000 chickens', 'chicken', 600],
  ];
  it.each(cases)('%s', (text, kind, q) => {
    const c = one(text);
    expect(c.intent).toBe('spawn');
    expect(kindOf(c)).toBe(kind);
    expect(c.quantity).toBe(q);
  });
  it('spawn with where', () => {
    const c = one('spawn 20 ducks near the beach');
    expect(c.where?.anchor).toBe('beach');
    expect(c.quantity).toBe(20);
  });
  it('spawn with modifiers', () => {
    const c = one('spawn 10 giant blue chickens');
    expect(c.extras?.map((e) => e.type).sort()).toEqual(['color', 'size']);
  });
  it('spawn magnitude scales with quantity', () => {
    expect(one('spawn 500 chickens').magnitude).toBeGreaterThan(7);
    expect(one('spawn 2 chickens').magnitude).toBeLessThan(5);
  });
  it('accessory', () => {
    const c = one('a dragon wearing a tiny hat');
    expect(c.intent).toBe('spawn');
    expect(kindOf(c)).toBe('dragon');
    expect(c.accessory).toBe('tiny hat');
  });
});

describe('destroy / modify / behaviour', () => {
  it('delete all chickens', () => expect([one('delete all chickens').intent, kindOf(one('delete all chickens'))]).toEqual(['destroy', 'chicken']));
  it('remove the trees', () => expect(kindOf(one('remove the trees'))).toBe('#tree'));
  it('get rid of the cows', () => expect(one('get rid of the cows').intent).toBe('destroy'));
  it('destroy the windmill', () => expect(kindOf(one('destroy the windmill'))).toBe('windmill'));
  it('make everyone giant', () => {
    const c = one('make everyone giant');
    expect([c.intent, c.property, kindOf(c)]).toEqual(['modify', 'size', '#human']);
  });
  it('tiny cows', () => expect(one('make the cows tiny').value).toMatchObject({ type: 'size', factor: 0.4 }));
  it('make the chickens fast', () => expect(one('make the chickens fast').property).toBe('speed'));
  it('make them happy (pronoun)', () => {
    const c = one('make them happy', true);
    expect([c.target.type, c.property]).toEqual(['pronoun', 'mood']);
  });
  it('make it bigger (pronoun, relative)', () => {
    const c = one('make it bigger', true);
    expect(c.target.type).toBe('pronoun');
    expect(c.value).toMatchObject({ type: 'size', relative: true });
  });
  it('grow the trees', () => expect(one('grow the trees').value).toMatchObject({ type: 'size', relative: true }));
  it('make everyone dance', () => expect(one('make everyone dance').value).toMatchObject({ type: 'behavior', behavior: 'dance' }));
  it('everyone dance', () => expect(one('everyone dance').intent).toBe('behavior'));
  it('dance', () => expect(kindOf(one('dance'))).toBe('#human'));
  it('everyone panic', () => expect(one('everyone panic').value).toMatchObject({ behavior: 'panic' }));
  it('make the villagers sleep', () => expect(one('make the villagers sleep').value).toMatchObject({ behavior: 'sleep' }));
  it('celebrate', () => expect(one('celebrate').value).toMatchObject({ behavior: 'celebrate' }));
  it('named villager', () => {
    const c = one('make martha giant');
    expect(c.target).toMatchObject({ type: 'name', name: 'Martha' });
  });
  it('turn the cows into dragons', () => {
    const c = one('turn the cows into dragons');
    expect(c.intent).toBe('transform');
    expect(c.value).toMatchObject({ type: 'into', into: { kind: 'dragon' } });
  });
  it('yeet the cows', () => expect(one('yeet the cows').intent).toBe('move'));
  it('move the cows to the jetty', () => expect(one('move the cows to the jetty').where?.anchor).toBe('jetty'));
  it('give everyone money', () => expect(one('give everyone money').value).toMatchObject({ type: 'gift', gift: 'coins' }));
  it('heal everyone', () => expect(one('heal everyone').intent).toBe('heal'));
  it('for duration', () => expect(one('make everyone dance for 10 seconds').duration).toBe(10));
});

describe('weather / time / physics / camera / meta', () => {
  const weather: [string, string][] = [['make it rain', 'rain'], ['rain', 'rain'], ['storm', 'storm'], ['make it snow', 'snow'],
    ["it's foggy", 'fog'], ['sunny', 'clear'], ['start a thunderstorm', 'storm'], ['clear skies', 'clear'], ['blizzard', 'snow']];
  it.each(weather)('%s', (text, w) => expect(one(text).value).toMatchObject({ type: 'weather', weather: w }));
  it('rain pizza → item rain', () => expect(one('rain pizza').value).toMatchObject({ weather: 'rain', item: { kind: 'pizza' } }));
  it('make it rain fish', () => expect(one('make it rain fish').value).toMatchObject({ item: { kind: 'fish' } }));
  it("it's raining pineapples", () => expect(one("it's raining pineapples").value).toMatchObject({ item: { type: 'thing', word: 'pineapple' } }));
  const times: [string, string][] = [['make it night', 'set'], ['noon', 'set'], ['speed up time', 'scale'], ['stop time', 'freeze'],
    ['freeze time', 'freeze'], ['resume time', 'resume'], ["it's friday", 'friday'], ['make it morning', 'set'], ['slow down time', 'scale']];
  it.each(times)('%s', (text, kind) => {
    const c = one(text);
    expect(c.intent).toBe('time');
    expect(c.value?.type === 'time' && c.value.time.kind).toBe(kind);
  });
  const gravity: [string, number][] = [['delete gravity', 0], ['turn off gravity', 0], ['no gravity', 0], ['reverse gravity', -1],
    ['low gravity', 0.25], ['heavy gravity', 3], ['turn gravity back on', 1], ['restore gravity', 1], ['zero g', 0], ['remove gravity', 0], ['zero gravity', 0], ['gravity off', 0]];
  it.each(gravity)('%s', (text, g) => expect(one(text).value).toMatchObject({ type: 'gravity', gravity: g }));
  const camera: [string, string][] = [['zoom in', 'zoom-in'], ['zoom out', 'zoom-out'], ['show everything', 'overview'],
    ["bird's eye view", 'overview'], ['show me the chickens', 'focus'], ['zoom in on the windmill', 'focus'], ['follow martha', 'focus']];
  it.each(camera)('%s', (text, a) => expect(one(text).value).toMatchObject({ type: 'camera', action: a }));
  const meta: [string, string][] = [['undo', 'undo'], ['undo that', 'undo'], ['show the newspaper', 'newspaper'], ['front page', 'newspaper'],
    ['help', 'help'], ['do that again', 'repeat'], ['more', 'more'], ['remember this as apocalypse', 'remember'], ['cast apocalypse', 'cast']];
  it.each(meta)('%s', (text, a) => expect(one(text).value).toMatchObject({ type: 'meta', action: a }));
  it('more chickens is a spawn, not meta', () => expect(one('more chickens').intent).toBe('spawn'));
});

describe('chaining, fillers, self-correction', () => {
  it('make it rain, then make everyone dance', () => {
    const cmds = parseTranscript('Make it rain, then make everyone dance.', 'voice', ctx());
    expect(cmds.map((c) => c.intent)).toEqual(['weather', 'behavior']);
    expect(cmds[1]?.chainIndex).toBe(1);
  });
  it('three-part chain', () => {
    const cmds = parseTranscript('make it rain, then spawn 20 ducks and turn the sun green', 'voice', ctx());
    expect(cmds.map((c) => c.intent)).toEqual(['weather', 'spawn', 'modify']);
  });
  it('sentences split', () => expect(parseTranscript('Delete gravity. Spawn 10 cows.', 'voice', ctx()).length).toBe(2));
  it('"ducks and cows" does not split', () => expect(parseTranscript('spawn ducks and cows', 'voice', ctx()).length).toBe(1));
  it('"next to" does not split', () => expect(parseTranscript('spawn ducks next to the river', 'voice', ctx()).length).toBe(1));
  it('self-correction', () => expect(one('make it rain no wait make it snow').value).toMatchObject({ weather: 'snow' }));
  it('fillers', () => expect(one('okay so um could you please spawn 5 cows').quantity).toBe(5));
  it('homophone docks → ducks', () => expect(kindOf(one('spawn 10 docks'))).toBe('duck'));
  it('fuzzy noun', () => expect(kindOf(one('spawn 10 chikens'))).toBe('chicken'));
});

describe('Improv Engine: garbage never throws', () => {
  it('asdf pineapples → pineapple Things', () => {
    const c = one('asdf pineapples');
    expect(c.improv).toBe('thing');
    expect(c.target).toMatchObject({ type: 'thing', word: 'pineapple' });
    expect(c.quantity).toBe(5);
  });
  it('spawn 20 pineapples', () => {
    const c = one('spawn 20 pineapples');
    expect([c.intent, c.quantity]).toEqual(['spawn', 20]);
    expect(c.target).toMatchObject({ word: 'pineapple' });
  });
  it('unknown verb + known target → comic effect', () => expect(one('blorpify the cows').improv).toBe('comic'));
  it('make the sun a pineapple → salvage', () => expect(one('make the sun a pineapple').improv).toBe('salvage'));
  const garbage = ['asdf qwerty', '', '   ', '🙂', '!!!???', 'x'.repeat(5000), 'the the the', '12345', 'zzzzzz', '\u0000\u0007',
    'DROP TABLE villagers;', '<script>alert(1)</script>', 'and then then then and'];
  it.each(garbage)('garbage %#', (text) => {
    expect(() => parseTranscript(text, 'text', ctx())).not.toThrow();
    const cmds = parseTranscript(text, 'text', ctx());
    expect(cmds.length).toBeGreaterThan(0);
  });
  it('1000 parses < 1 s', () => {
    const phrases = ['turn the sun green', 'spawn 500 chickens', 'make it rain, then make everyone dance', 'delete gravity', 'asdf pineapples'];
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) parseTranscript(phrases[i % phrases.length] ?? '', 'text', ctx());
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe('god powers (mission 1)', () => {
  it('increase the HP of the villagers', () => {
    const c = one('God, increase the HP of the villagers');
    expect(c.intent).toBe('modify');
    expect(c.property).toBe('health');
    expect(c.target).toMatchObject({ type: 'tag', tag: 'human' });
  });
  it('make the villagers stronger', () => expect(one('make the villagers stronger').property).toBe('health'));
  const miracles = ['God, do something', 'do something', 'help us', 'save the village', 'kill the enemies', 'God help us'];
  it.each(miracles)('%s', (text) => expect(one(text).intent).toBe('miracle'));
  it('enemy noun resolves to the raider tag', () => expect(one('strike the enemies with lightning').target).toMatchObject({ type: 'tag', tag: 'enemy' }));
  it('make it rain stays weather', () => expect(one('make it rain').value).toMatchObject({ type: 'weather', weather: 'rain' }));
});

describe('enemy boat', () => {
  it.each(['strike the enemy boat with lightning', 'hit the raider ship with lightning', 'strike the pirate ship with lightning'])('%s', (text) =>
    expect(one(text).target).toMatchObject({ type: 'kind', kind: 'gunboat' }));
});

describe('god power phrases (as shown in the HUD)', () => {
  it('Increase the HP of villagers', () => expect(one('Increase the HP of villagers')).toMatchObject({ intent: 'modify', property: 'health' }));
  it('Strike the enemy boat', () => {
    const c = one('Strike the enemy boat');
    expect(c.intent).toBe('disaster');
    expect(c.target).toMatchObject({ type: 'kind', kind: 'gunboat' });
  });
  it('Spawn 6 soldiers near the village', () => expect(one('Spawn 6 soldiers near the village')).toMatchObject({ intent: 'spawn', quantity: 6 }));
  it('Heal the villagers', () => expect(one('Heal the villagers').intent).toBe('heal'));
});

describe('creative battle commands', () => {
  it('turn the enemies into chickens', () => {
    const c = one('Turn the enemies into chickens');
    expect(c.intent).toBe('transform');
    expect(c.target).toMatchObject({ type: 'tag', tag: 'enemy' });
    expect(c.value).toMatchObject({ type: 'into', into: { kind: 'chicken' } });
  });
  it('summon a dragon', () => expect(one('Summon a dragon')).toMatchObject({ intent: 'spawn', target: { kind: 'dragon' } }));
  const disasters: [string, string][] = [['earthquake', 'earthquake'], ['send a tsunami', 'flood'], ['meteor shower on the raiders', 'meteor'], ['lightning strike', 'lightning'], ['cause an earthquake', 'earthquake']];
  it.each(disasters)('%s', (text, d) => {
    const c = one(text);
    expect(c.intent).toBe('disaster');
    expect(c.value).toMatchObject({ type: 'disaster', disaster: d });
    expect(c.target).toMatchObject({ type: 'tag', tag: 'enemy' });
  });
  it('lightning storm is still weather', () => expect(one('lightning storm').intent).toBe('weather'));
  it('pause', () => expect(one('pause the game').value).toMatchObject({ type: 'meta', action: 'pause' }));
});
