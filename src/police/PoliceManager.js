import * as THREE from 'three';
import { PoliceOfficer, POLICE_LOOK } from './PoliceOfficer.js';
import { PoliceDriver } from './PoliceDriver.js';
import { QueryGroups } from '../core/Physics.js';
import { CITY } from '../world/CityLayout.js';
import { GameConfig } from '../config.js';

const DETECT_INTERVAL = 0.25;
const PLAN_INTERVAL = 0.5;
const OFFICER_DAMAGE = 20;
const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const ease = (t) => t * t * (3 - 2 * t);

/**
 * Police presence and response. Patrol cars and foot officers exist at level
 * 0; the wanted level scales how many units respond. Units drive with the
 * existing traffic AI, deploy officers near the suspect, re-mount to chase a
 * driving suspect, set roadblocks at high levels and return to patrol after.
 */
export class PoliceManager {
  constructor(deps) {
    Object.assign(this, deps); // scene, physics, audio, effects, npcs, traffic, vehicles, network, wanted, player, rng, vehicleUse
    this.officers = [];
    this.units = [];
    this.tweens = [];
    this.pendingBoard = [];
    this.detectTimer = 0;
    this.planTimer = 0;
    this.roadblockTimer = 20;
    this.calmTime = 0;
    this.wanted.officers = () => this.officers;
    this.wanted.cars = () => this.units.filter((u) => u.driver && u.vehicle.mode === 'traffic').map((u) => ({ eye: () => ({ x: u.vehicle.currPos.x, y: 1.4, z: u.vehicle.currPos.z }) }));
    this.wanted.onAlert = (pos, radius) => {
      for (const o of this.officers) if (o.currPos.distanceTo(pos) < radius) o.onGunshot(pos);
    };
  }

  // ------------------------------------------------------------ player helpers

  playerPosition() {
    return this.player.position;
  }

  playerAlive() {
    return this.player.alive;
  }

  playerArmed() {
    return this.player.armed;
  }

  /** Where responders head: the suspect if seen just now, otherwise the last known position. */
  target() {
    const w = this.wanted;
    if (w.level === 0) return null;
    if (w.timeSinceSeen < 1.5) return this.player.position;
    return w.lastKnown;
  }

  // ------------------------------------------------------------ spawning

  populate() {
    for (let i = 0; i < GameConfig.patrolCars; i++) this.spawnUnit(false);
    const paths = this.npcs.paths.filter((p) => !p.indoor && p.loop && p.points.length === 4);
    for (let i = 0; i < GameConfig.patrolOfficers; i++) {
      const o = this.makeOfficer(this.rng.pick(paths));
      o.mode = 'patrol';
    }
  }

  makeOfficer(path, rig = null) {
    const o = new PoliceOfficer({
      physics: this.physics, scene: this.scene, audio: this.audio, controller: this.npcs.controller,
      path, rng: this.npcs.rng, police: this,
    });
    if (rig) o.setRig(rig);
    this.officers.push(o);
    return o;
  }

  /** Puts a police car on a lane away from the player (out of sight when responding). */
  spawnUnit(responding) {
    const ref = responding ? this.target() ?? this.player.position : this.player.position;
    for (let tries = 0; tries < 30; tries++) {
      const lane = this.network.lanes[Math.floor(this.rng.next() * this.network.lanes.length)];
      const distance = 4 + this.rng.next() * Math.max(1, lane.length - 8);
      const x = lane.start.x + lane.dir.x * distance;
      const z = lane.start.z + lane.dir.z * distance;
      const d = Math.hypot(x - ref.x, z - ref.z);
      if (responding ? d < 50 || d > 140 : d < 45) continue;
      if (!this.traffic.laneSpotFree(lane, distance, this.player.position, 40)) continue;
      if (responding && this.wanted.lineOfSight({ x, y: 1.4, z }, this.player.position, 60)) continue;
      const driver = this.traffic.createDriven({
        typeId: 'police', color: 0xeeeeea, lane, distance, look: POLICE_LOOK, passengerLook: POLICE_LOOK, DriverClass: PoliceDriver,
      });
      const unit = { vehicle: driver.vehicle, driver, crew: [driver.rig, driver.passengerRig], officers: [], state: 'patrol' };
      driver.vehicle.policeUnit = unit;
      driver.vehicle.persistent = true;
      this.units.push(unit);
      if (responding) this.respond(unit);
      return unit;
    }
    return null;
  }

  respond(unit) {
    if (!unit.driver) return;
    unit.bestDist = Infinity;
    unit.noProgress = 0;
    unit.state = 'respond';
    unit.driver.hijacked = false;
    unit.driver.setPursuit(() => this.target());
  }

  // ------------------------------------------------------------ crew in and out

  /** Officers leave a stopped car and continue on foot. */
  deploy(unit) {
    const v = unit.vehicle;
    unit.driver?.releaseReservation();
    v.driver = null;
    unit.driver = null;
    v.setMode('parked');
    v.sirenOn = true;
    unit.state = 'deployed';
    const spots = v.exitCandidates();
    unit.crew.forEach((rig, i) => {
      if (!rig) return;
      if (this.officers.filter((o) => o.alive).length >= GameConfig.maxPoliceOfficers) return;
      const spot = this.freeSpot(spots, i) ?? v.doorPosition();
      const from = new THREE.Vector3();
      rig.root.updateMatrixWorld(true);
      rig.root.getWorldPosition(from);
      rig.root.removeFromParent();
      this.scene.add(rig.root);
      this.tweens.push({
        t: 0, rig,
        update: (t) => {
          rig.root.position.lerpVectors(from, spot, ease(t));
          rig.update(1 / 60, t < 0.4 ? { seated: true } : { speed: 2, grounded: true });
        },
        done: () => {
          const o = this.makeOfficer({ loop: false, points: [{ x: spot.x, z: spot.z }, { x: spot.x + 1, z: spot.z }] }, rig);
          o.teleport(spot.x, spot.y, spot.z);
          o.car = v;
          o.unit = unit;
          o.mode = 'search';
          unit.officers.push(o);
        },
      });
    });
    unit.crew = [];
    this.audio.play('doorOpen', v.currPos);
  }

  freeSpot(spots, offset) {
    for (let k = 0; k < spots.length; k++) {
      const c = spots[(k + offset) % spots.length];
      const blocked = this.physics.world.intersectionWithShape({ x: c.x, y: c.y + 0.7, z: c.z }, { x: 0, y: 0, z: 0, w: 1 }, this.vehicleUse.exitShape, undefined, QueryGroups.solid);
      if (!blocked) return new THREE.Vector3(c.x, Math.max(0, this.physics.groundHeight(c.x, c.z, 3) + 0.03), c.z);
    }
    return null;
  }

  /** An officer reached their car door; boarding happens after this step's updates. */
  boardCar(officer, car) {
    this.pendingBoard.push([officer, car]);
  }

  /** An officer gets back into their car. */
  doBoard(officer, car) {
    const unit = car.policeUnit;
    if (!unit || car.disposed || unit.driver) {
      officer.wantsDespawn = true;
      return;
    }
    const rig = officer.rig;
    const seatIndex = unit.crew.length;
    this.removeOfficer(officer, false);
    const from = rig.root.position.clone();
    this.tweens.push({
      t: 0, rig,
      update: (t) => {
        car.model.root.updateMatrixWorld(true);
        const seat = car.seatPosition(undefined, seatIndex > 0).applyMatrix4(car.model.root.matrixWorld);
        rig.root.position.lerpVectors(from, seat, ease(t));
        rig.root.rotation.y = car.yaw;
        rig.update(1 / 60, t < 0.5 ? { speed: 1.5, grounded: true } : { seated: true });
      },
      done: () => {
        this.scene.remove(rig.root);
        car.model.root.add(rig.root);
        rig.root.position.copy(car.seatPosition(undefined, seatIndex > 0));
        rig.root.rotation.set(0, 0, 0);
        rig.update(0, { seated: true });
        unit.crew.push(rig);
        // Drive off once everyone still standing is aboard.
        if (!unit.officers.some((o) => this.officers.includes(o) && o.alive)) this.remount(unit);
      },
    });
    this.audio.play('doorClose', car.currPos);
  }

  /** Crew is back in the car: rejoin the road network (pursuit or patrol). */
  remount(unit) {
    const v = unit.vehicle;
    const hit = this.traffic.laneAt(v.currPos, v.yaw, 4.5);
    if (!hit || !unit.crew.length) return;
    v.setMode('traffic');
    const driver = new PoliceDriver({ vehicle: v, network: this.network, rng: () => this.rng.next(), lane: hit.lane, distance: hit.distance, rig: unit.crew[0] });
    driver.passengerRig = unit.crew[1] ?? null;
    driver.mergeFrom(v.currPos, hit.lane, hit.distance);
    driver.yaw = v.yaw;
    v.driver = driver;
    unit.driver = driver;
    unit.officers = [];
    if (this.wanted.level > 0) this.respond(unit);
    else unit.state = 'patrol';
  }

  removeOfficer(o, dispose = true) {
    const i = this.officers.indexOf(o);
    if (i >= 0) this.officers.splice(i, 1);
    this.physics.owners.delete(o.collider.handle);
    this.physics.world.removeRigidBody(o.body);
    if (dispose) {
      this.scene.remove(o.rig.root);
      o.rig.dispose();
    }
  }

  removeUnit(unit) {
    for (const rig of unit.crew) rig?.dispose();
    if (unit.driver) {
      unit.driver.releaseReservation();
      unit.vehicle.driver = null;
    }
    this.vehicles.remove(unit.vehicle);
    this.units.splice(this.units.indexOf(unit), 1);
  }

  /** A police car the player has taken: the crew gets out as officers, angry. */
  onPoliceCarTaken(vehicle) {
    const unit = vehicle.policeUnit;
    if (!unit) return;
    if (unit.driver) this.deploy(unit);
    vehicle.policeUnit = null;
    this.units.splice(this.units.indexOf(unit), 1);
    for (const o of unit.officers) o.car = null;
  }

  // ------------------------------------------------------------ combat helpers

  /** Officer shoots at the player with deliberate inaccuracy. */
  officerFire(o) {
    const p = this.player.position;
    o.weapon.muzzle.getWorldPosition(_from);
    const aim = new THREE.Vector3(p.x, p.y + 0.85, p.z);
    const dist = _from.distanceTo(aim);
    _dir.subVectors(aim, _from).normalize();
    const moving = Math.min(1, this.player.speed / 5);
    const error = (0.03 + dist * 0.0022) * o.aimPenalty * (1 + moving) / (this.wanted.level >= 5 ? 1.3 : 1);
    _dir.x += (Math.random() - 0.5) * 2 * error;
    _dir.y += (Math.random() - 0.5) * 2 * error;
    _dir.z += (Math.random() - 0.5) * 2 * error;
    _dir.normalize();
    o.weapon.object.getWorldQuaternion(_q);
    this.effects.otherFlash(_from, new THREE.Vector3(0, 0, 1).applyQuaternion(_q));
    this.audio.play('pistolShot', _from, 0.8);
    this.npcs.onGunshot(_from);
    const hit = this.physics.raycast(_from, _dir, 90, QueryGroups.npcBullets, o.body);
    const end = hit ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z) : _from.clone().addScaledVector(_dir, 90);
    this.effects.tracer(_from, end);
    if (!hit) return;
    const owner = this.physics.ownerOf(hit.collider);
    if (owner?.onBulletHit) {
      owner.onBulletHit(OFFICER_DAMAGE, hit.point, _dir);
      this.effects.characterHit(hit.point, _dir);
    } else {
      this.effects.impact(hit.point, hit.normal, { decal: !owner?.isVehicle && !owner?.isProp });
      owner?.onImpulse?.(hit.point, _dir, 1);
      if (owner?.isVehicle) {
        owner.damage.applyBullet(hit.point);
        // Rounds through the glass can reach a driving suspect.
        if (owner === this.player.vehicle && Math.random() < 0.3) this.player.hurt(6);
      }
    }
  }

  /**
   * A position for an officer in a firefight: around their slot of a ring
   * surrounding the suspect, alternating between cover (no line of sight) and
   * a firing position (clear line of sight).
   */
  findCover(o, preferred) {
    const p = this.player.position;
    const fighters = this.officers.filter((x) => x.mode === 'combat' && x.alive);
    const slot = Math.max(0, fighters.indexOf(o));
    const base = Math.atan2(o.currPos.x - p.x, o.currPos.z - p.z);
    const angle = base + (slot - (fighters.length - 1) / 2) * (this.wanted.level >= 3 ? 0.9 : 0.5);
    const cx = p.x + Math.sin(angle) * preferred;
    const cz = p.z + Math.cos(angle) * preferred;
    o.peek = !o.peek;
    const wantCover = !o.peek || o.health.value < o.health.max * 0.35;
    let fallback = null;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.random() * 0.4;
      const r = 1.5 + Math.random() * 4;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const y = this.physics.groundHeight(x, z, 4);
      const free = !this.physics.world.intersectionWithShape({ x, y: y + 0.7, z }, { x: 0, y: 0, z: 0, w: 1 }, this.vehicleUse.exitShape, undefined, QueryGroups.solid);
      if (!free) continue;
      const sees = this.wanted.lineOfSight({ x, y: y + 1.1, z }, p, 60);
      if (sees !== wantCover) return { x, z };
      fallback ??= { x, z };
    }
    return fallback;
  }

  tryArrest() {
    const w = this.wanted;
    if (w.level > 2 || w.hostileTimer > 0 || this.player.vehicle || this.player.speed > 2.5 || !this.player.alive) return;
    this.onArrest?.();
  }

  /** Field of view for spotting: alert officers see all around. */
  facingCheck = (o, pos) => {
    if (o.mode !== 'patrol' && o.mode !== 'return') return true;
    const dx = pos.x - o.currPos.x;
    const dz = pos.z - o.currPos.z;
    if (dx * dx + dz * dz < 36) return true;
    const a = Math.atan2(dx, dz) - o.yaw;
    return Math.cos(a) > 0.3;
  };

  // ------------------------------------------------------------ update

  fixedUpdate(dt, trafficCtx) {
    const ctx = this.traffic.context(trafficCtx);
    for (const u of this.units) if (u.driver) u.driver.update(dt, ctx);
    for (const o of this.officers) o.fixedUpdate(dt);
    // Bodies are only removed outside the officer update loop.
    for (const [o, car] of this.pendingBoard.splice(0)) if (this.officers.includes(o)) this.doBoard(o, car);

    this.detectTimer -= dt;
    if (this.detectTimer <= 0) {
      this.detectTimer = DETECT_INTERVAL;
      this.wanted.detect(this.player, this.facingCheck);
    }
    this.planTimer -= dt;
    if (this.planTimer <= 0) {
      this.planTimer = PLAN_INTERVAL;
      this.plan(PLAN_INTERVAL);
    }
  }

  plan(dt) {
    const w = this.wanted;
    const target = this.target();
    // Size of the response.
    const desiredCars = w.level === 0 ? GameConfig.patrolCars : Math.min(GameConfig.maxPoliceCars, w.level + 1);
    if (w.level > 0) {
      this.calmTime = 0;
      for (const u of this.units) if (u.state === 'patrol' && u.driver) this.respond(u);
      if (this.units.length < desiredCars && target) this.spawnUnit(true);
    } else this.calmTime += dt;

    for (const u of [...this.units]) {
      const v = u.vehicle;
      if (v.disposed) continue;
      if (u.state === 'respond' && u.driver && target) {
        const d = Math.hypot(target.x - v.currPos.x, target.z - v.currPos.z);
        const suspectDriving = !!this.player.vehicle && Math.abs(this.player.vehicle.speed) > 3;
        // Pull up when close, or when the road gets no closer (suspect in a park, a yard...).
        if (d < (u.bestDist ?? Infinity) - 2) {
          u.bestDist = d;
          u.noProgress = 0;
        } else u.noProgress = (u.noProgress ?? 0) + dt;
        const stuckNear = d < 45 && u.noProgress > 4;
        if ((d < 22 || stuckNear) && !suspectDriving) u.driver.hijacked = true; // pull up
        if (u.driver.hijacked && Math.abs(v.speed) < 0.6) this.deploy(u);
      }
      // Deployed crews get back in when the suspect drives off, or when it is over.
      if (u.state === 'deployed' && u.officers.length) {
        const away = this.player.vehicle && v.currPos.distanceTo(this.player.position) > 45;
        if (away || w.level === 0) for (const o of u.officers) if (o.alive && this.officers.includes(o)) o.mode = 'return';
      }
      // Leftover cars far from the action are cleared once things are calm.
      if (w.level === 0 && this.calmTime > 15 && this.units.length > GameConfig.patrolCars) {
        const far = v.currPos.distanceTo(this.player.position) > 90;
        if (far && (u.driver || u.officers.every((o) => !this.officers.includes(o)))) this.removeUnit(u);
      }
    }
    if (w.level === 0 && this.calmTime > 2) {
      for (const u of this.units) if (u.state === 'respond' && u.driver) {
        u.driver.setPursuit(null);
        u.driver.hijacked = false;
        u.state = 'patrol';
      }
    }

    // Officers: remove the fallen and those who walked off after the incident.
    for (const o of [...this.officers]) {
      if (o.removeMe) this.removeOfficer(o);
      else if (o.wantsDespawn && o.currPos.distanceTo(this.player.position) > 60 && !w.lineOfSight(o.eye(), this.player.position, 80)) this.removeOfficer(o);
    }
    // Keep a couple of officers walking the beat when things are quiet.
    if (w.level === 0 && this.calmTime > 20 && this.officers.filter((o) => o.mode === 'patrol').length < GameConfig.patrolOfficers) {
      const paths = this.npcs.paths.filter((p) => !p.indoor && p.loop && p.points.length === 4);
      const path = this.rng.pick(paths);
      if (path.points.every((q) => Math.hypot(q.x - this.player.position.x, q.z - this.player.position.z) > 40)) this.makeOfficer(path).mode = 'patrol';
    }

    this.roadblockTimer -= dt;
    if (w.level >= 4 && this.roadblockTimer <= 0 && this.player.vehicle && Math.abs(this.player.vehicle.speed) > 8) {
      this.roadblockTimer = 30;
      this.roadblock();
    }
  }

  /** Parks a car across the road at the next junction ahead of a fleeing driver. */
  roadblock() {
    const pv = this.player.vehicle;
    const p = pv.currPos;
    const fx = Math.sin(pv.yaw);
    const fz = Math.cos(pv.yaw);
    let best = null;
    for (const n of this.network.nodes) {
      const dx = n.x - p.x;
      const dz = n.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 45 || d > 110 || (dx * fx + dz * fz) / d < 0.75) continue;
      if (!best || d < best.d) best = { n, d };
    }
    if (!best || this.units.length >= GameConfig.maxPoliceCars + 1) return;
    const out = best.n.out.find((l) => l.dir.x * fx + l.dir.z * fz > 0.7) ?? best.n.out[0];
    const off = CITY.roadHalf + 6;
    const x = best.n.x + out.dir.x * off;
    const z = best.n.z + out.dir.z * off;
    if (this.vehicles.list.some((v) => Math.hypot(v.currPos.x - x, v.currPos.z - z) < 6)) return;
    const lane = out;
    const driver = this.traffic.createDriven({ typeId: 'police', color: 0xeeeeea, lane, distance: 2, look: POLICE_LOOK, passengerLook: POLICE_LOOK, DriverClass: PoliceDriver });
    const v = driver.vehicle;
    // Turn it across the carriageway.
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(out.dir.x, out.dir.z) + Math.PI / 2);
    v.body.setTranslation({ x, y: 0, z }, true);
    v.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
    v.syncState(true);
    const unit = { vehicle: v, driver, crew: [driver.rig, driver.passengerRig], officers: [], state: 'respond' };
    v.policeUnit = unit;
    this.units.push(unit);
    this.deploy(unit);
  }

  render(dt, alpha, cameraPos) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t = Math.min(1, tw.t + dt / 0.6);
      tw.update(tw.t);
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        tw.done();
      }
    }
    for (const o of this.officers) o.render(dt, alpha, o.currPos.distanceTo(cameraPos) > 55);
    // Siren sound follows the nearest responding car.
    let near = 0;
    for (const u of this.units) {
      if (!u.vehicle.sirenOn || u.state !== 'respond') continue;
      near = Math.max(near, 1 - u.vehicle.currPos.distanceTo(cameraPos) / 120);
    }
    this.audio.setSiren(Math.max(0, near));
  }

  /** Positions of cars running their siren (traffic yields to them). */
  sirens() {
    return this.units.filter((u) => u.vehicle.sirenOn && u.state === 'respond').map((u) => u.vehicle.currPos);
  }

  /** Obstacles for traffic: officers standing in the road. */
  obstacles(out) {
    for (const o of this.officers) if (o.alive) out.push({ x: o.currPos.x, z: o.currPos.z, r: o.radius });
    return out;
  }

  /** Clears the whole response (after an arrest or defeat). */
  standDown() {
    for (const u of [...this.units]) if (u.state !== 'patrol' || !u.driver) this.removeUnit(u);
    for (const o of [...this.officers]) if (o.mode !== 'patrol') this.removeOfficer(o);
    this.tweens.length = 0;
  }
}
