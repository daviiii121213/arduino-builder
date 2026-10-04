import * as THREE from 'three';
import { Groups, QueryGroups } from '../core/Physics.js';
import { CharacterRig } from '../characters/CharacterRig.js';
import { dampAngle } from '../core/math.js';
import { NPCHealth } from './NPCHealth.js';
import { regionFromWorld, damageFor } from '../combat/BodyDamage.js';
const GRAVITY = 20;

/**
 * Civilian walking a predefined route. Reacts to gunfire (flees), bullet hits
 * (flinch + flee) and vehicle impacts (knocked down). Respawns after dying.
 */
export class NPC {
  constructor({ physics, scene, audio, controller, look, path, rng }) {
    this.physics = physics;
    this.audio = audio;
    this.controller = controller;
    this.path = path;
    this.rng = rng;
    const R = physics.RAPIER;
    this.radius = 0.25;
    this.halfHeight = 0.4;
    this.centerOffset = this.halfHeight + this.radius;

    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    this.collider = physics.world.createCollider(
      R.ColliderDesc.capsule(this.halfHeight, this.radius).setCollisionGroups(Groups.npc),
      this.body,
    );
    physics.setOwner(this.collider, this);

    this.scene = scene;
    this.health = new NPCHealth(100);
    this.rig = new CharacterRig(look);
    scene.add(this.rig.root);
    this.walkSpeed = rng.range(1.15, 1.55);
    this.prevPos = new THREE.Vector3();
    this.currPos = new THREE.Vector3();
    this.renderPos = new THREE.Vector3();
    this.placeOnPath(rng.int(0, path.points.length - 1), rng.chance(0.5) ? 1 : -1);
  }

  placeOnPath(index, direction) {
    const p = this.path.points[index];
    this.target = index;
    this.direction = direction;
    this.advanceTarget();
    // Start just above the walkable surface (paths also run over the park terrace).
    this.teleport(p.x, this.physics.groundHeight(p.x, p.z, 5) + 0.05, p.z);
    const t = this.path.points[this.target];
    this.yaw = Math.atan2(t.x - p.x, t.z - p.z);
    this.health.reset();
    this.legInjury = 0;
    this.armInjury = 0;
    this.state = 'walk';
    this.stateTimer = 0;
    this.vy = 0;
    this.speed = 0;
    this.blockedTime = 0;
    this.pauseTimer = this.rng.range(4, 14);
    this.collider.setEnabled(true);
    this.setOpacity(1);
    this.rig.fallBlend = 0;
  }

  teleport(x, y, z) {
    this.body.setTranslation({ x, y: y + this.centerOffset, z }, true);
    this.body.setNextKinematicTranslation({ x, y: y + this.centerOffset, z });
    this.currPos.set(x, y, z);
    this.prevPos.copy(this.currPos);
    this.renderPos.copy(this.currPos);
  }

  advanceTarget() {
    const n = this.path.points.length;
    let next = this.target + this.direction;
    if (this.path.loop) next = (next + n) % n;
    else if (next < 0 || next >= n) {
      this.direction *= -1;
      next = this.target + this.direction;
    }
    this.target = next;
  }

  reverse() {
    this.direction *= -1;
    this.advanceTarget();
  }

  get alive() {
    return this.state !== 'dead';
  }

  get canBeHit() {
    return this.state !== 'dead' && this.state !== 'down';
  }

  // ------------------------------------------------------------ reactions

  /** Bullet hit: damage and reaction depend on the body region struck. Returns the region. */
  onBulletHit(damage, point, dir) {
    if (this.state === 'dead') return null;
    const lying = this.state === 'down';
    const { region, side } = lying ? { region: 'torso', side: 0 } : regionFromWorld(this.rig, point);
    const lethal = this.health.damage(damageFor(damage, region));
    this.rig.triggerHit(1, region, side);
    this.audio.play('hitBody', point);
    this.lastHitRegion = region;
    if (lethal) {
      this.die();
      return region;
    }
    this.audio.play('yelp', point, 0.8);
    this.fleeFrom(point.x - dir.x * 10, point.z - dir.z * 10);
    if (lying) return region;
    if (region === 'legs') {
      // Leg hits slow the character down for a while and can knock them over.
      this.legInjury = 14;
      if (this.rng.chance(0.4)) {
        this.state = 'down';
        this.stateTimer = 1.6;
        return region;
      }
    } else if (region === 'arms') {
      this.armInjury = 14;
      this.rig.injuredArm = side;
    }
    this.state = 'stagger';
    this.stateTimer = region === 'head' ? 0.6 : 0.4;
    return region;
  }

  hitByVehicle(speed, carPos) {
    if (!this.canBeHit) return;
    const lethal = this.health.damage(Math.min(150, speed * 9));
    this.rig.triggerHit(1);
    this.audio.play('hitBody', this.currPos, 1.4);
    this.fleeFrom(carPos.x, carPos.z);
    this.knockdown(carPos);
    if (lethal) this.die(true);
  }

  knockdown(from) {
    // Face the impact so the backward fall pose reads as being pushed away.
    this.yaw = Math.atan2(from.x - this.currPos.x, from.z - this.currPos.z);
    this.state = 'down';
    this.stateTimer = 2.8;
  }

  /** Runs away from a danger (gunfire, a theft, a car coming at them) within `radius`. */
  onDanger(pos, radius = 32, duration = 6) {
    if (this.state !== 'walk' && this.state !== 'idle' && this.state !== 'flee') return false;
    const d = Math.hypot(pos.x - this.currPos.x, pos.z - this.currPos.z);
    if (d > radius) return false;
    this.fleeFrom(pos.x, pos.z);
    if (this.state !== 'flee') this.state = 'flee';
    this.stateTimer = Math.max(this.stateTimer, duration * this.rng.range(0.8, 1.2));
    return true;
  }

  onGunshot(pos) {
    this.onDanger(pos, 32, 6);
  }

  /** Swaps the visual rig (used when an evicted driver becomes a pedestrian). */
  setRig(rig) {
    this.scene.remove(this.rig.root);
    this.rig.dispose();
    this.rig = rig;
    this.scene.add(rig.root);
    rig.root.rotation.set(0, 0, 0);
    rig.fallBlend = 0;
  }

  fleeFrom(x, z) {
    // Choose the path direction whose next waypoint takes us away from the threat.
    const here = this.currPos;
    const away = { x: here.x - x, z: here.z - z };
    const t = this.path.points[this.target];
    const towardTarget = (t.x - here.x) * away.x + (t.z - here.z) * away.z;
    if (towardTarget < 0) this.reverse();
  }

  die(byVehicle = false) {
    this.state = 'dead';
    this.stateTimer = 9;
    this.collider.setEnabled(false);
    if (!byVehicle) this.rig.triggerHit(1);
  }

  setOpacity(o) {
    for (const m of Object.values(this.rig.materials)) {
      m.transparent = o < 1;
      m.opacity = o;
      m.depthWrite = o >= 1;
    }
  }

  // ------------------------------------------------------------ update

  fixedUpdate(dt) {
    this.prevPos.copy(this.currPos);
    if (this.stateTimer > 0) this.stateTimer -= dt;
    this.legInjury = Math.max(0, (this.legInjury ?? 0) - dt);
    this.armInjury = Math.max(0, (this.armInjury ?? 0) - dt);
    this.rig.limp = this.legInjury > 0 ? 1 : 0;
    if (this.armInjury <= 0) this.rig.injuredArm = 0;

    let desiredSpeed = 0;
    switch (this.state) {
      case 'walk':
        desiredSpeed = this.walkSpeed;
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = this.rng.range(1.5, 4);
        }
        break;
      case 'idle':
        if (this.stateTimer <= 0) {
          this.state = 'walk';
          this.pauseTimer = this.rng.range(6, 18);
        }
        break;
      case 'stagger':
        if (this.stateTimer <= 0) {
          this.state = 'flee';
          this.stateTimer = this.rng.range(5, 8);
        }
        break;
      case 'flee':
        desiredSpeed = 4.6;
        if (this.stateTimer <= 0) {
          this.state = 'walk';
          this.pauseTimer = this.rng.range(6, 18);
        }
        break;
      case 'down':
        if (this.stateTimer <= 0) {
          this.state = 'flee';
          this.stateTimer = this.rng.range(5, 8);
        }
        break;
      case 'dead':
        if (this.stateTimer < 2) this.setOpacity(Math.max(0, this.stateTimer / 2));
        if (this.stateTimer <= 0) this.respawnRequested = true;
        return;
    }

    if (this.legInjury > 0) desiredSpeed *= 0.5;
    this.speed += Math.sign(desiredSpeed - this.speed) * Math.min(Math.abs(desiredSpeed - this.speed), 8 * dt);
    const pos = this.currPos;
    let dirX = 0;
    let dirZ = 0;
    if (this.speed > 0.01) {
      let t = this.path.points[this.target];
      let dx = t.x - pos.x;
      let dz = t.z - pos.z;
      if (Math.hypot(dx, dz) < 0.6) {
        this.advanceTarget();
        t = this.path.points[this.target];
        dx = t.x - pos.x;
        dz = t.z - pos.z;
      }
      const len = Math.hypot(dx, dz) || 1;
      dirX = dx / len;
      dirZ = dz / len;
      this.yaw = dampAngle(this.yaw, Math.atan2(dirX, dirZ), 8, dt);
    }
    // Move along the facing direction so turns at corners look natural.
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.vy = Math.max(this.vy - GRAVITY * dt, -30);
    const desired = { x: fx * this.speed * dt, y: this.vy * dt, z: fz * this.speed * dt };
    this.controller.computeColliderMovement(this.collider, desired, undefined, QueryGroups.npcMove);
    const moved = this.controller.computedMovement();
    if (this.controller.computedGrounded()) this.vy = -1;

    // Blocked (by the player, the car...) for a while: turn around.
    const want = Math.hypot(desired.x, desired.z);
    const got = Math.hypot(moved.x, moved.z);
    if (want > 0.005 && got < want * 0.3) this.blockedTime += dt;
    else this.blockedTime = Math.max(0, this.blockedTime - dt);
    if (this.blockedTime > 1.0) {
      this.blockedTime = 0;
      this.reverse();
    }

    const t = this.body.translation();
    const next = { x: t.x + moved.x, y: t.y + moved.y, z: t.z + moved.z };
    if (next.y < -10) {
      const p = this.path.points[this.target];
      this.teleport(p.x, this.physics.groundHeight(p.x, p.z, 5) + 0.05, p.z);
      return;
    }
    this.body.setNextKinematicTranslation(next);
    this.currPos.set(next.x, next.y - this.centerOffset, next.z);
    this.moveSpeed = got / dt;
  }

  /** `far` characters animate at a reduced rate (animation LOD). */
  render(dt, alpha, far = false) {
    this.renderPos.lerpVectors(this.prevPos, this.currPos, alpha);
    this.rig.root.position.copy(this.renderPos);
    this.rig.root.rotation.y = this.yaw;
    this.animDt = (this.animDt ?? 0) + dt;
    if (far && this.animDt < 0.1) return;
    dt = this.animDt;
    this.animDt = 0;
    const lying = this.state === 'dead' || this.state === 'down';
    this.rig.update(dt, {
      speed: lying ? 0 : this.moveSpeed ?? 0,
      grounded: true,
      dead: lying,
    });
  }
}
