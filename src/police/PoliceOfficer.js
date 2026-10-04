import { NPC } from '../npc/NPC.js';
import { WEAPONS } from '../weapons/WeaponDefinitions.js';
import { createPistolModel } from '../weapons/WeaponModels.js';
import { angleDiff, dampAngle } from '../core/math.js';

export const POLICE_LOOK = {
  skin: 0xc68e62, shirt: 0x24324a, pants: 0x1c2230, shoes: 0x141414, hair: 0x2a1c14,
  hairStyle: 'cap', hat: 0x1c2638, sleeves: 'short', scale: 1.02, build: 1.05,
};

const BRAIN_INTERVAL = 0.2;
const RUN = 4.2;
const WALK = 1.6;

/**
 * Police officer on foot. Reuses the civilian NPC body, movement, health and
 * body-part damage; adds a duty "brain": patrol, investigate, arrest attempts,
 * firefights from cover, search and returning to the car.
 */
export class PoliceOfficer extends NPC {
  constructor(opts) {
    super({ ...opts, look: opts.look ?? POLICE_LOOK });
    this.isOfficer = true;
    this.police = opts.police;
    this.mode = 'patrol';
    this.brainTimer = Math.random() * BRAIN_INTERVAL;
    this.fireCooldown = 1 + Math.random();
    this.burst = 0;
    this.repositionTimer = 0;
    this.searchTimer = 0;
    this.arrestTimer = 0;
    this.canSeePlayer = false;
    this.car = opts.car ?? null;
    this.slot = 0;
    this.recoil = 0;
    this.aimPitch = 0;
    this.weapon = createPistolModel();
    this.weapon.object.scale.setScalar(0.72);
    this.attachWeapon();
    this.health.max = this.health.value = 120;
  }

  attachWeapon() {
    this.rig.weaponPivot.add(this.weapon.object);
    this.weapon.object.position.set(0, 0, 0.2);
  }

  setRig(rig, disposeOld) {
    super.setRig(rig, disposeOld);
    this.attachWeapon();
  }

  get alive() {
    return this.state !== 'dead';
  }

  /** Eye position for line-of-sight checks. */
  eye() {
    return { x: this.currPos.x, y: this.currPos.y + 1.1, z: this.currPos.z };
  }

  // Officers do not flee like civilians; danger makes them respond instead.
  onDanger(pos) {
    if (this.alive && (this.mode === 'patrol' || this.mode === 'idle')) this.investigate(pos);
    return false;
  }

  onGunshot(pos) {
    this.onDanger(pos);
  }

  onWitness() {}

  /** Being shot at makes an officer engage immediately. */
  onBulletHit(damage, point, dir) {
    const region = super.onBulletHit(damage, point, dir);
    if (this.alive) {
      this.mode = 'combat';
      this.repositionTimer = 0;
    }
    return region;
  }

  investigate(pos) {
    this.mode = 'investigate';
    this.investigatePos = { x: pos.x, z: pos.z };
    this.searchTimer = 8;
    this.moveTo(pos, RUN);
  }

  moveTo(p, speed, onArrive = null) {
    this.goal = { x: p.x, z: p.z, speed, time: 0, onArrive };
    this.state = 'goto';
  }

  hold() {
    this.goal = null;
    this.state = 'idle';
    this.stateTimer = 999;
  }

  // ------------------------------------------------------------ brain

  fixedUpdate(dt) {
    if (this.state === 'dead') {
      super.fixedUpdate(dt);
      if (this.respawnRequested) this.removeMe = true;
      return;
    }
    this.fireCooldown -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.brainTimer -= dt;
    if (this.brainTimer <= 0) {
      this.brainTimer = BRAIN_INTERVAL;
      this.think(BRAIN_INTERVAL);
    }
    // Face the player while engaging.
    const ctx = this.police;
    if ((this.mode === 'combat' || this.mode === 'arrest') && this.canSeePlayer && this.state !== 'goto') {
      const p = ctx.playerPosition();
      this.yaw = dampAngle(this.yaw, Math.atan2(p.x - this.currPos.x, p.z - this.currPos.z), 10, dt);
    }
    if (this.mode === 'combat' && this.canSeePlayer) this.tryShoot();
    // The NPC base class handles locomotion, gravity and collisions.
    if ((this.state === 'walk' && this.mode !== 'patrol') || this.state === 'flee') this.hold();
    super.fixedUpdate(dt);
  }

  think(dt) {
    const ctx = this.police;
    const wanted = ctx.wanted;
    const player = ctx.playerPosition();
    const dist = Math.hypot(player.x - this.currPos.x, player.z - this.currPos.z);
    this.repositionTimer -= dt;

    if (wanted.level === 0) {
      if (this.mode === 'investigate') {
        this.searchTimer -= dt;
        if (this.searchTimer <= 0) this.mode = 'return';
        return;
      }
      if (this.mode !== 'patrol') this.mode = 'return';
      if (this.mode === 'return') this.returnToDuty();
      return;
    }

    if (this.canSeePlayer && ctx.playerAlive()) {
      const hostile = wanted.level >= 3 || wanted.hostileTimer > 0 || ctx.playerArmed();
      this.mode = hostile ? 'combat' : 'arrest';
    } else if (this.mode === 'combat' || this.mode === 'arrest' || this.mode === 'patrol' || this.mode === 'investigate' || this.mode === 'idle') {
      this.mode = 'search';
      this.searchTimer = 0;
    }

    if (this.mode === 'arrest') {
      if (dist > 1.8) this.moveTo(player, RUN);
      else {
        this.hold();
        this.arrestTimer += dt;
        if (this.arrestTimer > 1.4) ctx.tryArrest(this);
      }
      return;
    }
    this.arrestTimer = 0;

    if (this.mode === 'combat') {
      // Reposition every few seconds (or when hurt), preferring cover around our slot.
      const hurt = this.health.value < this.health.max * 0.35;
      if (this.repositionTimer <= 0 || dist < 4) {
        this.repositionTimer = 3.5 + Math.random() * 3;
        const spot = ctx.findCover(this, hurt ? 20 : 12);
        if (spot) this.moveTo(spot, RUN);
        else if (dist > 18) this.moveTo(player, RUN);
        else this.hold();
      }
      return;
    }

    if (this.mode === 'search') {
      const lk = wanted.lastKnown;
      this.searchTimer -= dt;
      if (this.searchTimer <= 0 && lk) {
        // Head for the last known position, then check spots around it.
        const near = Math.hypot(lk.x - this.currPos.x, lk.z - this.currPos.z) < 4;
        const a = Math.random() * Math.PI * 2;
        const r = near ? 5 + Math.random() * 12 : 0;
        this.moveTo({ x: lk.x + Math.cos(a) * r, z: lk.z + Math.sin(a) * r }, near ? WALK * 1.4 : RUN);
        this.searchTimer = near ? 4 + Math.random() * 3 : 6;
      }
    }
  }

  returnToDuty() {
    const car = this.car;
    if (car && !car.disposed && !car.driver && car.mode !== 'physics' && car.currPos.distanceTo(this.currPos) < 70) {
      if (this.state !== 'goto') {
        this.moveTo(car.doorPosition(), WALK * 1.3, () => this.police.boardCar(this, car));
      }
    } else {
      this.wantsDespawn = true;
      if (this.state !== 'goto') {
        // Walk off along the sidewalk until out of sight.
        const a = this.yaw;
        this.moveTo({ x: this.currPos.x + Math.sin(a) * 30, z: this.currPos.z + Math.cos(a) * 30 }, WALK);
      }
    }
  }

  tryShoot() {
    if (this.fireCooldown > 0 || this.state === 'goto' || this.state === 'stagger' || this.state === 'down') return;
    if (Math.abs(angleDiff(this.yaw, Math.atan2(this.police.playerPosition().x - this.currPos.x, this.police.playerPosition().z - this.currPos.z))) > 0.35) return;
    this.police.officerFire(this);
    this.recoil = 1;
    this.burst++;
    if (this.burst >= 3) {
      this.burst = 0;
      this.fireCooldown = 1.4 + Math.random() * 1.2;
    } else this.fireCooldown = 0.35 + Math.random() * 0.2;
  }

  /** Arm hits spoil the aim for a while (combat effectiveness). */
  get aimPenalty() {
    return this.armInjury > 0 ? 2 : 1;
  }

  render(dt, alpha, far = false) {
    this.renderPos.lerpVectors(this.prevPos, this.currPos, alpha);
    this.rig.root.position.copy(this.renderPos);
    this.rig.root.rotation.y = this.yaw;
    this.animDt = (this.animDt ?? 0) + dt;
    if (far && this.animDt < 0.1) return;
    dt = this.animDt;
    this.animDt = 0;
    const lying = this.state === 'dead' || this.state === 'down';
    const engaged = this.mode === 'combat' && this.canSeePlayer;
    if (engaged) {
      const p = this.police.playerPosition();
      const d = Math.hypot(p.x - this.currPos.x, p.z - this.currPos.z);
      this.aimPitch = Math.atan2(p.y - this.currPos.y, d);
    }
    this.weapon.object.visible = !lying;
    this.rig.update(dt, {
      speed: lying ? 0 : this.moveSpeed ?? 0,
      grounded: true,
      dead: lying,
      armed: !lying && (this.mode === 'combat' || this.mode === 'search' || this.mode === 'arrest'),
      aiming: engaged || this.mode === 'arrest',
      weapon: 'pistol',
      weaponPose: WEAPONS.pistol.pose,
      grips: this.weapon.grips,
      recoil: this.recoil,
      aimPitch: this.aimPitch,
    });
    this.weapon.object.position.z = this.rig.weaponOffset;
  }
}

