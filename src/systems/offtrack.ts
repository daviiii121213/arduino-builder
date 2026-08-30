import type { RaceCar } from '../entities/car';
import type { Track } from '../track/track';

export const OFF_TRACK_LIMIT = 3.0; // seconds

export interface OffTrackResult {
  offTrack: boolean;
  justReset: boolean;
}

/** Tracks the 3-second off-track rule and resets the car to its last safe
 * position (correctly oriented along the track) once the timer expires. */
export function updateOffTrack(car: RaceCar, track: Track, dt: number): OffTrackResult {
  const idx = track.nearestIndex(car.body.x, car.body.y, (car as any)._offIdxHint ?? 0);
  (car as any)._offIdxHint = idx;
  const sample = track.sampleAt(idx);
  const lateral = track.lateralOffset(idx, car.body.x, car.body.y);
  const off = Math.abs(lateral) > sample.halfWidth;

  if (!off) {
    car.offTrackTimer = 0;
    car.lastSafe = { x: car.body.x, y: car.body.y, angle: car.body.angle };
    return { offTrack: false, justReset: false };
  }

  car.offTrackTimer += dt;
  if (car.offTrackTimer >= OFF_TRACK_LIMIT) {
    const safe = car.lastSafe ?? { x: sample.x, y: sample.y, angle: sample.angle };
    car.body.x = safe.x;
    car.body.y = safe.y;
    car.body.angle = safe.angle;
    car.body.forwardSpeed = 0;
    car.body.lateralSpeed = 0;
    car.offTrackTimer = 0;
    return { offTrack: true, justReset: true };
  }
  return { offTrack: true, justReset: false };
}
