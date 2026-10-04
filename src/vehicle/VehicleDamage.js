import * as THREE from 'three';

const MAX_DENT = 0.16;
const SCUFF = new THREE.Color(0x4a4a4a);
const _p = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _smokePos = new THREE.Vector3();
const UP = { x: 0, y: 1, z: 0 };

/**
 * Non-graphic vehicle damage: health, dents pressed into the body mesh,
 * scuffed paint, engine smoke and loss of engine power.
 */
export class VehicleDamage {
  constructor(vehicle) {
    this.vehicle = vehicle;
    this.health = 100;
    this.geometry = vehicle.model.body.geometry;
    this.offsets = new Float32Array(this.geometry.attributes.position.count);
    this.smokeTimer = 0;
  }

  /** 1 = healthy engine, lower values cut power, 0 = dead engine. */
  get enginePower() {
    if (this.health <= 0) return 0;
    return this.health < 25 ? 0.45 : 1;
  }

  /** Impact at a point in the vehicle's local frame, pushing in from `localDir`. */
  apply(amount, localPoint, radius = 0.6) {
    if (amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    const depth = Math.min(0.12, amount * 0.006);
    if (depth > 0.004) this.dent(localPoint, radius, depth);
  }

  /** Bullet impact at a world point. */
  applyBullet(worldPoint) {
    _p.set(worldPoint.x, worldPoint.y, worldPoint.z);
    this.vehicle.toLocal(_p, _p);
    this.apply(2.5, _p, 0.14);
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

  /** Smoke from the engine bay once the car is badly damaged. */
  update(dt, effects) {
    if (this.health > 55) return;
    this.smokeTimer -= dt;
    if (this.smokeTimer > 0) return;
    const v = this.vehicle;
    const severity = 1 - this.health / 55;
    this.smokeTimer = 0.45 - severity * 0.33;
    _smokePos.set((Math.random() - 0.5) * 0.4, v.def.hood + 0.1, v.def.length / 2 - 0.6).applyMatrix4(v.model.root.matrixWorld);
    const grey = this.health <= 0 ? 0x1e1e1e : this.health < 25 ? 0x3a3a3a : 0x9a9a9a;
    effects.puff(_smokePos, UP, grey, 0.35 + severity * 0.5, 1.4 + severity);
  }
}
