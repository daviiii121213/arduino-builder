import { makeCanvas, ctx2d, grassTile, noiseTile, makePattern, rng } from './pixel';
import { getDecorSprites } from './decor';
import { wrapAngle } from './math';
import type { Track } from './tracks';

/**
 * Pre-renders a whole track into one big canvas: grass, the racing surface,
 * kerbs, the start/finish line and every roadside prop. The game then just
 * blits the camera window out of it each frame.
 */
export interface World {
  ground: HTMLCanvasElement;
  /** Transparent layer collecting skid marks and dirt sprayed during the race. */
  marks: HTMLCanvasElement;
  marksCtx: CanvasRenderingContext2D;
}

function centreLinePath(track: Track, g: CanvasRenderingContext2D, offset = 0): void {
  g.beginPath();
  const n = track.count;
  for (let i = 0; i <= n; i++) {
    const p = track.wp(i);
    const h = track.heading(i);
    const x = p.x - Math.sin(h) * offset;
    const y = p.y + Math.cos(h) * offset;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

function paintGrass(track: Track, g: CanvasRenderingContext2D): void {
  const def = track.def;
  const theme = def.theme;
  g.fillStyle = makePattern(grassTile(def.decorSeed, theme.grass), g);
  g.fillRect(0, 0, def.worldW, def.worldH);

  // Patches of lighter/darker grass, stippled so they stay pixel art rather
  // than turning into soft gradients.
  const rand = rng(def.decorSeed + 5501);
  for (let i = 0; i < 190; i++) {
    const cx = rand() * def.worldW;
    const cy = rand() * def.worldH;
    const r = 22 + rand() * 64;
    g.fillStyle = rand() < 0.5 ? theme.grass.light : theme.grass.deep;
    const dots = Math.round(r * r * 0.09);
    for (let k = 0; k < dots; k++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      // Thin out towards the rim so the patch has a soft, dithered edge.
      if (rand() < d / r) continue;
      g.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 2, 2);
    }
  }

  // A few tiny wild flowers for colour.
  for (let i = 0; i < 900; i++) {
    const x = Math.round(rand() * def.worldW);
    const y = Math.round(rand() * def.worldH);
    g.fillStyle = rand() < 0.5 ? theme.flowers[0] : theme.flowers[1];
    g.fillRect(x, y, 1, 1);
    if (rand() < 0.4) g.fillRect(x + 1, y + 1, 1, 1);
  }
}

function paintSurface(track: Track, g: CanvasRenderingContext2D): void {
  const def = track.def;
  const theme = def.theme;

  const surfaceTile = noiseTile(
    32,
    theme.surface.base,
    [
      { color: theme.surface.light, density: 0.19 },
      { color: theme.surface.dark, density: 0.18 },
      { color: theme.surface.grit, density: 0.06 },
    ],
    def.decorSeed + 11,
  );

  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Shoulder just outside the racing surface.
  g.strokeStyle = theme.shoulder;
  g.lineWidth = (def.halfWidth + 7) * 2;
  centreLinePath(track, g);
  g.stroke();

  // Racing surface itself, stroked with the pixel texture.
  g.strokeStyle = makePattern(surfaceTile, g);
  g.lineWidth = def.halfWidth * 2;
  centreLinePath(track, g);
  g.stroke();

  // Wheel ruts and loose gravel banked up on the edges of a dirt circuit.
  if (theme.rut) {
    for (const off of [-def.halfWidth * 0.4, def.halfWidth * 0.4]) {
      g.strokeStyle = theme.rut;
      g.lineWidth = 13;
      centreLinePath(track, g, off);
      g.stroke();
    }
  }
  if (theme.gravel) {
    for (const off of [-def.halfWidth + 5, def.halfWidth - 5]) {
      g.strokeStyle = theme.gravel;
      g.lineWidth = 7;
      centreLinePath(track, g, off);
      g.stroke();
    }
  }
  if (theme.edgeLine) {
    for (const off of [-def.halfWidth + 4, def.halfWidth - 4]) {
      g.strokeStyle = theme.edgeLine;
      g.lineWidth = 3;
      centreLinePath(track, g, off);
      g.stroke();
    }
  }
  if (theme.racingLine) {
    g.strokeStyle = 'rgba(20,20,24,0.16)';
    g.lineWidth = Math.round(def.halfWidth * 0.47);
    centreLinePath(track, g);
    g.stroke();
  }
}

/**
 * Kerbs hugging the inside of the tighter corners, drawn as one continuous
 * strip of alternating slabs in the circuit's own colours.
 */
function paintKerbs(track: Track, g: CanvasRenderingContext2D): void {
  const def = track.def;
  const kerb = def.theme.kerb;
  if (!kerb) return;
  const edge = (i: number, side: number): { x: number; y: number } => {
    const p = track.wp(i);
    const h = track.heading(i);
    const off = (def.halfWidth - 5) * side;
    return { x: p.x - Math.sin(h) * off, y: p.y + Math.cos(h) * off };
  };
  g.lineCap = 'butt';
  g.lineWidth = 9;
  for (let i = 0; i < track.count; i++) {
    if (track.curvature(i) < 0.028) continue;
    const side = wrapAngle(track.heading(i + 1) - track.heading(i - 1)) > 0 ? 1 : -1;
    const a = edge(i, side);
    const b = edge(i + 1, side);
    g.strokeStyle = i % 4 < 2 ? kerb[0] : kerb[1];
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  g.lineCap = 'round';
}

/** Chequered start/finish band plus a couple of marker posts. */
function paintStartLine(track: Track, g: CanvasRenderingContext2D): void {
  const def = track.def;
  const { pos, heading } = track.pointAt(0);
  const w = def.halfWidth * 2;
  const square = 8;
  g.save();
  g.translate(pos.x, pos.y);
  g.rotate(heading);
  const cols = 2;
  const rows = Math.floor(w / square);
  for (let cx = 0; cx < cols; cx++) {
    for (let ry = 0; ry < rows; ry++) {
      g.fillStyle = (cx + ry) % 2 === 0 ? '#f2f0e8' : '#20222a';
      g.fillRect(cx * square - square, ry * square - (rows * square) / 2, square, square);
    }
  }
  // Posts either side of the line.
  for (const side of [-1, 1]) {
    const y = side * (def.halfWidth + 8);
    g.fillStyle = '#20222a';
    g.fillRect(-6, y - 5, 12, 10);
    g.fillStyle = '#e8e6df';
    g.fillRect(-5, y - 4, 10, 4);
    g.fillStyle = '#c8332b';
    g.fillRect(-5, y, 10, 4);
  }
  g.restore();
}

function paintDecor(track: Track, g: CanvasRenderingContext2D): void {
  const sprites = getDecorSprites();
  for (const item of track.decor) {
    const sprite = sprites[item.kind];
    const w = sprite.width;
    const h = sprite.height;
    g.save();
    g.translate(Math.round(item.pos.x), Math.round(item.pos.y));
    // Soft shadow so props sit on the ground instead of floating.
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.ellipse(2, 3, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    if (item.flip) g.scale(-1, 1);
    g.drawImage(sprite, -Math.round(w / 2), -Math.round(h / 2));
    g.restore();
  }
}

/**
 * A world with nothing to draw on: used by races simulated out of sight, so
 * they never smear skid marks across the track the player is racing on.
 */
export function headlessWorld(): World {
  const ground = makeCanvas(1, 1);
  const marks = makeCanvas(1, 1);
  return { ground, marks, marksCtx: ctx2d(marks) };
}

export function buildWorld(track: Track): World {
  const def = track.def;
  const ground = makeCanvas(def.worldW, def.worldH);
  const g = ctx2d(ground);
  paintGrass(track, g);
  paintSurface(track, g);
  paintKerbs(track, g);
  paintStartLine(track, g);
  paintDecor(track, g);

  const marks = makeCanvas(def.worldW, def.worldH);
  return { ground, marks, marksCtx: ctx2d(marks) };
}
