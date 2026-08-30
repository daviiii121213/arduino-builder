import type { ActionId } from '../input/controls';
import { newOwnedCar, type OwnedCarState } from '../entities/car';

export type ReputationRank = 'Novato' | 'Piloto' | 'Profissional' | 'Elite' | 'Lenda';

export interface TrackRecord {
  bestLap: number | null;
  bestTotal: number | null;
  topSpeed: number | null;
  bestDrift: number | null;
}

export interface EventProgress {
  stars: number; // 0-5
  bestTime: number | null;
  completed: boolean;
}

export interface Settings {
  volMaster: number;
  volMusic: number;
  volSfx: number;
  volEngine: number;
  volAmbient: number;
  volUi: number;
  musicOn: boolean;
  sfxOn: boolean;
  fullscreen: boolean;
  resolution: string;
  vsync: boolean;
  vibration: boolean;
  showMinimap: boolean;
  showSpeed: boolean;
  showDamage: boolean;
  showFuel: boolean;
  drivingAssist: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  volMaster: 80, volMusic: 70, volSfx: 80, volEngine: 75, volAmbient: 60, volUi: 70,
  musicOn: true, sfxOn: true,
  fullscreen: false, resolution: '1600x900', vsync: true,
  vibration: true, showMinimap: true, showSpeed: true, showDamage: true, showFuel: true, drivingAssist: false,
};

export interface GameState {
  money: number;
  reputation: number;
  ownedCars: OwnedCarState[];
  selectedCarId: string;
  unlockedRegions: string[];
  eventProgress: Record<string, EventProgress>;
  achievements: Record<string, boolean>;
  records: Record<string, TrackRecord>;
  settings: Settings;
  controlBindings: Partial<Record<ActionId, string>>;
}

export function createDefaultGameState(): GameState {
  return {
    money: 2500,
    reputation: 0,
    ownedCars: [newOwnedCar('compact')],
    selectedCarId: 'compact',
    unlockedRegions: ['interior'],
    eventProgress: {},
    achievements: {},
    records: {},
    settings: { ...DEFAULT_SETTINGS },
    controlBindings: {},
  };
}

export function reputationRank(reputation: number): ReputationRank {
  if (reputation >= 4000) return 'Lenda';
  if (reputation >= 2000) return 'Elite';
  if (reputation >= 800) return 'Profissional';
  if (reputation >= 200) return 'Piloto';
  return 'Novato';
}
