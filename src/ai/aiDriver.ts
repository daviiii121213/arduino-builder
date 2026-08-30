import type { Difficulty } from '../data/types';
import type { RaceCar } from '../entities/car';
import type { CarInput } from '../physics/carPhysics';
import { msToKmh } from '../physics/carPhysics';
import type { Track } from '../track/track';

interface DifficultyTuning {
  steerGain: number;
  cornerConfidence: number; // 0..1, higher = brakes later / carries more speed
  mistakeChance: number; // chance per second of a small steering wobble
  reactionLag: number; // seconds of input smoothing
  nitroUsage: number; // 0..1 probability per opportunity
}

const TUNING: Record<Difficulty, DifficultyTuning> = {
  facil: { steerGain: 2.0, cornerConfidence: 0.68, mistakeChance: 0.25, reactionLag: 0.28, nitroUsage: 0.25 },
  normal: { steerGain: 2.6, cornerConfidence: 0.82, mistakeChance: 0.12, reactionLag: 0.16, nitroUsage: 0.5 },
  dificil: { steerGain: 3.2, cornerConfidence: 0.96, mistakeChance: 0.04, reactionLag: 0.07, nitroUsage: 0.8 },
};

export class AIDriver {
  readonly difficulty: Difficulty;
  private laneBias: number; // personal preferred lateral offset (meters), gives cars distinct lines
  private overtakeOffset = 0;
  private smoothedSteer = 0;
  private stuckTimer = 0;
  private recovering = false;

  constructor(difficulty: Difficulty, personalityLaneBias: number) {
    this.difficulty = difficulty;
    this.laneBias = personalityLaneBias;
  }

  update(car: RaceCar, track: Track, rivals: RaceCar[], dt: number): CarInput {
    const tuning = TUNING[this.difficulty];
    const idx = track.nearestIndex(car.body.x, car.body.y, this.lastIndex(car, track));
    (car as any)._aiSampleIdx = idx;

    const speedKmh = msToKmh(Math.abs(car.body.forwardSpeed));
    const lookaheadM = clamp(8 + speedKmh * 0.28, 8, 55);
    const targetIdx = advanceIndex(track, idx, lookaheadM);
    const target = track.sampleAt(targetIdx);

    // corner-speed limiting: look further ahead and measure heading change
    const farIdx = advanceIndex(track, idx, clamp(20 + speedKmh * 0.6, 20, 110));
    const farSample = track.sampleAt(farIdx);
    const headingDelta = Math.abs(normalizeAngle(farSample.angle - track.sampleAt(idx).angle));
    const curvatureFactor = clamp(1 - headingDelta * 1.35, 0.28, 1);
    const surfaceMult = target.surface === 'terra' ? 0.85 : 1;
    const desiredSpeedKmh = Math.min(car.effectiveStats.topSpeed, car.effectiveStats.topSpeed * (0.35 + curvatureFactor * tuning.cornerConfidence)) * surfaceMult;

    // lateral offset target, with simple overtaking nudge
    this.updateOvertake(car, rivals, track, idx);
    const maxOffset = target.halfWidth * 0.7;
    const desiredOffset = clamp(this.laneBias + this.overtakeOffset, -maxOffset, maxOffset);
    const perp = { x: Math.cos(target.angle + Math.PI / 2), y: Math.sin(target.angle + Math.PI / 2) };
    const targetX = target.x + perp.x * desiredOffset;
    const targetY = target.y + perp.y * desiredOffset;

    const toTarget = Math.atan2(targetY - car.body.y, targetX - car.body.x);
    let steerRaw = normalizeAngle(toTarget - car.body.angle) * tuning.steerGain;

    if (Math.random() < tuning.mistakeChance * dt) {
      steerRaw += (Math.random() - 0.5) * 0.6;
    }
    this.smoothedSteer += (clamp(steerRaw, -1, 1) - this.smoothedSteer) * clamp(dt / Math.max(0.02, tuning.reactionLag), 0, 1);

    let throttle = 1;
    let brake = 0;
    if (speedKmh > desiredSpeedKmh * 1.04) {
      brake = clamp((speedKmh - desiredSpeedKmh) / 40, 0.15, 1);
      throttle = 0;
    } else if (speedKmh < desiredSpeedKmh * 0.9) {
      throttle = 1;
    } else {
      throttle = 0.7;
    }

    // stuck / recovery handling: facing badly wrong way or barely moving while trying to go
    const trackAngle = track.sampleAt(idx).angle;
    const facingDot = Math.cos(normalizeAngle(car.body.angle - trackAngle));
    if (Math.abs(car.body.forwardSpeed) < 0.6 && throttle > 0) {
      this.stuckTimer += dt;
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
    }
    if (this.stuckTimer > 1.2) this.recovering = true;
    if (this.recovering) {
      throttle = 0;
      brake = 1; // will trigger reverse in physics from standstill
      this.smoothedSteer = facingDot < 0.2 ? Math.sign(this.smoothedSteer || 1) : this.smoothedSteer;
      if (Math.abs(car.body.forwardSpeed) > 3 && facingDot > 0.5) {
        this.recovering = false;
        this.stuckTimer = 0;
      }
    } else if (facingDot < -0.3) {
      // pointing strongly backwards on track (spun out) — ease off and correct
      throttle *= 0.3;
    }

    const nitroWanted = curvatureFactor > 0.85 && car.nitro > 15 && Math.random() < tuning.nitroUsage * dt * 2;

    return {
      throttle,
      brake,
      steer: clamp(this.smoothedSteer, -1, 1),
      handbrake: false,
      nitro: nitroWanted,
    };
  }

  private lastIndex(car: RaceCar, track: Track): number {
    const stored = (car as any)._aiSampleIdx as number | undefined;
    return stored ?? track.nearestIndexFull(car.body.x, car.body.y);
  }

  private updateOvertake(car: RaceCar, rivals: RaceCar[], track: Track, idx: number): void {
    let closest: RaceCar | null = null;
    let closestDist = Infinity;
    for (const r of rivals) {
      if (r === car) continue;
      const d = Math.hypot(r.body.x - car.body.x, r.body.y - car.body.y);
      if (d < closestDist && d < 22) {
        // roughly ahead: project onto track direction
        const dir = track.sampleAt(idx).angle;
        const dx = r.body.x - car.body.x;
        const dy = r.body.y - car.body.y;
        const along = dx * Math.cos(dir) + dy * Math.sin(dir);
        if (along > 1) { closestDist = d; closest = r; }
      }
    }
    if (closest) {
      const dir = track.sampleAt(idx).angle;
      const perp = { x: -Math.sin(dir), y: Math.cos(dir) };
      const lateralOfRival = (closest.body.x - car.body.x) * perp.x + (closest.body.y - car.body.y) * perp.y;
      const desiredSide = lateralOfRival >= 0 ? -1 : 1;
      this.overtakeOffset += (desiredSide * 2.4 - this.overtakeOffset) * 0.08;
    } else {
      this.overtakeOffset *= 0.92;
    }
  }
}

function advanceIndex(track: Track, idx: number, meters: number): number {
  const n = track.samples.length;
  const spacing = track.totalLength / n;
  const steps = Math.max(1, Math.round(meters / Math.max(0.5, spacing)));
  return (idx + steps) % n;
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
