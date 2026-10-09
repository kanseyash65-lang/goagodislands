import type { TargetSpec } from '../types';

/**
 * Noun table: kinds, groups (tags) and aliases → target spec (Goa edition).
 * Special tags resolved by team at execution time: `enemy` (raiders, team 2)
 * and `ally` (your troops, team 1). `human` spawns villagers, never soldiers.
 */
const kind = (k: string, label: string): TargetSpec => ({ type: 'kind', kind: k, label });
const tag = (t: string, label: string): TargetSpec => ({ type: 'tag', tag: t, label });
const each = (words: readonly string[], t: TargetSpec): [string, TargetSpec][] => words.map((w) => [w, t]);

export const NOUN_TABLE: readonly [string, TargetSpec][] = [
  ...each(['enemy soldiers', 'enemy soldier', 'enemy troops', 'enemy army', 'enemies', 'enemy', 'raiders', 'raider', 'pirates', 'pirate',
    'invaders', 'invader', 'attackers', 'attacker', 'bad guys', 'smugglers'], tag('enemy', 'raiders')),
  ...each(['my troops', 'my soldiers', 'my army', 'our troops', 'our soldiers', 'allies', 'defenders'], tag('ally', 'your troops')),
  ...each(['soldier', 'soldiers', 'troop', 'troops', 'army', 'rifleman', 'riflemen', 'warriors', 'fighters', 'guards', 'guard'], kind('rifleman', 'soldiers')),
  ...each(['heavy', 'heavies', 'heavy gunner', 'heavy gunners', 'tank', 'tanks'], kind('heavy', 'heavy gunners')),
  ...each(['rocketeer', 'rocketeers', 'rocket troops', 'bazooka'], kind('rocketeer', 'rocketeers')),
  ...each(['medic', 'medics', 'doctor', 'doctors'], kind('medic', 'medics')),
  ...each(['engineer', 'engineers'], kind('engineer', 'engineers')),
  ...each(['chicken', 'chickens', 'hen', 'hens', 'rooster', 'roosters', 'chick', 'chicks', 'poultry'], kind('chicken', 'chickens')),
  ...each(['cow', 'cows', 'cattle', 'bull', 'bulls', 'calf', 'calves', 'buffalo'], kind('cow', 'cows')),
  ...each(['dog', 'dogs', 'puppy', 'puppies', 'doggo', 'doggos', 'hound', 'hounds', 'pup', 'pups'], kind('dog', 'dogs')),
  ...each(['cat', 'cats', 'kitten', 'kittens', 'kitty', 'kitties'], kind('cat', 'cats')),
  ...each(['duck', 'ducks', 'duckling', 'ducklings'], kind('duck', 'ducks')),
  ...each(['dragon', 'dragons', 'wyvern', 'wyverns'], kind('dragon', 'dragons')),
  ...each(['bird', 'birds', 'crow', 'crows', 'pigeon', 'pigeons', 'sparrow', 'sparrows'], kind('crow', 'crows')),
  ...each(['fish', 'fishes', 'mackerel', 'pomfret'], kind('fish', 'fish')),
  ...each(['coconut tree', 'coconut trees', 'coconut palm', 'coconut palms', 'palm', 'palms', 'palm tree', 'palm trees', 'coconut', 'coconuts'], kind('palm', 'coconut palms')),
  ...each(['tree', 'trees', 'forest', 'forests', 'woods', 'jungle'], tag('tree', 'trees')),
  ...each(['banana', 'bananas', 'banana tree', 'banana trees', 'banana plant', 'banana plants'], kind('banana', 'banana plants')),
  ...each(['bush', 'bushes', 'shrub', 'shrubs', 'hedge', 'hedges'], kind('bush', 'bushes')),
  ...each(['flower', 'flowers', 'hibiscus', 'rose', 'roses'], kind('hibiscus', 'flowers')),
  ...each(['rock', 'rocks', 'stone', 'stones', 'boulder', 'boulders'], kind('rock', 'rocks')),
  ...each(['cliff', 'cliffs', 'mountain', 'mountains', 'hill', 'hills'], kind('cliff', 'cliffs')),
  ...each(['house', 'houses', 'home', 'homes', 'cottage', 'cottages', 'hut', 'huts'], kind('house', 'houses')),
  ...each(['chapel', 'church', 'churches'], kind('chapel', 'chapel')),
  ...each(['shack', 'shacks', 'beach shack', 'beach shacks'], kind('shack', 'beach shacks')),
  ...each(['windmill', 'windmills', 'mill'], kind('windmill', 'windmill')),
  ...each(['market', 'markets', 'shop', 'shops', 'stall', 'stalls'], kind('market', 'market')),
  ...each(['well', 'wells'], kind('well', 'well')),
  ...each(['lighthouse', 'lighthouses'], kind('lighthouse', 'lighthouse')),
  ...each(['fort', 'forts', 'castle', 'castles', 'fortress', 'tower', 'towers'], kind('fort-tower', 'fort tower')),
  ...each(['boat', 'boats', 'ship', 'ships', 'gunboat', 'gunboats', 'enemy boat', 'enemy boats', 'enemy ship', 'enemy ships', 'enemy gunboat', 'raider boat', 'raider ship', 'raider gunboat', 'pirate ship', 'pirate boat', 'warship'], kind('gunboat', 'gunboat')),
  ...each(['landing craft', 'landing boats'], kind('landing-craft', 'landing craft')),
  ...each(['fishing boat', 'fishing boats', 'canoe', 'canoes'], kind('fishing-boat', 'fishing boats')),
  ...each(['headquarters', 'hq', 'base'], kind('hq', 'headquarters')),
  ...each(['cannon', 'cannons'], kind('cannon', 'cannons')),
  ...each(['machine gun', 'machine guns'], kind('machine-gun', 'machine guns')),
  ...each(['sun', 'sunshine', 'sky', 'skies', 'daylight'], kind('sun', 'sun')),
  ...each(['moon', 'moons'], kind('moon', 'moon')),
  ...each(['sea', 'ocean', 'water', 'arabian sea', 'waves'], kind('sea', 'sea')),
  ...each(['cloud', 'clouds'], kind('cloud', 'clouds')),
  ...each(['pizza', 'pizzas'], kind('pizza', 'pizza')),
  ...each(['crate', 'crates', 'box', 'boxes'], kind('crate', 'crates')),
  ...each(['coin', 'coins', 'money', 'gold', 'cash', 'gold coins'], kind('coin', 'coins')),
  ...each(['fisherman', 'fishermen', 'fisherfolk'], kind('fisherman', 'fishermen')),
  ...each(['farmer', 'farmers', 'toddy tapper'], kind('farmer', 'farmers')),
  ...each(['vendor', 'vendors', 'merchant', 'merchants', 'fish seller'], kind('vendor', 'vendors')),
  ...each(['tourist', 'tourists'], kind('tourist', 'tourists')),
  ...each(['child', 'children', 'kid', 'kids', 'baby', 'babies'], kind('child', 'children')),
  ...each(['elder', 'elders', 'grandma', 'grandpa', 'old people', 'old man', 'old woman'], kind('elder', 'elders')),
  ...each(['villager', 'villagers', 'people', 'person', 'persons', 'human', 'humans', 'everyone', 'everybody', 'folks',
    'citizens', 'townsfolk', 'residents', 'man', 'men', 'woman', 'women', 'locals', 'population', 'goans'], tag('human', 'villagers')),
  ...each(['animal', 'animals', 'creature', 'creatures', 'critters', 'beasts', 'wildlife', 'pets'], tag('animal', 'animals')),
  ...each(['building', 'buildings', 'structures', 'village', 'town'], tag('building', 'buildings')),
  ...each(['plant', 'plants', 'nature', 'vegetation', 'greenery'], tag('plant', 'plants')),
  ...each(['everything', 'world', 'the world', 'all things', 'all of it', 'universe', 'reality', 'island', 'the island'], tag('any', 'everything')),
  ...each(['flying things', 'flyers', 'flying animals'], tag('flying', 'flying things')),
];

/** Pronouns resolve to the last target set (TTL in config). */
export const PRONOUNS: ReadonlySet<string> = new Set(['it', 'them', 'that', 'those', 'they', 'him', 'her', 'these', 'this one', 'em']);

/** Spatial anchors for "near the beach", "on the northern hill" … (keys match WorldLayout.anchors). */
export const ANCHOR_TABLE: readonly [string, string][] = [
  ['beach', 'beach'], ['shore', 'shore'], ['coast', 'coast'], ['sea', 'sea'], ['water', 'sea'], ['jetty', 'jetty'], ['pier', 'jetty'],
  ['village', 'village'], ['town', 'village'], ['square', 'village'], ['middle', 'middle'], ['center', 'middle'], ['centre', 'middle'],
  ['windmill', 'windmill'], ['mill', 'windmill'], ['forest', 'forest'], ['woods', 'forest'], ['jungle', 'jungle'],
  ['hill', 'hill'], ['hills', 'hill'], ['northern hill', 'hill'], ['mountain', 'hill'], ['north', 'north'], ['south', 'south'],
  ['east', 'east'], ['west', 'west'], ['fort', 'fort'], ['chapel', 'chapel'], ['church', 'chapel'], ['lighthouse', 'lighthouse'],
  ['market', 'market'], ['cove', 'cove'], ['house', 'village'], ['houses', 'village'],
];
export const WHERE_WORDS: ReadonlySet<string> = new Set(['near', 'by', 'around', 'beside', 'at', 'in', 'on', 'above', 'over', 'next', 'to', 'into', 'onto', 'inside', 'towards', 'toward']);
