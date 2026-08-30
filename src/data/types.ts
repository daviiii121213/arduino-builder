export type TireType = 'normal' | 'racing' | 'chuva' | 'offroad';
export type SurfaceType = 'asfalto' | 'terra' | 'grama' | 'lama' | 'areia' | 'gelo' | 'poca';
export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'storm';
export type TimeOfDay = 'day' | 'evening' | 'night';
export type Difficulty = 'facil' | 'normal' | 'dificil';
export type EventDifficulty = 'facil' | 'normal' | 'dificil' | 'profissional';
export type Terrain = 'asfalto' | 'cidade' | 'terra' | 'montanha' | 'extremo';

export interface CarStats {
  /** top speed in km/h */
  topSpeed: number;
  /** 0-100 acceleration rating, higher = faster accel */
  acceleration: number;
  braking: number;
  grip: number;
  handling: number;
  driftFactor: number;
  weight: number; // kg
  durability: number; // 0-100, resistance to damage
  fuelCapacity: number; // liters
  nitroCapacity: number; // 0-100
}

export interface CarDef {
  id: string;
  name: string;
  category: string;
  price: number;
  special?: boolean; // unlocked via achievement/rival, not purchasable
  stats: CarStats;
  color: string;
  colorDark: string;
  colorAccent: string;
}

export type UpgradeSlot = 'motor' | 'turbo' | 'freios' | 'pneus' | 'suspensao' | 'transmissao' | 'nitro';

export interface UpgradeLevelDef {
  level: number;
  price: number;
  description: string;
  effects: Partial<CarStats>;
}

export interface UpgradeDef {
  slot: UpgradeSlot;
  name: string;
  levels: UpgradeLevelDef[];
}

export interface CheckpointDef {
  x: number;
  y: number;
  angle: number; // direction of travel through checkpoint, radians
  width: number;
  isStartFinish?: boolean;
  isPit?: boolean;
}

export interface TrackDef {
  id: string;
  regionId: string;
  name: string;
  description: string;
  lengthMeters: number;
  laps: number;
  eventTypes: RaceEventType[];
  terrain: Terrain;
}

export type RaceEventType =
  | 'circuito'
  | 'contrarrelogio'
  | 'melhor_volta'
  | 'drift'
  | 'sprint'
  | 'eliminacao'
  | 'destruicao'
  | 'duelo_rival';

export interface RegionDef {
  id: string;
  name: string;
  description: string;
  unlockCost: number;
  unlocked: boolean;
  environment: string;
  trackIds: string[];
}

export interface CareerEventDef {
  id: string;
  trackId: string;
  eventType: RaceEventType;
  difficulty: EventDifficulty;
  weather: WeatherType;
  time: TimeOfDay;
  laps: number;
  rivalId?: string;
  requiredReputation?: number;
  unlockedByDefault?: boolean;
}

export interface RivalDef {
  id: string;
  name: string;
  style: 'agressivo' | 'especialista_curvas' | 'especialista_velocidade' | 'especialista_drift';
  carId: string;
  regionId: string;
}
