import type { CheckpointDef, SurfaceType, TrackDef } from '../data/types';
import type { Vec2 } from './spline';

export interface TrackSample {
  x: number;
  y: number;
  angle: number; // direction of travel (radians)
  s: number; // cumulative distance from start (meters)
  halfWidth: number;
  surface: SurfaceType;
}

export interface DecorationInstance {
  type: string;
  x: number;
  y: number;
  angle: number;
  scale: number;
  /** if true, participates in solid collision (barriers, buildings, trees) */
  solid: boolean;
  radius: number;
}

export interface PitLane {
  entryS: number;
  exitS: number;
  laneOffset: number; // lateral offset from centerline (meters)
}

export interface Checkpoint extends CheckpointDef {
  index: number;
  s: number;
  sampleIdx: number;
}

export class Track {
  readonly def: TrackDef;
  readonly samples: TrackSample[];
  readonly totalLength: number;
  readonly checkpoints: Checkpoint[];
  readonly decorations: DecorationInstance[];
  readonly pitLane: PitLane | null;
  readonly startGrid: { x: number; y: number; angle: number }[];

  constructor(def: TrackDef, samples: TrackSample[], checkpoints: Checkpoint[], decorations: DecorationInstance[], pitLane: PitLane | null, startGrid: { x: number; y: number; angle: number }[]) {
    this.def = def;
    this.samples = samples;
    this.totalLength = samples.length ? samples[samples.length - 1].s + dist(samples[samples.length - 1], samples[0]) : 0;
    this.checkpoints = checkpoints;
    this.decorations = decorations;
    this.pitLane = pitLane;
    this.startGrid = startGrid;
  }

  /** Find nearest track sample index to a world point, searching outward from a hint index for speed. */
  nearestIndex(x: number, y: number, hint = 0): number {
    const n = this.samples.length;
    let best = hint;
    let bestD = Infinity;
    const window = Math.min(n, 60);
    for (let d = -window; d <= window; d++) {
      const i = ((hint + d) % n + n) % n;
      const s = this.samples[i];
      const dd = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  }

  /** Full search (used rarely, e.g. respawn / initial placement). */
  nearestIndexFull(x: number, y: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const dd = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  }

  /** Signed lateral offset (meters) of point relative to centerline at given sample index (+right, -left). */
  lateralOffset(index: number, x: number, y: number): number {
    const s = this.samples[index];
    const nx = Math.cos(s.angle + Math.PI / 2);
    const ny = Math.sin(s.angle + Math.PI / 2);
    return (x - s.x) * nx + (y - s.y) * ny;
  }

  isOffTrack(index: number, x: number, y: number): boolean {
    const s = this.samples[index];
    const lateral = Math.abs(this.lateralOffset(index, x, y));
    return lateral > s.halfWidth;
  }

  sampleAt(index: number): TrackSample {
    return this.samples[((index % this.samples.length) + this.samples.length) % this.samples.length];
  }
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
