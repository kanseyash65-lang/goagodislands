import type { BufferGeometry } from 'three';
import * as E from './economy-models';
import * as G from './goan-models';
import * as H from './human-models';
import * as M from './military-models';
import type { ModelBuilder } from './model-builder';
import * as N from './nature-models';

/**
 * Kind → 3D model (+ moving attachments). Geometries are built once at boot.
 * Attachment modes: `aim` follows the entity's aimYaw (turrets), `spinZ` turns
 * around the local forward axis (windmill sails on their hub), `spinY` turns
 * around the vertical axis (radar dish).
 */
export type AttachMode = 'aim' | 'spinZ' | 'spinY';

export interface Attachment {
  readonly model: string;
  readonly offset: readonly [number, number, number];
  readonly mode: AttachMode;
  readonly speed: number;
}

export interface KindModel {
  readonly body: string;
  readonly attachments: readonly Attachment[];
}

const MODELS: Readonly<Record<string, () => ModelBuilder>> = {
  fisherman: H.fisherman, farmer: H.farmer, vendor: H.vendor, tourist: H.tourist, child: H.child, elder: H.elder,
  rifleman: H.rifleman, heavy: H.heavy, rocketeer: H.rocketeer, medic: H.medic, engineer: H.engineer, commander: H.commander,
  cow: N.cow, dog: N.dog, cat: N.cat, crow: N.crow, chicken: N.chicken, duck: N.duck, dragon: N.dragon,
  palm: N.palm, banana: N.banana, bush: N.bush, hibiscus: N.hibiscus, rock: N.rock, cliff: N.cliff, cloud: N.cloud,
  house: () => G.goanHouse(false), chapel: G.chapel, shack: G.shack, market: G.market, well: G.well,
  windmill: G.windmill, 'windmill-sails': G.windmillSails, lighthouse: G.lighthouse, 'fort-tower': G.fortTower,
  jetty: G.jetty, 'fishing-boat': G.fishingBoat,
  hq: M.hq, 'cannon-base': M.cannonBase, 'cannon-turret': M.cannonTurret, 'mg-base': M.machineGunBase,
  'mg-turret': M.machineGunTurret, 'mortar-base': M.mortarBase, 'mortar-turret': M.mortarTurret,
  'sniper-tower': M.sniperTower, 'sniper-turret': M.sniperTurret, mine: M.mine, bunker: M.bunker, cage: M.cage,
  'supply-depot': M.supplyDepot, wall: M.wall, rubble: M.rubble,
  residence: E.residence, sawmill: E.sawmill, quarry: E.quarry, 'iron-mine': E.ironMine, vault: E.vault,
  'timber-store': E.timberStore, 'stone-store': E.stoneStore, 'metal-store': E.metalStore, armory: E.armory,
  barracks: E.barracks, dock: E.dock, 'radar-base': E.radarBase, 'radar-dish': E.radarDish,
  'landing-craft': E.landingCraft, gunboat: E.gunboat, thing: E.thing, crate: E.crate, coin: E.coin, pizza: E.pizza, fish: E.fish,
};

const aim = (model: string, y: number): Attachment => ({ model, offset: [0, y, 0], mode: 'aim', speed: 0 });

/** Kinds whose body model differs from the kind name, or that have attachments. */
const SPECIAL: Readonly<Record<string, KindModel>> = {
  cannon: { body: 'cannon-base', attachments: [aim('cannon-turret', 1.1)] },
  'machine-gun': { body: 'mg-base', attachments: [aim('mg-turret', 0.4)] },
  mortar: { body: 'mortar-base', attachments: [aim('mortar-turret', 0.4)] },
  'sniper-tower': { body: 'sniper-tower', attachments: [aim('sniper-turret', 0)] },
  // The hub sits on the front of the tower top, so the sails spin on their own axle.
  windmill: { body: 'windmill', attachments: [{ model: 'windmill-sails', offset: [0, 6.6, 2.05], mode: 'spinZ', speed: 1 }] },
  radar: { body: 'radar-base', attachments: [{ model: 'radar-dish', offset: [0, 3.8, 0], mode: 'spinY', speed: 0.8 }] },
};

export interface ModelCatalog {
  readonly geometries: ReadonlyMap<string, BufferGeometry>;
  /** Model per kind name. */
  kindModel(kind: string): KindModel | undefined;
  /** Top of the model (for health bars and labels). */
  height(model: string): number;
}

export function buildModelCatalog(): ModelCatalog {
  const geometries = new Map<string, BufferGeometry>();
  const heights = new Map<string, number>();
  for (const [key, make] of Object.entries(MODELS)) {
    const g = make().build();
    geometries.set(key, g);
    heights.set(key, g.boundingBox?.max.y ?? 2);
  }
  return {
    geometries,
    kindModel: (kind) => SPECIAL[kind] ?? (geometries.has(kind) ? { body: kind, attachments: [] } : undefined),
    height: (model) => heights.get(model) ?? 2,
  };
}
