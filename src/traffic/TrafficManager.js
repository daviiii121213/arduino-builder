import { TrafficDriver } from './TrafficDriver.js';
import { Vehicle } from '../vehicle/Vehicle.js';
import { VEHICLE_TYPES, VEHICLE_TYPE_IDS } from '../vehicle/VehicleDefinitions.js';
import { CharacterRig } from '../characters/CharacterRig.js';
import { GameConfig } from '../config.js';
import { regionAlongRay, damageFor } from '../combat/BodyDamage.js';

const MIN_SPAWN_DISTANCE = 40;

/**
 * Keeps a configurable number of AI-driven cars circulating, spawning
 * replacements out of the player's immediate view when cars leave traffic
 * (stolen, bumped, abandoned).
 */
export class TrafficManager {
  constructor({ physics, scene, audio, network, vehicles, lights, randomLook, rng }) {
    this.physics = physics;
    this.scene = scene;
    this.audio = audio;
    this.network = network;
    this.vehicles = vehicles;
    this.lights = lights;
    this.randomLook = randomLook;
    this.rng = rng;
    this.drivers = [];
    this.target = GameConfig.trafficCount;
    this.spawnTimer = 0;
  }

  get count() {
    return this.drivers.length;
  }

  /** Initial population, spread over the network. */
  populate(playerPos) {
    for (let tries = 0; this.drivers.length < this.target && tries < 200; tries++) this.trySpawn(playerPos, 20);
  }

  /**
   * Creates an AI-driven car on `lane` with a seated driver (and optionally a
   * front passenger). The caller decides which list the driver belongs to.
   */
  createDriven({ typeId, color, lane, distance, look, passengerLook = null, DriverClass = TrafficDriver }) {
    const x = lane.start.x + lane.dir.x * distance;
    const z = lane.start.z + lane.dir.z * distance;
    const vehicle = this.vehicles.add(new Vehicle({
      physics: this.physics, scene: this.scene, audio: this.audio, wheels: this.vehicles.wheels,
      typeId, color, x, z, yaw: Math.atan2(lane.dir.x, lane.dir.z), mode: 'traffic',
    }));
    const seat = (l, passenger) => {
      const rig = new CharacterRig(l);
      rig.look = l;
      vehicle.model.root.add(rig.root);
      rig.root.position.copy(vehicle.seatPosition(undefined, passenger));
      rig.update(0, { seated: true });
      return rig;
    };
    const rig = seat(look, false);
    const driver = new DriverClass({ vehicle, network: this.network, rng: () => this.rng.next(), lane, distance, rig });
    if (passengerLook) driver.passengerRig = seat(passengerLook, true);
    vehicle.driver = driver;
    return driver;
  }

  /** Is a spot on a lane clear of the player and other cars? */
  laneSpotFree(lane, distance, playerPos, minDistance) {
    const x = lane.start.x + lane.dir.x * distance;
    const z = lane.start.z + lane.dir.z * distance;
    if (Math.hypot(x - playerPos.x, z - playerPos.z) < minDistance) return false;
    return !this.vehicles.list.some((v) => Math.hypot(v.currPos.x - x, v.currPos.z - z) < 10);
  }

  trySpawn(playerPos, minDistance = MIN_SPAWN_DISTANCE) {
    const lane = this.network.lanes[Math.floor(this.rng.next() * this.network.lanes.length)];
    if (lane.closed) return false;
    const distance = 4 + this.rng.next() * Math.max(1, lane.length - 8);
    if (!this.laneSpotFree(lane, distance, playerPos, minDistance)) return false;
    const typeId = VEHICLE_TYPE_IDS[Math.floor(this.rng.next() * VEHICLE_TYPE_IDS.length)];
    const def = VEHICLE_TYPES[typeId];
    const color = def.colors[Math.floor(this.rng.next() * def.colors.length)];
    this.drivers.push(this.createDriven({ typeId, color, lane, distance, look: this.randomLook() }));
    return true;
  }

  /**
   * Takes the AI driver out of a car (theft, crash). The car becomes a normal
   * physics vehicle; returns the driver's rig so the pedestrian system can adopt it.
   */
  release(vehicle) {
    const driver = vehicle.driver;
    if (!(driver instanceof TrafficDriver)) return null;
    const i = this.drivers.indexOf(driver);
    if (i >= 0) this.drivers.splice(i, 1);
    driver.onReleased?.();
    driver.releaseReservation();
    vehicle.driver = null;
    vehicle.braking = false;
    const lv = { x: Math.sin(driver.yaw) * driver.speed, y: 0, z: Math.cos(driver.yaw) * driver.speed };
    vehicle.setMode('physics');
    vehicle.body.setLinvel(lv, true);
    vehicle.lastVel.set(lv.x, lv.y, lv.z);
    return driver.rig;
  }

  /** Over the target (quiet hours): one car far from the player leaves the city. */
  thin(playerPos) {
    if (this.drivers.length <= this.target) return;
    const d = this.drivers.find((x) => !x.parking && !x.reserved && Math.hypot(x.x - playerPos.x, x.z - playerPos.z) > 90);
    if (d) this.despawn(d);
  }

  /** Removes a driven car and its occupants from the world (population thinning). */
  despawn(driver) {
    const v = driver.vehicle;
    const i = this.drivers.indexOf(driver);
    if (i >= 0) this.drivers.splice(i, 1);
    driver.releaseReservation();
    driver.rig?.dispose();
    driver.passengerRig?.dispose();
    v.driver = null;
    this.vehicles.remove(v);
  }

  /**
   * Two AI cars touching (a distracted driver, a police car running a light):
   * both drivers lose control, the cars take impact damage and coast to a stop.
   */
  collide(a, b) {
    const da = a.driver;
    const db = b.driver;
    const va = { x: Math.sin(da.yaw) * da.speed, z: Math.cos(da.yaw) * da.speed };
    const vb = { x: Math.sin(db.yaw) * db.speed, z: Math.cos(db.yaw) * db.speed };
    const rel = Math.hypot(va.x - vb.x, va.z - vb.z);
    const rigA = this.release(a);
    const rigB = this.release(b);
    // Momentum shared out roughly by mass.
    const ma = a.def.mass;
    const mb = b.def.mass;
    const cx = (va.x * ma + vb.x * mb) / (ma + mb);
    const cz = (va.z * ma + vb.z * mb) / (ma + mb);
    for (const [car, own] of [[a, va], [b, vb]]) {
      const nv = { x: cx * 0.85 + own.x * 0.15, y: 0, z: cz * 0.85 + own.z * 0.15 };
      car.body.setLinvel(nv, true);
      car.lastVel.set(nv.x, 0, nv.z);
      car.damage.applyImpact(Math.max(4.5, rel * 1.15), { x: own.x - nv.x, y: 0, z: own.z - nv.z });
      car.loseControl(1.2, 0);
      car.hazardOn = true;
      car.persistent = false;
    }
    this.audio.play('carCrash', a.currPos, Math.min(1, 0.4 + rel / 12));
    this.onCollision?.({ cars: [a, b], rigs: [rigA, rigB], speed: rel, pos: a.currPos.clone().lerp(b.currPos, 0.5) });
  }

  /** Touching AI cars (cheap broad phase: only cars within a few metres). */
  checkCollisions() {
    const ds = this.drivers;
    for (let i = 0; i < ds.length; i++) {
      const a = ds[i].vehicle;
      if (ds[i].ghostTime > 0) continue;
      for (let j = i + 1; j < ds.length; j++) {
        const b = ds[j].vehicle;
        if (ds[j].ghostTime > 0) continue;
        const dx = a.currPos.x - b.currPos.x;
        const dz = a.currPos.z - b.currPos.z;
        if (dx * dx + dz * dz > 49) continue;
        if (Math.abs(ds[i].speed - ds[j].speed) < 1 && ds[i].speed < 1) continue;
        if (this.vehicles.footprintsOverlap(a, b, 0.05)) {
          this.collide(a, b);
          return;
        }
      }
    }
  }

  /**
   * A bullet hit a traffic car: if it passed through the driver, apply body-part damage.
   * Returns {target, region} for hit feedback, or null.
   */
  hitOccupant(vehicle, shot) {
    const driver = vehicle.driver;
    if (!(driver instanceof TrafficDriver)) return null;
    const reach = shot.origin.distanceTo(shot.point) + 2.5;
    const hit = regionAlongRay(driver.rig, shot.origin, shot.dir, reach);
    if (!hit) {
      driver.panic();
      return null;
    }
    this.audio.play('hitBody', vehicle.currPos);
    driver.rig.triggerHit(1, hit.region, hit.side);
    const lethal = driver.health.damage(damageFor(shot.damage, hit.region));
    const target = { alive: !lethal };
    if (lethal) this.killDriver(vehicle);
    else {
      this.audio.play('yelp', vehicle.currPos);
      driver.panic();
      if (hit.region === 'arms') driver.armInjury = 12;
    }
    return { target, region: hit.region };
  }

  /** Crash or shot: the driver slumps over and the car coasts out of control. */
  killDriver(vehicle) {
    const rig = this.release(vehicle);
    if (!rig) return;
    rig.slumped = true;
    rig.update(0, { seated: true });
    vehicle.deadOccupant = rig;
    vehicle.loseControl(3 + Math.random() * 2, (Math.random() - 0.5) * 0.5);
  }

  /** Injures the driver of a car involved in a heavy impact. Returns true if they died. */
  injureDriver(vehicle, amount) {
    const driver = vehicle.driver;
    if (!(driver instanceof TrafficDriver)) return false;
    driver.rig.triggerHit(1, 'torso');
    if (driver.health.damage(amount)) {
      this.killDriver(vehicle);
      return true;
    }
    return false;
  }

  /** The lane a car at `pos` heading `yaw` is driving along (or parked beside), with distance along it. */
  laneAt(pos, yaw, maxLateral = 4.2) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    let best = null;
    for (const lane of this.network.lanes) {
      if (lane.dir.x * fx + lane.dir.z * fz < 0.9) continue;
      const dx = pos.x - lane.start.x;
      const dz = pos.z - lane.start.z;
      const s = dx * lane.dir.x + dz * lane.dir.z;
      const lateral = Math.abs(dx * lane.dir.z - dz * lane.dir.x);
      if (s < 0 || s > lane.length - 1.5 || lateral > maxLateral || lane.closed) continue;
      if (!best || lateral < best.lateral) best = { lane, distance: s, lateral };
    }
    return best;
  }

  /** A pedestrian has got into a parked car: it joins traffic from the curb. */
  adoptVehicle(vehicle, rig) {
    const hit = this.laneAt(vehicle.currPos, vehicle.yaw);
    if (!hit) return false;
    vehicle.setMode('traffic');
    const driver = new TrafficDriver({ vehicle, network: this.network, rng: () => this.rng.next(), lane: hit.lane, distance: hit.distance, rig });
    driver.mergeFrom(vehicle.currPos, hit.lane, hit.distance);
    driver.yaw = vehicle.yaw;
    vehicle.driver = driver;
    vehicle.persistent = false;
    this.drivers.push(driver);
    return true;
  }

  /** Free curbside spot ahead of a driver on its current lane, if any. */
  findParkingSpot(driver, spots) {
    const hit = this.laneAt({ x: driver.x, z: driver.z }, driver.yaw, 1.5);
    if (!hit) return null;
    for (const spot of spots) {
      if (spot.lane !== hit.lane) continue;
      const s = (spot.x - hit.lane.start.x) * hit.lane.dir.x + (spot.z - hit.lane.start.z) * hit.lane.dir.z;
      if (s - hit.distance < 14 || s - hit.distance > 45) continue;
      if (this.vehicles.list.some((v) => v !== driver.vehicle && Math.hypot(v.currPos.x - spot.x, v.currPos.z - spot.z) < 5.5)) continue;
      return spot;
    }
    return null;
  }

  /** Takes a car that has just parked out of traffic; returns the driver's rig. */
  releaseParked(vehicle) {
    const driver = vehicle.driver;
    this.drivers.splice(this.drivers.indexOf(driver), 1);
    driver.releaseReservation();
    vehicle.driver = null;
    vehicle.speed = 0;
    vehicle.braking = false;
    vehicle.hazard = false;
    vehicle.setMode('parked');
    vehicle.persistent = false;
    return driver.rig;
  }

  /** Asks a car to stop for a carjacking. */
  hijack(vehicle) {
    if (vehicle.driver instanceof TrafficDriver) vehicle.driver.hijacked = true;
  }

  /** Shared per-step context for AI drivers (police drivers use it too). */
  context(ctx) {
    return { ...ctx, vehicles: this.vehicles.list, lights: this.lights, audio: this.audio };
  }

  fixedUpdate(dt, ctx) {
    const full = this.context(ctx);
    for (const d of this.drivers) d.update(dt, full);
    this.checkCollisions();
    this.spawnTimer -= dt;
    if (this.drivers.length < this.target && this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      for (let i = 0; i < 6 && !this.trySpawn(ctx.playerPos); i++);
    }
  }
}
