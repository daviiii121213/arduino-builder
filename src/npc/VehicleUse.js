import * as THREE from 'three';
import { QueryGroups } from '../core/Physics.js';

const BOARD_TIME = 0.6;
const ease = (t) => t * t * (3 - 2 * t);
const _seat = new THREE.Vector3();

/**
 * Pedestrians getting into parked cars and drivers getting out of cars they
 * have parked. Short tweens move the character between the door and the seat.
 */
export class VehicleUse {
  constructor({ scene, physics, npcs, traffic, playerPosition }) {
    Object.assign(this, { scene, physics, npcs, traffic, playerPosition });
    this.tweens = [];
    this.exitShape = new physics.RAPIER.Capsule(0.4, 0.25);
  }

  /** Sends a pedestrian to a parked car; they get in and drive away. */
  sendNpcToCar(npc, vehicle) {
    vehicle.reserved = true;
    npc.goTo(vehicle.doorPosition(), () => this.board(npc, vehicle), npc.walkSpeed * 1.2, () => (vehicle.reserved = false));
  }

  board(npc, vehicle) {
    vehicle.reserved = false;
    if (vehicle.driver || vehicle.mode !== 'parked' || vehicle.disposed) return;
    const rig = npc.rig;
    const from = rig.root.position.clone();
    this.npcs.recycle(npc, this.playerPosition());
    this.scene.add(rig.root);
    this.tweens.push({
      t: 0, rig, update: (t) => {
        vehicle.model.root.updateMatrixWorld(true);
        vehicle.seatPosition(_seat).applyMatrix4(vehicle.model.root.matrixWorld);
        rig.root.position.lerpVectors(from, _seat, ease(t));
        rig.root.rotation.y = vehicle.yaw;
        rig.update(1 / 60, t < 0.5 ? { speed: 1.5, grounded: true } : { seated: true });
      },
      done: () => {
        this.scene.remove(rig.root);
        vehicle.model.root.add(rig.root);
        rig.root.position.copy(vehicle.seatPosition(_seat));
        rig.root.rotation.set(0, 0, 0);
        rig.update(0, { seated: true });
        if (!this.traffic.adoptVehicle(vehicle, rig)) {
          // No lane to join (e.g. a lot space): the driver simply gets out again.
          this.driverExits(vehicle, this.traffic.release(vehicle) ?? rig);
        }
      },
    });
  }

  /** Driver leaves a car that has stopped (parked, crashed...) and walks off. */
  driverExits(vehicle, rig, { flee = false, threat = null } = {}) {
    const spot = this.exitSpot(vehicle);
    rig.root.updateMatrixWorld(true);
    const from = rig.root.getWorldPosition(new THREE.Vector3());
    rig.root.removeFromParent();
    this.scene.add(rig.root);
    rig.root.position.copy(from);
    this.tweens.push({
      t: 0, rig, update: (t) => {
        rig.root.position.lerpVectors(from, spot, ease(t));
        rig.root.rotation.y = vehicle.yaw + Math.PI / 2;
        rig.update(1 / 60, t < 0.4 ? { seated: true } : { speed: 1.5, grounded: true });
      },
      done: () => this.npcs.adoptDriver(rig, spot, flee ? threat ?? vehicle.currPos : null, { calm: !flee }),
    });
  }

  exitSpot(vehicle) {
    for (const c of vehicle.exitCandidates()) {
      const blocked = this.physics.world.intersectionWithShape(
        { x: c.x, y: c.y + 0.7, z: c.z }, { x: 0, y: 0, z: 0, w: 1 }, this.exitShape,
        undefined, QueryGroups.solid, undefined, vehicle.body,
      );
      if (!blocked) {
        const down = this.physics.raycast({ x: c.x, y: c.y + 1.5, z: c.z }, { x: 0, y: -1, z: 0 }, 4, QueryGroups.ground);
        return new THREE.Vector3(c.x, down ? down.point.y + 0.03 : c.y, c.z);
      }
    }
    return vehicle.doorPosition();
  }

  update(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t = Math.min(1, tw.t + dt / BOARD_TIME);
      tw.update(tw.t);
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        tw.done();
      }
    }
  }
}
