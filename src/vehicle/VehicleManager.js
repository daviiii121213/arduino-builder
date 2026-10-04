import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';
import { WheelInstances } from './VehicleModels.js';
import { VEHICLE_TYPES, VEHICLE_TYPE_IDS } from './VehicleDefinitions.js';
import { GameConfig } from '../config.js';

const MAX_VEHICLES = 40;
const _local = new THREE.Vector3();
const _corner = new THREE.Vector3();

/**
 * Owns every vehicle in the world: parked population, simulation stepping,
 * wake-up on contact and cleanup of abandoned cars.
 */
export class VehicleManager {
  constructor({ physics, scene, audio, rng, effects }) {
    this.effects = effects;
    this.physics = physics;
    this.scene = scene;
    this.audio = audio;
    this.rng = rng;
    this.wheels = new WheelInstances(scene, MAX_VEHICLES * 4 + 8);
    this.list = [];
    this.playerVehicle = null;
  }

  add(vehicle) {
    this.list.push(vehicle);
    return vehicle;
  }

  remove(vehicle) {
    vehicle.dispose(this.scene);
    this.list.splice(this.list.indexOf(vehicle), 1);
  }

  /** Parks cars in lot stalls and along curbs, never on lanes or inside buildings. */
  spawnParked(lotSpots, curbSpots, avoid) {
    const spots = [...lotSpots];
    // Shuffle curbside candidates and keep a spread-out subset.
    const curb = curbSpots.slice();
    for (let i = curb.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [curb[i], curb[j]] = [curb[j], curb[i]];
    }
    spots.push(...curb);
    const placed = [];
    for (const s of spots) {
      if (placed.length >= GameConfig.parkedCount) break;
      if (avoid.some((a) => Math.hypot(a.x - s.x, a.z - s.z) < a.r)) continue;
      if (placed.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < 7)) continue;
      const typeId = s.type ?? VEHICLE_TYPE_IDS[Math.floor(this.rng.next() * VEHICLE_TYPE_IDS.length)];
      const def = VEHICLE_TYPES[typeId];
      const color = def.colors[Math.floor(this.rng.next() * def.colors.length)];
      this.add(new Vehicle({
        physics: this.physics, scene: this.scene, audio: this.audio, wheels: this.wheels,
        typeId, color, x: s.x, y: s.y ?? 0, z: s.z, yaw: s.yaw, mode: 'parked',
      }));
      placed.push(s);
    }
  }

  /** Nearest vehicle whose driver door is within reach of `pos`. */
  nearestEnterable(pos, maxDistance = 2.6) {
    let best = null;
    let bestD = maxDistance;
    const door = new THREE.Vector3();
    for (const v of this.list) {
      if (v.driver === 'player' || v.disposed) continue;
      if (Math.abs(pos.y - v.currPos.y) > 1.6) continue;
      v.doorPosition(door);
      let d = Math.hypot(pos.x - door.x, pos.z - door.z);
      // Standing anywhere close along the car also counts.
      if (v.overlapsPoint(pos, 1.0)) d = Math.min(d, 1.5);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  /**
   * Wakes parked/traffic cars the player's car is about to touch, so contacts are
   * resolved with real masses instead of against an immovable kinematic body.
   */
  checkPlayerContacts(onTrafficBumped) {
    const pv = this.playerVehicle;
    if (!pv) return;
    const speed = Math.abs(pv.speed);
    const margin = 0.35 + speed * 0.06;
    for (const v of this.list) {
      if (v === pv || v.mode === 'physics' || v.disposed) continue;
      if (pv.currPos.distanceToSquared(v.currPos) > 64) continue;
      if (!this.footprintsOverlap(pv, v, margin)) continue;
      if (v.mode === 'traffic') onTrafficBumped(v);
      else v.setMode('physics');
    }
  }

  footprintsOverlap(a, b, margin) {
    const test = (p, q) => {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
        _corner.set(sx * p.halfExtents.x, 0.5, sz * p.halfExtents.z).applyMatrix4(p.physicsMatrix);
        q.toLocal(_corner, _local);
        if (Math.abs(_local.x) < q.halfExtents.x + margin && Math.abs(_local.z) < q.halfExtents.z + margin) return true;
      }
      return false;
    };
    return test(a, b) || test(b, a);
  }

  fixedUpdate(dt, playerInput) {
    for (const v of this.list) {
      if (v.mode !== 'physics') continue;
      let input = v === this.playerVehicle ? playerInput : null;
      if (!input && v.coast?.time > 0) {
        v.coast.time -= dt;
        input = { throttle: 0, brake: 0, steer: v.coast.steer, handbrake: false };
      }
      v.fixedUpdate(dt, input);
    }
  }

  postStep() {
    for (const v of this.list) v.postStep();
  }

  /** Removes abandoned cars far from the player when the world holds too many. */
  cleanup(playerPos) {
    if (this.list.length <= GameConfig.parkedCount + GameConfig.trafficCount + 6) return;
    for (const v of this.list) {
      if (v.driver || v === this.playerVehicle || v.persistent) continue;
      if (v.currPos.distanceTo(playerPos) > 90) {
        this.remove(v);
        return;
      }
    }
  }

  render(dt, alpha, night) {
    for (const v of this.list) {
      v.render(dt, alpha, night, v === this.playerVehicle);
      v.damage.update(dt, this.effects);
    }
    this.wheels.commit();
  }
}
