import type { CarStats } from '../data/types';

export interface CarInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1 (already resolved to "left is negative" internally)
  handbrake: boolean;
  nitro: boolean;
}

export interface PhysicsBody {
  x: number;
  y: number;
  angle: number; // heading, radians
  forwardSpeed: number; // m/s along heading
  lateralSpeed: number; // m/s perpendicular to heading (slip)
}

export interface SurfaceEffect {
  gripMultiplier: number;
  topSpeedMultiplier: number;
  rollingResistanceMultiplier: number;
}

const GRAVITY = 9.81;

/** Converts km/h stat to m/s */
export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}
export function msToKmh(ms: number): number {
  return ms * 3.6;
}

/**
 * Advances an arcade vehicle physics body by one fixed timestep.
 * Uses a forward/lateral decomposition (bicycle-like) model: engine force
 * drives the forward component, steering rotates the heading at a rate
 * proportional to speed, and lateral "slip" velocity is damped toward zero
 * by grip while steering/handbrake can intentionally induce it (drifting).
 */
export function stepCarPhysics(
  body: PhysicsBody,
  stats: CarStats,
  input: CarInput,
  dt: number,
  surface: SurfaceEffect,
  nitroActive: boolean,
  conditionFactor: number, // 0..1, 1 = perfect condition
  tireGripFactor: number, // 0..1 from tire wear/type
): void {
  const fwd = { x: Math.cos(body.angle), y: Math.sin(body.angle) };
  const right = { x: -fwd.y, y: fwd.x };

  const mass = stats.weight;
  const topSpeedMs = kmhToMs(stats.topSpeed) * surface.topSpeedMultiplier;
  const effAccel = stats.acceleration * conditionFactor;
  const effBrake = stats.braking * conditionFactor;
  const effGrip = stats.grip * conditionFactor * tireGripFactor * surface.gripMultiplier;
  const effHandling = stats.handling * conditionFactor;

  // --- Longitudinal (forward) dynamics ---
  const speedRatio = Math.max(0, body.forwardSpeed) / Math.max(1, topSpeedMs);
  const powerCurve = Math.max(0.08, 1 - speedRatio * speedRatio * 0.92);
  let engineForce = input.throttle * (effAccel / 100) * mass * 6.2 * powerCurve;
  if (nitroActive) engineForce *= 1.55;

  const brakingForce = input.brake * (effBrake / 100) * mass * 9.5;
  const rollingResistance = 0.02 * mass * GRAVITY * surface.rollingResistanceMultiplier;
  const dragCoefficient = 0.35 + (1 - surface.topSpeedMultiplier) * 0.4;

  let longForce = engineForce;
  if (body.forwardSpeed > 0.05) {
    longForce -= brakingForce;
    longForce -= rollingResistance;
    longForce -= dragCoefficient * body.forwardSpeed * body.forwardSpeed;
  } else if (body.forwardSpeed < -0.05) {
    longForce += brakingForce * 0.6; // braking also slows reverse
    longForce -= dragCoefficient * body.forwardSpeed * Math.abs(body.forwardSpeed);
  } else if (input.brake > 0 && input.throttle < 0.05) {
    // allow reverse from standstill
    longForce = -input.brake * (effAccel / 100) * mass * 3.2;
  }

  const longAccel = longForce / mass;
  body.forwardSpeed += longAccel * dt;
  body.forwardSpeed = clamp(body.forwardSpeed, -topSpeedMs * 0.4, topSpeedMs * 1.08);

  // --- Steering / heading ---
  const speedForSteer = Math.min(Math.abs(body.forwardSpeed), topSpeedMs);
  const wheelbase = 2.6 + mass / 3000; // heavier cars turn a bit wider
  const steerAngle = input.steer * maxSteerAngle(effHandling);
  const speedFactor = 1 - Math.min(0.55, speedForSteer / (topSpeedMs * 1.6));
  const direction = body.forwardSpeed >= 0 ? 1 : -1;
  const turnRate = direction * (speedForSteer / wheelbase) * Math.tan(steerAngle) * (0.55 + speedFactor * 0.6);
  body.angle += turnRate * dt;

  // --- Lateral slip / grip ---
  const gripDecayBase = 3.2 + (effGrip / 100) * 9.5;
  const handbrakeGripLoss = input.handbrake ? 0.18 : 1;
  const gripDecay = gripDecayBase * handbrakeGripLoss;

  // steering + handbrake induce slip; higher driftFactor stat keeps it controllable
  const driftStat = stats.driftFactor / 100;
  const inducedSlip = input.steer * speedForSteer * (0.55 + (1 - effGrip / 130)) * (input.handbrake ? 2.2 : 0.55);
  body.lateralSpeed += inducedSlip * dt * (0.6 + driftStat * 0.4);

  body.lateralSpeed *= Math.exp(-gripDecay * dt);
  const maxLateral = topSpeedMs * 0.85;
  body.lateralSpeed = clamp(body.lateralSpeed, -maxLateral, maxLateral);

  // --- Integrate position ---
  const vx = fwd.x * body.forwardSpeed + right.x * body.lateralSpeed;
  const vy = fwd.y * body.forwardSpeed + right.y * body.lateralSpeed;
  body.x += vx * dt;
  body.y += vy * dt;
}

function maxSteerAngle(handling: number): number {
  // roughly 22-38 degrees of effective front-wheel steering
  const deg = 22 + (handling / 100) * 16;
  return (deg * Math.PI) / 180;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const SURFACE_EFFECTS: Record<string, SurfaceEffect> = {
  asfalto: { gripMultiplier: 1.0, topSpeedMultiplier: 1.0, rollingResistanceMultiplier: 1.0 },
  terra: { gripMultiplier: 0.78, topSpeedMultiplier: 0.9, rollingResistanceMultiplier: 1.3 },
  grama: { gripMultiplier: 0.6, topSpeedMultiplier: 0.75, rollingResistanceMultiplier: 1.8 },
  lama: { gripMultiplier: 0.42, topSpeedMultiplier: 0.55, rollingResistanceMultiplier: 2.6 },
  areia: { gripMultiplier: 0.5, topSpeedMultiplier: 0.62, rollingResistanceMultiplier: 2.2 },
  gelo: { gripMultiplier: 0.32, topSpeedMultiplier: 0.85, rollingResistanceMultiplier: 0.6 },
  poca: { gripMultiplier: 0.55, topSpeedMultiplier: 0.9, rollingResistanceMultiplier: 1.1 },
};

export const TIRE_GRIP_BY_TYPE: Record<string, Partial<Record<string, number>>> = {
  normal: { asfalto: 1.0, terra: 0.8, grama: 0.75, lama: 0.6, areia: 0.65, gelo: 0.5, poca: 0.75 },
  racing: { asfalto: 1.15, terra: 0.6, grama: 0.55, lama: 0.4, areia: 0.5, gelo: 0.35, poca: 0.6 },
  chuva: { asfalto: 0.95, terra: 0.75, grama: 0.7, lama: 0.65, areia: 0.6, gelo: 0.55, poca: 1.05 },
  offroad: { asfalto: 0.85, terra: 1.1, grama: 1.05, lama: 1.0, areia: 1.0, gelo: 0.6, poca: 0.85 },
};
