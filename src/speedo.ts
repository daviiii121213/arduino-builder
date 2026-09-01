import { drawText } from './font';

/**
 * The dial: a pixel-art speedometer drawn with plotted pixels rather than
 * strokes, so every edge lands on a whole pixel. It reads 0 to 260 km/h in
 * twenties, marks the last stretch red, and carries the current gear in the
 * middle with the digital speed under it.
 */

/** Every value printed around the rim. */
export const DIAL_MARKS = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260];
export const DIAL_MAX = DIAL_MARKS[DIAL_MARKS.length - 1];
/** Where the redline starts, in km/h. */
export const REDLINE = 200;

const START_ANGLE = Math.PI * 0.75;
const SWEEP = Math.PI * 1.5;

const INK = '#0d1014';
const FACE = '#161c28';
const RIM = '#4a566e';
const BONE = '#f2f0e8';
const DIM = '#8b93a3';
const KERB = '#c8332b';
const NEEDLE = '#e0553f';

/** A 3x5 digit set, small enough to letter every mark on the rim. */
const MICRO: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};

export const MICRO_W = 3;
export const MICRO_H = 5;

/** Width in pixels of a number drawn in the micro font. */
export function microWidth(text: string): number {
  return text.length * (MICRO_W + 1) - 1;
}

export function drawMicro(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  g.fillStyle = color;
  let cursor = Math.round(x);
  for (const ch of text) {
    const glyph = MICRO[ch];
    if (glyph) {
      for (let row = 0; row < MICRO_H; row++) {
        for (let col = 0; col < MICRO_W; col++) {
          if (glyph[row][col] === '#') g.fillRect(cursor + col, Math.round(y) + row, 1, 1);
        }
      }
    }
    cursor += MICRO_W + 1;
  }
}

/** Midpoint circle, filled or outlined, on whole pixels. */
function circle(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  fill: boolean,
): void {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const span = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    if (fill) {
      g.fillRect(cx - span, cy + y, span * 2 + 1, 1);
    } else {
      g.fillRect(cx - span, cy + y, 1, 1);
      g.fillRect(cx + span, cy + y, 1, 1);
    }
  }
  if (!fill) {
    for (let x = -r; x <= r; x++) {
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - x * x)));
      g.fillRect(cx + x, cy - span, 1, 1);
      g.fillRect(cx + x, cy + span, 1, 1);
    }
  }
}

/** Bresenham line, one pixel at a time. */
function line(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thickness = 1,
): void {
  g.fillStyle = color;
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x, y, thickness, thickness);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function angleFor(kmh: number): number {
  const clamped = Math.max(0, Math.min(DIAL_MAX, kmh));
  return START_ANGLE + (clamped / DIAL_MAX) * SWEEP;
}

export interface SpeedoState {
  /** Road speed in km/h. */
  kmh: number;
  gear: number;
  gearCount: number;
  /** 0..1, drives the small rev strip under the gear. */
  rpm: number;
  /** Tint for the gear digit, taken from the car. */
  tint: string;
}

/** Draws the dial with its centre at (cx, cy) and the given radius. */
export function drawSpeedometer(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  state: SpeedoState,
): void {
  const x = Math.round(cx);
  const y = Math.round(cy);

  circle(g, x, y, radius + 1, INK, true);
  circle(g, x, y, radius, FACE, true);
  circle(g, x, y, radius, RIM, false);

  // Redline arc, drawn as pixels along the rim.
  for (let kmh = REDLINE; kmh <= DIAL_MAX; kmh += 2) {
    const a = angleFor(kmh);
    for (let d = 0; d < 2; d++) {
      g.fillStyle = KERB;
      g.fillRect(
        Math.round(x + Math.cos(a) * (radius - 1 - d)),
        Math.round(y + Math.sin(a) * (radius - 1 - d)),
        1,
        1,
      );
    }
  }

  // Ticks and their numbers.
  for (const mark of DIAL_MARKS) {
    const a = angleFor(mark);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Short ticks tucked inside the rim, numbers sitting just inside them:
    // the wider ring is what lets all fourteen labels fit without touching.
    const outer = radius - 3;
    const inner = outer - 3;
    const hot = mark >= REDLINE;
    line(g, x + cos * inner, y + sin * inner, x + cos * outer, y + sin * outer, hot ? KERB : BONE);

    const label = String(mark);
    const lr = radius - 8;
    const lx = x + cos * lr - microWidth(label) / 2;
    const ly = y + sin * lr - MICRO_H / 2;
    drawMicro(g, label, lx, ly, hot ? '#e08a80' : DIM);
  }

  // Needle, with a short counterweight on the other side.
  const a = angleFor(state.kmh);
  const nx = x + Math.cos(a) * (radius - 9);
  const ny = y + Math.sin(a) * (radius - 9);
  line(g, x - Math.cos(a) * 5, y - Math.sin(a) * 5, nx, ny, NEEDLE);
  circle(g, x, y, 3, INK, true);
  circle(g, x, y, 2, NEEDLE, true);

  // The needle never crosses the bottom of the sweep, so the gear lives there.
  const gearLabel = String(Math.min(state.gear, state.gearCount));
  drawText(g, gearLabel, x, y + Math.round(radius * 0.30), {
    scale: 2,
    color: state.tint,
    shadow: INK,
    align: 'center',
  });

  // A small cluster under the dial: rev strip on the left, road speed on the
  // right, both on their own plate so they read against any track.
  const plateW = radius * 2;
  const plateX = x - radius;
  const plateY = y + radius + 3;
  const plateH = 11;
  g.fillStyle = INK;
  g.fillRect(plateX, plateY, plateW, plateH);
  g.fillStyle = FACE;
  g.fillRect(plateX + 1, plateY + 1, plateW - 2, plateH - 2);

  const segments = 10;
  const stripW = Math.round(plateW * 0.52);
  const stripX = plateX + 4;
  const stripY = plateY + 3;
  const lit = Math.round(Math.max(0, Math.min(1, state.rpm)) * segments);
  const cell = Math.floor(stripW / segments);
  for (let i = 0; i < segments; i++) {
    g.fillStyle = i < lit ? (i >= segments - 3 ? KERB : '#f2c14e') : '#28303f';
    g.fillRect(stripX + i * cell, stripY, Math.max(1, cell - 1), 5);
  }

  const digits = String(Math.round(Math.max(0, Math.min(999, state.kmh))));
  drawMicro(g, digits, plateX + plateW - 5 - microWidth(digits), plateY + 3, BONE);
}
