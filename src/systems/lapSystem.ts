import type { RaceCar } from '../entities/car';
import type { Track } from '../track/track';

export interface LapEvent {
  type: 'checkpoint' | 'lap' | 'finish';
  lap?: number;
  lapTime?: number;
}

/** Advances checkpoint/lap progress for a car; checkpoints must be reached
 * in order for a lap to count. Also maintains `raceDistance` used for live
 * position calculation (lap * trackLength + progress along current lap). */
export function updateLap(car: RaceCar, track: Track, now: number, totalLaps: number): LapEvent | null {
  const n = track.samples.length;
  const idx = track.nearestIndex(car.body.x, car.body.y, (car as any)._lapIdxHint ?? 0);
  (car as any)._lapIdxHint = idx;

  const sample = track.sampleAt(idx);
  car.raceDistance = car.lap * track.totalLength + sample.s;

  const expected = track.checkpoints[car.currentCheckpoint];
  const rel = ((idx - expected.sampleIdx + n) % n);
  if (rel <= 3) {
    car.currentCheckpoint = (car.currentCheckpoint + 1) % track.checkpoints.length;
    if (car.currentCheckpoint === 0) {
      const lapTime = now - car.lapStartTime;
      car.lapStartTime = now;
      if (car.bestLapTime === null || lapTime < car.bestLapTime) car.bestLapTime = lapTime;
      car.lap += 1;
      if (car.lap >= totalLaps && !car.finished) {
        car.finished = true;
        car.finishTime = car.totalRaceTime;
        return { type: 'finish', lap: car.lap, lapTime };
      }
      return { type: 'lap', lap: car.lap, lapTime };
    }
    return { type: 'checkpoint' };
  }
  return null;
}

export function computePositions(cars: RaceCar[]): RaceCar[] {
  return [...cars].sort((a, b) => b.raceDistance - a.raceDistance);
}
