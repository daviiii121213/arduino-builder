import * as THREE from 'three';
import { CITY } from '../world/CityLayout.js';

const R = CITY.roadCenters;
const HALF = CITY.roadHalf;
/** Distance from an intersection centre to where lanes start/stop (past the crosswalk). */
const LANE_INSET = HALF + 4.2;

/** Right-hand vector for a heading direction (x, z). */
export const rightOf = (dx, dz) => ({ x: -dz, z: dx });

/**
 * Directed lane graph of the street grid. Nodes are intersections; every road
 * segment has one lane per direction, offset to the right of the centre line.
 */
export class RoadNetwork {
  constructor() {
    this.nodes = [];
    for (let i = 0; i < R.length; i++) {
      for (let j = 0; j < R.length; j++) {
        const signalized = Math.abs(R[i]) < 50 && Math.abs(R[j]) < 50;
        this.nodes.push({ id: this.nodes.length, i, j, x: R[i], z: R[j], signalized, out: [] });
      }
    }
    this.lanes = [];
    const node = (i, j) => this.nodes[i * R.length + j];
    for (const a of this.nodes) {
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const b = node(a.i + di, a.j + dj);
        if (!b || a.i + di < 0 || a.i + di >= R.length || a.j + dj < 0 || a.j + dj >= R.length) continue;
        const dir = { x: Math.sign(b.x - a.x), z: Math.sign(b.z - a.z) };
        const r = rightOf(dir.x, dir.z);
        const o = CITY.laneOffset;
        const lane = {
          id: this.lanes.length,
          from: a,
          to: b,
          dir,
          axis: dir.x !== 0 ? 'x' : 'z',
          start: new THREE.Vector3(a.x + dir.x * LANE_INSET + r.x * o, 0, a.z + dir.z * LANE_INSET + r.z * o),
          end: new THREE.Vector3(b.x - dir.x * LANE_INSET + r.x * o, 0, b.z - dir.z * LANE_INSET + r.z * o),
        };
        lane.length = lane.start.distanceTo(lane.end);
        a.out.push(lane);
        this.lanes.push(lane);
      }
    }
  }

  /** Lanes leaving `lane.to`, excluding a U-turn unless it is the only way out. */
  exits(lane) {
    const options = lane.to.out.filter((l) => l.to !== lane.from);
    return options.length ? options : lane.to.out;
  }

  /** Picks the next lane: straight is preferred, turns are common. */
  chooseNext(lane, rng) {
    const options = this.exits(lane);
    const weighted = options.map((l) => ({ l, w: l.dir.x === lane.dir.x && l.dir.z === lane.dir.z ? 2 : 1 }));
    let total = weighted.reduce((s, o) => s + o.w, 0) * rng();
    for (const o of weighted) {
      total -= o.w;
      if (total <= 0) return o.l;
    }
    return options[0];
  }

  /** Points of the curve through the intersection from the end of `a` to the start of `b`. */
  turnPoints(a, b, samples = 8) {
    const p0 = a.end;
    const p2 = b.start;
    const straight = a.dir.x === b.dir.x && a.dir.z === b.dir.z;
    let p1;
    if (straight) p1 = p0.clone().lerp(p2, 0.5);
    else {
      // Corner where the incoming lane line meets the outgoing lane line.
      const t = (p2.x - p0.x) * a.dir.x + (p2.z - p0.z) * a.dir.z;
      p1 = new THREE.Vector3(p0.x + a.dir.x * t, 0, p0.z + a.dir.z * t);
    }
    const pts = [];
    for (let k = 1; k < samples; k++) {
      const t = k / samples;
      const u = 1 - t;
      pts.push(new THREE.Vector3(
        u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        0,
        u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
      ));
    }
    return pts;
  }

  /** Curbside parking spots (heading follows the adjacent lane), away from intersections. */
  curbsideSpots(spacing = 6.5, clearance = 16) {
    const spots = [];
    for (const lane of this.lanes) {
      const r = rightOf(lane.dir.x, lane.dir.z);
      const len = Math.hypot(lane.to.x - lane.from.x, lane.to.z - lane.from.z);
      for (let s = clearance; s <= len - clearance; s += spacing) {
        spots.push({
          x: lane.from.x + lane.dir.x * s + r.x * CITY.parkingOffset,
          z: lane.from.z + lane.dir.z * s + r.z * CITY.parkingOffset,
          yaw: Math.atan2(lane.dir.x, lane.dir.z),
          lane,
        });
      }
    }
    return spots;
  }
}
