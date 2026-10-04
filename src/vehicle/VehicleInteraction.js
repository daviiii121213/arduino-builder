import * as THREE from 'three';
import { QueryGroups } from '../core/Physics.js';
import { TrafficDriver } from '../traffic/TrafficDriver.js';

const MAX_EXIT_SPEED = 5;
const ENTER_TIME = 0.55;
const EXIT_TIME = 0.45;
const EJECT_TIME = 0.6;
const HIJACK_TIMEOUT = 4;

const _seat = new THREE.Vector3();
const _door = new THREE.Vector3();
const ease = (t) => t * t * (3 - 2 * t);

/**
 * Entering, leaving and stealing vehicles. A small state machine moves the
 * player (and an evicted AI driver) between the street and the driver seat,
 * transferring control and camera at the right moments.
 */
export class VehicleInteraction {
  constructor({ scene, player, vehicles, traffic, npcs, camera, weapons, physics, audio }) {
    Object.assign(this, { scene, player, vehicles, traffic, npcs, camera, weapons, physics, audio });
    this.state = 'onFoot'; // onFoot | approaching | ejecting | entering | driving | exiting
    this.vehicle = null;
    this.timer = 0;
    this.exitShape = new physics.RAPIER.Capsule(player.halfHeight, player.radius);
    this.message = null;
    this.messageTimer = 0;
  }

  get driving() {
    return this.state === 'driving';
  }

  /** Player has no on-foot control (in a car or mid-transition). */
  get busy() {
    return this.state !== 'onFoot';
  }

  /** Contextual prompt (Brazilian Portuguese) or null. */
  prompt() {
    if (this.messageTimer > 0) return this.message;
    if (this.state === 'driving') {
      const st = this.vehicle.damage.state;
      if (st === 'burning') return 'O veículo está pegando fogo! Pressione F para sair';
      if (st !== 'ok') return 'Veículo inutilizado. Pressione F para sair';
      return Math.abs(this.vehicle.speed) > MAX_EXIT_SPEED ? null : 'Pressione F para sair do veículo';
    }
    if (this.state !== 'onFoot') return null;
    const v = this.vehicles.nearestEnterable(this.player.position);
    if (!v) return null;
    return v.driver instanceof TrafficDriver ? 'Pressione F para roubar o veículo' : 'Pressione F para entrar no veículo';
  }

  flash(text) {
    this.message = text;
    this.messageTimer = 1.6;
  }

  toggle() {
    if (this.state === 'driving') this.beginExit();
    else if (this.state === 'onFoot') {
      const v = this.vehicles.nearestEnterable(this.player.position);
      if (v) this.beginEnter(v);
    }
  }

  // ------------------------------------------------------------ enter

  beginEnter(vehicle) {
    this.onEnter?.(vehicle);
    this.vehicle = vehicle;
    this.weapons.holster();
    this.player.setEnabled(false);
    this.startPos = this.player.position.clone();
    this.startYaw = this.player.yaw;
    this.timer = 0;
    vehicle.persistent = false;
    this.camera.excludeBody = vehicle.body;
    if (vehicle.driver instanceof TrafficDriver) {
      // Carjacking: the car stops, then the driver is pulled out.
      this.traffic.hijack(vehicle);
      this.state = 'approaching';
      this.audio.play('yelp', vehicle.currPos);
      this.npcs.onTheft(vehicle.currPos);
    } else if (vehicle.deadOccupant) {
      // An incapacitated driver is moved out of the seat first.
      this.ejectDriver();
    } else {
      this.startEnterAnimation();
    }
  }

  startEnterAnimation() {
    const v = this.vehicle;
    if (v.mode !== 'physics') v.setMode('physics');
    this.state = 'entering';
    this.timer = 0;
    this.startPos = this.player.rig.root.position.clone();
    this.camera.setMode('vehicle');
    this.camera.excludeBody = v.body;
    this.audio.play('doorOpen', v.currPos);
  }

  ejectDriver() {
    const v = this.vehicle;
    const dead = !!v.deadOccupant && !(v.driver instanceof TrafficDriver);
    const rig = dead ? v.deadOccupant : this.traffic.release(v);
    v.deadOccupant = null;
    this.state = 'ejecting';
    this.timer = 0;
    if (!rig) return;
    this.ejected = { dead, rig, from: new THREE.Vector3(), to: this.findExitSpot(v, true) ?? v.doorPosition(new THREE.Vector3()) };
    rig.root.updateMatrixWorld(true);
    rig.root.getWorldPosition(this.ejected.from);
    v.model.root.remove(rig.root);
    this.scene.add(rig.root);
    rig.root.position.copy(this.ejected.from);
    rig.root.rotation.set(0, v.yaw + Math.PI / 2, 0);
    this.audio.play('doorOpen', v.currPos);
  }

  // ------------------------------------------------------------ exit

  beginExit() {
    const v = this.vehicle;
    if (Math.abs(v.speed) > MAX_EXIT_SPEED) return;
    const spot = this.findExitSpot(v);
    if (!spot) {
      this.flash('Sem espaço para sair aqui');
      return;
    }
    this.exitSpot = spot;
    this.state = 'exiting';
    this.timer = 0;
    v.driver = null;
    this.vehicles.playerVehicle = null;
    const rig = this.player.rig;
    rig.root.updateMatrixWorld(true);
    this.startPos = rig.root.getWorldPosition(new THREE.Vector3());
    v.model.root.remove(rig.root);
    this.scene.add(rig.root);
    rig.root.position.copy(this.startPos);
    this.audio.play('doorOpen', v.currPos);
    this.audio.setEngine(false);
  }

  /** First free spot beside the car (walls, cars and people are checked). */
  findExitSpot(v, farSide = false) {
    const world = this.physics.world;
    const candidates = v.exitCandidates();
    if (farSide) candidates.push(candidates.shift());
    for (const c of candidates) {
      const down = this.physics.raycast({ x: c.x, y: c.y + 1.5, z: c.z }, { x: 0, y: -1, z: 0 }, 4, QueryGroups.ground);
      const feetY = down ? down.point.y + 0.03 : c.y;
      const blocked = world.intersectionWithShape(
        { x: c.x, y: feetY + this.player.centerOffset + 0.03, z: c.z }, { x: 0, y: 0, z: 0, w: 1 }, this.exitShape,
        undefined, QueryGroups.solid, undefined, v.body,
      );
      if (!blocked) return new THREE.Vector3(c.x, feetY, c.z);
    }
    return null;
  }

  // ------------------------------------------------------------ per-frame

  update(dt) {
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    const v = this.vehicle;
    const rig = this.player.rig;
    switch (this.state) {
      case 'approaching': {
        // Walk alongside the door while the car brakes to a stop.
        this.timer += dt;
        v.doorPosition(_door);
        rig.root.position.lerp(_door, Math.min(1, dt * 8));
        rig.root.rotation.y = v.yaw - Math.PI / 2;
        rig.update(dt, { speed: 2.5, grounded: true });
        if (Math.abs(v.speed) < 0.6 || this.timer > HIJACK_TIMEOUT) this.ejectDriver();
        break;
      }
      case 'ejecting': {
        this.timer += dt;
        const t = Math.min(1, this.timer / EJECT_TIME);
        if (this.ejected) {
          const r = this.ejected.rig;
          r.root.position.lerpVectors(this.ejected.from, this.ejected.to, ease(t));
          r.update(dt, this.ejected.dead ? { seated: true } : { speed: 2, grounded: true });
        }
        rig.update(dt, { speed: 0, grounded: true });
        if (t >= 1) {
          if (this.ejected) {
            this.npcs.adoptDriver(this.ejected.rig, this.ejected.to, this.player.position, { dead: this.ejected.dead });
            this.ejected = null;
          }
          this.startEnterAnimation();
        }
        break;
      }
      case 'entering': {
        this.timer += dt;
        const t = Math.min(1, this.timer / ENTER_TIME);
        v.model.root.updateMatrixWorld(true);
        v.seatPosition(_seat).applyMatrix4(v.model.root.matrixWorld);
        v.doorPosition(_door);
        // First step to the door, then slide into the seat.
        if (t < 0.45) rig.root.position.lerpVectors(this.startPos, _door, ease(t / 0.45));
        else rig.root.position.lerpVectors(_door, _seat, ease((t - 0.45) / 0.55));
        rig.root.rotation.y = v.yaw;
        rig.update(dt, t < 0.45 ? { speed: 2.4, grounded: true } : { seated: true });
        if (t >= 1) this.finishEnter();
        break;
      }
      case 'exiting': {
        this.timer += dt;
        const t = Math.min(1, this.timer / EXIT_TIME);
        rig.root.position.lerpVectors(this.startPos, this.exitSpot, ease(t));
        rig.root.rotation.y = v.yaw;
        rig.update(dt, t < 0.4 ? { seated: true } : { speed: 2, grounded: true });
        if (t >= 1) this.finishExit();
        break;
      }
      case 'driving':
        rig.update(dt, { seated: true });
        break;
      default:
    }
  }

  finishEnter() {
    const v = this.vehicle;
    const rig = this.player.rig;
    this.scene.remove(rig.root);
    v.model.root.add(rig.root);
    rig.root.position.copy(v.seatPosition(_seat));
    rig.root.rotation.set(0, 0, 0);
    v.driver = 'player';
    this.vehicles.playerVehicle = v;
    this.state = 'driving';
    this.audio.play('doorClose', v.currPos);
    setTimeout(() => this.audio.play('engineStart', v.currPos), 250);
  }

  finishExit() {
    const v = this.vehicle;
    const spot = this.exitSpot;
    this.player.setEnabled(true);
    this.player.teleport(spot.x, spot.y, spot.z);
    this.player.yaw = v.yaw;
    this.camera.setMode('onFoot');
    this.camera.excludeBody = undefined;
    this.state = 'onFoot';
    this.vehicle = null;
    this.audio.play('doorClose', v.currPos);
  }

  /** Immediately puts a driving player back on foot next to the car (defeat, arrest). */
  forceExit() {
    const v = this.vehicle;
    if (!v) return;
    const rig = this.player.rig;
    rig.root.removeFromParent();
    this.scene.add(rig.root);
    v.driver = null;
    this.vehicles.playerVehicle = null;
    this.exitSpot = this.findExitSpot(v) ?? v.doorPosition(new THREE.Vector3());
    this.audio.setEngine(false);
    this.finishExit();
  }

  /** Focus point for the camera. */
  focus() {
    if (this.state === 'driving' || this.state === 'entering') return this.vehicle.position;
    if (this.state === 'onFoot') return this.player.position;
    return this.player.rig.root.position;
  }
}
