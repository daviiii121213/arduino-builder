import type { SurfaceType } from '../data/types';
import { getTrack } from '../data/regions';
import { catmullRomClosed, resampleClosed, type Vec2 } from './spline';
import { Track, type Checkpoint, type DecorationInstance, type TrackSample } from './track';

const SPACING = 5; // meters between samples

/** Control points for the "Vale Verde" rural circuit (meters, arbitrary origin). */
const CONTROL_POINTS: Vec2[] = [
  { x: 0, y: 0 },
  { x: 130, y: -6 },
  { x: 250, y: -34 },
  { x: 350, y: -100 },
  { x: 400, y: -200 },
  { x: 370, y: -300 },
  { x: 280, y: -365 },
  { x: 150, y: -390 },
  { x: 10, y: -370 },
  { x: -120, y: -330 },
  { x: -220, y: -250 },
  { x: -260, y: -140 },
  { x: -220, y: -40 },
  { x: -110, y: 10 },
];

// s-ranges (as a fraction of total length, filled after sampling) describing
// the dirt path section and the narrow bridge crossing for width/surface.
function widthAt(fracS: number): number {
  // narrower through the bridge (~0.55-0.62) and the tight dirt esses (~0.68-0.85)
  if (fracS > 0.55 && fracS < 0.62) return 8; // bridge
  if (fracS > 0.68 && fracS < 0.85) return 9; // dirt esses
  if (fracS > 0.15 && fracS < 0.28) return 10; // first tight corner
  return 13;
}

function surfaceAt(fracS: number): SurfaceType {
  if (fracS > 0.6 && fracS < 0.92) return 'terra';
  return 'asfalto';
}

let cached: Track | null = null;

export function buildRuralTrack(): Track {
  if (cached) return cached;
  const def = getTrack('campo-1');

  const dense = catmullRomClosed(CONTROL_POINTS, 40);
  const points = resampleClosed(dense, SPACING);

  const raw: { x: number; y: number; angle: number }[] = points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    const angle = Math.atan2(next.y - p.y, next.x - p.x);
    return { x: p.x, y: p.y, angle };
  });

  // smooth angles slightly to avoid jitter from resampling
  const smoothedAngles = smoothAngles(raw.map((r) => r.angle));

  let s = 0;
  const samples: TrackSample[] = raw.map((r, i) => {
    const frac = i / raw.length;
    const sample: TrackSample = {
      x: r.x,
      y: r.y,
      angle: smoothedAngles[i],
      s,
      halfWidth: widthAt(frac) / 2,
      surface: surfaceAt(frac),
    };
    const next = raw[(i + 1) % raw.length];
    s += Math.hypot(next.x - r.x, next.y - r.y);
    return sample;
  });

  const totalLen = s;
  const numCheckpoints = 16;
  const checkpoints: Checkpoint[] = [];
  for (let i = 0; i < numCheckpoints; i++) {
    const targetS = (i / numCheckpoints) * totalLen;
    const idx = closestSampleForS(samples, targetS);
    const sample = samples[idx];
    checkpoints.push({
      index: i,
      s: sample.s,
      sampleIdx: idx,
      x: sample.x,
      y: sample.y,
      angle: sample.angle,
      width: sample.halfWidth * 2,
      isStartFinish: i === 0,
    });
  }

  const decorations = buildDecorations(samples);

  const pitLane = { entryS: totalLen * 0.03, exitS: totalLen * 0.1, laneOffset: 9 };

  const startBase = samples[0];
  const perp = { x: Math.cos(startBase.angle + Math.PI / 2), y: Math.sin(startBase.angle + Math.PI / 2) };
  const startGrid = [0, 1, 2, 3].map((row) => {
    const back = row * 9;
    const side = row % 2 === 0 ? -3 : 3;
    const bx = startBase.x - Math.cos(startBase.angle) * back;
    const by = startBase.y - Math.sin(startBase.angle) * back;
    return { x: bx + perp.x * side, y: by + perp.y * side, angle: startBase.angle };
  });

  cached = new Track(def, samples, checkpoints, decorations, pitLane, startGrid);
  return cached;
}

function closestSampleForS(samples: TrackSample[], targetS: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = Math.abs(samples[i].s - targetS);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function smoothAngles(angles: number[]): number[] {
  const n = angles.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a0 = angles[(i - 1 + n) % n];
    const a1 = angles[i];
    const a2 = angles[(i + 1) % n];
    out[i] = Math.atan2(
      (Math.sin(a0) + Math.sin(a1) + Math.sin(a2)) / 3,
      (Math.cos(a0) + Math.cos(a1) + Math.cos(a2)) / 3,
    );
  }
  return out;
}

function buildDecorations(samples: TrackSample[]): DecorationInstance[] {
  const decorations: DecorationInstance[] = [];
  const n = samples.length;

  const push = (type: string, x: number, y: number, angle: number, scale: number, solid: boolean, radius: number) => {
    decorations.push({ type, x, y, angle, scale, solid, radius });
  };

  // Trees lining most of the track, offset outward on both sides, skipping
  // gaps near stands/pits/bridge for readability.
  for (let i = 0; i < n; i += 6) {
    const frac = i / n;
    if (frac > 0.55 && frac < 0.63) continue; // bridge area kept clear
    const s = samples[i];
    const perp = { x: Math.cos(s.angle + Math.PI / 2), y: Math.sin(s.angle + Math.PI / 2) };
    const outerGap = s.halfWidth + 6 + (i % 5);
    const innerGap = s.halfWidth + 5 + (i % 4);
    if ((i / 6) % 3 !== 0) {
      push('arvore', s.x + perp.x * outerGap, s.y + perp.y * outerGap, 0, 0.8 + ((i % 3) * 0.15), false, 2.5);
    }
    if (frac > 0.3 && frac < 0.55 && (i / 6) % 4 === 0) {
      push('arvore', s.x - perp.x * innerGap, s.y - perp.y * innerGap, 0, 0.7, false, 2.5);
    }
  }

  // Farm cluster near the start/finish straight
  push('fazenda_casa', samples[0].x + 40, samples[0].y - 30, 0.3, 1, true, 6);
  push('fazenda_celeiro', samples[0].x + 60, samples[0].y - 45, 0.3, 1, true, 7);
  push('silo', samples[0].x + 78, samples[0].y - 30, 0, 1, true, 4);
  push('cerca', samples[0].x + 20, samples[0].y - 18, 0.3, 1, false, 1);

  // Grandstand + pit area near start
  push('arquibancada', samples[0].x - 20, samples[0].y + 22, 0, 1, false, 1);
  push('boxes', samples[0].x + 10, samples[0].y + 20, 0, 1, true, 8);

  // Bridge over the dirt-section river crossing
  const bridgeIdx = Math.floor(n * 0.585);
  const bs = samples[bridgeIdx];
  push('ponte', bs.x, bs.y, bs.angle, 1, false, 5);

  // Barriers on the tightest corners (first hairpin ~0.18-0.26, dirt esses ~0.68-0.85)
  for (let i = 0; i < n; i++) {
    const frac = i / n;
    const tight = (frac > 0.16 && frac < 0.28) || (frac > 0.68 && frac < 0.85);
    if (!tight || i % 3 !== 0) continue;
    const s = samples[i];
    const perp = { x: Math.cos(s.angle + Math.PI / 2), y: Math.sin(s.angle + Math.PI / 2) };
    push('barreira', s.x + perp.x * (s.halfWidth + 1.2), s.y + perp.y * (s.halfWidth + 1.2), s.angle, 1, true, 1.2);
    push('barreira', s.x - perp.x * (s.halfWidth + 1.2), s.y - perp.y * (s.halfWidth + 1.2), s.angle, 1, true, 1.2);
  }

  // Warning signs before the dirt section and before the bridge
  const signBefore = (frac: number, label: string) => {
    const idx = Math.floor(n * frac);
    const s = samples[idx];
    const perp = { x: Math.cos(s.angle + Math.PI / 2), y: Math.sin(s.angle + Math.PI / 2) };
    push('placa_' + label, s.x + perp.x * (s.halfWidth + 2.5), s.y + perp.y * (s.halfWidth + 2.5), s.angle, 1, false, 1);
  };
  signBefore(0.58, 'ponte');
  signBefore(0.60, 'terra');
  signBefore(0.15, 'curva');
  signBefore(0.67, 'curva');

  // Distant industrial silhouettes / houses scattered for atmosphere
  push('casa', samples[0].x - 90, samples[0].y + 40, 0, 1, false, 4);
  push('casa', samples[0].x - 130, samples[0].y + 20, 0, 0.9, false, 4);

  // Gas station along the back straight
  const gasIdx = Math.floor(n * 0.42);
  const gs = samples[gasIdx];
  const gperp = { x: Math.cos(gs.angle + Math.PI / 2), y: Math.sin(gs.angle + Math.PI / 2) };
  push('posto', gs.x - gperp.x * (gs.halfWidth + 10), gs.y - gperp.y * (gs.halfWidth + 10), gs.angle, 1, true, 6);

  return decorations;
}
