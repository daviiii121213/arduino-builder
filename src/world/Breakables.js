import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Materials } from './Materials.js';

function colored(geo, hex, m) {
  const g = (geo.index ? geo.toNonIndexed() : geo).clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (m) g.applyMatrix4(m);
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));

const LAMP_H = 6.2;
/**
 * Breakable street furniture. Geometry is built standing at the origin (base at
 * y = 0, facing +z = toward the road). `breakSpeed`: minimum impact speed (m/s);
 * `absorb`: share of the car's speed the impact takes; `damage` to the car.
 */
const TYPES = {
  lamp: {
    height: LAMP_H, radius: 0.14, breakSpeed: 7, absorb: 0.22, damage: 9,
    body: () => mergeGeometries([
      colored(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10), 0x2c3033, at(0, 0.25, 0)),
      colored(new THREE.CylinderGeometry(0.07, 0.1, LAMP_H, 8), 0x2c3033, at(0, LAMP_H / 2, 0)),
      colored(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), 0x2c3033, at(0, LAMP_H - 0.05, 0.7, Math.PI / 2 - 0.25)),
      colored(new THREE.BoxGeometry(0.34, 0.16, 0.7), 0x2c3033, at(0, LAMP_H + 0.1, 1.45)),
    ]),
    glow: () => new THREE.BoxGeometry(0.26, 0.04, 0.6).translate(0, LAMP_H + 0.01, 1.45),
  },
  sign: {
    height: 2.5, radius: 0.06, breakSpeed: 3.2, absorb: 0.03, damage: 1,
    body: () => mergeGeometries([
      colored(new THREE.CylinderGeometry(0.04, 0.045, 2.5, 6), 0x9aa0a6, at(0, 1.25, 0)),
      colored(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16), 0xc8322a, at(0, 2.2, 0.04, Math.PI / 2)),
      colored(new THREE.CylinderGeometry(0.27, 0.27, 0.035, 16), 0x2a5aa8, at(0, 2.2, 0.045, Math.PI / 2)),
      colored(new THREE.BoxGeometry(0.42, 0.06, 0.04), 0xc8322a, at(0, 2.2, 0.065, 0, 0, Math.PI / 4)),
    ]),
  },
  workSign: {
    height: 1.5, radius: 0.25, breakSpeed: 2.5, absorb: 0.02, damage: 1,
    body: () => mergeGeometries([
      colored(new THREE.BoxGeometry(0.05, 1.0, 0.05), 0x3a3d40, at(-0.3, 0.5, -0.1, 0.18)),
      colored(new THREE.BoxGeometry(0.05, 1.0, 0.05), 0x3a3d40, at(0.3, 0.5, -0.1, 0.18)),
      colored(new THREE.BoxGeometry(0.05, 1.0, 0.05), 0x3a3d40, at(0, 0.5, -0.35, -0.3)),
      colored(new THREE.BoxGeometry(0.8, 0.8, 0.03), 0xf08a1c, at(0, 1.15, 0, 0, 0, Math.PI / 4)),
      colored(new THREE.BoxGeometry(0.62, 0.62, 0.035), 0xf3e9d2, at(0, 1.15, 0, 0, 0, Math.PI / 4)),
      colored(new THREE.BoxGeometry(0.5, 0.5, 0.04), 0xf08a1c, at(0, 1.15, 0, 0, 0, Math.PI / 4)),
      colored(new THREE.BoxGeometry(0.06, 0.32, 0.045), 0x1d1d1d, at(0, 1.18, 0.002)),
      colored(new THREE.BoxGeometry(0.07, 0.07, 0.045), 0x1d1d1d, at(0, 0.97, 0.002)),
    ]),
  },
};

const LIE_TIME = 8;
const SINK_TIME = 1.4;
const RESTORE_AFTER = 75;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qf = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _axis = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Lightweight destructible street furniture (lamp posts, small signs). Each
 * stands on a static collider; a car hitting one hard enough removes the
 * collider and the object topples in the direction of the impact, lies there
 * for a few seconds, sinks away and is hidden. Hidden objects come back
 * (repaired) much later, out of the player's sight. No new objects are ever
 * allocated: one instanced mesh per type.
 */
export class Breakables {
  constructor(scene, physics, audio) {
    this.scene = scene;
    this.physics = physics;
    this.audio = audio;
    this.items = [];
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
    this.onLampChange = null; // (lampIndex, broken)
  }

  /** Registers an object; geometry is created in build(). */
  add(type, x, y, z, rotY = 0, extra = {}) {
    const t = TYPES[type];
    const collider = this.physics.addStaticCylinder(x, y + t.height / 2, z, t.height / 2, t.radius);
    const item = { type, x, y, z, rotY, collider, state: 'standing', theta: 0, omega: 0, timer: 0, ...extra };
    this.physics.setOwner(collider, item);
    this.items.push(item);
    return item;
  }

  build() {
    this.meshes = {};
    for (const [type, t] of Object.entries(TYPES)) {
      const list = this.items.filter((i) => i.type === type);
      if (!list.length) continue;
      const body = new THREE.InstancedMesh(t.body(), this.material, list.length);
      body.castShadow = true;
      body.receiveShadow = true;
      body.frustumCulled = false;
      this.scene.add(body);
      let glow = null;
      if (t.glow) {
        glow = new THREE.InstancedMesh(t.glow(), Materials.emissiveWarm(), list.length);
        glow.frustumCulled = false;
        this.scene.add(glow);
      }
      this.meshes[type] = { body, glow };
      list.forEach((item, i) => {
        item.index = i;
        this.write(item);
      });
    }
  }

  write(item) {
    const m = this.meshes[item.type];
    if (item.state === 'hidden') {
      m.body.setMatrixAt(item.index, ZERO);
      m.glow?.setMatrixAt(item.index, ZERO);
    } else {
      _q.setFromAxisAngle(Y, item.rotY);
      if (item.theta) _q.premultiply(_qf.setFromAxisAngle(_axis.set(item.axis.x, 0, item.axis.z), item.theta));
      _m.compose(_p.set(item.x, item.y - (item.sinkY ?? 0), item.z), _q, _s);
      m.body.setMatrixAt(item.index, _m);
      // The lamp goes dark as soon as it is hit.
      m.glow?.setMatrixAt(item.index, item.state === 'standing' ? _m : ZERO);
    }
    m.body.instanceMatrix.needsUpdate = true;
    if (m.glow) m.glow.instanceMatrix.needsUpdate = true;
  }

  /**
   * Before the physics step: any simulated car about to hit a standing object
   * fast enough knocks it down (its collider is removed so the car carries on).
   */
  checkVehicles(vehicles, dt) {
    for (const v of vehicles) {
      if (v.mode !== 'physics' || v.disposed) continue;
      const lv = v.body.linvel();
      const speed = Math.hypot(lv.x, lv.z);
      if (speed < 2.4) continue;
      const reach = speed * dt * 2 + 0.15;
      for (const item of this.items) {
        if (item.state !== 'standing') continue;
        const dx = item.x - v.currPos.x;
        const dz = item.z - v.currPos.z;
        if (dx * dx + dz * dz > 49) continue;
        const t = TYPES[item.type];
        const local = v.toLocal(_p.set(item.x, v.currPos.y + 0.5, item.z));
        const m = t.radius + reach;
        if (Math.abs(local.x) > v.halfExtents.x + m || Math.abs(local.z) > v.halfExtents.z + m) continue;
        // Only when the car is moving toward the object.
        if (dx * lv.x + dz * lv.z <= 0) continue;
        if (speed < t.breakSpeed) continue;
        this.knockDown(item, lv.x / speed, lv.z / speed, speed);
        const keep = 1 - t.absorb;
        v.body.setLinvel({ x: lv.x * keep, y: lv.y, z: lv.z * keep }, true);
        v.lastVel.set(lv.x * keep, lv.y, lv.z * keep);
        v.damage.applyCrash(t.damage, { x: -lv.x, y: 0, z: -lv.z });
      }
    }
  }

  knockDown(item, dirX, dirZ, speed) {
    const t = TYPES[item.type];
    this.physics.owners.delete(item.collider.handle);
    this.physics.world.removeCollider(item.collider, false);
    item.collider = null;
    item.state = 'falling';
    // Rotation axis = up x direction, so the top tips toward the push.
    item.axis = { x: dirZ, z: -dirX };
    item.dir = { x: dirX, z: dirZ };
    item.theta = 0.02;
    item.omega = Math.min(2.2, speed * 0.12 + 0.3) * (2.5 / t.height + 0.4);
    item.bounced = false;
    item.sinkY = 0;
    this.audio.play(item.type === 'lamp' ? 'poleFall' : 'metalHit', { x: item.x, y: item.y + 1, z: item.z }, item.type === 'lamp' ? 1 : 0.6);
    if (item.lampIndex !== undefined) this.onLampChange?.(item.lampIndex, true);
  }

  update(dt, playerPos) {
    for (const item of this.items) {
      if (item.state === 'standing') continue;
      const t = TYPES[item.type];
      if (item.state === 'falling') {
        // Rigid rod pivoting at its base.
        item.omega += (3 * 9.8 / (2 * t.height)) * Math.sin(item.theta) * dt;
        item.theta += item.omega * dt;
        const flat = Math.PI / 2 - 0.02;
        if (item.theta >= flat) {
          item.theta = flat;
          if (!item.bounced && item.omega > 0.8) {
            item.bounced = true;
            item.omega = -item.omega * 0.18;
            if (item.type === 'lamp') this.audio.play('metalHit', { x: item.x + item.dir.x * 4, y: 0.3, z: item.z + item.dir.z * 4 }, 0.8);
          } else {
            item.state = 'lying';
            item.timer = 0;
          }
        }
        this.write(item);
      } else if (item.state === 'lying') {
        item.timer += dt;
        if (item.timer > LIE_TIME) {
          item.sinkY = Math.min(0.8, ((item.timer - LIE_TIME) / SINK_TIME) * 0.8);
          if (item.timer > LIE_TIME + SINK_TIME) {
            item.state = 'hidden';
            item.timer = 0;
          }
          this.write(item);
        }
      } else if (item.state === 'hidden') {
        item.timer += dt;
        // Repaired later, out of the player's sight.
        if (item.timer > RESTORE_AFTER && Math.hypot(item.x - playerPos.x, item.z - playerPos.z) > 70) this.restore(item);
      }
    }
  }

  restore(item) {
    const t = TYPES[item.type];
    item.collider = this.physics.addStaticCylinder(item.x, item.y + t.height / 2, item.z, t.height / 2, t.radius);
    this.physics.setOwner(item.collider, item);
    item.state = 'standing';
    item.theta = 0;
    item.sinkY = 0;
    this.write(item);
    if (item.lampIndex !== undefined) this.onLampChange?.(item.lampIndex, false);
  }

  /** Fallen objects lying in the road, as circles traffic must stop for. */
  obstacles(out) {
    for (const item of this.items) {
      if (item.state !== 'lying' && item.state !== 'falling') continue;
      const h = TYPES[item.type].height * Math.sin(item.theta);
      for (let d = 0.8; d < h; d += 1.6) out.push({ x: item.x + item.dir.x * d, z: item.z + item.dir.z * d, r: 0.6 });
    }
    return out;
  }
}
