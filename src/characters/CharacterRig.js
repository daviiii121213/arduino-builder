import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, damp, dampFactor, lerp } from '../core/math.js';

// Body dimensions for a 1.8 m reference character (scaled per instance).
const DIM = {
  hipY: 0.95,
  thigh: 0.45,
  shin: 0.44,
  upperArm: 0.29,
  forearm: 0.26,
  shoulderX: 0.2,
  shoulderY: 0.44, // above spine pivot
  hipX: 0.095,
};

let sharedGeo = null;
function geometries() {
  if (sharedGeo) return sharedGeo;
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10).translate(0, -len / 2 - r * 0.3, 0);
  // Torso as a lathe so the chest is broader than the waist.
  const torsoProfile = [
    [0.0, 0.0], [0.15, 0.0], [0.155, 0.08], [0.15, 0.18], [0.165, 0.3], [0.185, 0.4],
    [0.17, 0.46], [0.11, 0.5], [0.0, 0.51],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.LatheGeometry(torsoProfile, 14).scale(1.12, 1, 0.68);
  const pelvis = new THREE.CapsuleGeometry(0.13, 0.12, 4, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.75).translate(0, -0.02, 0);
  const head = new THREE.SphereGeometry(0.11, 16, 12).scale(0.92, 1.08, 1.0);
  const hair = new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.95, 1.05, 1.06).translate(0, 0.01, -0.008);
  const nose = new THREE.ConeGeometry(0.018, 0.045, 6).rotateX(Math.PI / 2).translate(0, -0.005, 0.11);
  const ear = new THREE.SphereGeometry(0.025, 8, 6).scale(0.5, 1, 0.8);
  const neck = new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10).translate(0, 0.05, 0);
  const upperArm = capsule(0.052, DIM.upperArm - 0.06);
  const forearm = capsule(0.043, DIM.forearm - 0.06);
  const hand = new THREE.BoxGeometry(0.07, 0.095, 0.035).translate(0, -0.05, 0);
  const thigh = capsule(0.078, DIM.thigh - 0.09);
  const shin = capsule(0.062, DIM.shin - 0.08);
  const foot = new THREE.BoxGeometry(0.1, 0.07, 0.25).translate(0, -0.035, 0.05);
  const collar = new THREE.TorusGeometry(0.075, 0.02, 6, 14).rotateX(Math.PI / 2);
  sharedGeo = { torso, pelvis, head, hair, nose, ear, neck, upperArm, forearm, hand, thigh, shin, foot, collar };
  return sharedGeo;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _down = new THREE.Vector3(0, -1, 0);

/**
 * Procedurally animated humanoid made of simple primitives.
 * Root origin is at the feet; the character faces local +Z.
 */
export class CharacterRig {
  /**
   * @param {{skin, shirt, pants, shoes, hair, sleeves?:'short'|'long', scale?:number, build?:number}} look
   */
  constructor(look) {
    const g = geometries();
    const C = {
      skin: new THREE.Color(look.skin),
      shirt: new THREE.Color(look.shirt),
      pants: new THREE.Color(look.pants),
      shoes: new THREE.Color(look.shoes),
      hair: new THREE.Color(look.hair),
    };
    const sleeve = look.sleeves === 'long' ? C.shirt : C.skin;
    const build = look.build ?? 1;

    this.root = new THREE.Group();
    // Every joint is a bone; all body parts are merged into one skinned mesh (one draw call).
    this.bones = [];
    const parts = [];
    const joint = (parent, x, y, z) => {
      const j = new THREE.Bone();
      j.position.set(x, y, z);
      parent?.add(j);
      this.bones.push(j);
      return j;
    };
    const part = (geo, color, bone, offset, scale) => parts.push({ geo, color, bone, offset, scale });

    this.body = joint(null, 0, 0, 0); // tilted as a whole for falls
    this.hips = joint(this.body, 0, DIM.hipY, 0);
    part(g.pelvis, C.pants, this.hips, null, [build, 1, build]);
    this.spine = joint(this.hips, 0, 0.04, 0);
    part(g.torso, C.shirt, this.spine, null, [build, 1, build]);
    this.neck = joint(this.spine, 0, 0.5, 0);
    part(g.collar, C.shirt, this.neck);
    part(g.neck, C.skin, this.neck);
    this.head = joint(this.neck, 0, 0.18, 0);
    part(g.head, C.skin, this.head);
    part(g.hair, C.hair, this.head);
    part(g.nose, C.skin, this.head);
    part(g.ear, C.skin, this.head, [0.1, -0.005, -0.005]);
    part(g.ear, C.skin, this.head, [-0.1, -0.005, -0.005]);

    const arm = (side) => {
      const shoulder = joint(this.spine, side * DIM.shoulderX * build, DIM.shoulderY, -0.01);
      const upper = joint(shoulder, 0, 0, 0);
      part(g.upperArm, C.shirt, upper);
      const fore = joint(upper, 0, -DIM.upperArm, 0);
      part(g.forearm, sleeve, fore);
      const hand = joint(fore, 0, -DIM.forearm, 0);
      part(g.hand, C.skin, hand);
      return { shoulder, upper, fore, hand };
    };
    // Facing +Z, the character's left side is +X.
    this.armL = arm(1);
    this.armR = arm(-1);

    const leg = (side) => {
      const thigh = joint(this.hips, side * DIM.hipX, -0.03, 0);
      part(g.thigh, C.pants, thigh);
      const shin = joint(thigh, 0, -DIM.thigh, 0);
      part(g.shin, C.pants, shin);
      const foot = joint(shin, 0, -DIM.shin, 0);
      part(g.foot, C.shoes, foot);
      return { thigh, shin, foot };
    };
    this.legL = leg(1);
    this.legR = leg(-1);

    /** Weapons are parented here; it pivots with aim pitch in front of the right shoulder. */
    this.weaponPivot = joint(this.spine, -0.12, 0.36, 0.05);

    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
    this.materials = { body: this.material };
    this.mesh = new THREE.SkinnedMesh(this.buildSkinnedGeometry(parts), this.material);
    this.mesh.castShadow = true;
    this.mesh.add(this.body);
    this.root.add(this.mesh);
    this.root.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(this.bones));
    this.root.scale.setScalar(look.scale ?? 1);

    this.phase = 0;
    this.runBlend = 0;
    this.moveBlend = 0;
    this.airBlend = 0;
    this.armedBlend = 0;
    this.aimBlend = 0;
    this.fallBlend = 0;
    this.hitTimer = 0;
    this.flashTimer = 0;
    this.lastStepSign = 1;
    this.onFootstep = null;
    this.weaponOffset = 0.3;
  }

  /** Bakes all parts in bind pose with a rigid weight to their joint. */
  buildSkinnedGeometry(parts) {
    this.body.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    const geos = parts.map(({ geo, color, bone, offset, scale }) => {
      const pg = geo.index ? geo.toNonIndexed() : geo.clone();
      m.identity();
      if (scale) m.makeScale(scale[0], scale[1], scale[2]);
      if (offset) m.setPosition(offset[0], offset[1], offset[2]);
      pg.applyMatrix4(m);
      pg.applyMatrix4(bone.matrixWorld);
      const count = pg.attributes.position.count;
      const colors = new Float32Array(count * 3);
      const skinIndex = new Uint16Array(count * 4);
      const skinWeight = new Float32Array(count * 4);
      const boneIndex = this.bones.indexOf(bone);
      for (let i = 0; i < count; i++) {
        colors.set([color.r, color.g, color.b], i * 3);
        skinIndex[i * 4] = boneIndex;
        skinWeight[i * 4] = 1;
      }
      for (const name of Object.keys(pg.attributes)) if (name !== 'position' && name !== 'normal') pg.deleteAttribute(name);
      pg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      pg.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
      pg.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
      return pg;
    });
    const merged = mergeGeometries(geos);
    geos.forEach((x) => x.dispose());
    return merged;
  }

  setFlash(amount) {
    this.material.emissive.setRGB(amount, amount * 0.85, amount * 0.8);
  }

  flash() {
    this.flashTimer = 0.12;
  }

  triggerHit(strength = 1) {
    this.hitTimer = 0.35 * strength;
    this.flash();
  }

  /**
   * @param {number} dt
   * @param {object} s - {speed, runSpeed, grounded, aimPitch, armed, aiming, weapon, recoil, reload, dead, seated}
   */
  update(dt, s) {
    const speed = s.speed ?? 0;
    const stride = lerp(1.35, 2.3, this.runBlend);
    this.phase += (speed / stride) * Math.PI * dt;
    const step = Math.sign(Math.sin(this.phase));
    if (step !== this.lastStepSign && s.grounded && speed > 0.5) this.onFootstep?.(this.runBlend);
    this.lastStepSign = step;

    this.moveBlend = damp(this.moveBlend, clamp(speed / 1.2, 0, 1), 10, dt);
    this.runBlend = damp(this.runBlend, clamp((speed - 2.8) / 2.5, 0, 1), 6, dt);
    this.airBlend = damp(this.airBlend, s.grounded ? 0 : 1, 10, dt);
    this.armedBlend = damp(this.armedBlend, s.armed ? 1 : 0, 14, dt);
    this.aimBlend = damp(this.aimBlend, s.aiming ? 1 : 0, 16, dt);
    this.fallBlend = damp(this.fallBlend, s.dead ? 1 : 0, s.dead ? 5 : 3, dt);
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.setFlash(this.flashTimer > 0 ? 0.9 : 0);
    }

    if (s.seated) {
      this.poseSeated();
      return;
    }

    const p = this.phase;
    const mv = this.moveBlend * (1 - this.airBlend);
    const run = this.runBlend;
    const legAmp = lerp(0.42, 0.85, run) * mv;
    const kneeAmp = lerp(0.6, 1.35, run) * mv;
    const time = performance.now() * 0.001;

    // Legs.
    const legPose = (legs, ph) => {
      const swing = -Math.sin(ph) * legAmp;
      const knee = Math.max(0, Math.cos(ph)) * kneeAmp + 0.04;
      legs.thigh.rotation.set(swing, 0, 0);
      legs.shin.rotation.set(knee, 0, 0);
      legs.foot.rotation.set(-swing * 0.3 - knee * 0.25, 0, 0);
    };
    legPose(this.legL, p);
    legPose(this.legR, p + Math.PI);
    // Airborne tuck.
    const air = this.airBlend;
    this.legL.thigh.rotation.x = lerp(this.legL.thigh.rotation.x, -0.75, air);
    this.legL.shin.rotation.x = lerp(this.legL.shin.rotation.x, 1.1, air);
    this.legR.thigh.rotation.x = lerp(this.legR.thigh.rotation.x, 0.15, air);
    this.legR.shin.rotation.x = lerp(this.legR.shin.rotation.x, 0.55, air);

    // Hips and spine.
    const bob = -Math.abs(Math.cos(p)) * lerp(0.025, 0.06, run) * mv;
    const breathe = Math.sin(time * 1.6) * 0.006 * (1 - mv);
    this.hips.position.y = DIM.hipY + bob + breathe;
    this.hips.rotation.y = Math.sin(p) * 0.12 * mv * (1 - this.aimBlend);
    const lean = lerp(0.04, 0.2, run) * mv * (1 - this.aimBlend);
    const pitch = s.aimPitch ?? 0;
    const hit = Math.sin((this.hitTimer / 0.35) * Math.PI) * (this.hitTimer > 0 ? 1 : 0);
    this.spine.rotation.set(
      lean - pitch * 0.35 * this.armedBlend - hit * 0.35,
      -this.hips.rotation.y * 0.8 + hit * 0.2,
      Math.sin(p) * 0.03 * mv,
    );
    this.head.rotation.set(-pitch * 0.4 + breathe * 2 + hit * 0.3, 0, 0);

    // Arms: free swing, then blended toward weapon IK when armed.
    const armAmp = lerp(0.35, 0.95, run) * mv;
    const armSwing = (arm, ph, side) => {
      arm.upper.rotation.set(Math.sin(ph) * armAmp + air * -0.6, 0, side * (0.1 + air * 0.5));
      arm.fore.rotation.set(-lerp(0.15, 1.2, run) * mv - 0.1 - air * 0.4, 0, 0);
      arm.upper.quaternion.setFromEuler(arm.upper.rotation);
      arm.fore.quaternion.setFromEuler(arm.fore.rotation);
    };
    armSwing(this.armL, p, 1);
    armSwing(this.armR, p + Math.PI, -1);

    // Weapon pivot: low-ready when relaxed, follows aim pitch when aiming.
    const recoil = s.recoil ?? 0;
    const reload = s.reload ?? -1;
    const reloadTilt = reload >= 0 ? Math.sin(reload * Math.PI) : 0;
    const pose = s.weaponPose;
    if (pose) {
      const twist = pose.twist * this.armedBlend;
      this.spine.rotation.y += twist;
      this.weaponPivot.position.set(pose.pivot[0], pose.pivot[1], pose.pivot[2] - recoil * 0.05);
      this.weaponPivot.rotation.set(
        lerp(pose.readyPitch, -pitch * 0.65, this.aimBlend) - recoil * 0.22 + reloadTilt * 0.45,
        -twist + lerp(pose.readyYaw, 0, this.aimBlend),
        reloadTilt * 0.6,
      );
      this.weaponOffset = lerp(pose.readyOffset, pose.aimOffset, this.aimBlend);
    }

    if (this.armedBlend > 0.01 && s.grips) this.applyWeaponIK(s.grips, reload, this.armedBlend);

    // Whole-body fall for knocked-down characters.
    const f = this.fallBlend;
    this.body.rotation.x = -f * 1.45;
    this.body.position.y = f * 0.15;
    this.body.position.z = -f * 0.25;
    if (f > 0.01) {
      this.armL.upper.rotation.z = lerp(this.armL.upper.rotation.z, 1.2, f);
      this.armR.upper.rotation.z = lerp(this.armR.upper.rotation.z, -1.0, f);
      this.armL.upper.quaternion.setFromEuler(this.armL.upper.rotation);
      this.armR.upper.quaternion.setFromEuler(this.armR.upper.rotation);
      this.legL.thigh.rotation.x = lerp(this.legL.thigh.rotation.x, -0.2, f);
      this.legR.thigh.rotation.x = lerp(this.legR.thigh.rotation.x, 0.1, f);
    }
  }

  poseSeated() {
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.hips.position.y = DIM.hipY;
    this.hips.rotation.set(0, 0, 0);
    this.spine.rotation.set(-0.15, 0, 0);
    this.head.rotation.set(0.12, 0, 0);
    for (const legs of [this.legL, this.legR]) {
      legs.thigh.rotation.set(-1.45, 0, 0);
      legs.shin.rotation.set(1.35, 0, 0);
      legs.foot.rotation.set(0.1, 0, 0);
    }
    for (const [arm, side] of [[this.armL, 1], [this.armR, -1]]) {
      arm.upper.rotation.set(-0.95, 0, side * -0.12);
      arm.upper.quaternion.setFromEuler(arm.upper.rotation);
      arm.fore.rotation.set(-0.55, 0, 0);
      arm.fore.quaternion.setFromEuler(arm.fore.rotation);
    }
  }

  /** Two-bone IK placing both hands on the weapon grip markers. */
  applyWeaponIK(grips, reload, weight) {
    this.root.updateMatrixWorld(true);
    let left = grips.left.getWorldPosition(_v3);
    if (reload >= 0) {
      // Left hand drops to the belt and comes back with a fresh magazine.
      const t = Math.sin(clamp(reload, 0, 1) * Math.PI);
      const belt = _v2.set(0.15, 0.05, 0.12).applyMatrix4(this.hips.matrixWorld);
      left = left.lerp(belt, t);
    }
    this.solveArm(this.armL, left, weight, 1);
    this.solveArm(this.armR, grips.right.getWorldPosition(_v3), weight, -1);
  }

  solveArm(arm, targetWorld, weight, side) {
    const parent = arm.shoulder;
    parent.updateMatrixWorld(true);
    const target = parent.worldToLocal(targetWorld.clone());
    const l1 = DIM.upperArm;
    const l2 = DIM.forearm;
    const dist = clamp(target.length(), 0.05, (l1 + l2) * 0.999);
    const dir = target.clone().normalize();
    // Elbow points down and outward.
    const pole = _v1.set(side * 0.6, -1, -0.3).normalize();
    const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
    const a = Math.acos(cosA);
    const axis = _v2.crossVectors(dir, pole).normalize();
    const upperDir = dir.clone().applyAxisAngle(axis, a);
    const elbow = upperDir.clone().multiplyScalar(l1);
    const foreDir = target.clone().sub(elbow).normalize();

    _q1.setFromUnitVectors(_down, upperDir);
    arm.upper.quaternion.slerp(_q1, weight);
    const localFore = foreDir.applyQuaternion(arm.upper.quaternion.clone().invert());
    _q1.setFromUnitVectors(_down, localFore);
    arm.fore.quaternion.slerp(_q1, weight);
    arm.hand.rotation.set(0, 0, 0);
  }

  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

export const dampF = dampFactor;
