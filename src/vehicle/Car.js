import * as THREE from 'three';
import { Groups, QueryGroups } from '../core/Physics.js';
import { createCarModel, CAR_DIMENSIONS } from './CarModel.js';
import { approach, clamp, lerp } from '../core/math.js';

const TUNING = {
  mass: 1150,
  centerOfMassY: 0.42,
  engineForce: 2700,
  reverseForce: 1500,
  brakeForce: 60,
  handbrakeForce: 45,
  rollingBrake: 3,
  maxSpeed: 38,
  maxReverseSpeed: 9,
  maxSteerLow: 0.6,
  maxSteerHigh: 0.17,
  steerSpeed: 3.2,
  steerReturn: 5,
  downforce: 2.5,
  suspension: { stiffness: 28, compression: 2.4, relaxation: 3.0, restLength: 0.28, travel: 0.25, connectionY: 0.52 },
  frictionSlip: 2.4,
  rearFrictionSlipHandbrake: 1.0,
  sideFriction: 1.0,
};

const GEARS = [0, 9, 16, 23, 30, 38];
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _inv = new THREE.Matrix4();

/**
 * Drivable car: Rapier dynamic chassis + raycast vehicle controller.
 * Forward is local +Z.
 */
export class Car {
  constructor({ physics, scene, audio, spawn }) {
    this.physics = physics;
    this.audio = audio;
    this.isVehicle = true;
    const R = physics.RAPIER;
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
    this.body = physics.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
        .setCcdEnabled(true)
        .setLinearDamping(0.05)
        .setAngularDamping(0.8)
        .setCanSleep(false),
    );
    const m = TUNING.mass;
    const main = R.ColliderDesc.cuboid(0.86, 0.3, 2.08)
      .setTranslation(0, 0.62, 0)
      .setMassProperties(
        m, { x: 0, y: TUNING.centerOfMassY, z: 0.05 },
        { x: (m / 12) * (0.6 ** 2 + 4.1 ** 2), y: (m / 12) * (1.72 ** 2 + 4.1 ** 2), z: (m / 12) * (1.72 ** 2 + 0.6 ** 2) * 1.6 },
        { x: 0, y: 0, z: 0, w: 1 },
      )
      .setCollisionGroups(Groups.vehicle)
      .setFriction(0.3);
    this.mainCollider = physics.world.createCollider(main, this.body);
    this.cabinCollider = physics.world.createCollider(
      R.ColliderDesc.cuboid(0.74, 0.24, 1.05).setTranslation(0, 1.18, -0.5).setDensity(0).setCollisionGroups(Groups.vehicle).setFriction(0.3),
      this.body,
    );
    physics.setOwner(this.mainCollider, this);
    physics.setOwner(this.cabinCollider, this);

    const v = physics.world.createVehicleController(this.body);
    v.indexUpAxis = 1;
    v.setIndexForwardAxis = 2;
    const S = TUNING.suspension;
    const { track, wheelBase, wheelRadius } = CAR_DIMENSIONS;
    [[track, wheelBase.front], [-track, wheelBase.front], [track, wheelBase.rear], [-track, wheelBase.rear]].forEach(([x, z], i) => {
      v.addWheel({ x, y: S.connectionY, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, S.restLength, wheelRadius);
      v.setWheelSuspensionStiffness(i, S.stiffness);
      v.setWheelSuspensionCompression(i, S.compression);
      v.setWheelSuspensionRelaxation(i, S.relaxation);
      v.setWheelMaxSuspensionTravel(i, S.travel);
      v.setWheelFrictionSlip(i, TUNING.frictionSlip);
      v.setWheelSideFrictionStiffness(i, TUNING.sideFriction);
      v.setWheelMaxSuspensionForce(i, 60000);
    });
    this.controller = v;

    this.model = createCarModel(0x2e6f78);
    scene.add(this.model.root);

    this.steer = 0;
    this.speed = 0;
    this.throttle = 0;
    this.braking = false;
    this.driver = null;
    this.engineOn = false;
    this.rpm = 0;
    this.gear = 1;
    this.skid = 0;
    this.flippedTime = 0;
    this.lastVel = new THREE.Vector3();
    this.impactCooldown = 0;

    this.prevPos = new THREE.Vector3();
    this.currPos = new THREE.Vector3();
    this.prevRot = new THREE.Quaternion();
    this.currRot = new THREE.Quaternion();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.matrix = new THREE.Matrix4();
    this.syncState(true);
  }

  get yaw() {
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
    if (reset) {
      this.prevPos.copy(this.currPos);
      this.prevRot.copy(this.currRot);
      this.position.copy(this.currPos);
      this.quaternion.copy(this.currRot);
    }
  }

  /**
   * @param {number} dt
   * @param {{throttle:number, brake:number, steer:number, handbrake:boolean}|null} input
   */
  fixedUpdate(dt, input) {
    const v = this.controller;
    const speed = v.currentVehicleSpeed();
    this.speed = speed;
    const absSpeed = Math.abs(speed);
    const ctl = input ?? { throttle: 0, brake: 0, steer: 0, handbrake: false };

    // Speed-sensitive steering with smooth return to centre.
    const maxSteer = lerp(TUNING.maxSteerLow, TUNING.maxSteerHigh, clamp(absSpeed / 28, 0, 1));
    const targetSteer = ctl.steer * maxSteer;
    const rate = ctl.steer === 0 ? TUNING.steerReturn : TUNING.steerSpeed;
    this.steer = approach(this.steer, targetSteer, rate * dt);

    // W accelerates (or brakes while rolling backwards); S brakes, then reverses.
    let engine = 0;
    let brake = 0;
    if (ctl.throttle > 0) {
      if (speed < -0.8) brake = TUNING.brakeForce;
      else if (speed < TUNING.maxSpeed) engine = TUNING.engineForce * clamp(1.15 - speed / (TUNING.maxSpeed * 1.25), 0.25, 1);
    } else if (ctl.brake > 0) {
      if (speed > 0.8) brake = TUNING.brakeForce;
      else if (speed > -TUNING.maxReverseSpeed) engine = -TUNING.reverseForce;
    } else if (this.driver) {
      brake = TUNING.rollingBrake;
    } else {
      brake = 25; // parked
    }
    this.braking = brake >= TUNING.brakeForce * 0.5 || (!!this.driver && ctl.brake > 0 && speed > 0.8);
    this.throttle = Math.abs(engine) / TUNING.engineForce;

    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      v.setWheelSteering(i, front ? this.steer : 0);
      v.setWheelEngineForce(i, front ? 0 : engine);
      let b = brake;
      if (!front && ctl.handbrake) b = Math.max(b, TUNING.handbrakeForce);
      v.setWheelBrake(i, b);
      v.setWheelFrictionSlip(i, !front && ctl.handbrake ? TUNING.rearFrictionSlipHandbrake : TUNING.frictionSlip);
    }

    // Aerodynamic downforce keeps the car planted at speed.
    const lv = this.body.linvel();
    const sp2 = lv.x * lv.x + lv.z * lv.z;
    this.body.resetForces(true);
    this.body.addForce({ x: 0, y: -sp2 * TUNING.downforce, z: 0 }, true);

    v.updateVehicle(dt, undefined, QueryGroups.wheels);

    // Lateral slip drives the tyre squeal.
    const lateral = this.lateralSpeed();
    this.skid = clamp((Math.abs(lateral) - 2.5) / 5, 0, 1) + (ctl.handbrake && absSpeed > 5 ? 0.5 : 0) + (this.braking && absSpeed > 12 ? 0.35 : 0);

    // Impact detection from sudden velocity change.
    _v.set(lv.x, lv.y, lv.z);
    const dv = _v.distanceTo(this.lastVel);
    this.impactCooldown -= dt;
    if (dv > 4 && this.impactCooldown <= 0) {
      this.audio.play('carCrash', this.currPos, clamp(dv / 12, 0.3, 1));
      this.impactCooldown = 0.4;
    }
    this.lastVel.copy(_v);

    this.recoverIfFlipped(dt);
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
    if (_v.y < 0.35 && slow) this.flippedTime += dt;
    else this.flippedTime = 0;
    if (this.flippedTime > 2) {
      const t = this.body.translation();
      const yaw = Math.atan2(2 * (this.currRot.w * this.currRot.y + this.currRot.x * this.currRot.z), 1 - 2 * (this.currRot.y ** 2 + this.currRot.x ** 2));
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      this.body.setTranslation({ x: t.x, y: t.y + 1.2, z: t.z }, true);
      this.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.flippedTime = 0;
    }
  }

  /** Called after the physics step. */
  postStep() {
    this.syncState();
  }

  render(dt, alpha) {
    this.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.quaternion.slerpQuaternions(this.prevRot, this.currRot, alpha);
    const root = this.model.root;
    root.position.copy(this.position);
    root.quaternion.copy(this.quaternion);
    root.updateMatrix();
    this.matrix.compose(this.position, this.quaternion, new THREE.Vector3(1, 1, 1));

    const v = this.controller;
    const S = TUNING.suspension;
    this.model.wheels.forEach((w, i) => {
      const len = v.wheelSuspensionLength(i) ?? S.restLength;
      w.steerPivot.position.y = S.connectionY - len;
      w.steerPivot.rotation.y = v.wheelSteering(i) ?? 0;
      w.spin.rotation.x = v.wheelRotation(i) ?? 0;
    });
    this.model.steering.rotation.z = -this.steer * 2.5;

    // Simulated gearbox for the engine sound.
    const absSpeed = Math.abs(this.speed);
    while (this.gear < GEARS.length - 1 && absSpeed > GEARS[this.gear] * 0.95) this.gear++;
    while (this.gear > 1 && absSpeed < GEARS[this.gear - 1] * 0.75) this.gear--;
    const lo = GEARS[this.gear - 1];
    const hi = GEARS[this.gear];
    const targetRpm = this.driver ? clamp(0.12 + ((absSpeed - lo) / (hi - lo)) * 0.75 + this.throttle * 0.12, 0.1, 1) : 0;
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 8);
    this.audio.setEngine(!!this.driver, this.rpm, this.throttle, this.driver ? this.skid : 0);
    this.model.materials.tailMat.emissiveIntensity = this.braking ? 1.6 : 0.25;
  }

  /** True if `point` (world) lies within the car's footprint expanded by `margin`. */
  overlapsPoint(point, margin, minY, maxY) {
    _inv.copy(this.matrix).invert();
    _v.copy(point).applyMatrix4(_inv);
    return Math.abs(_v.x) < 0.9 + margin && Math.abs(_v.z) < 2.12 + margin && _v.y > minY - 1.6 && _v.y < maxY;
  }

  /** Door position on the driver's side (left, +X local), in world space. */
  doorPosition(target = new THREE.Vector3()) {
    return target.set(1.35, 0, 0.1).applyMatrix4(this.matrix);
  }

  /** Candidate exit spots in world space, preferred first. */
  exitCandidates() {
    return [
      new THREE.Vector3(1.45, 0.2, 0.1),
      new THREE.Vector3(-1.45, 0.2, 0.1),
      new THREE.Vector3(0, 0.2, 3.0),
      new THREE.Vector3(0, 0.2, -3.0),
      new THREE.Vector3(0, 2.0, 0),
    ].map((p) => p.applyMatrix4(this.matrix));
  }
}
