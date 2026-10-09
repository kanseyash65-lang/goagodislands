import type { ReactionKind } from '../core/events/event-types';

/**
 * Dialogue banks (03_WORLD_LORE_AND_NPC §13). Deadpan only: no "LOL", no emoji.
 * `{thing}` is replaced with the event subject ("chickens", "green", "pineapple").
 */
export const AMBIENT_LINES: readonly string[] = [
  'Lovely weather for the time of year.',
  "Did you feed the chickens? I can't remember.",
  "I've got a good feeling about this Tuesday.",
  'Taxes are due. Somewhere.',
  'The well tastes of well again.',
  'I should fix that fence. Next Tuesday.',
  'Busy day. Same as yesterday. Also a Tuesday.',
  'My knees predict rain. My knees are often wrong.',
  'Has anyone seen my good bucket?',
  "Another day, another turnip.",
];

export const NIGHT_LINES: readonly string[] = [
  'Is it bedtime? It feels like bedtime.',
  "Goodnight, Tuesday. See you tomorrow, Tuesday.",
];

export const REACTION_LINES: Readonly<Record<ReactionKind, readonly string[]>> = {
  sky: [
    "I've never trusted {thing} suns.",
    'It was yellow yesterday. I am almost sure.',
    'Good for the crops. Probably.',
    "The sky is {thing} now. We're not discussing it.",
  ],
  color: [
    'Was it always {thing}? Be honest.',
    "{thing}. Bold choice. Not mine, but bold.",
    'I liked the old colour. Nobody asked me.',
  ],
  gravityOff: [
    'I forgot my ladder.',
    'I preferred yesterday.',
    'My hat left. Without me.',
    'Has anyone seen the cow? Upward, I think.',
    "Don't put the bread down. Bread is not secure.",
  ],
  gravityReverse: [
    "The sky is now the floor. I'm adjusting.",
    'Look on the bright side. The ceiling is very big.',
  ],
  gravityOn: [
    'Oof.',
    'Gravity is back. It did not apologise.',
    'I landed on my lunch.',
  ],
  chickens: [
    "We'll need a bigger farm.",
    "That's more chickens than the village has opinions.",
    'I counted forty and then lost the will.',
    'Egg prices are going to be a problem.',
  ],
  spawnMany: [
    'That is a lot of {thing}.',
    'Where did all these {thing} come from? Never mind.',
    "I'll put the kettle on. For the {thing}.",
  ],
  spawn: [
    'Was that {thing} there before?',
    'Oh. A {thing}. Right.',
    "I'm sure there's paperwork for this.",
  ],
  rain: ["It's raining. In Tuesday, that's unusual.", 'My crops are delighted. I am not.'],
  snow: ['Snow. In Tuesday. I left my scarf in Monday.', 'My nose has stopped talking to me.'],
  weather: ['The weather has opinions today.', 'I dressed for a different sky.'],
  itemRain: [
    'It is raining {thing}. I brought the wrong umbrella.',
    'Forecast said light {thing}. This is heavy {thing}.',
    'I am filing a complaint with the weather.',
  ],
  dance: ["I didn't plan to dance today but here we are.", 'My legs have made a decision.'],
  behavior: ['I am doing this for reasons I do not have.', 'This feels like a Tuesday decision.'],
  time: ['Is it Tuesday? It feels like Tuesday.', 'Time is moving. Quickly. I did not consent.'],
  improv: [
    "Something happened. I'm choosing not to ask.",
    'That felt like a Tuesday decision.',
    'Reality is... complicated today.',
    'Is that a {thing}? It looks like a {thing}.',
  ],
  dragon: [
    "I'm sure it's friendly. Please don't make eye contact.",
    'Has anyone checked if it has a permit?',
    "It's looking at the windmill. I'm getting my coat.",
  ],
  destroy: ['Where did the {thing} go?', 'We had so many {thing}. Now we have memories.', 'Gone. Like my Monday.'],
  size: ['Was it always that size?', 'Proportions are just a suggestion today.'],
  blessing: ['I feel... fine? Unusually fine.', 'Something nice happened. Suspicious.'],
  harm: ['Ow. Mildly.', 'I felt that in my paperwork.'],
  disaster: ['Not again. We just rebuilt.', 'Someone fetch the bucket. The other bucket.'],
  generic: ['Huh.', 'Well, that happened.', 'I hope next Tuesday is quieter.'],
  none: [],
};

/** Escalating acceptance: used once a reaction kind has happened a few times. */
export const HABITUATION_LINES: readonly string[] = [
  'Another miracle. Put it with the others.',
  "Honestly, it's been a quiet week.",
  'I hope next Tuesday is quieter.',
  'Yes, yes. Very impressive. Moving on.',
];
