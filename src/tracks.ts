import { closedSpline, segmentDistance, clamp, wrapAngle, type Vec } from './math';
import { rng } from './pixel';
import { DECOR_RADIUS, type DecorKind } from './decor';

export type Surface = 'asphalt' | 'dirt';

export interface DecorItem {
  kind: DecorKind;
  pos: Vec;
  radius: number;
  /** Drawing order jitter so props don't look stamped on a grid. */
  flip: boolean;
}

export interface TrackDef {
  id: string;
  name: string;
  surface: Surface;
  worldW: number;
  worldH: number;
  halfWidth: number;
  /** Multiplies car lateral grip: dirt is looser and slides more. */
  gripScale: number;
  /** Multiplies top speed on the racing surface. */
  speedScale: number;
  control: Vec[];
  decorSeed: number;
  /** Props scattered on the grass, by kind, with relative weights. */
  decorKinds: Array<{ kind: DecorKind; weight: number }>;
  /** Props lining the track edge in corners. */
  edgeKind: DecorKind;
}

const ASPHALT: TrackDef = {
  id: 'asphalt',
  name: 'ASPHALT CIRCUIT',
  surface: 'asphalt',
  worldW: 2800,
  worldH: 2000,
  halfWidth: 72,
  gripScale: 1,
  speedScale: 1,
  decorSeed: 20260831,
  decorKinds: [
    { kind: 'tree', weight: 4 },
    { kind: 'pine', weight: 3 },
    { kind: 'bush', weight: 3 },
    { kind: 'rock', weight: 1 },
  ],
  edgeKind: 'tyres',
  control: [
    { x: 520, y: 1560 },
    { x: 360, y: 1120 },
    { x: 470, y: 660 },
    { x: 880, y: 390 },
    { x: 1330, y: 345 },
    { x: 1680, y: 500 },
    { x: 1790, y: 815 },
    { x: 2090, y: 915 },
    { x: 2340, y: 660 },
    { x: 2490, y: 930 },
    { x: 2380, y: 1380 },
    { x: 2030, y: 1630 },
    { x: 1520, y: 1690 },
    { x: 1010, y: 1720 },
  ],
};

const DIRT: TrackDef = {
  id: 'dirt',
  name: 'DIRT CIRCUIT',
  surface: 'dirt',
  worldW: 2400,
  worldH: 2200,
  halfWidth: 62,
  gripScale: 0.68,
  speedScale: 0.94,
  decorSeed: 771003,
  decorKinds: [
    { kind: 'pine', weight: 4 },
    { kind: 'rock', weight: 4 },
    { kind: 'bush', weight: 2 },
    { kind: 'tree', weight: 2 },
  ],
  edgeKind: 'hay',
  control: [
    { x: 420, y: 1830 },
    { x: 290, y: 1330 },
    { x: 560, y: 1010 },
    { x: 940, y: 1090 },
    { x: 1140, y: 810 },
    { x: 920, y: 470 },
    { x: 1230, y: 270 },
    { x: 1690, y: 300 },
    { x: 1990, y: 610 },
    { x: 1800, y: 990 },
    { x: 2030, y: 1360 },
    { x: 1960, y: 1790 },
    { x: 1470, y: 1950 },
    { x: 930, y: 1980 },
  ],
};

export const TRACK_DEFS: TrackDef[] = [ASPHALT, DIRT];

export interface NearestInfo {
  /** Index of the waypoint starting the closest segment. */
  index: number;
  /** Distance from the centre line. */
  dist: number;
  /** Distance travelled along the lap at the closest point. */
  along: number;
  /** Signed side offset: negative = left of travel direction. */
  side: number;
}

export class Track {
  readonly def: TrackDef;
  readonly waypoints: Vec[];
  readonly headings: number[];
  readonly cumLen: number[];
  readonly totalLen: number;
  /** Corner radius at each waypoint, in world pixels (huge on straights). */
  readonly radii: number[];
  readonly decor: DecorItem[];
  /** Solid props bucketed into a coarse grid for cheap collision lookups. */
  private solidGrid = new Map<string, DecorItem[]>();
  private static readonly CELL = 64;

  constructor(def: TrackDef) {
    this.def = def;
    // Rotate the loop so waypoint 0 (the start/finish line) sits on the
    // longest straight, which gives the starting grid clean room behind it.
    const raw = closedSpline(def.control, 14);
    const startAt = pickStartIndex(raw);
    this.waypoints = [...raw.slice(startAt), ...raw.slice(0, startAt)];

    const n = this.waypoints.length;
    this.cumLen = new Array(n + 1).fill(0);
    this.headings = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[(i + 1) % n];
      this.cumLen[i + 1] = this.cumLen[i] + Math.hypot(b.x - a.x, b.y - a.y);
      this.headings[i] = Math.atan2(b.y - a.y, b.x - a.x);
    }
    this.totalLen = this.cumLen[n];
    this.radii = cornerRadii(this.headings, this.cumLen);
    this.decor = buildDecor(this);
    for (const item of this.decor) {
      if (item.radius <= 0) continue;
      const key = Track.cellKey(item.pos.x, item.pos.y);
      const bucket = this.solidGrid.get(key);
      if (bucket) bucket.push(item);
      else this.solidGrid.set(key, [item]);
    }
  }

  private static cellKey(x: number, y: number): string {
    return `${Math.floor(x / Track.CELL)},${Math.floor(y / Track.CELL)}`;
  }

  /** Solid props in the cells around a point. */
  nearbySolids(p: Vec): DecorItem[] {
    const cx = Math.floor(p.x / Track.CELL);
    const cy = Math.floor(p.y / Track.CELL);
    const out: DecorItem[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = this.solidGrid.get(`${cx + dx},${cy + dy}`);
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }

  get count(): number {
    return this.waypoints.length;
  }

  wp(i: number): Vec {
    const n = this.waypoints.length;
    return this.waypoints[((i % n) + n) % n];
  }

  heading(i: number): number {
    const n = this.headings.length;
    return this.headings[((i % n) + n) % n];
  }

  /**
   * Closest point on the centre line. `hint` restricts the search to a window
   * around the last known index, which keeps per-frame cost tiny.
   */
  nearest(p: Vec, hint?: number): NearestInfo {
    const n = this.waypoints.length;
    let from = 0;
    let to = n;
    if (hint !== undefined) {
      from = hint - 12;
      to = hint + 13;
    }
    let best = Infinity;
    let bestI = 0;
    let bestT = 0;
    for (let k = from; k < to; k++) {
      const i = ((k % n) + n) % n;
      const a = this.waypoints[i];
      const b = this.waypoints[(i + 1) % n];
      const r = segmentDistance(p, a, b);
      if (r.dist2 < best) {
        best = r.dist2;
        bestI = i;
        bestT = r.t;
      }
    }
    const a = this.waypoints[bestI];
    const h = this.headings[bestI];
    // Positive cross product means the point sits to the right of travel.
    const side = Math.sin(h) * -(p.x - a.x) + Math.cos(h) * (p.y - a.y);
    const segLen = this.cumLen[bestI + 1] - this.cumLen[bestI];
    return {
      index: bestI,
      dist: Math.sqrt(best),
      along: this.cumLen[bestI] + segLen * bestT,
      side,
    };
  }

  /** True when the point is on the racing surface rather than the grass. */
  onTrack(p: Vec, hint?: number): boolean {
    return this.nearest(p, hint).dist <= this.def.halfWidth;
  }

  /** Corner radius at waypoint i. */
  radius(i: number): number {
    const n = this.radii.length;
    return this.radii[((i % n) + n) % n];
  }

  /** Curvature magnitude around waypoint i, in radians per waypoint. */
  curvature(i: number): number {
    return Math.abs(wrapAngle(this.heading(i + 1) - this.heading(i - 1))) * 0.5;
  }

  /** Starting slot for car `slot`, lined up behind the start/finish line. */
  startSlot(slot: number): { pos: Vec; heading: number } {
    const row = Math.floor(slot / 2);
    const col = slot % 2 === 0 ? -1 : 1;
    const back = 46 + row * 52;
    const along = (this.totalLen - back + this.totalLen) % this.totalLen;
    const { pos, heading } = this.pointAt(along);
    const lateral = this.def.halfWidth * 0.38 * col;
    return {
      pos: { x: pos.x - Math.sin(heading) * lateral, y: pos.y + Math.cos(heading) * lateral },
      heading,
    };
  }

  /** World position and travel direction at a distance along the lap. */
  pointAt(along: number): { pos: Vec; heading: number; index: number } {
    const n = this.waypoints.length;
    const d = ((along % this.totalLen) + this.totalLen) % this.totalLen;
    let lo = 0;
    let hi = n;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumLen[mid] <= d) lo = mid;
      else hi = mid;
    }
    const segLen = this.cumLen[lo + 1] - this.cumLen[lo];
    const t = segLen === 0 ? 0 : clamp((d - this.cumLen[lo]) / segLen, 0, 1);
    const a = this.waypoints[lo];
    const b = this.waypoints[(lo + 1) % n];
    return {
      pos: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
      heading: this.headings[lo],
      index: lo,
    };
  }
}

/** Corner radius at each waypoint, from the heading change over a short window. */
function cornerRadii(headings: number[], cumLen: number[]): number[] {
  const n = headings.length;
  const window = 3;
  const radii = new Array(n).fill(0);
  const at = (i: number): number => ((i % n) + n) % n;
  for (let i = 0; i < n; i++) {
    const turn = Math.abs(wrapAngle(headings[at(i + window)] - headings[at(i - window)]));
    let arc = 0;
    for (let k = -window; k < window; k++) {
      const j = at(i + k);
      arc += cumLen[j + 1] - cumLen[j];
    }
    radii[i] = turn < 1e-4 ? 1e5 : arc / turn;
  }
  return radii;
}

/**
 * Picks the waypoint sitting in the middle of the longest straight: the stretch
 * whose tightest corner (looking a little back and well ahead) is the widest.
 */
function pickStartIndex(points: Vec[]): number {
  const n = points.length;
  const at = (i: number): number => ((i % n) + n) % n;
  const headings: number[] = [];
  const cumLen: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[at(i + 1)];
    cumLen[i + 1] = cumLen[i] + Math.hypot(b.x - a.x, b.y - a.y);
    headings.push(Math.atan2(b.y - a.y, b.x - a.x));
  }
  const radii = cornerRadii(headings, cumLen);
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < n; i++) {
    let worst = Infinity;
    for (let k = -6; k <= 10; k++) worst = Math.min(worst, radii[at(i + k)]);
    if (worst > bestScore) {
      bestScore = worst;
      best = i;
    }
  }
  return best;
}

/** Scatters scenery on the grass and props along the outside of corners. */
function buildDecor(track: Track): DecorItem[] {
  const def = track.def;
  const rand = rng(def.decorSeed);
  const items: DecorItem[] = [];
  const totalWeight = def.decorKinds.reduce((s, k) => s + k.weight, 0);
  const pickKind = (): DecorKind => {
    let r = rand() * totalWeight;
    for (const k of def.decorKinds) {
      r -= k.weight;
      if (r <= 0) return k.kind;
    }
    return def.decorKinds[0].kind;
  };

  const place = (pos: Vec, kind: DecorKind): void => {
    if (pos.x < 30 || pos.y < 30 || pos.x > def.worldW - 30 || pos.y > def.worldH - 30) return;
    // Never block the racing surface.
    if (track.nearest(pos).dist < def.halfWidth + 12) return;
    for (const it of items) {
      if (Math.hypot(it.pos.x - pos.x, it.pos.y - pos.y) < 26) return;
    }
    items.push({ kind, pos, radius: DECOR_RADIUS[kind], flip: rand() < 0.5 });
  };

  // Scenery hugging both sides of the track.
  for (let i = 0; i < track.count; i += 4) {
    const p = track.wp(i);
    const h = track.heading(i);
    for (const side of [-1, 1]) {
      if (rand() < 0.45) continue;
      const off = (def.halfWidth + 26 + rand() * 90) * side;
      place({ x: p.x - Math.sin(h) * off, y: p.y + Math.cos(h) * off }, pickKind());
    }
  }

  // Corner markers on the outside of the tighter turns.
  for (let i = 0; i < track.count; i += 2) {
    if (track.curvature(i) < 0.035) continue;
    const p = track.wp(i);
    const h = track.heading(i);
    const turn = wrapAngle(track.heading(i + 1) - track.heading(i - 1));
    const side = turn > 0 ? -1 : 1; // outside of the corner
    const off = (def.halfWidth + 15) * side;
    place({ x: p.x - Math.sin(h) * off, y: p.y + Math.cos(h) * off }, def.edgeKind);
  }

  // A sparse field of props further out, so the world isn't empty.
  for (let i = 0; i < 260; i++) {
    const pos = { x: 40 + rand() * (def.worldW - 80), y: 40 + rand() * (def.worldH - 80) };
    if (track.nearest(pos).dist < def.halfWidth + 60) continue;
    place(pos, pickKind());
  }

  return items;
}

export function buildTracks(): Track[] {
  return TRACK_DEFS.map((d) => new Track(d));
}
