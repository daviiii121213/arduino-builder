import { TrafficDriver } from '../traffic/TrafficDriver.js';

/**
 * Traffic driver for police cars. On patrol it behaves like normal traffic;
 * when responding it runs with the siren, ignores signals and picks the turn
 * at each junction that leads toward the target.
 */
export class PoliceDriver extends TrafficDriver {
  constructor(opts) {
    super(opts);
    this.isPolice = true;
    this.targetFn = null;
    this.setPursuit(null);
  }

  setPursuit(targetFn) {
    this.targetFn = targetFn;
    this.searching = false;
    const responding = !!targetFn;
    this.ignoreSignals = responding;
    this.cruise = responding ? 14 : 8.5 + this.rng() * 1.5;
    this.vehicle.sirenOn = responding;
    if (responding) this.releaseReservation();
  }

  /**
   * Drives toward `targetFn()` at normal speed obeying signals: searching an
   * area (lights flashing, siren off) or going to look at an incident.
   */
  setSearch(targetFn, lights = true) {
    this.targetFn = targetFn;
    this.searching = true;
    this.ignoreSignals = false;
    this.cruise = 9 + this.rng() * 1.5;
    this.vehicle.sirenOn = lights;
  }

  get responding() {
    return !!this.targetFn;
  }

  pickNextLane(lane) {
    const target = this.targetFn?.();
    if (!target) return super.pickNextLane(lane);
    const options = this.network.exits(lane);
    let best = options[0];
    let bestScore = Infinity;
    for (const o of options) {
      // Distance from the target to the outgoing lane segment, plus a little noise to avoid loops.
      const ax = o.from.x;
      const az = o.from.z;
      const bx = o.to.x;
      const bz = o.to.z;
      const len2 = (bx - ax) ** 2 + (bz - az) ** 2;
      const t = Math.max(0, Math.min(1, ((target.x - ax) * (bx - ax) + (target.z - az) * (bz - az)) / len2));
      const d = Math.hypot(target.x - (ax + (bx - ax) * t), target.z - (az + (bz - az) * t));
      const score = d + Math.hypot(target.x - bx, target.z - bz) * 0.3 + this.rng() * (this.searching ? 14 : 6);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
  }
}
