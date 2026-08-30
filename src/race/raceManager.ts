import { AIDriver } from '../ai/aiDriver';
import { CARS, getCarDef } from '../data/cars';
import type { Difficulty, EventDifficulty, RaceEventType, Terrain, TimeOfDay, WeatherType } from '../data/types';
import { newOwnedCar, RaceCar } from '../entities/car';
import { resolveCarCollisions, resolveDecorationCollisions, type CollisionEvent } from '../systems/collision';
import { computeRaceEconomy, type RaceEconomy } from '../systems/economy';
import { updateDriftScoring, updateFuel, updateNitro, updateTireWear } from '../systems/drivingSystems';
import { updateLap } from '../systems/lapSystem';
import { updateOffTrack } from '../systems/offtrack';
import { SURFACE_EFFECTS, TIRE_GRIP_BY_TYPE, stepCarPhysics, msToKmh, type CarInput } from '../physics/carPhysics';
import { buildRuralTrack } from '../track/trackBuilder';
import { Track } from '../track/track';
import { createWeatherState, weatherGripMultiplier, isOverPuddle, type WeatherState } from '../systems/weather';
import type { OwnedCarState } from '../entities/car';

export interface RaceConfig {
  trackId: string;
  laps: number;
  difficulty: Difficulty;
  eventDifficulty: EventDifficulty;
  weather: WeatherType;
  time: TimeOfDay;
  terrain: Terrain;
  eventType: RaceEventType;
  opponentCount: number;
}

export type RacePhase = 'grid' | 'countdown' | 'running' | 'finished';

export interface RaceGameEvent {
  type: 'colisao' | 'volta' | 'finalizado' | 'fora_de_pista_reset' | 'nitro';
  car: RaceCar;
  data?: any;
}

export interface RaceResultEntry {
  car: RaceCar;
  position: number;
  totalTime: number | null;
  bestLap: number | null;
}

export class RaceManager {
  track: Track;
  cars: RaceCar[] = [];
  player!: RaceCar;
  private aiDrivers = new Map<RaceCar, AIDriver>();
  weather: WeatherState;
  economy: RaceEconomy;
  phase: RacePhase = 'grid';
  countdownValue = 3;
  countdownTimer = 0;
  raceClock = 0;
  events: RaceGameEvent[] = [];
  collisionsThisRace = 0;
  falseStart = false;
  private launchWindowOpen = false;
  private launchBonusTimer = 0;

  constructor(private config: RaceConfig, playerCarOwned: OwnedCarState) {
    this.track = buildRuralTrack();
    this.weather = createWeatherState(config.weather, config.time, this.track);
    this.economy = computeRaceEconomy(config.eventDifficulty, config.weather, config.time, config.terrain);

    const playerDef = getCarDef(playerCarOwned.carId);
    this.player = new RaceCar('player', playerDef, playerCarOwned, 'Você');
    this.player.isPlayer = true;
    this.cars.push(this.player);

    const opponents = pickOpponents(playerCarOwned.carId, config.opponentCount);
    opponents.forEach((def, i) => {
      const owned = newOwnedCar(def.id);
      const ai = new RaceCar('ai-' + i, def, owned, def.name);
      this.aiDrivers.set(ai, new AIDriver(config.difficulty, ((i % 2 === 0 ? 1 : -1) * (0.6 + i * 0.4))));
      this.cars.push(ai);
    });

    this.cars.forEach((car, i) => {
      const grid = this.track.startGrid[i] ?? this.track.startGrid[this.track.startGrid.length - 1];
      car.body.x = grid.x;
      car.body.y = grid.y;
      car.body.angle = grid.angle;
      car.lastSafe = { x: grid.x, y: grid.y, angle: grid.angle };
    });

    this.startCountdown();
  }

  startCountdown(): void {
    this.phase = 'countdown';
    this.countdownValue = 3;
    this.countdownTimer = 0;
    this.launchWindowOpen = false;
  }

  private beginRunning(): void {
    this.phase = 'running';
    this.raceClock = 0;
    for (const car of this.cars) car.lapStartTime = 0;
  }

  update(dt: number, playerInput: CarInput): void {
    if (this.phase === 'countdown') {
      this.countdownTimer += dt;
      const prevValue = this.countdownValue;
      this.countdownValue = Math.max(0, 3 - Math.floor(this.countdownTimer));
      if (this.countdownValue !== prevValue && this.countdownValue > 0) {
        // beep handled by caller via phase read
      }
      if (this.countdownTimer >= 3 && this.countdownTimer < 3.6) {
        this.launchWindowOpen = true;
        if (playerInput.throttle > 0.5 && this.launchBonusTimer === 0) {
          this.launchBonusTimer = 0.9; // reward for a clean reaction launch
        }
      }
      if (this.countdownTimer < 3 && playerInput.throttle > 0.5) {
        this.falseStart = true;
      }
      if (this.countdownTimer >= 3.6) {
        this.launchWindowOpen = false;
        this.beginRunning();
      }
      return;
    }
    if (this.phase !== 'running') return;

    this.raceClock += dt;
    for (const car of this.cars) car.totalRaceTime = this.raceClock;

    if (this.launchBonusTimer > 0) this.launchBonusTimer = Math.max(0, this.launchBonusTimer - dt);

    for (const car of this.cars) {
      const input = car.isPlayer ? this.adjustedPlayerInput(playerInput) : this.aiDrivers.get(car)!.update(car, this.track, this.cars, dt);
      const idx = this.track.nearestIndex(car.body.x, car.body.y, (car as any)._physIdxHint ?? 0);
      (car as any)._physIdxHint = idx;
      const sample = this.track.sampleAt(idx);
      const surface = isOverPuddle(this.weather, car.body.x, car.body.y) ? 'poca' : sample.surface;
      const surfaceEffect = { ...SURFACE_EFFECTS[surface] };
      surfaceEffect.gripMultiplier *= weatherGripMultiplier(this.weather.weather);

      const tireGrip = TIRE_GRIP_BY_TYPE[car.owned.tireType]?.[surface] ?? 1;
      const nitroActive = updateNitro(car, input.nitro, dt);
      (car as any)._nitroActive = nitroActive;
      if (nitroActive && car.isPlayer) this.events.push({ type: 'nitro', car });
      const fuelFactor = updateFuel(car, input.throttle, dt);

      const conditionFactor = car.conditionFactor * fuelFactor;
      stepCarPhysics(car.body, car.effectiveStats, input, dt, surfaceEffect, nitroActive, conditionFactor, tireGrip * car.tireGripFactor);
      updateTireWear(car, surface as any, dt);
      updateDriftScoring(car, dt);

      const off = updateOffTrack(car, this.track, dt);
      if (off.justReset) this.events.push({ type: 'fora_de_pista_reset', car });

      const lapEvent = updateLap(car, this.track, this.raceClock, this.config.laps);
      if (lapEvent?.type === 'lap') this.events.push({ type: 'volta', car, data: lapEvent });
      if (lapEvent?.type === 'finish') this.events.push({ type: 'finalizado', car, data: lapEvent });
    }

    resolveCarCollisions(this.cars, (e) => this.onImpact(e));
    resolveDecorationCollisions(this.cars, this.track.decorations, (e) => this.onImpact(e));

    if (this.player.finished || this.allFinished()) {
      this.phase = 'finished';
    }
  }

  private adjustedPlayerInput(input: CarInput): CarInput {
    if (this.launchBonusTimer > 0) {
      return { ...input, throttle: Math.min(1, input.throttle * 1.35) };
    }
    return input;
  }

  private allFinished(): boolean {
    return this.cars.every((c) => c.finished);
  }

  private onImpact(e: CollisionEvent): void {
    this.collisionsThisRace += 1;
    this.events.push({ type: 'colisao', car: e.car, data: e });
  }

  drainEvents(): RaceGameEvent[] {
    const evts = this.events;
    this.events = [];
    return evts;
  }

  results(): RaceResultEntry[] {
    const sorted = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.raceDistance - a.raceDistance;
    });
    return sorted.map((car, i) => ({ car, position: i + 1, totalTime: car.finishTime, bestLap: car.bestLapTime }));
  }

  playerPosition(): number {
    const sorted = [...this.cars].sort((a, b) => b.raceDistance - a.raceDistance);
    return sorted.indexOf(this.player) + 1;
  }
}

function pickOpponents(excludeId: string, count: number) {
  const pool = CARS.filter((c) => c.id !== excludeId && !c.special);
  const selfIndex = Math.max(0, CARS.findIndex((c) => c.id === excludeId));
  const sortedByCloseness = [...pool].sort((a, b) => {
    const ia = CARS.findIndex((c) => c.id === a.id);
    const ib = CARS.findIndex((c) => c.id === b.id);
    return Math.abs(ia - selfIndex) - Math.abs(ib - selfIndex);
  });
  return sortedByCloseness.slice(0, count);
}

export function formatTime(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds)) return '--:--.--';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

export function speedKmh(car: RaceCar): number {
  return msToKmh(Math.hypot(car.body.forwardSpeed, car.body.lateralSpeed));
}
