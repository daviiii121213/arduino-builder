import * as THREE from 'three';
import { QueryGroups } from '../core/Physics.js';

const ENTER_DISTANCE = 2.6;
const MAX_EXIT_SPEED = 5;
const SEAT = new THREE.Vector3(0.38, -0.2, -0.3);

/** Entering and leaving the car: seat placement, exit-spot validation and camera mode. */
export class VehicleInteraction {
  constructor({ scene, player, car, camera, weapons, physics, audio }) {
    this.scene = scene;
    this.player = player;
    this.car = car;
    this.camera = camera;
    this.weapons = weapons;
    this.physics = physics;
    this.audio = audio;
    this.driving = false;
    this.exitShape = new physics.RAPIER.Capsule(player.halfHeight, player.radius);
  }

  /** Text for the on-screen prompt, or null. */
  prompt() {
    if (this.driving) {
      return Math.abs(this.car.speed) > MAX_EXIT_SPEED ? 'Reduza a velocidade para sair' : '[F] Sair do veículo';
    }
    return this.canEnter() ? '[F] Entrar no veículo' : null;
  }

  canEnter() {
    const p = this.player.position;
    const door = this.car.doorPosition(new THREE.Vector3());
    const center = this.car.position;
    const near = Math.hypot(p.x - door.x, p.z - door.z) < ENTER_DISTANCE || Math.hypot(p.x - center.x, p.z - center.z) < 2.4;
    return near && Math.abs(p.y - center.y) < 1.6;
  }

  toggle() {
    if (this.driving) this.exit();
    else if (this.canEnter()) this.enter();
  }

  enter() {
    this.driving = true;
    this.weapons.holster();
    this.player.setEnabled(false);
    const rig = this.player.rig;
    this.car.model.root.add(rig.root);
    rig.root.position.copy(SEAT);
    rig.root.rotation.set(0, 0, 0);
    this.car.driver = this.player;
    this.camera.setMode('vehicle');
    this.camera.excludeBody = this.car.body;
    this.audio.play('doorOpen', this.car.position);
    setTimeout(() => this.audio.play('doorClose', this.car.position), 350);
    setTimeout(() => this.audio.play('engineStart', this.car.position), 550);
  }

  exit() {
    if (Math.abs(this.car.speed) > MAX_EXIT_SPEED) return;
    const spot = this.findExitSpot();
    if (!spot) return;
    this.driving = false;
    this.car.driver = null;
    const rig = this.player.rig;
    this.scene.add(rig.root);
    this.player.setEnabled(true);
    this.player.teleport(spot.x, spot.y, spot.z);
    this.player.yaw = this.car.yaw;
    this.camera.setMode('onFoot');
    this.camera.excludeBody = undefined;
    this.audio.play('doorClose', this.car.position);
  }

  findExitSpot() {
    const world = this.physics.world;
    const centerOffset = this.player.centerOffset;
    for (const c of this.car.exitCandidates()) {
      // Drop the candidate onto whatever is below it.
      const down = this.physics.raycast({ x: c.x, y: c.y + 1.5, z: c.z }, { x: 0, y: -1, z: 0 }, 6, QueryGroups.solid, this.car.body);
      const feetY = down ? down.point.y + 0.05 : c.y;
      const blocked = world.intersectionWithShape(
        { x: c.x, y: feetY + centerOffset + 0.02, z: c.z }, { x: 0, y: 0, z: 0, w: 1 }, this.exitShape,
        undefined, QueryGroups.solid, undefined, undefined,
      );
      if (!blocked) return new THREE.Vector3(c.x, feetY, c.z);
    }
    return null;
  }
}
