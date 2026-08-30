import type { CarDef, CarStats, TireType, UpgradeSlot } from '../data/types';
import { getUpgrade } from '../data/upgrades';
import type { PhysicsBody } from '../physics/carPhysics';

export interface OwnedCarState {
  carId: string;
  upgrades: Partial<Record<UpgradeSlot, number>>; // slot -> level (0 = not installed)
  condition: number; // 0-100
  tireType: TireType;
}

export function newOwnedCar(carId: string): OwnedCarState {
  return { carId, upgrades: {}, condition: 100, tireType: 'normal' };
}

export function computeEffectiveStats(def: CarDef, owned: OwnedCarState): CarStats {
  const stats: CarStats = { ...def.stats };
  for (const slot of Object.keys(owned.upgrades) as UpgradeSlot[]) {
    const level = owned.upgrades[slot] ?? 0;
    if (level <= 0) continue;
    const upg = getUpgrade(slot);
    for (let l = 0; l < level; l++) {
      const def2 = upg.levels[l];
      if (!def2) continue;
      for (const key of Object.keys(def2.effects) as (keyof CarStats)[]) {
        stats[key] = (stats[key] as number) + (def2.effects[key] as number);
      }
    }
  }
  return stats;
}

export function upgradeCost(owned: OwnedCarState, slot: UpgradeSlot): number | null {
  const upg = getUpgrade(slot);
  const currentLevel = owned.upgrades[slot] ?? 0;
  const next = upg.levels[currentLevel];
  return next ? next.price : null;
}

/** Full runtime race entity: physics body + consumables + track progress. */
export class RaceCar {
  readonly ownedId: string; // reference into player's garage (or 'ai-N')
  readonly def: CarDef;
  readonly baseStats: CarStats;
  owned: OwnedCarState;

  body: PhysicsBody = { x: 0, y: 0, angle: 0, forwardSpeed: 0, lateralSpeed: 0 };

  condition: number;
  fuel: number;
  nitro: number;
  tireWear = 0; // 0-100, 100 = fully worn

  // race/lap tracking
  currentCheckpoint = 0;
  lap = 0;
  lapStartTime = 0;
  bestLapTime: number | null = null;
  totalRaceTime = 0;
  finished = false;
  finishTime: number | null = null;
  raceDistance = 0; // cumulative meters travelled along track (for position calc)

  // off-track handling
  offTrackTimer = 0;
  lastSafe: { x: number; y: number; angle: number } | null = null;

  // drift scoring
  driftScore = 0;
  driftCombo = 0;
  isDrifting = false;
  driftAirTime = 0;

  isPlayer = false;
  label: string;

  constructor(ownedId: string, def: CarDef, owned: OwnedCarState, label: string) {
    this.ownedId = ownedId;
    this.def = def;
    this.owned = owned;
    this.baseStats = computeEffectiveStats(def, owned);
    this.condition = owned.condition;
    this.fuel = this.baseStats.fuelCapacity;
    this.nitro = this.baseStats.nitroCapacity;
    this.label = label;
  }

  get effectiveStats(): CarStats {
    const conditionFactor = 0.55 + 0.45 * (this.condition / 100);
    const s = { ...this.baseStats };
    s.acceleration *= conditionFactor;
    s.topSpeed *= 0.7 + 0.3 * conditionFactor;
    s.braking *= conditionFactor;
    s.handling *= 0.6 + 0.4 * conditionFactor;
    return s;
  }

  get conditionFactor(): number {
    return 0.55 + 0.45 * (this.condition / 100);
  }

  get tireGripFactor(): number {
    return Math.max(0.4, 1 - this.tireWear / 160);
  }

  applyDamage(amount: number): void {
    this.condition = Math.max(0, this.condition - amount);
  }

  repair(): void {
    this.condition = 100;
  }

  refuel(): void {
    this.fuel = this.baseStats.fuelCapacity;
  }

  changeTires(type: TireType): void {
    this.owned.tireType = type;
    this.tireWear = 0;
  }
}
