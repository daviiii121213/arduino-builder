import { closedSpline, segmentDistance, clamp, wrapAngle, type Vec } from './math';
import { rng } from './pixel';
import { DECOR_RADIUS, type DecorKind } from './decor';

export type Surface = 'asphalt' | 'dirt';

/** World pixels are about a third of a metre, which puts lap lengths in a real range. */
const METRES_PER_PIXEL = 0.35;

/** Every colour a track's artwork is painted from: no two circuits look alike. */
export interface TrackTheme {
  /** Racing surface: base colour plus the speckles stippled over it. */
  surface: { base: string; light: string; dark: string; grit: string };
  /** Strip of dirt/kerbstone just outside the racing surface. */
  shoulder: string;
  grass: { base: string; light: string; dark: string; deep: string; tuft: string };
  /** Small scattered highlights on the grass (flowers, stones). */
  flowers: [string, string];
  /** Alternating kerb slabs on corner apexes, or null for loose surfaces. */
  kerb: [string, string] | null;
  /** Painted edge line, or null. */
  edgeLine: string | null;
  /** Wheel ruts and loose gravel banked on the edges, for dirt circuits. */
  rut: string | null;
  gravel: string | null;
  /** Rubbered-in racing line down the middle. */
  racingLine: boolean;
  /** Tint of the skid marks this surface takes. */
  skid: string;
  /** Dust colour kicked up by the tyres. */
  dust: string;
}

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
  /** One line describing the circuit on the track select screen. */
  tagline: string;
  surface: Surface;
  theme: TrackTheme;
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

const BAYSIDE_THEME: TrackTheme = {
  surface: { base: '#4a4d55', light: '#54575f', dark: '#42454c', grit: '#5c606a' },
  shoulder: '#2f3238',
  grass: { base: '#3c7a34', light: '#458c3c', dark: '#336b2c', deep: '#2c5c26', tuft: '#54a145' },
  flowers: ['#e6d36a', '#d8dce4'],
  kerb: ['#c8332b', '#e8e6df'],
  edgeLine: '#d9d7cf',
  rut: null,
  gravel: null,
  racingLine: true,
  skid: 'rgba(24,22,26,0.38)',
  dust: '#6a6d75',
};

const DUSTBOWL_THEME: TrackTheme = {
  surface: { base: '#8a5f38', light: '#9a6d42', dark: '#79512e', grit: '#a87c50' },
  shoulder: '#6d4a2b',
  grass: { base: '#6f7a33', light: '#818c3c', dark: '#5d6a2c', deep: '#4c5724', tuft: '#96a247' },
  flowers: ['#e4cf7a', '#c9b184'],
  kerb: null,
  edgeLine: null,
  rut: 'rgba(90,60,32,0.35)',
  gravel: 'rgba(196,163,116,0.5)',
  racingLine: false,
  skid: 'rgba(86,56,30,0.45)',
  dust: '#a37c4c',
};

const SERPENTINE_THEME: TrackTheme = {
  surface: { base: '#3b414f', light: '#454c5c', dark: '#333846', grit: '#4f5768' },
  shoulder: '#262b35',
  grass: { base: '#2e6340', light: '#377449', dark: '#265535', deep: '#1e442b', tuft: '#3f8a55' },
  flowers: ['#dfe7ef', '#cf8f5a'],
  kerb: ['#2f6fbe', '#e8e6df'],
  edgeLine: '#cfd6df',
  rut: null,
  gravel: null,
  racingLine: true,
  skid: 'rgba(20,20,28,0.4)',
  dust: '#5d6675',
};

const BAYSIDE: TrackDef = {
  id: 'bayside',
  name: 'BAYSIDE CIRCUIT',
  tagline: 'Wide, fast and forgiving. Learn the game here.',
  surface: 'asphalt',
  theme: BAYSIDE_THEME,
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

const DUSTBOWL: TrackDef = {
  id: 'dustbowl',
  name: 'DUSTBOWL RALLY',
  tagline: 'Loose dirt and dry scrub. The car rotates before you ask it to.',
  surface: 'dirt',
  theme: DUSTBOWL_THEME,
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

const SERPENTINE: TrackDef = {
  id: 'serpentine',
  name: 'SERPENTINE PASS',
  tagline: 'Narrow mountain tarmac. A dozen corners and nowhere to rest.',
  surface: 'asphalt',
  theme: SERPENTINE_THEME,
  worldW: 2700,
  worldH: 2400,
  halfWidth: 56,
  gripScale: 1.02,
  speedScale: 0.98,
  decorSeed: 5150607,
  decorKinds: [
    { kind: 'pine', weight: 6 },
    { kind: 'rock', weight: 3 },
    { kind: 'tree', weight: 2 },
    { kind: 'bush', weight: 2 },
  ],
  edgeKind: 'barrier',
  control: [
    { x: 400, y: 2050 },
    { x: 300, y: 1650 },
    { x: 520, y: 1400 },
    { x: 850, y: 1500 },
    { x: 1000, y: 1250 },
    { x: 760, y: 1030 },
    { x: 420, y: 980 },
    { x: 330, y: 650 },
    { x: 620, y: 400 },
    { x: 1000, y: 470 },
    { x: 1150, y: 760 },
    { x: 1420, y: 880 },
    { x: 1560, y: 600 },
    { x: 1400, y: 330 },
    { x: 1750, y: 220 },
    { x: 2150, y: 330 },
    { x: 2300, y: 650 },
    { x: 2100, y: 900 },
    { x: 2250, y: 1200 },
    { x: 2350, y: 1600 },
    { x: 2100, y: 1950 },
    { x: 1700, y: 2100 },
    { x: 1250, y: 2150 },
    { x: 820, y: 2180 },
  ],
};

export const TRACK_DEFS: TrackDef[] = [BAYSIDE, DUSTBOWL, SERPENTINE];

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

  /** Circuit facts for the track select screen. */
  get info(): { lengthM: number; corners: number; difficulty: number; surfaceLabel: string } {
    // A corner is a run of waypoints tighter than a comfortable flat-out radius.
    let corners = 0;
    let inCorner = false;
    for (let i = 0; i < this.count; i++) {
      const r = this.radius(i);
      const tight = r < 260;
      if (tight && !inCorner) corners++;
      inCorner = tight;
    }
    // A corner spanning waypoint 0 would otherwise be counted twice.
    if (inCorner && this.radius(0) < 260 && corners > 1) corners--;
    // Difficulty: how often corners come at you, plus a step for a loose
    // surface and another for a narrow road.
    const density = corners / (this.totalLen / 1000);
    const base = density < 1 ? 1 : density < 1.6 ? 2 : 3;
    const difficulty = clamp(
      base + (this.def.surface === 'dirt' ? 1 : 0) + (this.def.halfWidth < 62 ? 1 : 0),
      1,
      3,
    );
    return {
      lengthM: Math.round((this.totalLen * METRES_PER_PIXEL) / 10) * 10,
      corners,
      difficulty,
      surfaceLabel: this.def.surface === 'dirt' ? 'DIRT' : 'ASPHALT',
    };
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
