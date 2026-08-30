import type { RaceCar } from '../entities/car';
import type { DecorationInstance } from '../track/track';

const CAR_RADIUS = 1.7;

export interface CollisionEvent {
  car: RaceCar;
  impactSpeed: number;
  x: number;
  y: number;
}

/** Resolves circle-circle collisions between cars, applying a simple
 * elastic impulse weighted by mass and damaging both cars by impact speed. */
export function resolveCarCollisions(cars: RaceCar[], onImpact: (e: CollisionEvent) => void): void {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.body.x - a.body.x;
      const dy = b.body.y - a.body.y;
      const dist = Math.hypot(dx, dy);
      const minDist = CAR_RADIUS * 2;
      if (dist > minDist || dist < 1e-4) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;

      const massA = a.effectiveStats.weight;
      const massB = b.effectiveStats.weight;
      const totalMass = massA + massB;
      a.body.x -= nx * overlap * (massB / totalMass);
      a.body.y -= ny * overlap * (massB / totalMass);
      b.body.x += nx * overlap * (massA / totalMass);
      b.body.y += ny * overlap * (massA / totalMass);

      const avx = Math.cos(a.body.angle) * a.body.forwardSpeed - Math.sin(a.body.angle) * a.body.lateralSpeed;
      const avy = Math.sin(a.body.angle) * a.body.forwardSpeed + Math.cos(a.body.angle) * a.body.lateralSpeed;
      const bvx = Math.cos(b.body.angle) * b.body.forwardSpeed - Math.sin(b.body.angle) * b.body.lateralSpeed;
      const bvy = Math.sin(b.body.angle) * b.body.forwardSpeed + Math.cos(b.body.angle) * b.body.lateralSpeed;

      const relVx = avx - bvx;
      const relVy = avy - bvy;
      const relSpeed = Math.hypot(relVx, relVy);
      const closingSpeed = relVx * nx + relVy * ny;
      if (closingSpeed > 0) continue; // separating already

      const restitution = 0.35;
      const impulse = (-(1 + restitution) * closingSpeed) / (1 / massA + 1 / massB);
      const ix = impulse * nx;
      const iy = impulse * ny;

      applyImpulseToBody(a, -ix / massA, -iy / massA);
      applyImpulseToBody(b, ix / massB, iy / massB);

      const impactSpeed = Math.abs(closingSpeed);
      if (impactSpeed > 1.5) {
        const dmg = Math.min(30, impactSpeed * 0.9);
        a.applyDamage(dmg * 0.6);
        b.applyDamage(dmg * 0.6);
        onImpact({ car: a, impactSpeed, x: a.body.x, y: a.body.y });
        onImpact({ car: b, impactSpeed, x: b.body.x, y: b.body.y });
      }
    }
  }
}

function applyImpulseToBody(car: RaceCar, dvx: number, dvy: number): void {
  const fwd = { x: Math.cos(car.body.angle), y: Math.sin(car.body.angle) };
  const right = { x: -fwd.y, y: fwd.x };
  car.body.forwardSpeed += dvx * fwd.x + dvy * fwd.y;
  car.body.lateralSpeed += dvx * right.x + dvy * right.y;
}

/** Resolves collisions against solid decorations (barriers, buildings, trees). */
export function resolveDecorationCollisions(cars: RaceCar[], decorations: DecorationInstance[], onImpact: (e: CollisionEvent) => void): void {
  for (const car of cars) {
    for (const deco of decorations) {
      if (!deco.solid) continue;
      const dx = car.body.x - deco.x;
      const dy = car.body.y - deco.y;
      const dist = Math.hypot(dx, dy);
      const minDist = CAR_RADIUS + deco.radius;
      if (dist > minDist || dist < 1e-4) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      car.body.x += nx * overlap;
      car.body.y += ny * overlap;

      const speed = Math.abs(car.body.forwardSpeed) + Math.abs(car.body.lateralSpeed);
      const fwd = { x: Math.cos(car.body.angle), y: Math.sin(car.body.angle) };
      const right = { x: -fwd.y, y: fwd.x };
      const vx = fwd.x * car.body.forwardSpeed + right.x * car.body.lateralSpeed;
      const vy = fwd.y * car.body.forwardSpeed + right.y * car.body.lateralSpeed;
      const into = vx * nx + vy * ny;
      if (into < 0) {
        const bounceVx = vx - (1.4) * into * nx;
        const bounceVy = vy - (1.4) * into * ny;
        car.body.forwardSpeed = bounceVx * fwd.x + bounceVy * fwd.y;
        car.body.lateralSpeed = bounceVx * right.x + bounceVy * right.y;
      }
      if (speed > 2) {
        const dmg = Math.min(35, speed * 1.1);
        car.applyDamage(dmg);
        onImpact({ car, impactSpeed: speed, x: car.body.x, y: car.body.y });
      }
    }
  }
}
