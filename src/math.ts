export interface Vec {
  x: number;
  y: number;
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Wraps an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** Squared distance from point p to segment ab, plus how far along ab it fell (0..1). */
export function segmentDistance(p: Vec, a: Vec, b: Vec): { dist2: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / len2, 0, 1);
  const dx = p.x - (a.x + abx * t);
  const dy = p.y - (a.y + aby * t);
  return { dist2: dx * dx + dy * dy, t };
}

/**
 * Catmull-Rom spline through a closed loop of control points, resampled into
 * `perSegment` points per control segment. Used to turn a handful of hand-placed
 * corner points into a smooth racing line.
 */
export function closedSpline(points: Vec[], perSegment: number): Vec[] {
  const n = points.length;
  const out: Vec[] = [];
  const at = (i: number): Vec => points[((i % n) + n) % n];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}
