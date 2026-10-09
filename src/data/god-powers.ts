/**
 * The god's voice powers during a defense mission. `words` is exactly what the
 * player says (or taps); the command parser already understands every one.
 */
export interface GodPower {
  readonly icon: string;
  readonly words: string;
  readonly label: string;
  readonly help: string;
}

export const GOD_POWERS: readonly GodPower[] = [
  { icon: '🌧️', words: 'Make it rain', label: 'Make it rain', help: 'Rain puts out every burning house.' },
  { icon: '❤️', words: 'Increase the HP of villagers', label: 'Villagers HP up', help: 'Doubles villager health, heals them and makes them hit harder.' },
  { icon: '⚡', words: 'God, do something', label: 'Do something!', help: 'A divine miracle: lightning on the raiders, heals and douses fires. 12 s cooldown.' },
  { icon: '⛵', words: 'Strike the enemy boat', label: 'Strike the boat', help: 'Three bolts hit the raider gunboat. Two calls sink it and stop the firebombs.' },
  { icon: '🪖', words: 'Spawn 6 soldiers near the village', label: '6 soldiers', help: 'Six riflemen appear to fight beside your villagers.' },
  { icon: '🩹', words: 'Heal the villagers', label: 'Heal villagers', help: 'Restores every villager to full health.' },
  { icon: '🐔', words: 'Turn the enemies into chickens', label: 'Chickens!', help: 'Every raider becomes a harmless chicken. Try any idea like this.' },
  { icon: '🐉', words: 'Summon a dragon', label: 'Dragon', help: 'A fire-breathing dragon fights for you (up to 3 per call).' },
];
