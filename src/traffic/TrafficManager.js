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

  trySpawn(playerPos, minDistance = MIN_SPAWN_DISTANCE) {
    const lane = this.network.lanes[Math.floor(this.rng.next() * this.network.lanes.length)];
    const distance = 4 + this.rng.next() * Math.max(1, lane.length - 8);
    const x = lane.start.x + lane.dir.x * distance;
    const z = lane.start.z + lane.dir.z * distance;
    if (Math.hypot(x - playerPos.x, z - playerPos.z) < minDistance) return false;
    for (const v of this.vehicles.list) if (Math.hypot(v.currPos.x - x, v.currPos.z - z) < 10) return false;

    const typeId = VEHICLE_TYPE_IDS[Math.floor(this.rng.next() * VEHICLE_TYPE_IDS.length)];
    const def = VEHICLE_TYPES[typeId];
    const color = def.colors[Math.floor(this.rng.next() * def.colors.length)];
    const yaw = Math.atan2(lane.dir.x, lane.dir.z);
    const vehicle = this.vehicles.add(new Vehicle({
      physics: this.physics, scene: this.scene, audio: this.audio, wheels: this.vehicles.wheels,
      typeId, color, x, z, yaw, mode: 'traffic',
    }));
    const look = this.randomLook();
    const rig = new CharacterRig(look);
    rig.look = look;
    vehicle.model.root.add(rig.root);
    rig.root.position.copy(vehicle.seatPosition());
    rig.update(0, { seated: true });
    const driver = new TrafficDriver({
      vehicle, network: this.network, rng: () => this.rng.next(), lane, distance, rig,
    });
    vehicle.driver = driver;
    this.drivers.push(driver);
    return true;
  }

  /**
   * Takes the AI driver out of a car (theft, crash). The car becomes a normal
   * physics vehicle; returns the driver's rig so the pedestrian system can adopt it.
   */
  release(vehicle) {
    const driver = vehicle.driver;
    if (!(driver instanceof TrafficDriver)) return null;
    this.drivers.splice(this.drivers.indexOf(driver), 1);
    driver.releaseReservation();
    vehicle.driver = null;
    vehicle.braking = false;
    const lv = { x: Math.sin(driver.yaw) * driver.speed, y: 0, z: Math.cos(driver.yaw) * driver.speed };
    vehicle.setMode('physics');
    vehicle.body.setLinvel(lv, true);
    return driver.rig;
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

  /** Asks a car to stop for a carjacking. */
  hijack(vehicle) {
    if (vehicle.driver instanceof TrafficDriver) vehicle.driver.hijacked = true;
  }

  fixedUpdate(dt, ctx) {
    const full = { ...ctx, vehicles: this.vehicles.list, lights: this.lights, audio: this.audio };
    for (const d of this.drivers) d.update(dt, full);
    this.spawnTimer -= dt;
    if (this.drivers.length < this.target && this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      for (let i = 0; i < 6 && !this.trySpawn(ctx.playerPos); i++);
    }
  }
}
