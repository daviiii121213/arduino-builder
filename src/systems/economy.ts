import type { EventDifficulty, Terrain, TimeOfDay, WeatherType } from '../data/types';

const DIFFICULTY_MULT: Record<EventDifficulty, number> = {
  facil: 1.0,
  normal: 1.5,
  dificil: 2.0,
  profissional: 3.0,
};

const WEATHER_MULT: Record<WeatherType, number> = {
  sunny: 1.0,
  cloudy: 1.1,
  rain: 1.5,
  storm: 2.0,
};

const TIME_MULT: Record<TimeOfDay, number> = {
  day: 1.0,
  evening: 1.2,
  night: 1.4,
};

const TERRAIN_MULT: Record<Terrain, number> = {
  asfalto: 1.0,
  cidade: 1.2,
  terra: 1.4,
  montanha: 1.6,
  extremo: 2.0,
};

const BASE_ENTRY_FEE = 150;
const BASE_REWARD = 700;

export interface RaceEconomy {
  entryFee: number;
  reward1st: number;
  reward2nd: number;
  reward3rd: number;
  multiplier: number;
}

export function computeRaceEconomy(difficulty: EventDifficulty, weather: WeatherType, time: TimeOfDay, terrain: Terrain): RaceEconomy {
  const multiplier = DIFFICULTY_MULT[difficulty] * WEATHER_MULT[weather] * TIME_MULT[time] * TERRAIN_MULT[terrain];
  const entryFee = Math.round((BASE_ENTRY_FEE * multiplier) / 10) * 10;
  const reward1st = Math.round((BASE_REWARD * multiplier) / 10) * 10;
  return {
    entryFee,
    reward1st,
    reward2nd: Math.round(reward1st * 0.55),
    reward3rd: Math.round(reward1st * 0.3),
    multiplier,
  };
}

export function rewardForPosition(economy: RaceEconomy, position: number): number {
  if (position === 1) return economy.reward1st;
  if (position === 2) return economy.reward2nd;
  if (position === 3) return economy.reward3rd;
  return 0;
}
