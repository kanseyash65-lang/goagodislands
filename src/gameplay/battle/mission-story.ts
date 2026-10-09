import type { IEventBus } from '../../core/events/event-bus';
import type { MissionDef } from '../missions/mission-defs';

/** A newspaper front page written about one mission (see systems/newspaper). */
export interface SpecialEdition {
  readonly masthead: string;
  readonly headline: string;
  readonly subhead: string;
  readonly lead: string;
  readonly quote: string;
  readonly stories: readonly { readonly title: string; readonly body: string }[];
  readonly caption: string;
}

export interface MissionTally {
  rains: number;
  boosts: number;
  miracles: number;
  chickens: number;
  dragons: number;
  disasters: number;
  raidersDown: number;
  /** Exactly what the player said, in order (for the newspaper). */
  spoken: string[];
}

const SPOKEN_MAX = 6;
const QUOTES = [
  '"Paus ailo! The rain came when God called." — a fisherman,',
  '"Dev borem korum. A candle at the chapel tonight." — an elder,',
  '"They had guns, then they were chickens." — a feni seller,',
];

/** Star rating: 3 = nothing lost and most villagers safe; 2 = held well; 1 = survived. */
export function starsFor(buildingsLost: number, lossLimit: number, villagersNow: number, villagersStart: number): number {
  const kept = villagersStart > 0 ? villagersNow / villagersStart : 1;
  if (buildingsLost === 0 && kept >= 0.75) return 3;
  if (buildingsLost <= Math.floor(lossLimit / 2) && kept >= 0.5) return 2;
  return 1;
}

/**
 * Listens to one mission and remembers the god's deeds, so the victory screen
 * can rate it and the Goa God Herald can print a headline about what you did.
 */
export class MissionStory {
  tally: MissionTally = MissionStory.empty();
  villagersAtStart = 0;
  private active = false;

  constructor(bus: IEventBus, villagers: () => number) {
    bus.on('SceneChanged', ({ scene }) => {
      this.active = scene === 'battle';
      if (!this.active) return;
      this.tally = MissionStory.empty();
      this.villagersAtStart = villagers();
    });
    bus.on('CommandSubmitted', ({ raw }) => {
      if (this.active && this.tally.spoken.length < SPOKEN_MAX && !this.tally.spoken.includes(raw)) this.tally.spoken.push(raw);
    });
    bus.on('CommandExecuted', ({ command, result }) => {
      if (!this.active) return;
      const t = this.tally;
      if (command.intent === 'weather' && /rain|storm/.test(result.subject)) t.rains++;
      else if ((command.intent === 'modify' && command.property === 'health') || command.intent === 'heal') t.boosts++;
      else if (command.intent === 'miracle') t.miracles++;
      else if (command.intent === 'disaster') t.disasters++;
      else if (command.intent === 'transform' && result.subject.includes('chicken')) t.chickens += result.affected;
      else if (command.intent === 'spawn' && result.subject.includes('dragon')) t.dragons += result.affected;
    });
    bus.on('UnitKilled', ({ team }) => { if (this.active && team === 2) this.tally.raidersDown++; });
  }

  private static empty(): MissionTally {
    return { rains: 0, boosts: 0, miracles: 0, chickens: 0, dragons: 0, disasters: 0, raidersDown: 0, spoken: [] };
  }

  /** Raiders beaten, counting the ones turned into poultry. */
  raidersDefeated(): number {
    return this.tally.raidersDown + this.tally.chickens;
  }

  edition(m: MissionDef, villagersSaved: number, buildingsLost: number, stars: number): SpecialEdition {
    const t = this.tally;
    const place = m.place.toUpperCase();
    const headline = t.chickens > 0 ? `GOD TURNS ${t.chickens} PIRATES INTO CHICKENS AT ${place}`
      : t.dragons > 0 ? `DRAGON TORCHES RAIDERS OVER ${place}`
        : t.miracles + t.disasters > 0 ? `LIGHTNING FROM A CLEAR SKY SAVES ${place}`
          : t.rains > 0 ? `DIVINE RAIN DOUSES RAIDER FIRES IN ${place}`
            : `${place} STANDS: RAIDERS DRIVEN INTO THE SEA`;
    const deeds: string[] = [];
    if (t.rains > 0) deeds.push(`summoned rain ${t.rains === 1 ? 'once' : `${t.rains} times`} to put out the burning houses`);
    if (t.boosts > 0) deeds.push('filled the villagers with divine strength');
    if (t.chickens > 0) deeds.push(`turned ${t.chickens} armed raiders into confused chickens`);
    if (t.dragons > 0) deeds.push(`sent ${t.dragons === 1 ? 'a dragon' : `${t.dragons} dragons`} to breathe fire on the invaders`);
    if (t.miracles + t.disasters > 0) deeds.push('called lightning down on the attackers');
    const deedText = deeds.length > 0 ? `Witnesses say the God of Goa ${deeds.join(', ')}.` : 'The villagers held the line on their own, with a little divine encouragement.';
    const said = t.spoken.slice(0, 3).map((s) => `"${s}"`).join(', ');
    return {
      masthead: 'THE GOA GOD HERALD',
      headline,
      subhead: `${villagersSaved} ${villagersSaved === 1 ? 'villager' : 'villagers'} saved · ${this.raidersDefeated()} raiders defeated · ${buildingsLost} homes lost · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
      lead: `Raiders landed at ${m.place} today and met an opponent they did not expect. ${deedText} By sunset the raider gunboat had fled and the village was safe.`,
      quote: `${QUOTES[(t.chickens > 0 ? 2 : t.rains > 0 ? 0 : 1) % QUOTES.length] ?? ''} ${m.place}`,
      stories: [
        { title: 'THE GOD WAS HEARD SAYING', body: said.length > 0 ? `${said}. Villagers report the voice came from the clouds.` : 'Nothing at all. Villagers call it divine restraint.' },
        { title: 'FENI PRICES STEADY', body: 'Market vendors report brisk trade as the village celebrates. Chicken curry is off the menu, out of respect.' },
        { title: 'FISHING BOATS RETURN', body: 'With the raiders gone, the fleet sails out at dawn. The catch is expected to be excellent.' },
      ],
      caption: `THE GOA GOD HERALD: ${headline}. I defended Goa with my voice. #GoaGodIslands`,
    };
  }
}
