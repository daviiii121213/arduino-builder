import * as THREE from 'three';
import { Groups, QueryGroups } from '../core/Physics.js';
import { buildVehicleModel, VehicleMaterials } from './VehicleModels.js';
import { VEHICLE_TYPES } from './VehicleDefinitions.js';
import { approach, clamp, lerp } from '../core/math.js';

const COMMON = {
  reverseFactor: 0.55,
  brakeForce: 55,
  handbrakeForce: 40,
  rollingBrake: 3,
  maxReverseSpeed: 8,
  maxSteerHigh: 0.16,
  steerSpeed: 3.2,
  steerReturn: 5,
  downforce: 2.2,
  suspension: { stiffness: 30, compression: 2.4, relaxation: 3.0, restLength: 0.24, travel: 0.22 },
  frictionSlip: 2.4,
  handbrakeSlip: 1.0,
};

const GEARS = [0, 8, 15, 22, 30, 42];
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);
const _wheelQ = new THREE.Quaternion();
const _wheelS = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const Y_AXIS = new THREE.Vector3(0, 1, 0);

let nextId = 1;

/**
 * A car that can be parked (frozen kinematic body), driven with physics
 * (dynamic chassis + raycast wheels) or moved along roads by traffic AI
 * (kinematic body). Driving input and AI live elsewhere.
 */
export class Vehicle {
  constructor({ physics, scene, audio, wheels, typeId, color, x, y = 0, z, yaw, mode = 'parked' }) {
    this.id = nextId++;
    this.physics = physics;
    this.audio = audio;
    this.wheelsInstanced = wheels;
    this.isVehicle = true;
    this.typeId = typeId;
    const d = (this.def = VEHICLE_TYPES[typeId]);
    const R = physics.RAPIER;
    this.RAPIER = R;

    _q.setFromAxisAngle(Y_AXIS, yaw);
    this.body = physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(x, y, z)
        .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
        .setCcdEnabled(true)
        .setLinearDamping(0.05)
        .setAngularDamping(0.8),
    );
    const m = d.mass;
    const hh = (d.belt - d.bottom) / 2;
    const L = d.length;
    const W = d.width;
    this.halfExtents = { x: W / 2, z: L / 2 };
    const main = R.ColliderDesc.cuboid(W / 2 - 0.03, hh, L / 2 - 0.02)
      .setTranslation(0, d.bottom + hh, 0)
      .setMassProperties(
        m, { x: 0, y: d.bottom + 0.2, z: 0.05 },
        { x: (m / 12) * ((hh * 2) ** 2 + L ** 2), y: (m / 12) * (W ** 2 + L ** 2), z: (m / 12) * (W ** 2 + (hh * 2) ** 2) * 1.6 },
        { x: 0, y: 0, z: 0, w: 1 },
      )
      .setCollisionGroups(Groups.vehicle)
      .setFriction(0.3);
    this.mainCollider = physics.world.createCollider(main, this.body);
    const c = d.cabin;
    this.cabinCollider = physics.world.createCollider(
      R.ColliderDesc.cuboid(d.cabinWidth / 2, (d.roof - d.belt) / 2, (c.front - c.rear) / 2 * 0.9)
        .setTranslation(0, (d.roof + d.belt) / 2, (c.front + c.rear) / 2)
        .setDensity(0).setCollisionGroups(Groups.vehicle).setFriction(0.3),
      this.body,
    );
    physics.setOwner(this.mainCollider, this);
    physics.setOwner(this.cabinCollider, this);
    this.connectionY = d.wheelRadius + COMMON.suspension.restLength - 0.06;

    this.model = buildVehicleModel(d, color);
    scene.add(this.model.root);
    this.wheelBase = wheels.allocate();
    this.wheelSpin = 0;

    this.mode = 'parked';
    this.driver = null; // 'player' or a TrafficDriver
    this.steer = 0;
    this.speed = 0;
    this.throttle = 0;
    this.braking = false;
    this.rpm = 0;
    this.gear = 1;
    this.skid = 0;
    this.flippedTime = 0;
    this.restTime = 0;
    this.impactCooldown = 0;
    this.lastVel = new THREE.Vector3();

    this.prevPos = new THREE.Vector3();
    this.currPos = new THREE.Vector3();
    this.prevRot = new THREE.Quaternion();
    this.currRot = new THREE.Quaternion();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.physicsMatrix = new THREE.Matrix4();
    this.syncState(true);
    this.setMode(mode);
  }

  // ------------------------------------------------------------ modes

  setMode(mode) {
    if (mode === this.mode && this.controller) return;
    const R = this.RAPIER;
    if (mode === 'physics') {
      this.body.setBodyType(R.RigidBodyType.Dynamic, true);
      if (!this.controller) this.createController();
    } else {
      this.body.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    }
    this.mode = mode;
    this.restTime = 0;
  }

  createController() {
    const v = this.physics.world.createVehicleController(this.body);
    v.indexUpAxis = 1;
    v.setIndexForwardAxis = 2;
    const S = COMMON.suspension;
    this.model.wheelAnchors.forEach((a, i) => {
      v.addWheel({ x: a.x, y: this.connectionY, z: a.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, S.restLength, this.def.wheelRadius);
      v.setWheelSuspensionStiffness(i, S.stiffness);
      v.setWheelSuspensionCompression(i, S.compression);
      v.setWheelSuspensionRelaxation(i, S.relaxation);
      v.setWheelMaxSuspensionTravel(i, S.travel);
      v.setWheelFrictionSlip(i, COMMON.frictionSlip);
      v.setWheelSideFrictionStiffness(i, 1);
      v.setWheelMaxSuspensionForce(i, 60000);
    });
    this.controller = v;
  }

  get occupied() {
    return !!this.driver;
  }

  /** Heading of the physics state. */
  get yaw() {
    _v.set(0, 0, 1).applyQuaternion(this.currRot);
    return Math.atan2(_v.x, _v.z);
  }

  /** Heading of the interpolated (rendered) pose. */
  get renderYaw() {
    _v.set(0, 0, 1).applyQuaternion(this.quaternion);
    return Math.atan2(_v.x, _v.z);
  }

  syncState(reset = false) {
    const t = this.body.translation();
    const r = this.body.rotation();
    if (!reset) {
      this.prevPos.copy(this.currPos);
      this.prevRot.copy(this.currRot);
    }
    this.currPos.set(t.x, t.y, t.z);
    this.currRot.set(r.x, r.y, r.z, r.w);
    this.physicsMatrix.compose(this.currPos, this.currRot, _one);
    if (reset) {
      this.prevPos.copy(this.currPos);
      this.prevRot.copy(this.currRot);
      this.position.copy(this.currPos);
      this.quaternion.copy(this.currRot);
    }
  }

  // ------------------------------------------------------------ simulation

  /** Kinematic pose for traffic (called every fixed step by the AI). */
  driveKinematic(x, z, yaw, speed, steer) {
    _q.setFromAxisAngle(Y_AXIS, yaw);
    this.body.setNextKinematicTranslation({ x, y: 0, z });
    this.body.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    this.speed = speed;
    this.steer = steer;
  }

  /**
   * Physics driving.
   * @param {{throttle:number, brake:number, steer:number, handbrake:boolean}|null} input
   */
  fixedUpdate(dt, input) {
    if (this.mode !== 'physics') return;
    const d = this.def;
    const v = this.controller;
    const speed = v.currentVehicleSpeed();
    this.speed = speed;
    const absSpeed = Math.abs(speed);
    const ctl = input ?? { throttle: 0, brake: 0, steer: 0, handbrake: false };

    const maxSteer = lerp(d.steer, COMMON.maxSteerHigh, clamp(absSpeed / 26, 0, 1));
    const rate = ctl.steer === 0 ? COMMON.steerReturn : COMMON.steerSpeed;
    this.steer = approach(this.steer, ctl.steer * maxSteer, rate * dt);

    let engine = 0;
    let brake = 0;
    if (ctl.throttle > 0) {
      if (speed < -0.8) brake = COMMON.brakeForce;
      else if (speed < d.maxSpeed) engine = d.engine * clamp(1.15 - speed / (d.maxSpeed * 1.25), 0.25, 1);
    } else if (ctl.brake > 0) {
      if (speed > 0.8) brake = COMMON.brakeForce;
      else if (speed > -COMMON.maxReverseSpeed) engine = -d.engine * COMMON.reverseFactor;
    } else {
      brake = input ? COMMON.rollingBrake : 20;
    }
    this.braking = !!input && ctl.brake > 0 && speed > 0.8;
    this.throttle = Math.abs(engine) / d.engine;

    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      v.setWheelSteering(i, front ? this.steer : 0);
      v.setWheelEngineForce(i, front ? 0 : engine);
      v.setWheelBrake(i, !front && ctl.handbrake ? Math.max(brake, COMMON.handbrakeForce) : brake);
      v.setWheelFrictionSlip(i, !front && ctl.handbrake ? COMMON.handbrakeSlip : COMMON.frictionSlip);
    }
    const lv = this.body.linvel();
    this.body.resetForces(true);
    this.body.addForce({ x: 0, y: -(lv.x * lv.x + lv.z * lv.z) * COMMON.downforce * (d.mass / 1100), z: 0 }, true);
    v.updateVehicle(dt, undefined, QueryGroups.wheels);

    const lateral = this.lateralSpeed();
    this.skid = clamp((Math.abs(lateral) - 2.5) / 5, 0, 1) + (ctl.handbrake && absSpeed > 5 ? 0.5 : 0) + (this.braking && absSpeed > 10 ? 0.4 : 0);

    _v.set(lv.x, lv.y, lv.z);
    const dv = _v.distanceTo(this.lastVel);
    this.impactCooldown -= dt;
    if (dv > 4 && this.impactCooldown <= 0) {
      this.audio.play('carCrash', this.currPos, clamp(dv / 12, 0.3, 1));
      this.impactCooldown = 0.4;
    }
    this.lastVel.copy(_v);
    this.recoverIfFlipped(dt);

    // An abandoned car that has come to rest is frozen again to save simulation time.
    const still = absSpeed < 0.2 && _v.length() < 0.3;
    this.restTime = !this.driver && still ? this.restTime + dt : 0;
    if (this.restTime > 2.5 && this.isUpright()) this.setMode('parked');
  }

  isUpright() {
    _v.set(0, 1, 0).applyQuaternion(this.currRot);
    return _v.y > 0.9;
  }

  lateralSpeed() {
    const lv = this.body.linvel();
    _v.set(1, 0, 0).applyQuaternion(this.currRot);
    return lv.x * _v.x + lv.y * _v.y + lv.z * _v.z;
  }

  /** Safety net: a car resting on its side/roof is put back on its wheels. */
  recoverIfFlipped(dt) {
    _v.set(0, 1, 0).applyQuaternion(this.currRot);
    const lv = this.body.linvel();
    const slow = Math.hypot(lv.x, lv.y, lv.z) < 1.5;
    this.flippedTime = _v.y < 0.35 && slow ? this.flippedTime + dt : 0;
    if (this.flippedTime > 2) {
      const t = this.body.translation();
      _q.setFromAxisAngle(Y_AXIS, this.yaw);
      this.body.setTranslation({ x: t.x, y: t.y + 1.2, z: t.z }, true);
      this.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.flippedTime = 0;
    }
  }

  postStep() {
    this.syncState();
  }

  // ------------------------------------------------------------ presentation

  render(dt, alpha, night, isPlayerCar) {
    this.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.quaternion.slerpQuaternions(this.prevRot, this.currRot, alpha);
    const root = this.model.root;
    root.position.copy(this.position);
    root.quaternion.copy(this.quaternion);
    root.updateMatrix();
    root.updateMatrixWorld();

    // Wheels: from the raycast controller when simulated, otherwise rolled by speed.
    const physics = this.mode === 'physics' && this.controller;
    const r = this.def.wheelRadius;
    if (!physics) this.wheelSpin -= (this.speed / r) * dt;
    this.model.wheelAnchors.forEach((a, i) => {
      let y = a.y;
      let steer = i < 2 ? this.steer : 0;
      let spin = this.wheelSpin;
      if (physics) {
        y = this.connectionY - (this.controller.wheelSuspensionLength(i) ?? COMMON.suspension.restLength);
        steer = this.controller.wheelSteering(i) ?? 0;
        spin = this.controller.wheelRotation(i) ?? 0;
      }
      _e.set(spin, steer, 0, 'YXZ');
      _wheelQ.setFromEuler(_e);
      _m.compose(_v.set(a.x, y, a.z), _wheelQ, _wheelS.set(1, r, r)).premultiply(root.matrixWorld);
      this.wheelsInstanced.set(this.wheelBase + i, _m);
    });

    const lightsOn = night > 0.3 && !!this.driver;
    this.lightsOn = lightsOn;
    this.model.head.material = lightsOn ? VehicleMaterials.headOn : VehicleMaterials.head;
    this.model.tail.material = this.braking ? VehicleMaterials.tailBrake : lightsOn ? VehicleMaterials.tailOn : VehicleMaterials.tail;
    this.model.beam.visible = lightsOn;

    if (isPlayerCar) {
      const absSpeed = Math.abs(this.speed);
      while (this.gear < GEARS.length - 1 && absSpeed > GEARS[this.gear] * 0.95) this.gear++;
      while (this.gear > 1 && absSpeed < GEARS[this.gear - 1] * 0.75) this.gear--;
      const lo = GEARS[this.gear - 1];
      const hi = GEARS[this.gear];
      const targetRpm = clamp(0.12 + ((absSpeed - lo) / (hi - lo)) * 0.75 + this.throttle * 0.12, 0.1, 1);
      this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 8);
      this.audio.setEngine(true, this.rpm, this.throttle, this.skid);
    }
  }

  /** Removes the vehicle from the world entirely. */
  dispose(scene) {
    if (this.controller) this.physics.world.removeVehicleController(this.controller);
    this.physics.owners.delete(this.mainCollider.handle);
    this.physics.owners.delete(this.cabinCollider.handle);
    this.physics.world.removeRigidBody(this.body);
    scene.remove(this.model.root);
    this.model.body.geometry.dispose();
    this.model.glass.geometry.dispose();
    this.wheelsInstanced.release(this.wheelBase);
    this.disposed = true;
  }

  // ------------------------------------------------------------ queries

  /** Point in this car's local frame (physics state). */
  toLocal(point, target = _v) {
    _inv.copy(this.physicsMatrix).invert();
    return target.copy(point).applyMatrix4(_inv);
  }

  /** True if `point` (world) lies within the footprint expanded by `margin`. */
  overlapsPoint(point, margin, maxY = 2) {
    const p = this.toLocal(point);
    return Math.abs(p.x) < this.halfExtents.x + margin && Math.abs(p.z) < this.halfExtents.z + margin && p.y > -1.2 && p.y < maxY;
  }

  /** World position of the driver door (left side, +X local). */
  doorPosition(target = new THREE.Vector3()) {
    return target.set(this.def.width / 2 + 0.55, 0, this.def.seat.z + 0.1).applyMatrix4(this.physicsMatrix);
  }

  /** Local seat anchor for a seated character root. */
  seatPosition(target = new THREE.Vector3()) {
    return target.set(this.def.seat.x, this.def.bottom - 0.27, this.def.seat.z);
  }

  /** Candidate exit spots in world space, preferred first. */
  exitCandidates() {
    const w = this.def.width / 2 + 0.6;
    const l = this.def.length / 2 + 0.9;
    const z = this.def.seat.z;
    return [
      [w, z], [-w, z], [w, z + 1.2], [w, z - 1.2], [-w, z + 1.2], [-w, z - 1.2], [0, l], [0, -l],
    ].map(([x, zz]) => new THREE.Vector3(x, 0.2, zz).applyMatrix4(this.physicsMatrix));
  }
}

export { COMMON as VEHICLE_COMMON };
