// Sprites for every placeable. Painters receive a canvas context sized to the
// footprint in pixels (plus headroom for the tall parts) and paint a top-down 3/4
// industrial object: chassis, panels, pipes, gauges, hazard trim, grime.

import { makeCanvas, rr, plate, brushed, grime, bolt, boltFrame, vgrad, hgrad,
         glassPanel, hazard, glow, led, pipe, dropShadow, engraved, vents, noiseOverlay, sign } from './draw.js';
import { P, rgba, shade, mix } from './palette.js';
import { mulberry32 } from '../core/rng.js';
import { TAU } from '../core/utils.js';
import { BUILDABLES } from '../data/buildables.js';

const TS = 32;
export const HEAD = 18;          // extra pixels above the footprint for tall structures

const cache = new Map();

export function machineSprite(id, dir = 0) {
  const def = BUILDABLES[id];
  if (!def) return null;
  const key = id + ':' + (rotates(id) ? dir : 0);
  if (cache.has(key)) return cache.get(key);
  const swap = rotates(id) && dir % 2 === 1;
  const tw = swap ? def.h : def.w, th = swap ? def.w : def.h;
  const w = tw * TS, h = th * TS;
  const { c, g } = makeCanvas(w, h + HEAD);
  g.translate(0, HEAD);
  const rnd = mulberry32(id.length * 7717 + id.charCodeAt(0) * 131 + dir * 17 + 5);
  dropShadow(g, w * 0.08, h - 9, w * 0.84, 16, 0.4);
  (PAINT[id] || paintGeneric)(g, w, h, rnd, dir, def);
  noiseOverlay(g, 0, 0, w, h + HEAD, 17 + id.length, 0.03);
  const spr = { canvas: c, w, h: h + HEAD, head: HEAD, tw, th };
  cache.set(key, spr);
  return spr;
}

export function rotates(id) {
  const k = BUILDABLES[id]?.kind;
  return k === 'belt' || k === 'dock' || k === 'machine' || k === 'miner' || k === 'gen' || k === 'store' || k === 'service' || k === 'lab';
}

// ---------------------------------------------------------------- shared bits

/** Common chassis: bolted base plate with skirt, used by most machines. */
function chassis(g, w, h, base = P.steelLo, seed = 1) {
  // skirt / shadowed base
  g.fillStyle = rgba('#0a0c0f', 0.55);
  rr(g, 2, h - 8, w - 4, 8, 3); g.fill();
  plate(g, 1, 2, w - 2, h - 4, base, { r: 4 });
  brushed(g, 1, 2, w - 2, h - 4, seed);
  boltFrame(g, 1, 2, w - 2, h - 4, 5, 2.1);
}

function frameRibs(g, x, y, w, h, n = 3, col = P.steelDark) {
  for (let i = 1; i < n; i++) {
    const rx = x + (w / n) * i;
    g.fillStyle = rgba(col, 0.55); g.fillRect(rx - 1.4, y, 2.8, h);
    g.fillStyle = rgba('#fff', 0.07); g.fillRect(rx + 1.4, y, 1, h);
  }
}

function gauge(g, x, y, r, hue = P.glowWarm) {
  g.fillStyle = P.steelDark; g.beginPath(); g.arc(x, y, r + 1.4, 0, TAU); g.fill();
  g.fillStyle = '#e6e0cf'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = rgba('#b03026', 0.8); g.lineWidth = 1.2;
  g.beginPath(); g.arc(x, y, r * 0.72, -Math.PI * 0.15, Math.PI * 0.25); g.stroke();
  g.strokeStyle = '#2a2a2e'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(-2.3) * r * 0.7, y + Math.sin(-2.3) * r * 0.7); g.stroke();
  g.fillStyle = '#2a2a2e'; g.beginPath(); g.arc(x, y, 1, 0, TAU); g.fill();
}

function controlPanel(g, x, y, w, h) {
  plate(g, x, y, w, h, P.steelDark, { r: 2 });
  glassPanel(g, x + 2, y + 2, w - 4, h * 0.5, P.glowCold, 0.7);
  for (let i = 0; i < 3; i++) led(g, x + 4 + i * 5, y + h - 3.5, 1.4, [P.uiGood, P.uiWarn, P.glowCold][i]);
}

function ductPipes(g, x, y, len, count = 2, col = P.steelMid) {
  for (let i = 0; i < count; i++) pipe(g, x, y + i * 6, x + len, y + i * 6, 4.4, col);
}

// ---------------------------------------------------------------- painters

function paintGeneric(g, w, h, rnd) {
  chassis(g, w, h, P.steelLo, 3);
  plate(g, w * 0.2, h * 0.2, w * 0.6, h * 0.5, P.steelMid, { r: 3 });
  gauge(g, w * 0.75, h * 0.28, 4);
}

// ---- conveyor -------------------------------------------------------------
function paintBelt(g, w, h, rnd, dir, def, fast) {
  const horiz = dir % 2 === 1;
  g.save();
  g.translate(w / 2, h / 2); g.rotate(horiz ? Math.PI / 2 : 0); g.translate(-w / 2, -h / 2);
  // side rails
  plate(g, 0, 0, w, h, P.steelLo, { r: 1 });
  g.fillStyle = P.steelDark; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  g.fillStyle = rgba('#fff', 0.12); g.fillRect(1, 0, 1.2, h); g.fillRect(w - 3, 0, 1.2, h);
  // rubber band
  vgrad(g, 4, 0, w - 8, h, [[0, P.rubberHi], [0.25, P.rubber], [1, '#1b1b20']]);
  g.fillRect(4, 0, w - 8, h);
  // tread grooves (static; motion overlay is drawn at runtime)
  for (let i = 0; i < h; i += 5) {
    g.fillStyle = rgba('#000', 0.35); g.fillRect(4, i, w - 8, 1.6);
    g.fillStyle = rgba('#fff', 0.06); g.fillRect(4, i + 1.6, w - 8, 0.8);
  }
  // direction chevron
  g.fillStyle = rgba(fast ? P.paintYellow : P.paintOrange, 0.9);
  g.beginPath();
  g.moveTo(w / 2, h * 0.24); g.lineTo(w * 0.72, h * 0.5); g.lineTo(w / 2, h * 0.42);
  g.lineTo(w * 0.28, h * 0.5); g.closePath(); g.fill();
  // rollers at the ends
  for (const ry of [2.2, h - 2.2]) {
    g.fillStyle = P.steelMid; rr(g, 3, ry - 1.6, w - 6, 3.2, 1.4); g.fill();
    g.fillStyle = rgba('#fff', 0.18); g.fillRect(3, ry - 1.6, w - 6, 0.9);
  }
  bolt(g, 2.4, 3, 1.2); bolt(g, w - 2.4, 3, 1.2);
  bolt(g, 2.4, h - 3, 1.2); bolt(g, w - 2.4, h - 3, 1.2);
  g.restore();
  // rotate the whole sprite for S/W so chevrons point correctly
  if (dir === 2 || dir === 3) { /* handled by renderer flip */ }
}

// ---- pipe & cable ---------------------------------------------------------
function paintPipe(g, w, h) {
  g.fillStyle = rgba('#0a0c0f', 0.3); g.fillRect(4, h - 6, w - 8, 5);
  pipe(g, w / 2, 0, w / 2, h, 14, P.steel);
  pipe(g, 0, h / 2, w, h / 2, 14, P.steel);
  g.fillStyle = P.steelMid;
  g.beginPath(); g.arc(w / 2, h / 2, 8, 0, TAU); g.fill();
  g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 1; g.stroke();
  g.fillStyle = rgba('#fff', 0.2); g.beginPath(); g.arc(w / 2 - 2, h / 2 - 2.4, 3.4, 0, TAU); g.fill();
  bolt(g, w / 2 - 6, h / 2 - 6, 1.3); bolt(g, w / 2 + 6, h / 2 + 6, 1.3);
}

function paintCable(g, w, h) {
  // conduit tray with two insulated cores
  g.fillStyle = rgba('#0a0c0f', 0.25); g.fillRect(2, h - 5, w - 4, 4);
  g.strokeStyle = P.steelDark; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  g.strokeStyle = '#171b20'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  g.strokeStyle = P.paintOrange; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(w / 2 - 1.4, 0); g.lineTo(w / 2 - 1.4, h); g.moveTo(0, h / 2 - 1.4); g.lineTo(w, h / 2 - 1.4); g.stroke();
  g.strokeStyle = P.copperHi; g.lineWidth = 1;
  g.beginPath(); g.moveTo(w / 2 + 1.6, 0); g.lineTo(w / 2 + 1.6, h); g.moveTo(0, h / 2 + 1.6); g.lineTo(w, h / 2 + 1.6); g.stroke();
  g.lineCap = 'butt';
  // junction clamp
  plate(g, w / 2 - 6, h / 2 - 6, 12, 12, P.steelMid, { r: 2 });
  bolt(g, w / 2, h / 2, 2.2, P.brass);
}

// ---- storage --------------------------------------------------------------
function paintChest(g, w, h, rnd) {
  chassis(g, w, h, P.paintBlue, 11);
  plate(g, 4, 5, w - 8, h - 12, shade(P.paintBlue, -0.12), { r: 2 });
  g.fillStyle = rgba('#000', 0.3); g.fillRect(5, h / 2 - 1, w - 10, 2);
  hazard(g, 4, h - 11, w - 8, 4, P.paintYellow, P.steelDark, 5);
  g.fillStyle = P.steelHi; rr(g, w / 2 - 5, h / 2 - 3.5, 10, 4, 1.5); g.fill();
  grime(g, 0, 0, w, h, 21, 0.8);
}

function paintWarehouse(g, w, h, rnd) {
  // big shed: floor, walls, roof panels with skylights
  g.fillStyle = P.concreteLo; rr(g, 0, 2, w, h - 2, 4); g.fill();
  plate(g, 0, -HEAD + 2, w, h + HEAD - 6, '#8b8579', { r: 5 });
  // roof panel ribs
  g.save(); rr(g, 0, -HEAD + 2, w, h + HEAD - 6, 5); g.clip();
  for (let x = 6; x < w; x += 12) {
    g.fillStyle = rgba('#000', 0.16); g.fillRect(x, -HEAD + 2, 3, h + HEAD);
    g.fillStyle = rgba('#fff', 0.08); g.fillRect(x + 3, -HEAD + 2, 1.4, h + HEAD);
  }
  // skylights
  for (let i = 0; i < 3; i++) glassPanel(g, w * 0.12 + i * w * 0.3, -HEAD + 10, w * 0.18, 14, P.glass, 0.55);
  g.restore();
  // roller doors along the front
  for (let i = 0; i < 2; i++) {
    const dx = w * 0.16 + i * w * 0.46;
    plate(g, dx, h - 22, w * 0.22, 20, P.steelLo, { r: 2 });
    for (let k = 0; k < 5; k++) { g.fillStyle = rgba('#000', 0.22); g.fillRect(dx, h - 20 + k * 4, w * 0.22, 1.6); }
    hazard(g, dx, h - 5, w * 0.22, 4, P.paintYellow, P.steelDark, 5);
  }
  engraved(g, 'WAREHOUSE', w / 2, -2, 'bold 11px sans-serif', rgba('#e8e2d4', 0.75), 'center');
  boltFrame(g, 0, -HEAD + 2, w, h + HEAD - 6, 6, 2.2);
  grime(g, 0, 0, w, h, 44, 0.9);
}

function paintDock(g, w, h, rnd) {
  // raised loading platform: marked apron, steel deck, bumpers, bollards and a gantry
  g.fillStyle = P.concrete; rr(g, 0, 0, w, h, 3); g.fill();
  g.save(); rr(g, 0, 0, w, h, 3); g.clip();
  for (let x = 0; x < w; x += 16) {
    g.strokeStyle = rgba('#3d3b36', 0.5); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
  for (let y = 0; y < h; y += 16) {
    g.strokeStyle = rgba('#3d3b36', 0.35); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  // painted bay outline on the apron
  g.strokeStyle = rgba(P.paintYellow, 0.75); g.lineWidth = 2.2; g.setLineDash([7, 5]);
  g.strokeRect(6, 6, w - 12, h - 18);
  g.setLineDash([]);
  g.restore();

  // steel deck with roller edge
  plate(g, 5, 4, w - 10, h - 20, P.steelLo, { r: 2 });
  brushed(g, 5, 4, w - 10, h - 20, 26);
  for (let x = 9; x < w - 10; x += 8) {
    g.fillStyle = P.steelHi; rr(g, x, h - 22, 5, 5, 2); g.fill();
    g.fillStyle = rgba('#000', 0.3); g.fillRect(x, h - 22, 1.4, 5);
  }
  // pallet of crates waiting for pickup
  const px = w * 0.16, py = h * 0.3;
  g.fillStyle = '#6b5027'; g.fillRect(px, py + 13, 20, 3.4);
  plate(g, px + 1, py, 18, 14, '#a5804a', { r: 1 });
  g.strokeStyle = '#4a3717'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(px + 1, py); g.lineTo(px + 19, py + 14);
  g.moveTo(px + 19, py); g.lineTo(px + 1, py + 14); g.stroke();

  // rubber dock bumpers along the truck edge
  for (let i = 0; i < 3; i++) {
    const bx = 8 + i * ((w - 26) / 2);
    g.fillStyle = P.rubber; rr(g, bx, h - 15, 13, 7, 2); g.fill();
    g.fillStyle = rgba('#fff', 0.08); g.fillRect(bx, h - 15, 13, 1.6);
  }
  // bollards
  for (const bx of [3, w - 7]) {
    g.fillStyle = P.paintYellow; rr(g, bx, h - 26, 4.5, 12, 2); g.fill();
    g.fillStyle = rgba('#000', 0.45); g.fillRect(bx, h - 21, 4.5, 3);
    g.fillStyle = rgba('#fff', 0.2); g.fillRect(bx, h - 26, 1.6, 12);
  }
  hazard(g, 0, h - 9, w, 8, P.paintYellow, P.steelDark, 7);

  // gantry sign over the bay
  g.fillStyle = P.steelDark; g.fillRect(w * 0.3 - 3, -12, 3, 14); g.fillRect(w * 0.7, -12, 3, 14);
  plate(g, w * 0.28, -16, w * 0.44, 13, P.paintGreen, { r: 2 });
  engraved(g, 'SHIPPING', w * 0.5, -6.5, 'bold 8px sans-serif', '#eaf5ea', 'center');
  led(g, w - 9, 9, 2.4, P.uiGood);
  led(g, w - 9, 17, 2.4, P.paintYellow);
  grime(g, 0, 0, w, h, 66, 0.7);
}

// ---- extraction -----------------------------------------------------------
function paintMiner(g, w, h, rnd, dir, def, deep) {
  chassis(g, w, h, deep ? P.paintYellow : P.paintOrange, 5);
  // drill housing
  plate(g, w * 0.16, h * 0.12, w * 0.68, h * 0.56, P.steelLo, { r: 3 });
  vents(g, w * 0.2, h * 0.18, w * 0.2, h * 0.4, 4);
  // drill head (static base; the bit spins at runtime)
  const cx = w * 0.62, cy = h * 0.58;
  g.fillStyle = P.steelDark; g.beginPath(); g.arc(cx, cy, 10, 0, TAU); g.fill();
  g.fillStyle = P.steelMid; g.beginPath(); g.arc(cx, cy, 7.5, 0, TAU); g.fill();
  g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 1; g.stroke();
  // output chute
  plate(g, w - 12, h * 0.62, 10, h * 0.3, P.steelMid, { r: 2 });
  hazard(g, 2, h - 9, w - 4, 6, P.paintYellow, P.steelDark, 6);
  gauge(g, w * 0.22, h * 0.76, 4.5);
  controlPanel(g, w * 0.36, h * 0.72, 16, 10);
  if (deep) { led(g, w - 7, 7, 2, P.glowCold); plate(g, 4, 4, 10, 10, P.steelHi, { r: 2 }); }
  grime(g, 0, 0, w, h, 9, 1);
}

function paintWaterPump(g, w, h, rnd) {
  chassis(g, w, h, P.paintBlue, 13);
  // pump volute
  const cx = w * 0.38, cy = h * 0.45;
  g.fillStyle = P.steelMid; g.beginPath(); g.arc(cx, cy, 13, 0, TAU); g.fill();
  g.fillStyle = P.steelLo; g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.fill();
  g.strokeStyle = rgba('#000', 0.55); g.lineWidth = 1.2; g.stroke();
  for (let i = 0; i < 6; i++) bolt(g, cx + Math.cos(i / 6 * TAU) * 11, cy + Math.sin(i / 6 * TAU) * 11, 1.5);
  // intake + discharge pipes
  pipe(g, cx, cy, w - 4, cy, 9, P.steel);
  pipe(g, cx, cy, cx, h - 2, 9, P.steel);
  // motor block
  plate(g, w * 0.58, h * 0.12, w * 0.34, h * 0.3, P.steelLo, { r: 2 });
  vents(g, w * 0.62, h * 0.16, w * 0.26, h * 0.22, 3);
  gauge(g, w * 0.82, h * 0.62, 5);
  grime(g, 0, 0, w, h, 27, 0.8);
}

// ---- processing -----------------------------------------------------------
function paintFurnace(g, w, h, rnd) {
  chassis(g, w, h, P.ironLo, 2);
  // firebrick body
  plate(g, 4, 4, w - 8, h - 12, '#7a4a33', { r: 3 });
  g.save(); rr(g, 4, 4, w - 8, h - 12, 3); g.clip();
  for (let y = 6; y < h - 8; y += 7) {
    g.strokeStyle = rgba('#000', 0.22); g.lineWidth = 1;
    g.beginPath(); g.moveTo(4, y); g.lineTo(w - 4, y); g.stroke();
    const off = ((y / 7) | 0) % 2 ? 7 : 0;
    for (let x = 4 + off; x < w - 4; x += 14) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 7); g.stroke(); }
  }
  g.restore();
  // fire door (glows at runtime)
  const dw = w * 0.36, dx = w / 2 - dw / 2, dy = h * 0.42;
  g.fillStyle = '#140c08'; rr(g, dx, dy, dw, h * 0.3, 3); g.fill();
  g.strokeStyle = P.steelDark; g.lineWidth = 2.4; rr(g, dx, dy, dw, h * 0.3, 3); g.stroke();
  g.fillStyle = P.steelMid; rr(g, dx + dw * 0.35, dy + h * 0.12, dw * 0.3, 3.4, 1.5); g.fill();
  // chimney stack
  plate(g, w - 18, -14, 13, 26, P.iron, { r: 2 });
  g.fillStyle = '#14140f'; g.beginPath(); g.ellipse(w - 11.5, -13, 6.5, 2.6, 0, 0, TAU); g.fill();
  g.fillStyle = rgba(P.rust, 0.5); g.fillRect(w - 18, -4, 13, 3);
  // temperature gauge cluster
  gauge(g, 12, h * 0.26, 5.5);
  led(g, 12, h * 0.5, 2, P.glowHot);
  hazard(g, 3, h - 9, w - 6, 6, P.paintYellow, P.steelDark, 6);
  grime(g, 0, 0, w, h, 4, 1.3);
}

function paintPress(g, w, h, rnd) {
  chassis(g, w, h, P.paintGreen, 8);
  // C-frame body
  plate(g, w * 0.1, h * 0.08, w * 0.8, h * 0.34, P.steelLo, { r: 3 });   // crown
  plate(g, w * 0.1, h * 0.62, w * 0.8, h * 0.28, P.steelLo, { r: 3 });   // bed
  plate(g, w * 0.12, h * 0.4, w * 0.14, h * 0.26, P.steelMid, { r: 2 }); // column
  plate(g, w * 0.74, h * 0.4, w * 0.14, h * 0.26, P.steelMid, { r: 2 });
  // ram (animated at runtime; this is its guide)
  g.fillStyle = rgba('#0d0f12', 0.6); g.fillRect(w * 0.3, h * 0.4, w * 0.4, h * 0.24);
  g.fillStyle = P.steelDark; g.fillRect(w * 0.32, h * 0.42, w * 0.36, h * 0.1);
  // die on the bed
  plate(g, w * 0.34, h * 0.66, w * 0.32, h * 0.14, P.brass, { r: 1 });
  boltFrame(g, w * 0.1, h * 0.08, w * 0.8, h * 0.34, 5, 2);
  gauge(g, w * 0.2, h * 0.2, 5);
  controlPanel(g, w * 0.58, h * 0.14, 18, 12);
  hazard(g, 3, h - 9, w - 6, 6);
  grime(g, 0, 0, w, h, 14, 1);
}

function paintCutter(g, w, h, rnd) {
  chassis(g, w, h, P.paintBlue, 6);
  plate(g, 5, 6, w - 10, h * 0.5, P.steelLo, { r: 3 });
  // blade guard + blade (spins at runtime)
  const cx = w * 0.5, cy = h * 0.42;
  g.fillStyle = P.steelDark; g.beginPath(); g.arc(cx, cy, 13, Math.PI, TAU); g.fill();
  g.fillStyle = P.steelMid; g.beginPath(); g.arc(cx, cy, 11, Math.PI, TAU); g.fill();
  g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 13, Math.PI, TAU); g.stroke();
  // material table with a slot
  plate(g, 5, h * 0.6, w - 10, h * 0.28, P.steelMid, { r: 2 });
  g.fillStyle = '#111418'; g.fillRect(cx - 2, h * 0.6, 4, h * 0.28);
  // coolant tank
  plate(g, w - 16, h * 0.62, 12, h * 0.24, P.paintGreenLo, { r: 2 });
  glassPanel(g, w - 13, h * 0.66, 6, h * 0.16, P.glass, 0.6);
  gauge(g, 12, h * 0.72, 4.5);
  hazard(g, 3, h - 9, w - 6, 6);
  grime(g, 0, 0, w, h, 18, 0.9);
}

function paintAssembler(g, w, h, rnd) {
  chassis(g, w, h, P.steelLo, 12);
  // work cell with glass safety enclosure
  plate(g, 4, 4, w - 8, h - 14, P.steelDark, { r: 3 });
  glassPanel(g, 7, 7, w - 14, h - 22, P.glass, 0.3);
  // internal jig table
  plate(g, w * 0.2, h * 0.42, w * 0.6, h * 0.28, P.steelMid, { r: 2 });
  g.fillStyle = rgba(P.paintOrange, 0.8); g.fillRect(w * 0.24, h * 0.48, w * 0.52, 2.4);
  // arm mounts (arms drawn at runtime)
  for (const ax of [w * 0.28, w * 0.72]) {
    g.fillStyle = P.steelDark; g.beginPath(); g.arc(ax, h * 0.3, 6, 0, TAU); g.fill();
    g.fillStyle = P.paintOrange; g.beginPath(); g.arc(ax, h * 0.3, 4, 0, TAU); g.fill();
  }
  controlPanel(g, w - 26, h - 26, 20, 14);
  led(g, 10, 10, 2.4, P.uiGood);
  hazard(g, 3, h - 9, w - 6, 6);
  boltFrame(g, 4, 4, w - 8, h - 14, 5, 2);
  grime(g, 0, 0, w, h, 24, 0.7);
}

function paintChemical(g, w, h, rnd) {
  chassis(g, w, h, P.steelLo, 15);
  // three reactor vessels
  for (let i = 0; i < 3; i++) {
    const cx = w * (0.22 + i * 0.28), cy = h * 0.42, r = Math.min(w, h) * 0.13;
    g.fillStyle = P.steelDark; g.beginPath(); g.arc(cx, cy, r + 2, 0, TAU); g.fill();
    const gr = g.createRadialGradient(cx - r * 0.4, cy - r * 0.5, 0, cx, cy, r);
    gr.addColorStop(0, P.steelHi); gr.addColorStop(0.6, P.steel); gr.addColorStop(1, P.steelLo);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    // sight glass showing green fluid
    glassPanel(g, cx - 2.5, cy - r * 0.7, 5, r * 1.4, '#7fd08a', 0.7);
    g.strokeStyle = rgba('#000', 0.45); g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    for (let k = 0; k < 6; k++) bolt(g, cx + Math.cos(k / 6 * TAU) * (r + 1), cy + Math.sin(k / 6 * TAU) * (r + 1), 1.3);
  }
  // manifold piping
  ductPipes(g, 4, h * 0.74, w - 8, 2, P.steel);
  pipe(g, w * 0.22, h * 0.28, w * 0.78, h * 0.28, 5, P.copper);
  // vent stack
  plate(g, w - 16, -12, 10, 22, P.steelMid, { r: 2 });
  sign(g, 6, h * 0.8, 11, 11, P.paintYellow, 'excl');
  gauge(g, w * 0.86, h * 0.5, 5);
  grime(g, 0, 0, w, h, 35, 0.9);
}

function paintPackager(g, w, h, rnd) {
  chassis(g, w, h, P.paintYellow, 19);
  plate(g, 4, 5, w - 8, h * 0.44, P.steelLo, { r: 3 });
  // wrapping tunnel
  g.fillStyle = '#14171b'; rr(g, w * 0.18, h * 0.16, w * 0.64, h * 0.24, 3); g.fill();
  g.fillStyle = rgba(P.glowCold, 0.25); g.fillRect(w * 0.2, h * 0.2, w * 0.6, 2);
  // roller table through the middle
  plate(g, 2, h * 0.56, w - 4, h * 0.24, P.steelMid, { r: 2 });
  for (let x = 6; x < w - 6; x += 7) {
    g.fillStyle = P.steelHi; rr(g, x, h * 0.58, 4.4, h * 0.2, 2); g.fill();
    g.fillStyle = rgba('#000', 0.25); g.fillRect(x, h * 0.58, 1.2, h * 0.2);
  }
  // finished crate at the end
  plate(g, w - 20, h * 0.6, 15, 14, '#a5804a', { r: 1 });
  g.strokeStyle = '#4a3717'; g.lineWidth = 1; g.strokeRect(w - 19.5, h * 0.6 + 0.5, 14, 13);
  controlPanel(g, 6, h * 0.82, 18, 11);
  hazard(g, 3, h - 8, w - 6, 5);
  grime(g, 0, 0, w, h, 41, 0.8);
}

function paintRecycler(g, w, h, rnd) {
  chassis(g, w, h, P.paintGreen, 22);
  // hopper mouth
  g.beginPath(); g.moveTo(w * 0.14, 6); g.lineTo(w * 0.86, 6);
  g.lineTo(w * 0.66, h * 0.42); g.lineTo(w * 0.34, h * 0.42); g.closePath();
  vgrad(g, 0, 6, w, h * 0.4, [[0, P.steelMid], [1, P.steelDark]]); g.fill();
  g.strokeStyle = rgba('#000', 0.6); g.lineWidth = 1.2; g.stroke();
  // shredder teeth
  g.fillStyle = P.steelHi;
  for (let i = 0; i < 7; i++) {
    const x = w * 0.36 + i * (w * 0.28 / 6);
    g.beginPath(); g.moveTo(x, h * 0.42); g.lineTo(x + 2.6, h * 0.42); g.lineTo(x + 1.3, h * 0.5); g.closePath(); g.fill();
  }
  plate(g, 4, h * 0.56, w - 8, h * 0.3, P.steelLo, { r: 2 });
  // recycling arrows emblem
  g.strokeStyle = rgba('#dff0df', 0.85); g.lineWidth = 2.2;
  const cx = w * 0.5, cy = h * 0.7, r = Math.min(w, h) * 0.1;
  for (let i = 0; i < 3; i++) {
    const a0 = i / 3 * TAU - 0.4, a1 = a0 + 1.4;
    g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
  }
  gauge(g, w - 12, h * 0.7, 4.5);
  hazard(g, 3, h - 8, w - 6, 5);
  grime(g, 0, 0, w, h, 48, 0.9);
}

function paintRobotics(g, w, h, rnd) {
  chassis(g, w, h, '#2f3a46', 28);
  plate(g, 4, 4, w - 8, h - 14, '#1d2630', { r: 4 });
  // glowing floor grid inside the cell
  g.save(); rr(g, 6, 6, w - 12, h - 18, 3); g.clip();
  g.fillStyle = '#101820'; g.fillRect(6, 6, w - 12, h - 18);
  g.strokeStyle = rgba(P.glowCold, 0.3); g.lineWidth = 1;
  for (let x = 6; x < w; x += 10) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h - 12); g.stroke(); }
  for (let y = 6; y < h - 12; y += 10) { g.beginPath(); g.moveTo(6, y); g.lineTo(w - 6, y); g.stroke(); }
  g.restore();
  // arm bases
  for (const [ax, ay] of [[w * 0.26, h * 0.3], [w * 0.74, h * 0.3], [w * 0.5, h * 0.7]]) {
    g.fillStyle = P.steelDark; g.beginPath(); g.arc(ax, ay, 7.5, 0, TAU); g.fill();
    g.fillStyle = P.paintOrange; g.beginPath(); g.arc(ax, ay, 5, 0, TAU); g.fill();
    g.fillStyle = rgba('#fff', 0.25); g.beginPath(); g.arc(ax - 1.4, ay - 1.6, 2, 0, TAU); g.fill();
  }
  // status column
  plate(g, w - 14, 8, 9, h * 0.4, P.steelLo, { r: 2 });
  led(g, w - 9.5, 14, 2, P.uiGood); led(g, w - 9.5, 21, 2, P.glowCold); led(g, w - 9.5, 28, 2, P.uiWarn);
  glassPanel(g, 8, h - 26, w * 0.3, 14, P.glowCold, 0.75);
  boltFrame(g, 4, 4, w - 8, h - 14, 6, 2.2);
}

// ---- power ----------------------------------------------------------------
function paintCoalGen(g, w, h, rnd) {
  chassis(g, w, h, P.ironLo, 31);
  // boiler drum lying horizontally
  const by = h * 0.42, bh = h * 0.4;
  vgrad(g, 5, by - bh / 2, w - 26, bh, [[0, P.steelHi], [0.3, P.steel], [1, P.steelDark]]);
  rr(g, 5, by - bh / 2, w - 26, bh, bh / 2); g.fill();
  g.strokeStyle = rgba('#000', 0.55); g.lineWidth = 1.2; g.stroke();
  for (let i = 1; i < 4; i++) { g.strokeStyle = rgba('#000', 0.3); g.lineWidth = 1.6;
    const x = 5 + (w - 26) * i / 4; g.beginPath(); g.moveTo(x, by - bh / 2); g.lineTo(x, by + bh / 2); g.stroke(); }
  // firebox with grate
  plate(g, 8, by + bh / 2 - 2, 20, 12, '#3a2a20', { r: 2 });
  g.fillStyle = '#120a06'; g.fillRect(10, by + bh / 2, 16, 8);
  for (let i = 0; i < 4; i++) { g.fillStyle = P.ironDark; g.fillRect(11 + i * 4, by + bh / 2, 1.6, 8); }
  // chimney + generator head
  plate(g, w - 20, -14, 14, 30, P.iron, { r: 2 });
  g.fillStyle = '#14140f'; g.beginPath(); g.ellipse(w - 13, -13, 7, 2.8, 0, 0, TAU); g.fill();
  plate(g, w - 22, h * 0.55, 18, h * 0.3, P.copperLo, { r: 2 });
  for (let i = 0; i < 5; i++) { g.fillStyle = rgba(P.copperHi, 0.7); g.fillRect(w - 21, h * 0.57 + i * 3, 16, 1.4); }
  gauge(g, 14, h * 0.2, 5.5);
  led(g, w - 30, h * 0.2, 2.2, P.uiGood);
  hazard(g, 3, h - 8, w - 6, 5);
  grime(g, 0, 0, w, h, 52, 1.2);
}

function paintSolar(g, w, h, rnd) {
  g.fillStyle = rgba('#0a0c0f', 0.35); rr(g, 3, h - 7, w - 6, 6, 2); g.fill();
  // frame
  plate(g, 1, 1, w - 2, h - 6, P.steelMid, { r: 2 });
  // photovoltaic cells
  const pad = 4, cw = (w - pad * 2) / 4, ch = (h - 6 - pad * 2) / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const px = pad + x * cw, py = pad + y * ch;
    const gr = g.createLinearGradient(px, py, px + cw, py + ch);
    gr.addColorStop(0, '#2b3f6e'); gr.addColorStop(0.5, '#1b2a4e'); gr.addColorStop(1, '#33507f');
    g.fillStyle = gr; g.fillRect(px + 0.6, py + 0.6, cw - 1.2, ch - 1.2);
    g.strokeStyle = rgba('#8fb4e0', 0.35); g.lineWidth = 0.6;
    g.strokeRect(px + 0.6, py + 0.6, cw - 1.2, ch - 1.2);
    g.strokeStyle = rgba('#cfe2f5', 0.22);
    g.beginPath(); g.moveTo(px + cw * 0.5, py); g.lineTo(px + cw * 0.5, py + ch); g.stroke();
  }
  // specular sweep
  g.save(); rr(g, 1, 1, w - 2, h - 6, 2); g.clip();
  g.fillStyle = rgba('#ffffff', 0.12);
  g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.78, 0); g.lineTo(w * 0.2, h); g.closePath(); g.fill();
  g.restore();
  boltFrame(g, 1, 1, w - 2, h - 6, 4, 1.8);
  led(g, w - 5, h - 4, 1.8, P.uiGood);
}

function paintTurbine(g, w, h, rnd) {
  chassis(g, w, h, P.steelLo, 37);
  // turbine hall casing
  const cy = h * 0.44, ch = h * 0.42;
  vgrad(g, 6, cy - ch / 2, w - 12, ch, [[0, P.steelHi], [0.28, P.steel], [1, P.steelDark]]);
  rr(g, 6, cy - ch / 2, w - 12, ch, 8); g.fill();
  g.strokeStyle = rgba('#000', 0.6); g.lineWidth = 1.3; g.stroke();
  // split-casing bolt line
  g.fillStyle = rgba('#000', 0.3); g.fillRect(6, cy - 1.2, w - 12, 2.4);
  for (let i = 0; i < 8; i++) bolt(g, 10 + i * (w - 20) / 7, cy, 1.6, P.brass);
  // rotor end (spins at runtime)
  g.fillStyle = P.steelDark; g.beginPath(); g.arc(w * 0.2, cy, 9, 0, TAU); g.fill();
  // steam pipework
  pipe(g, 4, h * 0.82, w - 4, h * 0.82, 8, P.steel);
  pipe(g, w * 0.75, h * 0.82, w * 0.75, cy + ch / 2, 8, P.steel);
  plate(g, w - 22, -12, 14, 24, P.steelMid, { r: 2 });
  gauge(g, 14, h * 0.18, 6); gauge(g, 28, h * 0.18, 4.5);
  controlPanel(g, w - 34, h * 0.12, 22, 14);
  hazard(g, 3, h - 8, w - 6, 5);
  grime(g, 0, 0, w, h, 58, 0.8);
}

function paintFusion(g, w, h, rnd) {
  chassis(g, w, h, '#243040', 44);
  plate(g, 4, 4, w - 8, h - 14, '#16202c', { r: 6 });
  // torus containment ring
  const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.3;
  g.strokeStyle = P.steelMid; g.lineWidth = 10;
  g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
  g.strokeStyle = P.steelHi; g.lineWidth = 3;
  g.beginPath(); g.arc(cx, cy, R - 3, 0, TAU); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    plate(g, cx + Math.cos(a) * R - 4, cy + Math.sin(a) * R - 4, 8, 8, P.steelLo, { r: 1 });
  }
  // plasma core glow (pulses at runtime)
  glow(g, cx, cy, R * 0.9, P.glowCold, 0.75);
  g.fillStyle = rgba('#ffffff', 0.8); g.beginPath(); g.arc(cx, cy, R * 0.22, 0, TAU); g.fill();
  // cryo lines
  for (const a of [0.4, 2.0, 3.6, 5.2]) pipe(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 16), 6, P.steel);
  glassPanel(g, 8, h - 26, w * 0.26, 14, P.glowCold, 0.8);
  boltFrame(g, 4, 4, w - 8, h - 14, 7, 2.4);
}

function paintLamp(g, w, h) {
  g.fillStyle = rgba('#0a0c0f', 0.3); g.beginPath(); g.ellipse(w / 2, h - 4, 7, 3, 0, 0, TAU); g.fill();
  g.fillStyle = P.steelDark; rr(g, w / 2 - 5, h - 8, 10, 5, 2); g.fill();
  vgrad(g, w / 2 - 2, h - 26, 4, 20, [[0, P.steel], [1, P.steelDark]]); g.fillRect(w / 2 - 2, h - 26, 4, 20);
  // shade
  g.beginPath(); g.moveTo(w / 2 - 10, h - 26); g.lineTo(w / 2 + 10, h - 26);
  g.lineTo(w / 2 + 6, h - 33); g.lineTo(w / 2 - 6, h - 33); g.closePath();
  vgrad(g, 0, h - 33, w, 8, [[0, P.paintGreen], [1, P.paintGreenLo]]); g.fill();
  g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 1; g.stroke();
  g.fillStyle = rgba(P.glowWarm, 0.9); rr(g, w / 2 - 8, h - 27, 16, 2.6, 1.2); g.fill();
}

// ---- structures -----------------------------------------------------------
function paintFloor(g, w, h, rnd) {
  g.fillStyle = P.concrete; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = rgba(rnd() > 0.5 ? P.concreteHi : P.concreteLo, 0.35);
    g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 1.6, 1.2, rnd() * TAU, 0, TAU); g.fill();
  }
  g.strokeStyle = rgba('#3d3b36', 0.6); g.lineWidth = 1.6;
  g.strokeRect(0.8, 0.8, w - 1.6, h - 1.6);
  g.strokeStyle = rgba('#ffffff', 0.10); g.lineWidth = 1;
  g.strokeRect(2.4, 2.4, w - 4.8, h - 4.8);
}

function paintWall(g, w, h) {
  plate(g, 0, -10, w, h + 10, P.steelMid, { r: 1 });
  for (let x = 2; x < w; x += 6) {
    g.fillStyle = rgba('#000', 0.24); g.fillRect(x, -10, 2.6, h + 10);
    g.fillStyle = rgba('#fff', 0.1); g.fillRect(x + 2.6, -10, 1.2, h + 10);
  }
  g.fillStyle = rgba('#0c0e11', 0.6); g.fillRect(0, h - 5, w, 5);
  g.fillStyle = P.steelDark; g.fillRect(0, -10, w, 3);
  grime(g, 0, 0, w, h, 71, 0.9);
}

function paintDoor(g, w, h) {
  plate(g, 0, -10, w, h + 10, P.steelLo, { r: 1 });
  for (let i = 0; i < 8; i++) {
    g.fillStyle = rgba('#000', 0.22); g.fillRect(1, -9 + i * 5, w - 2, 2);
    g.fillStyle = rgba('#fff', 0.09); g.fillRect(1, -7 + i * 5, w - 2, 1);
  }
  hazard(g, 0, h - 7, w, 6, P.paintYellow, P.steelDark, 5);
  g.fillStyle = P.steelHi; rr(g, w / 2 - 5, h - 14, 10, 3, 1.4); g.fill();
  led(g, w - 4, -6, 1.6, P.uiGood);
}

function paintWindow(g, w, h) {
  plate(g, 0, -10, w, h + 10, P.steelMid, { r: 1 });
  glassPanel(g, 3, -7, w - 6, h + 3, P.glass, 0.45);
  g.strokeStyle = P.steelDark; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(w / 2, -7); g.lineTo(w / 2, h - 4); g.moveTo(3, (h - 10) / 2); g.lineTo(w - 3, (h - 10) / 2); g.stroke();
  grime(g, 0, 0, w, h, 73, 0.6);
}

function paintOffice(g, w, h, rnd) {
  g.fillStyle = P.concreteLo; rr(g, 0, 2, w, h - 2, 4); g.fill();
  plate(g, 0, -HEAD + 2, w, h + HEAD - 6, '#7a8592', { r: 5 });
  // glazed curtain wall
  for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++)
    glassPanel(g, 8 + x * ((w - 16) / 4), -HEAD + 8 + y * 16, (w - 16) / 4 - 4, 12, rnd() < 0.5 ? P.glowWarm : P.glass, rnd() < 0.5 ? 0.8 : 0.4);
  plate(g, w * 0.34, h - 20, w * 0.32, 18, '#4a5560', { r: 2 });
  glassPanel(g, w * 0.36, h - 17, w * 0.28, 12, P.glowWarm, 0.85);
  engraved(g, 'OFFICE', w / 2, -2, 'bold 10px sans-serif', rgba('#e8e2d4', 0.8), 'center');
  boltFrame(g, 0, -HEAD + 2, w, h + HEAD - 6, 6, 2);
}

function paintBreakroom(g, w, h, rnd) {
  g.fillStyle = P.concreteLo; rr(g, 0, 2, w, h - 2, 4); g.fill();
  plate(g, 0, -HEAD + 4, w, h + HEAD - 8, '#9a7b58', { r: 4 });
  for (let x = 4; x < w; x += 8) { g.fillStyle = rgba('#000', 0.14); g.fillRect(x, -HEAD + 4, 2, h + HEAD); }
  glassPanel(g, 8, h - 30, w * 0.3, 16, P.glowWarm, 0.85);
  glassPanel(g, w * 0.58, h - 30, w * 0.3, 16, P.glowWarm, 0.85);
  plate(g, w * 0.4, h - 18, w * 0.2, 16, '#5d4a33', { r: 2 });
  // coffee cup sign
  g.fillStyle = '#e8e2d4'; rr(g, w - 22, -12, 10, 9, 2); g.fill();
  g.strokeStyle = '#e8e2d4'; g.lineWidth = 1.4;
  g.beginPath(); g.arc(w - 11, -7.5, 3, -1, 1.4); g.stroke();
  glow(g, w / 2, h - 22, 22, P.glowWarm, 0.25);
}

function paintLab(g, w, h, rnd) {
  g.fillStyle = P.concreteLo; rr(g, 0, 2, w, h - 2, 4); g.fill();
  plate(g, 0, -HEAD + 2, w, h + HEAD - 6, '#d5dae0', { r: 5 });
  // clean-room glazing and a big glowing dome
  glassPanel(g, 6, -HEAD + 8, w - 12, 18, P.glowCold, 0.6);
  const cx = w / 2, cy = h * 0.5;
  g.fillStyle = P.steelMid; g.beginPath(); g.arc(cx, cy, 15, Math.PI, TAU); g.fill();
  glow(g, cx, cy - 4, 20, P.glowCold, 0.5);
  g.fillStyle = rgba(P.glowCold, 0.7); g.beginPath(); g.arc(cx, cy - 3, 8, Math.PI, TAU); g.fill();
  // benches with apparatus
  plate(g, 5, h - 26, w * 0.3, 12, '#b8bec5', { r: 1 });
  plate(g, w * 0.64, h - 26, w * 0.3, 12, '#b8bec5', { r: 1 });
  for (let i = 0; i < 4; i++) {
    g.fillStyle = rgba(['#7fd08a', '#8fd4e8', P.paintYellow, '#d48ad4'][i], 0.85);
    rr(g, 8 + i * 6, h - 24, 3.4, 7, 1.4); g.fill();
  }
  engraved(g, 'R & D', w / 2, -2, 'bold 10px sans-serif', rgba('#2b313a', 0.85), 'center');
  boltFrame(g, 0, -HEAD + 2, w, h + HEAD - 6, 6, 2);
}

function paintMaintenance(g, w, h, rnd) {
  chassis(g, w, h, P.paintOrangeLo, 63);
  plate(g, 3, -12, w - 6, h - 2, '#8a5a2a', { r: 3 });
  // open bay with a tool wall
  g.fillStyle = '#1a1d21'; rr(g, 8, h - 26, w - 16, 22, 2); g.fill();
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = P.steelHi; g.lineWidth = 1.6;
    const x = 12 + i * ((w - 26) / 5);
    g.beginPath(); g.moveTo(x, h - 22); g.lineTo(x, h - 12); g.stroke();
    g.fillStyle = P.steelMid; g.beginPath(); g.arc(x, h - 11, 2.4, 0, TAU); g.fill();
  }
  sign(g, w - 20, -8, 14, 14, P.paintYellow, 'bolt');
  hazard(g, 3, h - 7, w - 6, 5);
  grime(g, 0, 0, w, h, 81, 1.1);
}

const PAINT = {
  belt: (g, w, h, r, d, def) => paintBelt(g, w, h, r, d, def, false),
  belt_fast: (g, w, h, r, d, def) => paintBelt(g, w, h, r, d, def, true),
  pipe: paintPipe,
  cable: paintCable,
  chest: paintChest,
  warehouse: paintWarehouse,
  dock: paintDock,
  miner: (g, w, h, r, d, def) => paintMiner(g, w, h, r, d, def, false),
  miner_adv: (g, w, h, r, d, def) => paintMiner(g, w, h, r, d, def, true),
  waterpump: paintWaterPump,
  furnace: paintFurnace,
  press: paintPress,
  cutter: paintCutter,
  assembler: paintAssembler,
  chemical: paintChemical,
  packager: paintPackager,
  recycler: paintRecycler,
  robotics: paintRobotics,
  coal_gen: paintCoalGen,
  solar: paintSolar,
  turbine: paintTurbine,
  fusion: paintFusion,
  lamp: paintLamp,
  floor: paintFloor,
  wall: paintWall,
  door: paintDoor,
  window: paintWindow,
  office: paintOffice,
  breakroom: paintBreakroom,
  lab: paintLab,
  maintenance: paintMaintenance,
};
