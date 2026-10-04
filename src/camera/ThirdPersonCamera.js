import * as THREE from 'three';
import { QueryGroups } from '../core/Physics.js';
import { clamp, damp, dampAngle, dampFactor } from '../core/math.js';

export const CAMERA_SETTINGS = {
  mouseSensitivity: 0.0022,
  aimSensitivityScale: 0.65,
  pitchMin: -1.15,
  pitchMax: 0.85,
  collisionRadius: 0.22,
};

const MODES = {
  onFoot: { distance: 3.4, shoulder: 0.35, height: 1.2, fov: 66 },
  armed: { distance: 2.8, shoulder: 0.48, height: 1.22, fov: 64 },
  aiming: { distance: 1.6, shoulder: 0.55, height: 1.22, fov: 52 },
  vehicle: { distance: 6.0, shoulder: 0, height: 1.55, fov: 70 },
};

const _pivot = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _desired = new THREE.Vector3();

/** Orbiting third-person camera with spring arm collision and per-mode framing. */
export class ThirdPersonCamera {
  constructor(camera, physics) {
    this.camera = camera;
    this.physics = physics;
    this.yaw = 0;
    this.pitch = -0.12;
    this.mode = 'onFoot';
    this.distance = MODES.onFoot.distance;
    this.shoulder = MODES.onFoot.shoulder;
    this.height = MODES.onFoot.height;
    this.fov = MODES.onFoot.fov;
    this.armLength = this.distance;
    this.pivot = new THREE.Vector3();
    this.pivotInitialized = false;
    this.recoilKick = 0;
    this.idleLookTime = 10;
    this.shake = 0;
    this.excludeBody = undefined;
  }

  setMode(mode) {
    this.mode = mode;
  }

  addRecoil(pitch, yaw) {
    // Part of the kick stays (aim climbs), part springs back.
    this.pitch = clamp(this.pitch + pitch * 0.35, CAMERA_SETTINGS.pitchMin, CAMERA_SETTINGS.pitchMax);
    this.yaw += (Math.random() - 0.5) * 2 * yaw;
    this.recoilKick += pitch * 0.65;
    this.shake = Math.min(this.shake + pitch * 2, 0.08);
  }

  handleMouse(dx, dy) {
    const scale = CAMERA_SETTINGS.mouseSensitivity * (this.mode === 'aiming' ? CAMERA_SETTINGS.aimSensitivityScale : 1);
    if (dx !== 0 || dy !== 0) this.idleLookTime = 0;
    this.yaw -= dx * scale;
    this.pitch = clamp(this.pitch - dy * scale, CAMERA_SETTINGS.pitchMin, CAMERA_SETTINGS.pitchMax);
  }

  /** Horizontal forward direction of the view. */
  forward(target = new THREE.Vector3()) {
    return target.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} focus - feet position of the followed character, or car position
   * @param {{vehicleYaw?:number, vehicleSpeed?:number}} [ctx]
   */
  update(dt, focus, ctx = {}) {
    const m = MODES[this.mode];
    this.idleLookTime += dt;
    const speedFov = this.mode === 'vehicle' ? clamp((ctx.vehicleSpeed ?? 0) * 0.35, 0, 12) : 0;
    const baseDistance = this.mode === 'vehicle' ? 2.2 + (ctx.vehicleLength ?? 4) * 0.95 : m.distance;
    this.distance = damp(this.distance, baseDistance + (this.mode === 'vehicle' ? clamp(Math.abs(ctx.vehicleSpeed ?? 0) * 0.05, 0, 1.5) : 0), 6, dt);
    this.shoulder = damp(this.shoulder, m.shoulder, 10, dt);
    this.height = damp(this.height, m.height, 8, dt);
    this.fov = damp(this.fov, m.fov + speedFov, 8, dt);

    // Vehicle chase: drift back behind the car when the player is not steering the view.
    if (this.mode === 'vehicle' && ctx.vehicleYaw !== undefined && this.idleLookTime > 1.2 && Math.abs(ctx.vehicleSpeed ?? 0) > 2) {
      const behindYaw = (ctx.vehicleSpeed ?? 0) < -2 ? ctx.vehicleYaw + Math.PI : ctx.vehicleYaw;
      this.yaw = dampAngle(this.yaw, behindYaw, 2.4, dt);
      this.pitch = damp(this.pitch, -0.2, 1.5, dt);
    }

    // Smooth the pivot: tight horizontally, softer vertically (stairs, jumps, suspension).
    _pivot.set(focus.x, focus.y + this.height, focus.z);
    if (!this.pivotInitialized) {
      this.pivot.copy(_pivot);
      this.pivotInitialized = true;
    }
    const hk = dampFactor(this.mode === 'vehicle' ? 14 : 30, dt);
    const vk = dampFactor(this.mode === 'vehicle' ? 8 : 12, dt);
    this.pivot.x += (_pivot.x - this.pivot.x) * hk;
    this.pivot.z += (_pivot.z - this.pivot.z) * hk;
    this.pivot.y += (_pivot.y - this.pivot.y) * vk;

    this.recoilKick = damp(this.recoilKick, 0, 10, dt);
    this.shake = damp(this.shake, 0, 12, dt);
    const viewPitch = this.pitch + this.recoilKick;
    const cp = Math.cos(viewPitch);
    _dir.set(Math.sin(this.yaw) * cp, Math.sin(viewPitch), Math.cos(this.yaw) * cp);
    _right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));

    // Spring arm: pivot -> shoulder offset -> camera, each segment sphere-cast.
    const r = CAMERA_SETTINGS.collisionRadius;
    let shoulderLen = Math.abs(this.shoulder);
    if (shoulderLen > 0.01) {
      const side = _right.clone().multiplyScalar(Math.sign(this.shoulder));
      shoulderLen = Math.min(shoulderLen, this.physics.sphereCast(this.pivot, side, r, shoulderLen, QueryGroups.camera, this.excludeBody));
      _shoulder.copy(this.pivot).addScaledVector(side, shoulderLen);
    } else _shoulder.copy(this.pivot);

    const back = _dir.clone().negate();
    const hitDist = this.physics.sphereCast(_shoulder, back, r, this.distance, QueryGroups.camera, this.excludeBody);
    const targetArm = Math.max(0.3, hitDist - 0.05);
    // Pull in instantly when blocked, ease back out when clear.
    this.armLength = targetArm < this.armLength ? targetArm : damp(this.armLength, targetArm, 4, dt);

    _desired.copy(_shoulder).addScaledVector(back, this.armLength);
    if (this.shake > 0.001) {
      _desired.x += (Math.random() - 0.5) * this.shake * 0.3;
      _desired.y += (Math.random() - 0.5) * this.shake * 0.3;
    }
    // Subtle sway while running on foot.
    const bob = ctx.bob ?? 0;
    if (bob > 0.01) {
      const ph = ctx.bobPhase ?? 0;
      _desired.y += Math.sin(ph * 2) * 0.03 * bob;
      _desired.addScaledVector(_right, Math.sin(ph) * 0.025 * bob);
    }
    this.camera.position.copy(_desired);
    this.camera.lookAt(_desired.clone().add(_dir));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** World-space ray through the screen centre. */
  aimRay() {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin, dir };
  }
}
