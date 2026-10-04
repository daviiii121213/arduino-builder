import * as THREE from 'three';

const MAX_DENT = 0.16;
const SCUFF = new THREE.Color(0x4a4a4a);
const _p = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _smokePos = new THREE.Vector3();
const UP = { x: 0, y: 1, z: 0 };

/** Collision intensity tiers by velocity change (m/s): [min dv, damage per m/s]. */
export const IMPACT_TIERS = [
  { name: 'light', min: 4, rate: 1.0 },
  { name: 'medium', min: 7, rate: 1.9 },
  { name: 'heavy', min: 12, rate: 3.4 },
];
const BURN_TIME = 16;
const FIRE_CHANCE = 0.75;

/** Damage for an impact of `dv` m/s, and its tier. */
export function impactDamage(dv) {
  let tier = null;
  for (const t of IMPACT_TIERS) if (dv >= t.min) tier = t;
  return tier ? { tier: tier.name, amount: dv * tier.rate } : { tier: null, amount: 0 };
}

/**
 * Non-graphic vehicle damage: health, dents pressed into the body mesh,
 * scuffed paint, engine smoke and loss of engine power. At zero health the
 * car is disabled and may catch fire; after burning out it is a wreck that
 * can no longer be used.
 *
 * state: 'ok' -> 'disabled' -> ('burning' ->) 'destroyed'
 */
export class VehicleDamage {
  constructor(vehicle) {
    this.vehicle = vehicle;
    this.health = 100;
    this.state = 'ok';
    this.geometry = vehicle.model.body.geometry;
    this.offsets = new Float32Array(this.geometry.attributes.position.count);
    this.smokeTimer = 0;
    this.igniteTimer = -1;
    this.burnTime = 0;
    this.overkill = 0;
    this.events = [];
  }

  /** 1 = healthy engine, lower values cut power, 0 = dead engine. */
  get enginePower() {
    if (this.health <= 0) return 0;
    return this.health < 25 ? 0.45 : 1;
  }

  /** Can someone still get in and drive it? */
  get usable() {
    return this.state === 'ok';
  }

  /** Impact at a point in the vehicle's local frame, pushing in from `localDir`. */
  apply(amount, localPoint, radius = 0.6) {
    if (amount <= 0) return;
    if (this.state === 'disabled') {
      // Further punishment of a wreck sets it alight.
      this.overkill += amount;
      if (this.overkill > 18 && this.igniteTimer < 0) this.igniteTimer = 0.5;
    }
    this.health = Math.max(0, this.health - amount);
    const depth = Math.min(0.12, amount * 0.006);
    if (depth > 0.004) this.dent(localPoint, radius, depth);
    if (this.health <= 0 && this.state === 'ok') this.disable();
  }

  /** Engine dies; often catches fire a few seconds later. */
  disable() {
    this.state = 'disabled';
    this.events.push('disabled');
    this.igniteTimer = Math.random() < FIRE_CHANCE ? 2.5 + Math.random() * 3 : -1;
  }

  ignite(fire) {
    if (this.state === 'burning' || this.state === 'destroyed') return;
    if (this.state === 'ok') this.health = 0;
    this.state = 'burning';
    this.burnTime = BURN_TIME;
    this.onFire = fire?.ignite(this.vehicle) ?? false;
    this.events.push('fire');
  }

  /** Burnt out: blackened shell, glass gone, lights dead. */
  char() {
    this.state = 'destroyed';
    this.events.push('destroyed');
    const col = this.geometry.attributes.color;
    for (let i = 0; i < col.count; i++) {
      const k = 0.18 + (i % 7) * 0.012;
      col.setXYZ(i, col.getX(i) * 0.12 + k * 0.5, col.getY(i) * 0.12 + k * 0.48, col.getZ(i) * 0.12 + k * 0.45);
    }
    col.needsUpdate = true;
    const m = this.vehicle.model;
    m.glass.visible = false;
    m.beam.visible = false;
    this.vehicle.wreck = true;
  }

  /** Bullet impact at a world point. */
  applyBullet(worldPoint) {
    _p.set(worldPoint.x, worldPoint.y, worldPoint.z);
    this.vehicle.toLocal(_p, _p);
    this.apply(2.5, _p, 0.14);
  }

  /** A collision with velocity change `dv`; returns the tier ('light'/'medium'/'heavy') or null. */
  applyImpact(dv, worldDir) {
    const { tier, amount } = impactDamage(dv);
    if (tier) this.applyCrash(amount, worldDir);
    return tier;
  }

  /** Impact from a sudden velocity change (world-space direction of the lost velocity). */
  applyCrash(amount, worldDir) {
    const v = this.vehicle;
    _q.copy(v.currRot).invert();
    _dir.copy(worldDir).applyQuaternion(_q).setY(0);
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, 1);
    // Project onto the body outline: whichever side the push came from.
    const hx = v.halfExtents.x;
    const hz = v.halfExtents.z;
    const s = 1 / Math.max(Math.abs(_dir.x) / hx, Math.abs(_dir.z) / hz);
    _p.set(_dir.x * s, (v.def.belt + v.def.bottom) / 2, _dir.z * s);
    this.apply(amount, _p, 0.75);
  }

  dent(center, radius, depth) {
    const pos = this.geometry.attributes.position;
    const col = this.geometry.attributes.color;
    const cx = center.x;
    const cz = center.z;
    // Push vertices horizontally toward the car's centre line.
    const inLen = Math.hypot(cx, cz) || 1;
    const ix = -cx / inLen;
    const iz = -cz / inLen;
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - cx;
      const dy = pos.getY(i) - center.y;
      const dz = pos.getZ(i) - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const push = Math.min(depth * f * (0.7 + Math.random() * 0.6), MAX_DENT - this.offsets[i]);
      if (push <= 0) continue;
      this.offsets[i] += push;
      pos.setXYZ(i, pos.getX(i) + ix * push, pos.getY(i) - push * 0.3, pos.getZ(i) + iz * push);
      const c = Math.min(0.5, f * 0.6);
      col.setXYZ(i, col.getX(i) + (SCUFF.r - col.getX(i)) * c, col.getY(i) + (SCUFF.g - col.getY(i)) * c, col.getZ(i) + (SCUFF.b - col.getZ(i)) * c);
      changed = true;
    }
    if (changed) {
      pos.needsUpdate = true;
      col.needsUpdate = true;
      this.geometry.computeVertexNormals();
    }
  }

  /** Smoke from the engine bay once the car is badly damaged; fire countdown. */
  update(dt, effects, fire) {
    if (this.health > 55) return;
    if (this.igniteTimer > 0) {
      this.igniteTimer -= dt;
      if (this.igniteTimer <= 0) this.ignite(fire);
    }
    if (this.state === 'burning') {
      this.burnTime -= dt;
      if (this.burnTime <= 0) {
        fire?.extinguish(this.vehicle);
        this.char();
      }
      if (this.onFire) return; // the fire makes its own smoke
    }
    this.smokeTimer -= dt;
    if (this.smokeTimer > 0) return;
    const v = this.vehicle;
    const severity = 1 - this.health / 55;
    this.smokeTimer = 0.45 - severity * 0.33;
    _smokePos.set((Math.random() - 0.5) * 0.4, v.def.hood + 0.1, v.def.length / 2 - 0.6).applyMatrix4(v.model.root.matrixWorld);
    const grey = this.health <= 0 ? 0x1e1e1e : this.health < 25 ? 0x3a3a3a : 0x9a9a9a;
    // A burnt-out wreck only smoulders.
    if (this.state === 'destroyed') this.smokeTimer = 1.2;
    effects.puff(_smokePos, UP, grey, 0.35 + severity * 0.5, 1.4 + severity);
  }
}
