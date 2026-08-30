export interface Vec2 { x: number; y: number; }

/** Catmull-Rom spline through a closed loop of control points. */
export function catmullRomClosed(points: Vec2[], samplesPerSegment: number): Vec2[] {
  const n = points.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      out.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }
  return out;
}

function catmullRomPoint(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return { x, y };
}

/** Resample a polyline (closed loop) to roughly uniform arc-length spacing. */
export function resampleClosed(points: Vec2[], spacing: number): Vec2[] {
  const total = closedLength(points);
  const count = Math.max(8, Math.round(total / spacing));
  const out: Vec2[] = [];
  const step = total / count;
  let acc = 0;
  let idx = 0;
  let segStart = points[0];
  let segEnd = points[1];
  let segLen = dist(segStart, segEnd);
  let segAcc = 0;
  out.push({ ...points[0] });
  for (let i = 1; i < count; i++) {
    const targetDist = i * step;
    while (acc + segLen < targetDist) {
      acc += segLen;
      idx = (idx + 1) % points.length;
      segStart = points[idx];
      segEnd = points[(idx + 1) % points.length];
      segLen = dist(segStart, segEnd) || 1e-6;
    }
    segAcc = targetDist - acc;
    const t = segAcc / segLen;
    out.push({ x: segStart.x + (segEnd.x - segStart.x) * t, y: segStart.y + (segEnd.y - segStart.y) * t });
  }
  return out;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function closedLength(points: Vec2[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    total += dist(points[i], points[(i + 1) % points.length]);
  }
  return total;
}
