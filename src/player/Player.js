import * as THREE from 'three';
import { Groups, QueryGroups } from '../core/Physics.js';
import { CharacterRig } from '../characters/CharacterRig.js';
import { clamp, dampAngle } from '../core/math.js';

const MOVE = {
  walkSpeed: 2.5,
  runSpeed: 5.9,
  aimSpeed: 2.0,
  groundAccel: 22,
  groundDecel: 26,
  airAccel: 4,
  gravity: 20,
  jumpSpeed: 6.0,
  coyoteTime: 0.12,
  jumpBuffer: 0.15,
  turnRate: 11,
  maxFall: 40,
};

const PLAYER_LOOK = {
  skin: 0xc68e62, shirt: 0xd8572a, pants: 0x2f3c52, shoes: 0x2a2420, hair: 0x2a1c14, hairStyle: 'side', sleeves: 'short', scale: 1,
};

/**
 * On-foot player: kinematic capsule driven by Rapier's character controller
 * (slopes, steps, ground snapping), plus the visual rig.
 */
export class Player {
  constructor({ physics, scene, audio, spawn }) {
    this.physics = physics;
    this.audio = audio;
    this.spawn = spawn;
    const R = physics.RAPIER;
    this.radius = 0.26;
    this.halfHeight = 0.4;
    this.centerOffset = this.halfHeight + this.radius; // feet -> capsule centre

    this.body = physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + this.centerOffset, spawn.z),
    );
    this.collider = physics.world.createCollider(
      R.ColliderDesc.capsule(this.halfHeight, this.radius).setCollisionGroups(Groups.player),
      this.body,
    );
    physics.setOwner(this.collider, this);

    const cc = physics.world.createCharacterController(0.02);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    cc.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(55));
    cc.enableAutostep(0.4, 0.2, false);
    cc.enableSnapToGround(0.4);
    cc.setSlideEnabled(true);
    // Lets the player shove loose props (bins, cones, crates).
    cc.setApplyImpulsesToDynamicBodies(true);
    cc.setCharacterMass(60);
    this.controller = cc;

    this.rig = new CharacterRig(PLAYER_LOOK);
    scene.add(this.rig.root);
    this.rig.onFootstep = (run) => this.audio.play('footstep', null, run > 0.5 ? 1.3 : 0.9);

    this.velocity = new THREE.Vector3();
    this.yaw = spawn.yaw ?? 0;
    this.grounded = false;
    this.coyote = 0;
    this.jumpQueued = 0;
    this.enabled = true;
    this.inVehicle = null;
    this.prevPos = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.currPos = this.prevPos.clone();
    this.renderPos = this.prevPos.clone();
    this.airTime = 0;
    this.actualSpeed = 0;
  }

  /** Feet position, interpolated for rendering. */
  get position() {
    return this.renderPos;
  }

  queueJump() {
    this.jumpQueued = MOVE.jumpBuffer;
  }

  /**
   * @param {number} dt fixed step
   * @param {{dirX:number, dirZ:number, run:boolean, aimingSlow:boolean, faceAim:boolean, aimYaw:number}} intent
   */
  fixedUpdate(dt, intent) {
    if (!this.enabled) return;
    const t = this.body.translation();
    this.prevPos.copy(this.currPos);

    const len = Math.hypot(intent.dirX, intent.dirZ);
    const dirX = len > 1 ? intent.dirX / len : intent.dirX;
    const dirZ = len > 1 ? intent.dirZ / len : intent.dirZ;
    const maxSpeed = intent.aimingSlow ? MOVE.aimSpeed : intent.run ? MOVE.runSpeed : MOVE.walkSpeed;
    const targetX = dirX * maxSpeed;
    const targetZ = dirZ * maxSpeed;
    const accelerating = len > 0.01;
    const accel = this.grounded ? (accelerating ? MOVE.groundAccel : MOVE.groundDecel) : MOVE.airAccel;
    // Accelerate along each axis toward the target velocity.
    const dvx = targetX - this.velocity.x;
    const dvz = targetZ - this.velocity.z;
    const dvLen = Math.hypot(dvx, dvz);
    const maxDv = accel * dt;
    if (dvLen > 0) {
      const k = Math.min(1, maxDv / dvLen);
      this.velocity.x += dvx * k;
      this.velocity.z += dvz * k;
    }

    // Vertical.
    this.jumpQueued = Math.max(0, this.jumpQueued - dt);
    this.coyote = this.grounded ? MOVE.coyoteTime : Math.max(0, this.coyote - dt);
    let jumped = false;
    if (this.jumpQueued > 0 && this.coyote > 0) {
      this.velocity.y = MOVE.jumpSpeed;
      this.jumpQueued = 0;
      this.coyote = 0;
      jumped = true;
      this.audio.play('jump');
    }
    this.velocity.y = Math.max(this.velocity.y - MOVE.gravity * dt, -MOVE.maxFall);

    const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt };
    this.controller.computeColliderMovement(this.collider, desired, undefined, QueryGroups.playerMove);
    const moved = this.controller.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded() && !jumped;

    // Intended velocity is kept (autostep needs it to climb curbs); actual speed drives animation.
    this.actualSpeed = Math.hypot(moved.x, moved.z) / dt;
    if (this.grounded) {
      if (!wasGrounded && this.airTime > 0.25) this.audio.play('land', null, clamp(-this.velocity.y / 10, 0.3, 1));
      this.velocity.y = -1;
      this.airTime = 0;
    } else {
      this.airTime += dt;
      if (desired.y > 0 && moved.y < desired.y * 0.5) this.velocity.y = 0; // bumped head
    }

    const next = { x: t.x + moved.x, y: t.y + moved.y, z: t.z + moved.z };
    if (next.y < -20) {
      this.teleport(this.spawn.x, this.spawn.y, this.spawn.z);
      return;
    }
    this.body.setNextKinematicTranslation(next);
    this.currPos.set(next.x, next.y - this.centerOffset, next.z);

    // Facing: aim direction while aiming, otherwise turn toward travel direction.
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (intent.faceAim) this.yaw = dampAngle(this.yaw, intent.aimYaw, 20, dt);
    else if (accelerating && horizSpeed > 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(dirX, dirZ), MOVE.turnRate, dt);
  }

  /** Called once per rendered frame with the fixed-step interpolation factor. */
  render(dt, alpha, animState) {
    this.renderPos.lerpVectors(this.prevPos, this.currPos, alpha);
    if (!this.enabled) return;
    this.rig.root.position.copy(this.renderPos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.update(dt, {
      speed: this.actualSpeed,
      grounded: this.grounded || this.airTime < 0.1,
      ...animState,
    });
  }

  teleport(x, y, z) {
    this.body.setTranslation({ x, y: y + this.centerOffset, z }, true);
    this.body.setNextKinematicTranslation({ x, y: y + this.centerOffset, z });
    this.currPos.set(x, y, z);
    this.prevPos.copy(this.currPos);
    this.renderPos.copy(this.currPos);
    this.velocity.set(0, 0, 0);
  }

  /** Disables the on-foot body (e.g. while driving). */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.collider.setEnabled(enabled);
    this.velocity.set(0, 0, 0);
  }

  speed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }
}
