import { GameConfig } from '../config.js';

/**
 * Density by hour: [hour, pedestrians, traffic] keyframes (fractions of the
 * configured maximum), interpolated. Busy morning commute and afternoon,
 * quieter evening, a thin but living city late at night.
 */
const CURVE = [
  [0, 0.3, 0.4],
  [5, 0.25, 0.35],
  [6.5, 0.6, 0.7],
  [8, 1.0, 1.0], // morning: people going to work and school
  [10, 0.85, 0.85],
  [12.5, 1.0, 1.0], // afternoon: busy streets
  [18, 1.0, 1.0],
  [20, 0.7, 0.75], // evening
  [22, 0.45, 0.55], // night
  [24, 0.3, 0.4], // late night
];

export function densityAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < CURVE.length - 1; i++) {
    const [h0, p0, t0] = CURVE[i];
    const [h1, p1, t1] = CURVE[i + 1];
    if (h >= h0 && h <= h1) {
      const k = (h - h0) / (h1 - h0);
      return { pedestrians: p0 + (p1 - p0) * k, traffic: t0 + (t1 - t0) * k };
    }
  }
  return { pedestrians: 1, traffic: 1 };
}

/**
 * Applies the time-of-day density to pedestrians and civilian traffic. Changes
 * happen gradually (one person or car every couple of seconds) and only away
 * from the player, so nobody pops in or out in view.
 */
export class PopulationCycle {
  constructor({ npcs, traffic, dayNight, player }) {
    Object.assign(this, { npcs, traffic, dayNight, player });
    this.timer = 0;
    this.current = densityAt(dayNight.hour);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 2;
    this.current = densityAt(this.dayNight.hour);
    const p = this.player.currPos;
    this.npcs.setDensity(this.current.pedestrians, p);
    this.traffic.target = Math.max(3, Math.round(GameConfig.trafficCount * this.current.traffic));
    this.traffic.thin(p);
  }
}
