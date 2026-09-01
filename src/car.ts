import { clamp, wrapAngle, type Vec } from './math';
import type { CarStats } from './cars';
import type { Track } from './tracks';
import { DEFAULT_WEATHER, type WeatherDef } from './weather';

export interface Controls {
  /** 1 accelerate, -1 brake/reverse. */
  throttle: number;
  /** -1 left, 1 right. */
  steer: number;
  handbrake: boolean;
  /** Burn nitro while held, if the tank has anything left. */
  nitro: boolean;
}

export const NEUTRAL: Controls = { throttle: 0, steer: 0, handbrake: false, nitro: false };

/** Seconds off the racing surface before the marshals step in. */
export const RECOVERY_DELAY = 3;
/** How long the car blinks before it is lifted back onto the road. */
export const RECOVERY_BLINK = 0.9;
/** How long the engine stays down on power after a recovery. */
export const RECOVERY_PENALTY = 1.8;
/** Throttle multiplier while that penalty lasts. */
export const RECOVERY_POWER = 0.42;

export type RecoveryPhase = 'none' | 'blink' | 'penalty';

/** How long the box takes to swap ratios. */
export const SHIFT_TIME = 0.26;
/** Torque left at the driven wheels in the middle of a change. */
export const SHIFT_TORQUE = 0.12;
/** A gear is only dropped below this fraction of its own upshift speed. */
const DOWNSHIFT_HYSTERESIS = 0.86;
/** Idle end of the rev range, so a rolling engine never reads zero. */
const IDLE_RPM = 0.18;

/**
 * How well the brakes still work at a given condition. The bands are the ones
 * the gauge shows: full, slightly down, noticeably down, badly down, and gone.
 */
export function brakeEfficiency(condition: number): number {
  if (condition >= 76) return 1;
  if (condition >= 51) return 0.85;
  if (condition >= 26) return 0.65;
  if (condition >= 1) return 0.45;
  return 0.2;
}

/** Which gear a given speed calls for, 1-based. */
export function gearForSpeed(shiftUp: number[], speed: number, current: number): number {
  let gear = 1;
  for (let i = 0; i < shiftUp.length; i++) {
    if (speed >= shiftUp[i]) gear = i + 2;
  }
  // Hysteresis on the way down, so a car sitting on a threshold doesn't hunt.
  if (gear < current && current >= 2) {
    const holdAt = shiftUp[current - 2] * DOWNSHIFT_HYSTERESIS;
    if (speed >= holdAt) return current;
  }
  return gear;
}

/** Where the revs sit inside the current gear's speed band, 0..1. */
export function rpmFor(shiftUp: number[], gear: number, speed: number, maxSpeed: number): number {
  const lo = gear <= 1 ? 0 : shiftUp[gear - 2];
  const hi = gear - 1 < shiftUp.length ? shiftUp[gear - 1] : Math.max(maxSpeed, lo + 1);
  const span = Math.max(1, hi - lo);
  return clamp(IDLE_RPM + (1 - IDLE_RPM) * ((speed - lo) / span), IDLE_RPM, 1);
}

export interface SurfaceFeel {
  gripMul: number;
  speedMul: number;
  extraDrag: number;
  offTrack: boolean;
}

export function surfaceFeel(
  track: Track,
  onTrack: boolean,
  weather: WeatherDef = DEFAULT_WEATHER,
): SurfaceFeel {
  if (onTrack) {
    return {
      gripMul: track.def.gripScale * weather.gripMul,
      speedMul: track.def.speedScale * weather.speedMul,
      extraDrag: track.def.surface === 'dirt' ? 0.25 : 0,
      offTrack: false,
    };
  }
  return {
    gripMul: track.def.gripScale * weather.gripMul * 0.55,
    speedMul: 0.42 * weather.speedMul,
    extraDrag: 2.4,
    offTrack: true,
  };
}

export class RaceCar {
  pos: Vec;
  vel: Vec = { x: 0, y: 0 };
  heading: number;
  readonly stats: CarStats;
  readonly isPlayer: boolean;
  readonly name: string;
  readonly carIndex: number;

  /** Longitudinal / lateral speed of the last step, for effects and AI. */
  forwardSpeed = 0;
  slip = 0;
  offTrack = false;

  /** Seconds of nitro left in the tank, and whether it is burning right now. */
  nitro: number;
  nitroActive = false;
  /** After running dry the bottle needs a quarter tank before it works again. */
  nitroLocked = false;

  /** Marshal recovery: only cars asked to (the player) get lifted back on. */
  autoRecover = false;
  offTrackTime = 0;
  recovery: RecoveryPhase = 'none';
  recoveryTimer = 0;
  /** Set for one frame when the car is put back on the road. */
  respawned = false;

  /** Automatic gearbox: current ratio, the change in progress, and the revs. */
  gear = 1;
  shiftTimer = 0;
  rpm = IDLE_RPM;
  /** Set for one frame on a change, so the HUD and audio can react. */
  shifted: 'up' | 'down' | null = null;

  /** Brake condition in whole percent, 100 down to 0. */
  brake = 100;
  private brakeWorn = 0;

  /** Laps completed; starts at -1 because cars line up before the line. */
  lap = -1;
  finished = false;
  finishTime = 0;
  lastFrac = 0;
  wpHint = 0;
  /** lap + fraction of the lap done: the sort key for race position. */
  raceProgress = 0;
  position = 1;

  controls: Controls = { ...NEUTRAL };

  constructor(opts: {
    pos: Vec;
    heading: number;
    stats: CarStats;
    isPlayer: boolean;
    name: string;
    carIndex: number;
  }) {
    this.pos = { ...opts.pos };
    this.heading = opts.heading;
    this.stats = opts.stats;
    this.isPlayer = opts.isPlayer;
    this.name = opts.name;
    this.carIndex = opts.carIndex;
    this.nitro = opts.stats.nitroCapacity;
  }

  /** Total number of ratios this car's box has. */
  get gearCount(): number {
    return this.stats.shiftUp.length + 1;
  }

  /** True while the car should flicker: during the lift and the power penalty. */
  get blinking(): boolean {
    return this.recovery !== 'none';
  }

  /** How full the tank is, 0..1 — what the nitro bar draws. */
  get nitroRatio(): number {
    return this.stats.nitroCapacity > 0 ? this.nitro / this.stats.nitroCapacity : 0;
  }

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.y);
  }

  /** Advances the arcade physics by dt seconds. */
  update(dt: number, track: Track, weather: WeatherDef = DEFAULT_WEATHER): void {
    const s = this.stats;
    const c = this.controls;
    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);

    const near = track.nearest(this.pos, this.wpHint);
    this.wpHint = near.index;
    const feel = surfaceFeel(track, near.dist <= track.def.halfWidth, weather);
    this.offTrack = feel.offTrack;
    const recovering = this.updateRecovery(dt, track, near.along);

    // Nitro: burns while held and the tank lasts, otherwise it trickles back.
    // Running the bottle dry locks it out until a quarter tank is back, so an
    // empty gauge can't stutter out a string of useless micro-boosts.
    this.nitroActive = c.nitro && !this.nitroLocked && this.nitro > 0 && !this.finished;
    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - dt);
      if (this.nitro === 0) this.nitroLocked = true;
    } else if (!c.nitro) {
      // The tank only refills once the button is released, so an empty gauge
      // stays empty until the player lets go.
      this.nitro = Math.min(s.nitroCapacity, this.nitro + s.nitroRegen * dt);
      if (this.nitroLocked && this.nitro >= s.nitroCapacity * 0.25) this.nitroLocked = false;
    }
    const boost = this.nitroActive ? s.nitroBoost : 1;

    // Split velocity into "along the car" and "sideways" components.
    let vf = this.vel.x * cos + this.vel.y * sin;
    let vr = -this.vel.x * sin + this.vel.y * cos;

    // The box picks its own ratio from road speed; a change costs a moment of
    // drive and drops the revs before they climb again.
    this.shifted = null;
    const nextGear = gearForSpeed(s.shiftUp, Math.abs(vf), this.gear);
    if (nextGear !== this.gear) {
      this.shifted = nextGear > this.gear ? 'up' : 'down';
      this.gear = nextGear;
      this.shiftTimer = SHIFT_TIME;
    }
    if (this.shiftTimer > 0) this.shiftTimer = Math.max(0, this.shiftTimer - dt);
    const shiftProgress = this.shiftTimer / SHIFT_TIME;
    // Drive comes back in along a curve, so the change is felt as a real pause
    // rather than a linear fade.
    const recovered = (1 - shiftProgress) * (1 - shiftProgress);
    const drive = SHIFT_TORQUE + (1 - SHIFT_TORQUE) * recovered;

    // Revs follow the gear band, dip through the change, then recover.
    const targetRpm = rpmFor(s.shiftUp, this.gear, Math.abs(vf), s.maxSpeed) * (1 - 0.45 * shiftProgress);
    this.rpm += (targetRpm - this.rpm) * (1 - Math.exp(-9 * dt));

    // While the marshals have the car, the driver has no say in it.
    const power = this.recovery === 'penalty' ? RECOVERY_POWER : 1;
    const maxSpeed = s.maxSpeed * feel.speedMul * boost;
    if (recovering) {
      vf -= vf * 2.6 * dt;
    } else if (c.throttle > 0) {
      vf += s.accel * boost * power * drive * c.throttle * dt * (vf < maxSpeed ? 1 : 0);
    } else if (c.throttle < 0) {
      if (vf > 8) {
        // Worn brakes bite less, and hard stops from speed wear them further.
        vf -= s.brake * brakeEfficiency(this.brake) * -c.throttle * dt;
        this.wearBrakes(dt, vf, s);
      } else {
        vf -= s.accel * 0.75 * drive * -c.throttle * dt;
      }
    }

    // Rolling resistance, plus extra when off the racing surface.
    const drag = s.drag + feel.extraDrag + (c.handbrake ? 1.6 : 0) + (recovering ? 1.2 : 0);
    vf -= vf * drag * dt;
    if (c.throttle === 0 && Math.abs(vf) < 6) vf *= 0.9;
    vf = clamp(vf, -s.reverseMax, maxSpeed);

    // Grip: the sideways component bleeds off, slower on loose surfaces.
    const grip = s.grip * feel.gripMul * (c.handbrake ? 0.3 : 1);
    vr *= Math.exp(-grip * dt);

    // Rebuild the velocity in the frame the car had *before* steering, so the
    // car can rotate without the velocity following it instantly: that
    // mismatch is the slide, and grip is what pulls the two back together.
    this.vel.x = cos * vf - sin * vr;
    this.vel.y = sin * vf + cos * vr;

    // Steering scales in with speed so parked cars can't spin on the spot.
    const speedFactor = clamp(Math.abs(vf) / 70, 0, 1);
    const highSpeedTrim = 1 - 0.22 * clamp(Math.abs(vf) / s.maxSpeed, 0, 1);
    const dir = vf < -1 ? -1 : 1;
    const steer = recovering ? 0 : c.steer;
    this.heading = wrapAngle(
      this.heading + steer * s.turnRate * speedFactor * highSpeedTrim * dir * dt,
    );

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    this.pos.x = clamp(this.pos.x, 12, track.def.worldW - 12);
    this.pos.y = clamp(this.pos.y, 12, track.def.worldH - 12);

    const ncos = Math.cos(this.heading);
    const nsin = Math.sin(this.heading);
    vf = this.vel.x * ncos + this.vel.y * nsin;
    const slip = -this.vel.x * nsin + this.vel.y * ncos;

    this.forwardSpeed = vf;
    this.slip = Math.abs(slip);

    // Once a car has taken the flag its lap counter stops, so the cool-down
    // laps it drives afterwards can't change the result.
    if (!this.finished) this.trackProgress(track, near.along);
  }

  /** Brake condition only ever falls in whole percent, and only under braking. */
  private wearBrakes(dt: number, speed: number, s: CarStats): void {
    if (this.brake <= 0) return;
    const load = 0.35 + 0.65 * clamp(speed / s.maxSpeed, 0, 1);
    this.brakeWorn += s.brakeWear * load * dt;
    while (this.brakeWorn >= 1 && this.brake > 0) {
      this.brakeWorn -= 1;
      this.brake -= 1;
    }
  }

  /**
   * Counts the time spent off the road and runs the rescue: a blink where the
   * car coasts to a stop, then a lift back onto the racing line, then a short
   * spell on reduced power. Returns true while the driver has no control.
   */
  private updateRecovery(dt: number, track: Track, along: number): boolean {
    this.respawned = false;
    if (!this.autoRecover || this.finished) {
      this.offTrackTime = 0;
      this.recovery = 'none';
      return false;
    }

    if (this.recovery === 'none') {
      this.offTrackTime = this.offTrack ? this.offTrackTime + dt : 0;
      if (this.offTrackTime >= RECOVERY_DELAY) {
        this.recovery = 'blink';
        this.recoveryTimer = RECOVERY_BLINK;
        this.offTrackTime = 0;
      }
      return false;
    }

    this.recoveryTimer -= dt;
    if (this.recovery === 'blink') {
      if (this.recoveryTimer <= 0) {
        this.placeOnTrack(track, along);
        this.recovery = 'penalty';
        this.recoveryTimer = RECOVERY_PENALTY;
        this.respawned = true;
      }
      return true;
    }

    if (this.recoveryTimer <= 0) this.recovery = 'none';
    return false;
  }

  /** Drops the car back on the centre line, pointed the right way. */
  private placeOnTrack(track: Track, along: number): void {
    const at = track.pointAt(along);
    this.pos = { ...at.pos };
    this.heading = at.heading;
    // Rejoin at a crawl, so being rescued is never faster than driving.
    const speed = Math.min(Math.hypot(this.vel.x, this.vel.y), 55);
    this.vel = { x: Math.cos(at.heading) * speed, y: Math.sin(at.heading) * speed };
    this.wpHint = at.index;
    this.offTrack = false;
    this.nitroActive = false;
  }

  private trackProgress(track: Track, along: number): void {
    const frac = along / track.totalLen;
    if (this.lastFrac > 0.75 && frac < 0.25) this.lap += 1;
    else if (this.lastFrac < 0.25 && frac > 0.75) this.lap -= 1;
    this.lastFrac = frac;
    this.raceProgress = this.lap + frac;
  }

  /** Sets the lap counter's baseline for a car placed on the starting grid. */
  primeGrid(track: Track): void {
    const near = track.nearest(this.pos);
    this.wpHint = near.index;
    this.lastFrac = near.along / track.totalLen;
    this.lap = -1;
    this.raceProgress = this.lap + this.lastFrac;
  }

  /** Displayed lap number, 1-based and clamped to the race length. */
  displayLap(totalLaps: number): number {
    return clamp(this.lap + 1, 1, totalLaps);
  }
}

/** Pushes two overlapping cars apart and trades a little momentum. */
export function resolveCarCollision(a: RaceCar, b: RaceCar): boolean {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const d = Math.hypot(dx, dy);
  const minDist = a.stats.radius + b.stats.radius;
  if (d >= minDist || d === 0) return false;

  const nx = dx / d;
  const ny = dy / d;
  const overlap = minDist - d;
  const ma = a.stats.mass;
  const mb = b.stats.mass;
  const total = ma + mb;

  a.pos.x -= nx * overlap * (mb / total);
  a.pos.y -= ny * overlap * (mb / total);
  b.pos.x += nx * overlap * (ma / total);
  b.pos.y += ny * overlap * (ma / total);

  const rvx = b.vel.x - a.vel.x;
  const rvy = b.vel.y - a.vel.y;
  const sep = rvx * nx + rvy * ny;
  if (sep > 0) return true; // already moving apart

  const impulse = (-(1 + 0.25) * sep) / (1 / ma + 1 / mb);
  a.vel.x -= (impulse * nx) / ma;
  a.vel.y -= (impulse * ny) / ma;
  b.vel.x += (impulse * nx) / mb;
  b.vel.y += (impulse * ny) / mb;
  return true;
}

/** Bounces a car off a solid roadside prop. */
export function resolveObstacleCollision(
  car: RaceCar,
  obstacle: { pos: Vec; radius: number },
): boolean {
  if (obstacle.radius <= 0) return false;
  const dx = car.pos.x - obstacle.pos.x;
  const dy = car.pos.y - obstacle.pos.y;
  const d = Math.hypot(dx, dy);
  const minDist = car.stats.radius + obstacle.radius;
  if (d >= minDist || d === 0) return false;

  const nx = dx / d;
  const ny = dy / d;
  car.pos.x = obstacle.pos.x + nx * minDist;
  car.pos.y = obstacle.pos.y + ny * minDist;

  const into = car.vel.x * nx + car.vel.y * ny;
  if (into < 0) {
    // Reflect with heavy damping: hitting scenery should cost you the corner.
    car.vel.x -= into * nx * 1.35;
    car.vel.y -= into * ny * 1.35;
    car.vel.x *= 0.55;
    car.vel.y *= 0.55;
  }
  return true;
}

export interface AISkill {
  /** Fraction of the corner speed limit this driver dares to carry. */
  pace: number;
  /** Preferred offset from the centre line, -1..1 of the half width. */
  line: number;
  /** Steering gain. */
  reaction: number;
  /** How much this driver drifts around its chosen line. */
  wobble: number;
  /** Fraction of the tank kept in reserve before spending nitro. */
  nitroReserve: number;
}

/** Waypoint-following opponent driver. */
export class AIDriver {
  private stuckTimer = 0;
  private reverseTimer = 0;
  private wobble: number;

  constructor(
    readonly car: RaceCar,
    readonly track: Track,
    readonly skill: AISkill,
  ) {
    this.wobble = (car.carIndex + 1) * 1.7;
  }

  update(dt: number, others: RaceCar[]): void {
    const car = this.car;
    const track = this.track;
    const near = track.nearest(car.pos, car.wpHint);
    this.wobble += dt;

    // Aim at a point down the road; the faster you go, the further you look.
    const lookahead = 55 + Math.abs(car.forwardSpeed) * 0.42;
    const ahead = track.pointAt(near.along + lookahead);
    const drift = Math.sin(this.wobble * 0.35) * 0.25 * this.skill.wobble;
    const lateral = (this.skill.line + drift) * track.def.halfWidth * 0.5;
    const target: Vec = {
      x: ahead.pos.x - Math.sin(ahead.heading) * lateral,
      y: ahead.pos.y + Math.cos(ahead.heading) * lateral,
    };

    let steer = clamp(
      wrapAngle(Math.atan2(target.y - car.pos.y, target.x - car.pos.x) - car.heading) *
        this.skill.reaction,
      -1,
      1,
    );

    // Look up the road for the tightest corner within braking distance and
    // pick a speed the car can actually hold through it.
    const segLen = track.totalLen / track.count;
    const brakeDist = 40 + (car.forwardSpeed * car.forwardSpeed) / (2 * car.stats.brake);
    const window = Math.max(3, Math.ceil(brakeDist / segLen));
    const cornerGrip = 210 * track.def.gripScale * this.skill.pace;
    const topSpeed = car.stats.maxSpeed * track.def.speedScale;
    let targetSpeed = topSpeed * this.skill.pace;
    for (let k = 0; k <= window; k++) {
      const r = track.radius(near.index + k);
      targetSpeed = Math.min(targetSpeed, Math.sqrt(cornerGrip * r));
    }
    targetSpeed = clamp(targetSpeed, topSpeed * 0.28, topSpeed);
    if (near.dist > track.def.halfWidth) targetSpeed *= 0.6;

    let throttle = car.forwardSpeed > targetSpeed ? -1 : 1;

    // Don't drive through the car in front: ease off and pick a side.
    for (const o of others) {
      if (o === car) continue;
      const dx = o.pos.x - car.pos.x;
      const dy = o.pos.y - car.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 80) continue;
      const rel = wrapAngle(Math.atan2(dy, dx) - car.heading);
      if (Math.abs(rel) > 0.9) continue;
      steer = clamp(steer - Math.sign(rel || 1) * (1 - d / 80) * 0.85, -1, 1);
      if (d < 46) throttle = Math.min(throttle, 0);
    }

    // Beached on the grass or wedged against scenery: back up and try again.
    if (Math.abs(car.forwardSpeed) < 18 && this.reverseTimer <= 0) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.4) {
        this.reverseTimer = 0.9;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      throttle = -1;
      steer = -steer;
    }

    // Nitro goes down the straights: only when the road ahead opens up, the
    // car is pointed the right way and there is a worthwhile amount left.
    const straightAhead = track.radius(near.index + 2) > 420 && track.radius(near.index + 6) > 360;
    const useNitro =
      straightAhead &&
      throttle > 0 &&
      Math.abs(steer) < 0.35 &&
      near.dist < track.def.halfWidth &&
      car.nitro > car.stats.nitroCapacity * this.skill.nitroReserve;

    car.controls = { throttle, steer, handbrake: false, nitro: useNitro };
  }
}
