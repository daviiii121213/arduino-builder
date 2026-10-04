import { CITY } from '../world/CityLayout.js';

/**
 * Occasionally stages small, mission-free street events near the player:
 * fender-benders, jaywalkers, sudden stops, a panicking pedestrian, a gust of
 * wind, someone driving off in a parked car, a car pulling over to park.
 */
export class EventDirector {
  constructor(game) {
    this.game = game;
    this.timer = 25;
    this.pending = [];
    this.rng = game.eventRng;
    this.log = [];
    this.events = {
      accident: () => this.accident(),
      jaywalker: () => this.jaywalker(),
      stall: () => this.stall(),
      panic: () => this.panic(),
      gust: () => this.gust(),
      commute: () => this.commute(),
      park: () => this.parkCar(),
    };
    this.weights = { accident: 1, jaywalker: 2, stall: 1.5, panic: 1, gust: 1.2, commute: 2, park: 2 };
  }

  get playerPos() {
    return this.game.player.currPos;
  }

  later(seconds, fn) {
    this.pending.push({ t: seconds, fn });
  }

  update(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.pending.splice(i, 1);
        p.fn();
      }
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 30 + this.rng.next() * 35;
    // Try weighted picks until one finds suitable actors nearby.
    const names = Object.keys(this.events);
    for (let attempt = 0; attempt < 5; attempt++) {
      const name = this.pickWeighted(names);
      if (this.trigger(name)) return;
    }
  }

  /** Runs an event by name; returns true if it found actors and started. */
  trigger(name) {
    const ok = !!this.events[name]?.();
    if (ok) this.log.push(name);
    return ok;
  }

  pickWeighted(names) {
    const total = names.reduce((s, n) => s + this.weights[n], 0);
    let r = this.rng.next() * total;
    for (const n of names) {
      r -= this.weights[n];
      if (r <= 0) return n;
    }
    return names[0];
  }

  nearDrivers(min, max) {
    const p = this.playerPos;
    return this.game.traffic.drivers.filter((d) => {
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      return dist > min && dist < max && !d.parking && !d.hijacked;
    });
  }

  nearWalkers(max) {
    const p = this.playerPos;
    return this.game.npcs.npcs.filter((n) => n.state === 'walk' && !n.path.indoor && n.currPos.distanceTo(p) < max);
  }

  // ------------------------------------------------------------ events

  /** A traffic car loses grip, spins into the curb; the shaken driver gets out. */
  accident() {
    const d = this.nearDrivers(20, 70).find((x) => x.speed > 6);
    if (!d) return false;
    const v = d.vehicle;
    const rig = this.game.traffic.release(v);
    v.model.root.add(rig.root);
    v.loseControl(2.5, (this.rng.next() < 0.5 ? -1 : 1) * 0.45);
    v.body.setAngvel({ x: 0, y: (this.rng.next() - 0.5) * 2.4, z: 0 }, true);
    this.game.audio.play('carCrash', v.currPos, 0.5);
    this.later(4, () => {
      if (rig.root.parent === v.model.root) this.game.vehicleUse.driverExits(v, rig);
    });
    return true;
  }

  /** A pedestrian dashes across the road away from the crosswalk. */
  jaywalker() {
    const span = 2 * 2 + 2 * CITY.roadHalf;
    for (const npc of this.nearWalkers(35)) {
      const p = npc.currPos;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tx = p.x + dx * span;
        const tz = p.z + dz * span;
        const target = this.nearestPathPoint(tx, tz, 3.5);
        if (!target) continue;
        npc.goTo({ x: tx, z: tz }, (n) => {
          n.path = target.path;
          n.target = target.index;
          n.advanceTarget();
        }, 3.6);
        return true;
      }
    }
    return false;
  }

  /** A car brakes to a halt in its lane with hazard lights for a few seconds. */
  stall() {
    const d = this.nearDrivers(15, 60)[0];
    if (!d) return false;
    d.stall(4 + this.rng.next() * 3);
    return true;
  }

  /** Someone gets spooked and runs off shouting. */
  panic() {
    const npc = this.nearWalkers(30)[0];
    if (!npc) return false;
    const p = npc.currPos;
    npc.onDanger({ x: p.x + (this.rng.next() - 0.5) * 6, z: p.z + (this.rng.next() - 0.5) * 6 }, 50, 6);
    this.game.audio.play('yelp', p);
    return true;
  }

  /** A gust of wind rattles loose props around the player. */
  gust() {
    const p = this.playerPos;
    const props = this.game.physicsProps.all.filter((it) => {
      const t = it.body.translation();
      return Math.hypot(t.x - p.x, t.z - p.z) < 30;
    });
    if (!props.length) return false;
    this.game.physicsProps.gust(p, 30, 5);
    this.game.audio.play('wind', p);
    return true;
  }

  /** A pedestrian walks to a parked car and drives away in it. */
  commute() {
    const p = this.playerPos;
    const cars = this.game.vehicles.list.filter((v) => v.mode === 'parked' && !v.driver && !v.reserved && !v.deadOccupant
      && v.damage.health > 30 && Math.hypot(v.currPos.x - p.x, v.currPos.z - p.z) < 70 && this.game.traffic.laneAt(v.currPos, v.yaw));
    for (const car of cars) {
      const npc = this.game.npcs.npcs.find((n) => n.state === 'walk' && !n.path.indoor && n.currPos.distanceTo(car.currPos) < 30);
      if (npc) {
        this.game.vehicleUse.sendNpcToCar(npc, car);
        return true;
      }
    }
    return false;
  }

  /** A traffic car pulls over into a free curbside spot; the driver gets out. */
  parkCar() {
    const spots = this.game.network.curbsideSpots();
    for (const d of this.nearDrivers(10, 80)) {
      const spot = this.game.traffic.findParkingSpot(d, spots);
      if (!spot) continue;
      d.parkAt(spot, (drv) => {
        const v = drv.vehicle;
        const rig = this.game.traffic.releaseParked(v);
        this.game.vehicleUse.driverExits(v, rig);
      });
      return true;
    }
    return false;
  }

  nearestPathPoint(x, z, maxDistance) {
    let best = null;
    for (const path of this.game.city.npcPaths) {
      if (path.indoor) continue;
      path.points.forEach((q, i) => {
        // Accept any point on the far side's loop segment, not just corners.
        const d = Math.hypot(q.x - x, q.z - z);
        if (d < maxDistance && (!best || d < best.d)) best = { path, index: i, d };
      });
      if (path.loop && path.points.length === 4) {
        for (let i = 0; i < 4; i++) {
          const a = path.points[i];
          const b = path.points[(i + 1) % 4];
          const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2)));
          const px = a.x + (b.x - a.x) * t;
          const pz = a.z + (b.z - a.z) * t;
          const d = Math.hypot(px - x, pz - z);
          if (d < 0.6 && (!best || d < best.d)) best = { path, index: (i + 1) % 4, d };
        }
      }
    }
    return best;
  }
}
