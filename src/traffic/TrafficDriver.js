import * as THREE from 'three';
import { angleDiff, clamp } from '../core/math.js';
import { NPCHealth } from '../npc/NPCHealth.js';

const ACCEL = 3.2;
const BRAKE = 7;
const EMERGENCY_BRAKE = 14;
const TURN_SPEED = 5.5;
const LOOK_AHEAD = 2.2;

/**
 * Lightweight lane-following driver for one traffic car. It owns the car's
 * route and speed only; the Vehicle just receives a kinematic pose.
 */
export class TrafficDriver {
  constructor({ vehicle, network, rng, lane, distance, rig }) {
    this.vehicle = vehicle;
    this.network = network;
    this.rng = rng;
    this.rig = rig;
    this.cruise = 8.5 + rng() * 3;
    this.speed = this.cruise * 0.6;
    this.points = [];
    this.stops = new Map(); // point index -> lane that ends there (stop line)
    this.index = 0; // current segment start
    this.along = 0; // distance travelled along the current segment
    this.lane = lane;
    this.appendLane(lane);
    this.advance(distance);
    const p = this.position();
    this.x = p.x;
    this.z = p.z;
    this.yaw = this.headingAhead();
    this.blockedTime = 0;
    this.ghostTime = 0;
    this.honkCooldown = 0;
    this.panicTime = 0;
    this.hijacked = false;
    this.blockedByPlayer = 0;
    this.health = new NPCHealth(100);
    this.armInjury = 0;
  }

  appendLane(lane) {
    if (!this.points.length) this.points.push(lane.start.clone());
    this.points.push(lane.end.clone());
    this.stops.set(this.points.length - 1, lane);
    this.tailLane = lane;
  }

  /** Extends the route through the next intersection when it is getting short. */
  ensureRoute() {
    let remaining = 0;
    for (let i = this.index; i < this.points.length - 1; i++) remaining += this.points[i].distanceTo(this.points[i + 1]);
    remaining -= this.along;
    while (remaining < 40) {
      const next = this.network.chooseNext(this.tailLane, this.rng);
      const turn = this.network.turnPoints(this.tailLane, next);
      let last = this.points[this.points.length - 1];
      for (const p of [...turn, next.start]) {
        remaining += last.distanceTo(p);
        this.points.push(p.clone());
        last = p;
      }
      this.points.push(next.end.clone());
      remaining += next.start.distanceTo(next.end);
      this.stops.set(this.points.length - 1, next);
      this.tailLane = next;
    }
    // Drop points we have long passed.
    if (this.index > 30) {
      const drop = this.index - 2;
      this.points.splice(0, drop);
      const stops = new Map();
      for (const [i, l] of this.stops) if (i - drop >= 0) stops.set(i - drop, l);
      this.stops = stops;
      this.index -= drop;
    }
  }

  advance(dist) {
    this.ensureRoute();
    this.along += dist;
    while (this.index < this.points.length - 1) {
      const len = this.points[this.index].distanceTo(this.points[this.index + 1]);
      if (this.along < len) break;
      this.along -= len;
      this.index++;
      if (this.stops.has(this.index)) this.lane = this.stops.get(this.index);
      this.ensureRoute();
    }
  }

  /** Point at `ahead` metres further along the route. */
  position(ahead = 0, target = new THREE.Vector3()) {
    let i = this.index;
    let d = this.along + ahead;
    while (i < this.points.length - 1) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const len = a.distanceTo(b);
      if (d <= len || i === this.points.length - 2) return target.copy(a).lerp(b, len > 0 ? Math.min(1, d / len) : 0);
      d -= len;
      i++;
    }
    return target.copy(this.points[this.points.length - 1]);
  }

  headingAhead(ahead = LOOK_AHEAD) {
    const a = this.position(0);
    const b = this.position(ahead);
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  /** Distance along the route to the next stop line, and the lane it belongs to. */
  nextStop() {
    let d = -this.along;
    for (let i = this.index; i < this.points.length - 1; i++) {
      d += this.points[i].distanceTo(this.points[i + 1]);
      if (this.stops.has(i + 1)) return { distance: d, lane: this.stops.get(i + 1) };
      if (d > 60) break;
    }
    return null;
  }

  /** Movement through `node` coming from `lane`: straight-through on an axis can share the junction. */
  reserve(node, lane) {
    node.reservations ??= [];
    const next = this.nextLaneAfter(lane);
    const straight = !!next && next.dir.x === lane.dir.x && next.dir.z === lane.dir.z;
    const ok = node.reservations.every((r) => r.straight && straight && r.axis === lane.axis);
    if (!ok) return false;
    if (this.reserved) this.releaseReservation();
    this.reserved = { node, straight, axis: lane.axis, driver: this };
    node.reservations.push(this.reserved);
    return true;
  }

  releaseReservation() {
    const r = this.reserved;
    if (!r) return;
    r.node.reservations = r.node.reservations.filter((x) => x !== r);
    this.reserved = null;
  }

  /** The lane the route takes after `lane` (already planned by ensureRoute). */
  nextLaneAfter(lane) {
    let seen = false;
    for (const [, l] of [...this.stops].sort((a, b) => a[0] - b[0])) {
      if (seen) return l;
      if (l === lane) seen = true;
    }
    return null;
  }

  panic() {
    this.panicTime = 8;
  }

  /**
   * @param {number} dt
   * @param {{vehicles:Array, obstacles:Array<{x:number,z:number,r:number,player?:boolean}>, lights:object, audio:object}} ctx
   */
  update(dt, ctx) {
    this.honkCooldown -= dt;
    this.panicTime = Math.max(0, this.panicTime - dt);
    this.ghostTime = Math.max(0, this.ghostTime - dt);
    const v = this.vehicle;
    const def = v.def;
    let target = this.panicTime > 0 ? this.cruise * 1.4 : this.cruise;

    // Slow for curves: compare heading now with heading a few metres ahead.
    const bend = Math.abs(angleDiff(this.headingAhead(1), this.headingAhead(9)));
    if (bend > 0.35) target = Math.min(target, TURN_SPEED + (this.panicTime > 0 ? 2 : 0));

    // Leave the intersection we hold once we are clear of it.
    if (this.reserved) {
      const n = this.reserved.node;
      const along = (this.x - n.x) * Math.sin(this.yaw) + (this.z - n.z) * Math.cos(this.yaw);
      if (Math.hypot(this.x - n.x, this.z - n.z) > 12 + def.length / 2 && along > 0) this.releaseReservation();
    }

    // Stop lines: traffic signals, then a one-at-a-time reservation of the junction.
    const stop = this.nextStop();
    if (stop && stop.lane.to) {
      const node = stop.lane.to;
      const dist = stop.distance - def.length / 2;
      let mustStop = false;
      if (node.signalized && this.panicTime <= 0) {
        const state = ctx.lights.stateFor(stop.lane.axis);
        if (state === 'red' || (state === 'yellow' && dist > 7)) mustStop = true;
      }
      if (!mustStop && dist < 7 && this.reserved?.node !== node) {
        mustStop = !this.reserve(node, stop.lane);
      }
      if (mustStop) target = Math.min(target, this.stoppingSpeed(dist - 0.5));
      else if (!node.signalized && dist < 14 && this.reserved?.node !== node) target = Math.min(target, Math.max(4, dist * 0.5));
    }

    // Keep distance from anything ahead in our path.
    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);
    const reach = 5 + this.speed * 1.6;
    let blockedByPlayer = false;
    let blockedByTraffic = false;
    const consider = (x, z, halfLen, halfWidth, isPlayer, isTraffic) => {
      const dx = x - this.x;
      const dz = z - this.z;
      const f = dx * fwdX + dz * fwdZ;
      if (f <= 0 || f > reach + halfLen) return;
      const l = Math.abs(dx * fwdZ - dz * fwdX);
      if (l > def.width / 2 + halfWidth + 0.35) return;
      const gap = f - def.length / 2 - halfLen;
      const allowed = gap < 1.2 ? 0 : (gap - 1.2) * 1.6;
      if (allowed < target) {
        target = allowed;
        blockedByPlayer = isPlayer;
        blockedByTraffic = isTraffic;
      }
    };
    for (const other of ctx.vehicles) {
      if (other === v || other.disposed) continue;
      const isTraffic = other.mode === 'traffic';
      if (isTraffic && this.ghostTime > 0) continue;
      const p = other.currPos;
      if (Math.abs(p.x - this.x) > 30 || Math.abs(p.z - this.z) > 30) continue;
      // Use the larger extent of the other car so crossing cars are seen too.
      const ext = Math.max(other.halfExtents.x, other.halfExtents.z);
      consider(p.x, p.z, ext * 0.8, ext * 0.8, other.driver === 'player', isTraffic);
    }
    for (const o of ctx.obstacles) {
      if (Math.abs(o.x - this.x) > 25 || Math.abs(o.z - this.z) > 25) continue;
      consider(o.x, o.z, o.r, o.r, !!o.player, false);
    }
    if (this.hijacked) target = 0;

    // Break rare gridlocks between AI cars by letting this one creep through.
    if (target < 0.1 && blockedByTraffic) this.blockedTime += dt;
    else this.blockedTime = 0;
    if (this.blockedTime > 10) {
      this.ghostTime = 2.5;
      this.blockedTime = 0;
    }
    this.blockedByPlayer = blockedByPlayer && target < 0.5 ? this.blockedByPlayer + dt : 0;
    if (this.blockedByPlayer > 1.5 && this.honkCooldown <= 0 && !this.hijacked) {
      ctx.audio.play('horn', v.currPos, 0.8);
      this.honkCooldown = 5;
    }

    const rate = target > this.speed ? ACCEL : this.hijacked || target < 0.5 ? EMERGENCY_BRAKE : BRAKE;
    const prev = this.speed;
    this.speed += clamp(target - this.speed, -rate * dt, rate * dt);
    v.braking = this.speed < prev - 0.01 && this.speed > 0.2;

    this.advance(this.speed * dt);
    const p = this.position();
    this.x = p.x;
    this.z = p.z;
    const desiredYaw = this.headingAhead();
    this.yaw += angleDiff(this.yaw, desiredYaw) * Math.min(1, dt * 10);
    let steer = clamp(angleDiff(this.yaw, this.headingAhead(5)) * 1.5, -0.5, 0.5);
    // An injured arm makes the steering visibly unsteady.
    this.armInjury = Math.max(0, this.armInjury - dt);
    if (this.armInjury > 0) steer += Math.sin(performance.now() * 0.006) * 0.25;
    v.driveKinematic(this.x, this.z, this.yaw, this.speed, steer);
  }

  stoppingSpeed(distance) {
    if (distance <= 0) return 0;
    return Math.sqrt(2 * BRAKE * 0.7 * distance);
  }
}
