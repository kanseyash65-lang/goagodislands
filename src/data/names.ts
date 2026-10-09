import type { IRng } from '../core/rng/mulberry32';

/** Procedural villager names: curated list + syllable combos + trade surnames. */
const CURATED = [
  'Martha', 'Borin', 'Edna', 'Gregor', 'Pim', 'Odile', 'Hamish', 'Wren', 'Tobias', 'Ines',
  'Fennick', 'Agatha', 'Ludo', 'Mabel', 'Osric', 'Prue', 'Quill', 'Rosalind', 'Silas', 'Tilda',
  'Ulric', 'Vera', 'Walt', 'Yara', 'Bertram', 'Clementine', 'Dorian', 'Elsie', 'Florin', 'Gwen',
  'Horace', 'Ivy', 'Jasper', 'Kit', 'Lorna', 'Milo', 'Nell', 'Otto', 'Petra', 'Rufus',
];
const FIRST_A = ['Mar', 'Bo', 'Ed', 'Gre', 'Pi', 'Ul', 'Wi', 'Ta', 'Fe', 'Ro', 'Ha', 'Li'];
const FIRST_B = ['tha', 'rin', 'na', 'gor', 'mo', 'ric', 'nnie', 'bby', 'lix', 'sa', 'mish', 'da'];
const SURNAMES = [
  'Thatcher', 'Miller', 'Chickenworth', 'Barley', 'Puddle', 'Fernsby', 'Cobble', 'Wickham',
  'Plum', 'Oddsock', 'Tuesdale', 'Hayward', 'Brambles', 'Kettle', 'Mudd', 'Turnip',
];

export function generateName(rng: IRng): string {
  const first = rng.chance(0.65) ? rng.pick(CURATED) : `${rng.pick(FIRST_A)}${rng.pick(FIRST_B)}`;
  return `${first} ${rng.pick(SURNAMES)}`;
}

export function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}
