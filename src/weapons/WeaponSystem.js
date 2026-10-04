import * as THREE from 'three';
import { WEAPONS } from './WeaponDefinitions.js';
import { weaponModelFactories } from './WeaponModels.js';
import { QueryGroups } from '../core/Physics.js';
import { angleDiff } from '../core/math.js';

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _target = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _muzzleDir = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Owns the player's two weapons: equipping (keys 1/2), firing (hitscan),
 * spread/recoil, ammunition and reloading.
 */
export class WeaponSystem {
  constructor({ player, physics, effects, audio, camera, onShot, onHit }) {
    this.player = player;
    this.physics = physics;
    this.effects = effects;
    this.audio = audio;
    this.camera = camera;
    this.onShot = onShot;
    this.onHit = onHit;
    const rig = player.rig;

    this.weapons = {};
    for (const id of Object.keys(WEAPONS)) {
      const def = WEAPONS[id];
      const model = weaponModelFactories[id]();
      model.magazine.userData.baseY = model.magazine.position.y;
      this.weapons[id] = {
        def,
        model,
        ammo: def.magazineSize,
        reserve: def.reserveAmmo,
      };
      this.stow(id);
    }
    this.rig = rig;
    this.current = null; // weapon id or null (unarmed)
    this.equipTimer = 0;
    this.reloadTimer = -1;
    this.cooldown = 0;
    this.spread = 0;
    this.recoil = 0;
    this.aimHold = 0; // keeps the character aimed for a moment after hip-firing
    this.triggerReleased = true;
    this.sinceShot = 1;
    this.pendingAutoReload = 0;
  }

  get active() {
    return this.current ? this.weapons[this.current] : null;
  }

  get isReloading() {
    return this.reloadTimer >= 0;
  }

  stow(id) {
    const w = this.weapons[id];
    const obj = w.model.object;
    const rig = this.player.rig;
    w.model.magazine.position.y = w.model.magazine.userData.baseY;
    w.model.magazine.visible = true;
    if (w.def.stow === 'back') {
      rig.spine.add(obj);
      obj.position.set(0.03, 0.46, -0.19);
      obj.rotation.set(Math.PI / 2, 0, 0.75, 'ZYX');
    } else {
      rig.hips.add(obj);
      obj.position.set(-0.2, 0.0, 0.02);
      obj.rotation.set(Math.PI / 2, 0, 0, 'XYZ');
    }
  }

  equip(id) {
    if (this.current === id) {
      // Pressing the same key again holsters the weapon.
      this.holster();
      return;
    }
    if (this.current) this.stow(this.current);
    this.current = id;
    const w = this.weapons[id];
    this.rig.weaponPivot.add(w.model.object);
    w.model.object.position.set(0, 0, w.def.pose.readyOffset);
    w.model.object.rotation.set(0, 0, 0, 'XYZ');
    w.model.magazine.position.y = w.model.magazine.userData.baseY;
    w.model.magazine.visible = true;
    this.equipTimer = w.def.equipTime;
    this.reloadTimer = -1;
    this.pendingAutoReload = 0;
    this.audio.play('equip');
  }

  holster() {
    if (!this.current) return;
    this.stow(this.current);
    this.current = null;
    this.reloadTimer = -1;
    this.pendingAutoReload = 0;
    this.audio.play('equip');
  }

  reload() {
    const w = this.active;
    if (!w || this.isReloading || this.equipTimer > 0) return;
    if (w.ammo >= w.def.magazineSize || w.reserve <= 0) return;
    this.reloadTimer = 0;
    this.audio.play('reloadOut');
  }

  /** Pose data for the character rig. */
  animState(aiming) {
    const w = this.active;
    if (!w) return { armed: false, aiming: false };
    return {
      armed: true,
      aiming: aiming || this.aimHold > 0,
      weapon: w.def.id,
      weaponPose: w.def.pose,
      grips: w.model.grips,
      recoil: this.recoil,
      reload: this.isReloading ? this.reloadTimer / w.def.reloadTime : -1,
    };
  }

  /**
   * @param {number} dt
   * @param {{fireHeld:boolean, firePressed:boolean, aiming:boolean, moving:number, airborne:boolean, cameraYaw:number}} ctl
   */
  update(dt, ctl) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.equipTimer = Math.max(0, this.equipTimer - dt);
    this.aimHold = Math.max(0, this.aimHold - dt);
    this.recoil = Math.max(0, this.recoil - dt * 9);
    const w = this.active;
    if (!w) return;
    const def = w.def;
    if (this.pendingAutoReload > 0) {
      this.pendingAutoReload -= dt;
      if (this.pendingAutoReload <= 0) this.reload();
    }

    // Keep the weapon at the rig's current offset (ready vs aimed).
    w.model.object.position.z = this.rig.weaponOffset;

    // Spread recovers toward a base that depends on movement and stance.
    let base = def.spreadBase * (ctl.aiming ? 1 : 2.2);
    base += ctl.moving * 0.004 + (ctl.airborne ? 0.03 : 0);
    this.sinceShot += dt;
    if (this.sinceShot > 0.12) this.spread = Math.max(base, this.spread - def.spreadRecovery * dt);
    else this.spread = Math.max(base, this.spread);

    if (this.isReloading) {
      this.reloadTimer += dt;
      const t = this.reloadTimer / def.reloadTime;
      // Magazine drops out, then slides back in.
      const mag = w.model.magazine;
      const baseY = mag.userData.baseY;
      mag.position.y = baseY - (t > 0.15 && t < 0.75 ? 0.25 : 0);
      mag.visible = !(t > 0.25 && t < 0.55);
      if (this.reloadTimer >= def.reloadTime) {
        const needed = def.magazineSize - w.ammo;
        const take = Math.min(needed, w.reserve);
        w.ammo += take;
        w.reserve -= take;
        this.reloadTimer = -1;
        mag.position.y = baseY;
        mag.visible = true;
        this.audio.play('reloadIn');
      }
      return;
    }

    if (!ctl.fireHeld) this.triggerReleased = true;
    const wantsFire = def.automatic ? ctl.fireHeld : ctl.firePressed || (ctl.fireHeld && this.triggerReleased);
    if (!wantsFire) return;
    this.aimHold = 1.0;
    if (this.equipTimer > 0 || this.cooldown > 0) return;
    // Wait until the character has turned to face the aim direction.
    if (Math.abs(angleDiff(this.player.yaw, ctl.cameraYaw)) > 0.4) return;
    if (w.ammo <= 0) {
      if (this.triggerReleased) {
        this.audio.play('emptyClick');
        this.triggerReleased = false;
        if (w.reserve > 0) this.reload();
      }
      return;
    }
    this.triggerReleased = false;
    this.fire(w);
    // Start reloading straight away when the magazine runs dry.
    if (w.ammo === 0 && w.reserve > 0) this.pendingAutoReload = 0.25;
  }

  fire(w) {
    const def = w.def;
    w.ammo--;
    this.cooldown = 1 / def.fireRate;
    this.sinceShot = 0;
    this.recoil = Math.min(1, this.recoil + 0.8);

    // 1) Ray from the camera through the (spread-jittered) crosshair.
    const ray = this.camera.aimRay();
    _dir.copy(ray.dir);
    const s = this.spread;
    const right = new THREE.Vector3().crossVectors(_dir, THREE.Object3D.DEFAULT_UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, _dir).normalize();
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * s;
    _dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();

    // Start past the player so nothing between the camera and the character is hit.
    const chest = _shoulder.copy(this.player.position);
    chest.y += 1.45;
    const skip = Math.max(0, _origin.subVectors(chest, ray.origin).dot(_dir));
    _origin.copy(ray.origin).addScaledVector(_dir, skip);
    const camHit = this.physics.raycast(_origin, _dir, def.range, QueryGroups.bullets, this.player.body);
    if (camHit) _target.set(camHit.point.x, camHit.point.y, camHit.point.z);
    else _target.copy(_origin).addScaledVector(_dir, def.range);

    // 2) Ray from the shooter's shoulder to that point resolves what is actually hit.
    const toTarget = new THREE.Vector3().subVectors(_target, chest);
    const dist = toTarget.length();
    toTarget.normalize();
    const hit = this.physics.raycast(chest, toTarget, dist + 0.05, QueryGroups.bullets, this.player.body);

    // Muzzle effects.
    const muzzle = w.model.muzzle;
    muzzle.getWorldPosition(_muzzle);
    w.model.object.getWorldQuaternion(_q);
    _muzzleDir.set(0, 0, 1).applyQuaternion(_q);
    this.effects.muzzleFlash(_muzzle, _muzzleDir, def.id === 'rifle' ? 1.15 : 0.9);
    const end = hit ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z) : _target;
    this.effects.tracer(_muzzle, end);
    this.audio.play(def.id === 'rifle' ? 'rifleShot' : 'pistolShot');
    this.camera.addRecoil(def.recoilPitch, def.recoilYaw);
    this.spread = Math.min(def.spreadMax, this.spread + def.spreadPerShot);
    this.onShot?.(chest);

    if (!hit) return;
    const owner = this.physics.ownerOf(hit.collider);
    if (owner?.onBulletHit) {
      owner.onBulletHit(def.damage, hit.point, toTarget);
      this.effects.characterHit(hit.point, toTarget);
      this.onHit?.(owner);
    } else {
      const isVehicle = owner?.isVehicle;
      this.effects.impact(hit.point, hit.normal, { decal: !isVehicle, dustColor: isVehicle ? 0x777777 : 0xb8b0a4 });
      this.audio.play('impact', hit.point);
      owner?.onImpact?.(hit.point, toTarget);
    }
  }
}
