import type { ReactionKind } from '../core/events/event-types';

/**
 * Newspaper templates (08 §7). Slots: {S} subject, {N} count. Headlines are
 * uppercased by the generator. Always deadpan: absurd event, serious tone.
 */
export const HEADLINES: Readonly<Partial<Record<ReactionKind, readonly string[]>>> = {
  sky: ['Local sun turns {S}; residents "mildly concerned"', '{S} sun reported. Council "monitoring the situation"', 'Sky changes colour without filing the forms'],
  color: ['Everything now {S}; nobody consulted', 'Village repainted {S} overnight. Painter denies involvement'],
  chickens: ['{N} chickens appear; farmers request "a bigger farm"', 'Chickens now outnumber opinions', 'Egg market braces for {N} new employees'],
  spawnMany: ['{N} {S} reported; council requests calm', 'Sudden {S} surplus baffles economists'],
  spawn: ['{S} appears. Paperwork pending', 'New {S} in town; neighbours "will bring a casserole"'],
  dragon: ['Dragon arrives; permit status unclear', 'Large lizard "probably friendly," says nobody'],
  gravityOff: ['Gravity cancelled; ladder sales soar', 'Village floats. Baker: "Do not put the bread down"', 'Up and down now "a matter of opinion"'],
  gravityReverse: ['Up is now down, confirms elder', 'Ceiling declared new floor'],
  gravityOn: ['Gravity returns; did not apologise', 'Everything falls back down. Several lunches lost'],
  itemRain: ['It rained {S}. Farmers file weather complaint', 'Forecast said light {S}; it was not light', '{S} falls from sky. Umbrella industry unprepared'],
  rain: ['It rained. In Tuesday', 'Wet weather; crops delighted, residents less so'],
  snow: ['Snow on a Tuesday. Scarves unavailable'],
  weather: ['Weather "having a day"', 'Sky does something; experts shrug'],
  dance: ['Entire village dances; nobody can explain why', 'Spontaneous dance ruled "not a crime"'],
  behavior: ['Villagers behave strangely; claim it was their idea'],
  time: ['Time behaves oddly; Tuesday continues', 'Clocks consulted. Clocks unhelpful'],
  destroy: ['All {S} gone. "We had so many," says farmer', '{S} vanish; investigation finds nothing, literally'],
  size: ['Proportions abandoned across village', 'Things now different sizes; tape measures confused'],
  disaster: ['Disaster strikes, briefly. Hats held', 'Calamity occurs; residents "have seen worse"'],
  improv: ['Local reality misunderstands request; {S} appears', 'Something happened. Residents "choosing not to ask"'],
  blessing: ['Everyone feels fine. Suspiciously fine'],
  harm: ['Villagers mildly inconvenienced; no injuries'],
  generic: ['Something happened; residents "choosing not to ask"', 'Average Tuesday reported. Again'],
};

export const SUBHEADS: readonly string[] = [
  'Officials confirm it is still Tuesday.',
  'Experts agree it is "probably fine".',
  'Council to meet, eventually, about it.',
  'Residents advised to carry on and hold onto hats.',
  'Witnesses describe the event as "a lot".',
  'Mayor unavailable for comment, believed to be napping.',
];

export const LEAD_TEMPLATES: readonly string[] = [
  'Residents reported that {T} Witnesses described the event as "fine", "probably fine", and "a Tuesday". Normalcy now stands at {P}%.',
  'In what officials are calling "an ordinary afternoon", {T} The village has responded with complete seriousness. Normalcy: {P}%.',
  'Sources close to the well confirm that {T} Life goes on. Normalcy is at {P}% and falling, or possibly rising.',
];

export const STORY_TAILS: readonly string[] = [
  'Officials declined to comment, citing lunch.',
  'A full investigation is planned for next Tuesday.',
  'Nobody was hurt. Several people were surprised.',
  'The council has formed a committee to form a committee.',
];

export const ABSURD_CHANCES: readonly string[] = ['chickens', 'pizza', 'opinions', 'more Tuesday', 'frogs', 'mild surprise', 'gravity'];

export const CLASSIFIEDS: readonly string[] = [
  'LOST: one gravity. If found, please return gently.',
  'WANTED: ladder. Gravity-related.',
  'FOR SALE: umbrella, pizza-proof, slightly used.',
  'FREE: 499 chickens to a good home. Must collect today.',
  'SEEKING: a normal day. Will pay well.',
  'LOST: hat. Last seen going up.',
  'WANTED: someone who remembers what colour the sun is.',
  'FOR SALE: map of the village, possibly outdated as of this morning.',
  'HELP WANTED: chicken counter. Must enjoy repetition.',
  'NOTICE: the bread is not secure. Do not put it down.',
  'FOUND: one dragon. Answers to nothing. Please collect.',
  'SWAP: one Tuesday for any Wednesday. Serious offers only.',
  'ROOM TO LET: recently floated, now landed. Minor damage.',
  'MISSING: sense of normalcy. Reward offered.',
  'FOR SALE: bucket. The other bucket.',
];

/** Filler briefs for the "In other news" column. */
export const BRIEFS: readonly string[] = [
  'Local man finds bucket. It was the other bucket.',
  'Well still wet, confirm inspectors.',
  'Council postpones meeting about postponing meetings.',
  'Turnip harvest “fine,” says turnip farmer, unprompted.',
  'Tavern introduces new drink: “Water, but on Tuesday.”',
  'Windmill continues to go round. Experts baffled, then not.',
  'Cat seen judging everyone. Investigation closed.',
  'Child asks why it is always Tuesday. Adults change the subject.',
  'Fence still needs fixing. Next Tuesday, say sources.',
  'Weather vane points in all directions, citing “recent events.”',
];
