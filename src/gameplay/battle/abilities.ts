import {
  ABILITY_COST, ABILITY_COST_STEP, ARTILLERY_DAMAGE, ARTILLERY_RADIUS, BARRAGE_DAMAGE, BARRAGE_RADIUS, BARRAGE_SHELLS,
  FLARE_SECONDS, MEDKIT_RADIUS, MEDKIT_SECONDS, SHIELD_RADIUS, SHIELD_SECONDS,
} from '../../core/config/combat.config';
import type { IRng } from '../../core/rng/mulberry32';
import { heightAt, type Point, type WorldLayout } from '../../world/world-layout';
import type { CombatSystem } from '../combat/combat-system';

export type AbilityName = keyof typeof ABILITY_COST;
export const ABILITIES: readonly AbilityName[] = ['artillery', 'flare', 'medkit', 'shield', 'barrage'];

export const ABILITY_INFO: Readonly<Record<AbilityName, { readonly icon: string; readonly label: string; readonly help: string }>> = {
  artillery: { icon: '💥', label: 'Artillery', help: 'Gunboat shell: heavy damage in a small area.' },
  flare: { icon: '🔥', label: 'Flare', help: 'All troops run to the flare, ignoring targets.' },
  medkit: { icon: '➕', label: 'Medkit', help: 'Heals troops standing in the zone.' },
  shield: { icon: '🛡️', label: 'Shield', help: 'Troops in the zone take no damage for a few seconds.' },
  barrage: { icon: '🎆', label: 'Barrage', help: 'A wide spread of shells.' },
};

/**
 * Gunboat abilities: spend energy, cost rises each use. Shells are real
 * projectiles fired from the gunboat; zones are read by the combat system.
 */
export class Abilities {
  readonly costs: Record<AbilityName, number> = { ...ABILITY_COST };

  constructor(private readonly combat: CombatSystem, private readonly world: { readonly layout: WorldLayout }, private readonly rng: IRng) {}

  reset(): void {
    Object.assign(this.costs, ABILITY_COST);
  }

  /** Executes an ability at (x, y). `now` is sim time. Caller has already paid. */
  cast(name: AbilityName, x: number, y: number, now: number, gunboat: Point): void {
    const z = this.combat.zones;
    switch (name) {
      case 'artillery':
        this.shell(gunboat, x, y, ARTILLERY_DAMAGE, ARTILLERY_RADIUS);
        break;
      case 'barrage':
        for (let i = 0; i < BARRAGE_SHELLS; i++) {
          const a = this.rng.range(0, Math.PI * 2);
          const r = Math.sqrt(this.rng.next()) * BARRAGE_RADIUS;
          this.shell(gunboat, x + Math.cos(a) * r, y + Math.sin(a) * r, BARRAGE_DAMAGE, ARTILLERY_RADIUS * 0.8);
        }
        break;
      case 'flare':
        z.flare = { x, y, radius: 3, until: now + FLARE_SECONDS };
        break;
      case 'medkit':
        z.medkits.push({ x, y, radius: MEDKIT_RADIUS, until: now + MEDKIT_SECONDS });
        break;
      case 'shield':
        z.shields.push({ x, y, radius: SHIELD_RADIUS, until: now + SHIELD_SECONDS });
        break;
    }
    this.costs[name] += ABILITY_COST_STEP;
  }

  private shell(from: Point, x: number, y: number, damage: number, radius: number): void {
    const l = this.world.layout;
    this.combat.projectiles.launch('mortar', from.x, from.y, 4, x, y, heightAt(l, x, y), damage, radius, 1, -1);
  }
}
