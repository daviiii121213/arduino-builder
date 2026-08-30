import type { RaceCar } from '../entities/car';
import { msToKmh } from '../physics/carPhysics';
import type { SurfaceType } from '../data/types';

const DRIFT_ANGLE_THRESHOLD = 0.12; // rad slip angle to count as drifting

/** Updates drift scoring/combo based on the car's slip angle each frame. */
export function updateDriftScoring(car: RaceCar, dt: number): void {
  const speed = Math.hypot(car.body.forwardSpeed, car.body.lateralSpeed);
  if (speed < 3) {
    car.isDrifting = false;
    car.driftCombo = 0;
    return;
  }
  const slipAngle = Math.atan2(car.body.lateralSpeed, Math.max(0.5, car.body.forwardSpeed));
  const drifting = Math.abs(slipAngle) > DRIFT_ANGLE_THRESHOLD;
  if (drifting) {
    if (!car.isDrifting) car.driftCombo = 0;
    car.isDrifting = true;
    car.driftCombo += dt;
    const multiplier = 1 + Math.min(3, car.driftCombo * 0.4);
    car.driftScore += Math.abs(slipAngle) * speed * dt * multiplier;
  } else {
    car.isDrifting = false;
    car.driftCombo = 0;
  }
}

/** Nitro regenerates slowly while drifting (skilled driving) and is consumed
 * while boosting. Returns whether the boost is actually active this frame. */
export function updateNitro(car: RaceCar, wantsNitro: boolean, dt: number): boolean {
  const active = wantsNitro && car.nitro > 1 && car.fuel > 0;
  if (active) {
    car.nitro = Math.max(0, car.nitro - 28 * dt);
  } else if (car.isDrifting) {
    car.nitro = Math.min(car.baseStats.nitroCapacity, car.nitro + 6 * dt);
  }
  return active;
}

/** Fuel drains with throttle use; an empty tank cuts engine power sharply. */
export function updateFuel(car: RaceCar, throttle: number, dt: number): number {
  const consumption = (0.35 + throttle * 1.1) * dt;
  car.fuel = Math.max(0, car.fuel - consumption);
  return car.fuel <= 0 ? 0.25 : 1;
}

/** Tire wear accumulates faster on demanding surfaces and while drifting. */
export function updateTireWear(car: RaceCar, surface: SurfaceType, dt: number): void {
  const surfaceFactor: Record<SurfaceType, number> = {
    asfalto: 1, terra: 1.6, grama: 1.4, lama: 1.8, areia: 1.7, gelo: 1.2, poca: 1.1,
  };
  const speedFactor = 0.4 + msToKmh(Math.abs(car.body.forwardSpeed)) / 260;
  const driftFactor = car.isDrifting ? 2.4 : 1;
  car.tireWear = Math.min(100, car.tireWear + 0.35 * surfaceFactor[surface] * speedFactor * driftFactor * dt);
}
