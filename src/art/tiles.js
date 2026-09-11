// Terrain tileset. Each terrain has several painted variants so large areas never tile
// visibly. Everything is generated once at boot into offscreen canvases.

import { makeCanvas, noiseOverlay } from './draw.js';
import { P, rgba, shade, mix } from './palette.js';
import { mulberry32 } from '../core/rng.js';
import { TILE, T } from '../world/world.js';
import { TAU } from '../core/utils.js';

const VARIANTS = 4;

function speckle(g, rnd, n, colors, size = 1.6, alpha = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * TILE, y = rnd() * TILE;
    g.fillStyle = rgba(colors[(rnd() * colors.length) | 0], 0.25 + rnd() * alpha);
    g.beginPath(); g.ellipse(x, y, size * (0.5 + rnd()), size * (0.4 + rnd() * 0.8), rnd() * TAU, 0, TAU); g.fill();
  }
}

function paintGrass(g, rnd, dark) {
  const base = dark ? P.grassLo : P.grass;
  g.fillStyle = base; g.fillRect(0, 0, TILE, TILE);
  speckle(g, rnd, 26, [P.grassHi, P.grassLo, mix(base, P.dirt, 0.35)], 2.4, 0.35);
  // blades
  for (let i = 0; i < 42; i++) {
    const x = rnd() * TILE, y = rnd() * TILE, h = 2 + rnd() * 4;
    g.strokeStyle = rgba(rnd() > 0.45 ? P.grassHi : P.grassLo, 0.35 + rnd() * 0.45);
    g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - 0.5) * 2, y - h * 0.6, x + (rnd() - 0.5) * 4, y - h); g.stroke();
  }
}

function paintDirt(g, rnd) {
  g.fillStyle = P.dirt; g.fillRect(0, 0, TILE, TILE);
  speckle(g, rnd, 40, [P.dirtHi, P.dirtLo, '#6b5436'], 2.2, 0.4);
  for (let i = 0; i < 7; i++) {           // small pebbles with a lit top
    const x = rnd() * TILE, y = rnd() * TILE, r = 0.9 + rnd() * 1.6;
    g.fillStyle = rgba(P.rockLo, 0.8); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = rgba(P.rockHi, 0.55); g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, TAU); g.fill();
  }
}

function paintRock(g, rnd) {
  g.fillStyle = P.rock; g.fillRect(0, 0, TILE, TILE);
  // faceted stone plates
  for (let i = 0; i < 6; i++) {
    const cx = rnd() * TILE, cy = rnd() * TILE, r = 5 + rnd() * 9;
    g.beginPath();
    const pts = 5 + ((rnd() * 3) | 0);
    for (let k = 0; k <= pts; k++) {
      const a = (k / pts) * TAU, rr = r * (0.65 + rnd() * 0.5);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fillStyle = rgba(rnd() > 0.5 ? P.rockHi : P.rockLo, 0.55); g.fill();
    g.strokeStyle = rgba('#000', 0.28); g.lineWidth = 0.8; g.stroke();
  }
  speckle(g, rnd, 24, [P.rockHi, P.rockLo, '#55524c'], 1.4, 0.4);
}

function paintGravel(g, rnd) {
  g.fillStyle = mix(P.rockLo, P.dirt, 0.35); g.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 58; i++) {
    const x = rnd() * TILE, y = rnd() * TILE, r = 0.8 + rnd() * 2.1;
    const c = [P.rock, P.rockHi, P.rockLo, P.dirtLo][(rnd() * 4) | 0];
    g.fillStyle = rgba(c, 0.9); g.beginPath(); g.ellipse(x, y, r, r * 0.82, rnd() * TAU, 0, TAU); g.fill();
    g.fillStyle = rgba('#ffffff', 0.14); g.beginPath(); g.arc(x - r * 0.3, y - r * 0.32, r * 0.45, 0, TAU); g.fill();
  }
}

function paintSand(g, rnd) {
  g.fillStyle = P.sand; g.fillRect(0, 0, TILE, TILE);
  speckle(g, rnd, 46, ['#d8c08a', '#a98f5c'], 1.5, 0.35);
  for (let i = 0; i < 4; i++) {           // ripples
    const y = rnd() * TILE;
    g.strokeStyle = rgba('#8d7345', 0.3); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= TILE; x += 6) g.lineTo(x, y + Math.sin(x / 5 + i) * 1.6);
    g.stroke();
  }
}

function paintWater(g, rnd, deep) {
  const base = deep ? P.waterDeep : P.water;
  const gr = g.createLinearGradient(0, 0, TILE, TILE);
  gr.addColorStop(0, shade(base, 0.08)); gr.addColorStop(1, shade(base, -0.12));
  g.fillStyle = gr; g.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 5; i++) {
    const y = rnd() * TILE;
    g.strokeStyle = rgba(P.waterHi, 0.14 + rnd() * 0.18); g.lineWidth = 0.8 + rnd();
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= TILE; x += 4) g.lineTo(x, y + Math.sin(x / 4 + i * 2) * 1.3);
    g.stroke();
  }
  if (!deep) speckle(g, rnd, 8, [P.waterHi, '#8fd0e0'], 1.2, 0.2);
}

function paintRoad(g, rnd) {
  g.fillStyle = P.road; g.fillRect(0, 0, TILE, TILE);
  speckle(g, rnd, 70, [P.roadHi, '#37352f', '#6a665f'], 1.2, 0.3);
  // cracks
  for (let i = 0; i < 2; i++) {
    g.strokeStyle = rgba('#23221f', 0.5); g.lineWidth = 0.9;
    let x = rnd() * TILE, y = rnd() * TILE;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 12; y += (rnd() - 0.5) * 12; g.lineTo(x, y); }
    g.stroke();
  }
}

function paintConcrete(g, rnd) {
  g.fillStyle = P.concrete; g.fillRect(0, 0, TILE, TILE);
  speckle(g, rnd, 40, [P.concreteHi, P.concreteLo], 1.6, 0.22);
  // expansion joints along two edges
  g.strokeStyle = rgba('#3d3b36', 0.55); g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(0, 0.8); g.lineTo(TILE, 0.8); g.moveTo(0.8, 0); g.lineTo(0.8, TILE); g.stroke();
  g.strokeStyle = rgba('#ffffff', 0.10); g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 2.2); g.lineTo(TILE, 2.2); g.moveTo(2.2, 0); g.lineTo(2.2, TILE); g.stroke();
  // oil stain
  if (rnd() < 0.4) {
    const x = rnd() * TILE, y = rnd() * TILE, r = 4 + rnd() * 7;
    const s = g.createRadialGradient(x, y, 0, x, y, r);
    s.addColorStop(0, 'rgba(24,22,20,0.35)'); s.addColorStop(1, 'rgba(24,22,20,0)');
    g.fillStyle = s; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
}

function paintForest(g, rnd) {
  paintGrass(g, rnd, true);
  g.fillStyle = rgba(P.treeLo, 0.25); g.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 10; i++) {          // leaf litter
    const x = rnd() * TILE, y = rnd() * TILE;
    g.fillStyle = rgba(rnd() > 0.5 ? '#6b5a2e' : P.treeLo, 0.5);
    g.beginPath(); g.ellipse(x, y, 1.8 + rnd(), 1.1, rnd() * TAU, 0, TAU); g.fill();
  }
}

const PAINTERS = {
  [T.GRASS]: (g, r) => paintGrass(g, r, false),
  [T.DIRT]: paintDirt,
  [T.ROCK]: paintRock,
  [T.GRAVEL]: paintGravel,
  [T.SAND]: paintSand,
  [T.WATER]: (g, r) => paintWater(g, r, false),
  [T.DEEP]: (g, r) => paintWater(g, r, true),
  [T.ROAD]: paintRoad,
  [T.CONCRETE]: paintConcrete,
  [T.FOREST]: paintForest,
};

export const TILE_AVG = {
  [T.GRASS]: P.grass, [T.DIRT]: P.dirt, [T.ROCK]: P.rock, [T.GRAVEL]: mix(P.rockLo, P.dirt, 0.35),
  [T.SAND]: P.sand, [T.WATER]: P.water, [T.DEEP]: P.waterDeep, [T.ROAD]: P.road,
  [T.CONCRETE]: P.concrete, [T.FOREST]: P.grassLo,
};

export function buildTileset() {
  const set = {};
  for (const key of Object.keys(PAINTERS)) {
    set[key] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const { c, g } = makeCanvas(TILE, TILE);
      const rnd = mulberry32(1000 + Number(key) * 97 + v * 13);
      PAINTERS[key](g, rnd);
      noiseOverlay(g, 0, 0, TILE, TILE, 40 + v, 0.045);
      set[key].push(c);
    }
  }
  return set;
}

/** Ore overlay drawn on top of terrain where a deposit exists. */
export function buildOreOverlays() {
  const out = {};
  const spec = {
    iron_ore: ['#8d7b68', '#c0a98c', '#e3d3b8'],
    copper_ore: ['#7d4d24', P.copper, P.copperHi],
    coal: ['#22222a', '#3a3a46', '#5c5c6c'],
    stone: ['#6f6d69', '#8f8d88', '#adaba6'],
    sand: ['#a68f5d', P.sand, '#ddc794'],
  };
  for (const [id, cols] of Object.entries(spec)) {
    out[id] = [];
    for (let v = 0; v < 3; v++) {
      const { c, g } = makeCanvas(TILE, TILE);
      const rnd = mulberry32(7700 + v * 31 + id.length * 17);
      for (let i = 0; i < 16; i++) {
        const x = 3 + rnd() * (TILE - 6), y = 3 + rnd() * (TILE - 6), r = 1.6 + rnd() * 3.4;
        g.beginPath();
        const pts = 5 + ((rnd() * 3) | 0);
        for (let k = 0; k <= pts; k++) {
          const a = (k / pts) * TAU, rr = r * (0.7 + rnd() * 0.5);
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
          k ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath();
        g.fillStyle = cols[0]; g.fill();
        g.strokeStyle = rgba('#000', 0.4); g.lineWidth = 0.7; g.stroke();
        g.fillStyle = rgba(cols[1], 0.9);
        g.beginPath(); g.arc(x - r * 0.2, y - r * 0.25, r * 0.5, 0, TAU); g.fill();
        g.fillStyle = rgba(cols[2], 0.85);
        g.beginPath(); g.arc(x - r * 0.35, y - r * 0.4, r * 0.22, 0, TAU); g.fill();
      }
      out[id].push(c);
    }
  }
  return out;
}
