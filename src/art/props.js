// World props: vegetation, rocks, city architecture, port furniture. Each is painted
// once per variant into a cached canvas with its own shadow and depth shading.

import { makeCanvas, rr, plate, brushed, grime, bolt, boltFrame, vgrad, hgrad,
         glassPanel, hazard, glow, led, dropShadow, engraved, noiseOverlay, vents } from './draw.js';
import { P, rgba, shade, mix } from './palette.js';
import { mulberry32 } from '../core/rng.js';
import { TAU } from '../core/utils.js';

const TS = 32;

/** type -> { w, h, ox, oy, paint(g, rnd, def) }  sizes in pixels, ox/oy = anchor offset */
export const PROPS = {
  tree: { w: 72, h: 92, ox: 36, oy: 80, paint: paintTree },
  bush: { w: 40, h: 34, ox: 20, oy: 28, paint: paintBush },
  boulder: { w: 46, h: 40, ox: 23, oy: 32, paint: paintBoulder },
  rubble: { w: 34, h: 22, ox: 17, oy: 16, paint: paintRubble },
  reed: { w: 26, h: 34, ox: 13, oy: 30, paint: paintReed },
  grasstuft: { w: 24, h: 20, ox: 12, oy: 16, paint: paintTuft },
  barrel: { w: 26, h: 34, ox: 13, oy: 28, paint: paintBarrel },
  pallet: { w: 40, h: 30, ox: 20, oy: 22, paint: paintPallet },
  container: { w: 76, h: 52, ox: 38, oy: 42, paint: paintContainer },
  streetlight: { w: 26, h: 78, ox: 13, oy: 72, paint: paintStreetlight },
  roadsign: { w: 34, h: 46, ox: 17, oy: 42, paint: paintRoadSign },
  signboard: { w: 120, h: 62, ox: 60, oy: 54, paint: paintSignboard },
  minecart: { w: 44, h: 36, ox: 22, oy: 28, paint: paintMinecart },
  crane: { w: 130, h: 150, ox: 65, oy: 132, paint: paintCrane },
  ship: { w: 240, h: 130, ox: 120, oy: 100, paint: paintShip },
  mine_entrance: { w: 110, h: 92, ox: 55, oy: 78, paint: paintMineEntrance },
  shop: { w: 160, h: 150, ox: 80, oy: 128, paint: (g, r, d) => paintCityBuilding(g, r, d, 'shop') },
  apartment: { w: 150, h: 178, ox: 75, oy: 154, paint: (g, r, d) => paintCityBuilding(g, r, d, 'apartment') },
  office_bldg: { w: 170, h: 196, ox: 85, oy: 170, paint: (g, r, d) => paintCityBuilding(g, r, d, 'office') },
  factory_bldg: { w: 220, h: 170, ox: 110, oy: 146, paint: (g, r, d) => paintCityBuilding(g, r, d, 'factory') },
  warehouse_bldg: { w: 200, h: 150, ox: 100, oy: 128, paint: (g, r, d) => paintCityBuilding(g, r, d, 'warehouse') },
  fence: { w: 32, h: 34, ox: 16, oy: 28, paint: paintFence },
};

const cache = new Map();

export function propSprite(type, seed = 0) {
  const def = PROPS[type];
  if (!def) return null;
  const v = Math.abs(seed) % 3;
  const key = type + ':' + v;
  if (cache.has(key)) return cache.get(key);
  const { c, g } = makeCanvas(def.w, def.h);
  const rnd = mulberry32(9001 + v * 7919 + type.length * 131 + type.charCodeAt(0) * 37);
  dropShadow(g, def.ox - def.w * 0.28, def.oy - 7, def.w * 0.56, 16, 0.34);
  def.paint(g, rnd, def);
  noiseOverlay(g, 0, 0, def.w, def.h, 31 + v, 0.035);
  const spr = { canvas: c, ox: def.ox, oy: def.oy, w: def.w, h: def.h };
  cache.set(key, spr);
  return spr;
}

// ------------------------------------------------------------------ vegetation

function paintTree(g, rnd, d) {
  const trunkX = d.ox, baseY = d.oy;
  // trunk with bark grooves
  g.beginPath();
  g.moveTo(trunkX - 5, baseY);
  g.bezierCurveTo(trunkX - 6, baseY - 18, trunkX - 4, baseY - 34, trunkX - 3.5, baseY - 46);
  g.lineTo(trunkX + 3.5, baseY - 46);
  g.bezierCurveTo(trunkX + 4.5, baseY - 32, trunkX + 6, baseY - 16, trunkX + 5.5, baseY);
  g.closePath();
  const tg = g.createLinearGradient(trunkX - 6, 0, trunkX + 6, 0);
  tg.addColorStop(0, '#3d2c1c'); tg.addColorStop(0.45, '#6b4c2c'); tg.addColorStop(1, '#2e2115');
  g.fillStyle = tg; g.fill();
  for (let i = 0; i < 9; i++) {
    g.strokeStyle = rgba('#20160d', 0.4); g.lineWidth = 0.8;
    const x = trunkX - 4 + rnd() * 8;
    g.beginPath(); g.moveTo(x, baseY - rnd() * 10); g.lineTo(x + (rnd() - 0.5) * 2, baseY - 20 - rnd() * 22); g.stroke();
  }
  // roots
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = '#3d2c1c'; g.lineWidth = 2.4;
    const a = Math.PI + (i / 3) * Math.PI;
    g.beginPath(); g.moveTo(trunkX, baseY - 2);
    g.quadraticCurveTo(trunkX + Math.cos(a) * 8, baseY + 1, trunkX + Math.cos(a) * 13, baseY + 3);
    g.stroke();
  }
  // canopy: clustered blobs, lit from upper-left
  const clusters = [];
  for (let i = 0; i < 13; i++) {
    const a = rnd() * TAU, r = rnd() * 22;
    clusters.push({ x: trunkX + Math.cos(a) * r * 1.15, y: baseY - 52 - Math.sin(a) * r * 0.75, r: 11 + rnd() * 10 });
  }
  for (const c of clusters) {
    g.fillStyle = P.treeLo; g.beginPath(); g.arc(c.x, c.y + 2, c.r, 0, TAU); g.fill();
  }
  for (const c of clusters) {
    const gr = g.createRadialGradient(c.x - c.r * 0.35, c.y - c.r * 0.4, c.r * 0.1, c.x, c.y, c.r);
    gr.addColorStop(0, P.treeHi); gr.addColorStop(0.6, P.tree); gr.addColorStop(1, P.treeLo);
    g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, c.r * 0.94, 0, TAU); g.fill();
  }
  // leaf speckle
  for (let i = 0; i < 90; i++) {
    const c = clusters[(rnd() * clusters.length) | 0];
    const a = rnd() * TAU, r = rnd() * c.r * 0.9;
    g.fillStyle = rgba(rnd() > 0.5 ? '#7fae5c' : P.treeLo, 0.5);
    g.beginPath(); g.ellipse(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 1.6, 1.1, rnd() * TAU, 0, TAU); g.fill();
  }
}

function paintBush(g, rnd, d) {
  for (let i = 0; i < 7; i++) {
    const x = d.ox + (rnd() - 0.5) * 22, y = d.oy - 4 - rnd() * 12, r = 5 + rnd() * 7;
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r);
    gr.addColorStop(0, P.grassHi); gr.addColorStop(0.65, P.tree); gr.addColorStop(1, P.treeLo);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = rgba(rnd() > 0.5 ? '#86b661' : P.treeLo, 0.55);
    g.beginPath(); g.ellipse(d.ox + (rnd() - 0.5) * 24, d.oy - 4 - rnd() * 16, 1.5, 1, rnd() * TAU, 0, TAU); g.fill();
  }
}

function paintReed(g, rnd, d) {
  for (let i = 0; i < 9; i++) {
    const x = d.ox + (rnd() - 0.5) * 14, h = 12 + rnd() * 18;
    g.strokeStyle = rgba(rnd() > 0.5 ? '#8aa05a' : '#5f7238', 0.9); g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(x, d.oy);
    g.quadraticCurveTo(x + (rnd() - 0.5) * 5, d.oy - h * 0.6, x + (rnd() - 0.5) * 10, d.oy - h); g.stroke();
  }
}

function paintTuft(g, rnd, d) {
  for (let i = 0; i < 12; i++) {
    const x = d.ox + (rnd() - 0.5) * 16, h = 4 + rnd() * 9;
    g.strokeStyle = rgba(rnd() > 0.5 ? P.grassHi : P.grassLo, 0.85); g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, d.oy); g.quadraticCurveTo(x, d.oy - h * 0.7, x + (rnd() - 0.5) * 7, d.oy - h); g.stroke();
  }
}

// ------------------------------------------------------------------ rocks

function paintBoulder(g, rnd, d) {
  const cx = d.ox, cy = d.oy - 8;
  const pts = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, r = 13 + rnd() * 7;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.72]);
  }
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  const gr = g.createLinearGradient(cx - 14, cy - 14, cx + 12, cy + 14);
  gr.addColorStop(0, P.rockHi); gr.addColorStop(0.5, P.rock); gr.addColorStop(1, P.rockLo);
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#1d1c1a', 0.6); g.lineWidth = 1.2; g.stroke();
  for (let i = 0; i < 5; i++) {     // fracture lines
    g.strokeStyle = rgba('#2a2926', 0.45); g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(cx + (rnd() - 0.5) * 20, cy + (rnd() - 0.5) * 14);
    g.lineTo(cx + (rnd() - 0.5) * 20, cy + (rnd() - 0.5) * 14); g.stroke();
  }
  g.fillStyle = rgba('#c9cdc6', 0.16);
  g.beginPath(); g.ellipse(cx - 5, cy - 6, 7, 4, -0.4, 0, TAU); g.fill();
  // moss
  g.fillStyle = rgba(P.grassLo, 0.35);
  g.beginPath(); g.ellipse(cx + 6, cy + 5, 6, 3, 0.2, 0, TAU); g.fill();
}

function paintRubble(g, rnd, d) {
  for (let i = 0; i < 7; i++) {
    const x = d.ox + (rnd() - 0.5) * 26, y = d.oy - rnd() * 8, r = 2 + rnd() * 4;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU, rr = r * (0.7 + rnd() * 0.5);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.75;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
    g.fillStyle = [P.rock, P.rockHi, P.rockLo][(rnd() * 3) | 0]; g.fill();
    g.strokeStyle = rgba('#000', 0.4); g.lineWidth = 0.6; g.stroke();
  }
}

// ------------------------------------------------------------------ industrial props

function paintBarrel(g, rnd, d) {
  const x = d.ox - 10, y = d.oy - 26, w = 20, h = 26;
  const body = rnd() > 0.5 ? P.paintOrange : P.paintBlue;
  hgrad(g, x, y, w, h, [[0, shade(body, -0.4)], [0.3, shade(body, 0.22)], [0.62, body], [1, shade(body, -0.5)]]);
  g.fillRect(x, y, w, h);
  g.fillStyle = shade(body, 0.3);
  g.beginPath(); g.ellipse(x + w / 2, y, w / 2, 3.4, 0, 0, TAU); g.fill();
  g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 1; g.stroke();
  for (const ry of [y + h * 0.24, y + h * 0.72]) {
    g.fillStyle = rgba('#1c1c20', 0.8); g.fillRect(x, ry, w, 2.6);
    g.fillStyle = rgba('#ffffff', 0.12); g.fillRect(x, ry, w, 0.9);
  }
  grime(g, x, y, w, h, 12, 0.9);
  g.strokeStyle = rgba('#000', 0.6); g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function paintPallet(g, rnd, d) {
  const x = d.ox - 17, y = d.oy - 14;
  g.save(); g.translate(x, y);
  for (let i = 0; i < 4; i++) {
    vgrad(g, 0, i * 5, 34, 4, [[0, '#a5804a'], [1, '#6b5027']]); g.fillRect(0, i * 5, 34, 4);
    g.strokeStyle = rgba('#3b2c16', 0.7); g.lineWidth = 0.7; g.strokeRect(0.5, i * 5 + 0.5, 33, 3);
  }
  g.fillStyle = '#4f3c1d'; g.fillRect(0, 0, 3, 19); g.fillRect(31, 0, 3, 19);
  // crate on top
  const cw = 26, ch = 16;
  vgrad(g, 4, -ch, cw, ch, [[0, '#b08a4e'], [1, '#7a5a2c']]); g.fillRect(4, -ch, cw, ch);
  g.strokeStyle = '#4a3717'; g.lineWidth = 1.2; g.strokeRect(4.5, -ch + 0.5, cw - 1, ch - 1);
  g.beginPath(); g.moveTo(4, -ch); g.lineTo(4 + cw, 0); g.moveTo(4 + cw, -ch); g.lineTo(4, 0); g.stroke();
  g.restore();
}

function paintContainer(g, rnd, d) {
  const w = 68, h = 40, x = d.ox - w / 2, y = d.oy - h;
  const col = [P.paintRed, P.paintBlue, P.paintGreen, P.paintOrange][(rnd() * 4) | 0];
  plate(g, x, y, w, h, col, { r: 2 });
  // corrugation
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let i = 2; i < w; i += 5) {
    g.strokeStyle = rgba('#000', 0.22); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x + i, y + 4); g.lineTo(x + i, y + h - 4); g.stroke();
    g.strokeStyle = rgba('#fff', 0.10);
    g.beginPath(); g.moveTo(x + i + 1.6, y + 4); g.lineTo(x + i + 1.6, y + h - 4); g.stroke();
  }
  g.restore();
  g.fillStyle = rgba('#0e0e10', 0.85); g.fillRect(x, y, w, 4); g.fillRect(x, y + h - 4, w, 4);
  g.fillStyle = shade(col, -0.55); g.fillRect(x, y, 4, h); g.fillRect(x + w - 4, y, 4, h);
  engraved(g, 'MRD ' + (1000 + ((rnd() * 8999) | 0)), x + w / 2, y + h * 0.62, 'bold 8px monospace', rgba('#fff', 0.6), 'center');
  grime(g, x, y, w, h, 33, 1);
}

function paintStreetlight(g, rnd, d) {
  const x = d.ox, base = d.oy;
  vgrad(g, x - 3, base - 62, 6, 62, [[0, P.steel], [0.5, P.steelLo], [1, P.steelDark]]);
  g.fillRect(x - 3, base - 62, 6, 62);
  g.fillStyle = P.steelDark; rr(g, x - 7, base - 5, 14, 6, 2); g.fill();
  g.strokeStyle = P.steelLo; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, base - 62); g.quadraticCurveTo(x + 2, base - 72, x + 11, base - 72); g.stroke();
  g.lineCap = 'butt';
  g.fillStyle = P.steelMid; rr(g, x + 6, base - 72, 14, 5, 2); g.fill();
  glow(g, x + 13, base - 66, 13, P.glowWarm, 0.5);
  g.fillStyle = rgba(P.glowWarm, 0.95); rr(g, x + 8, base - 68, 10, 3, 1.5); g.fill();
}

function paintRoadSign(g, rnd, d) {
  const x = d.ox, base = d.oy;
  g.fillStyle = P.steelLo; g.fillRect(x - 1.6, base - 30, 3.2, 30);
  plate(g, x - 14, base - 46, 28, 18, P.paintGreen, { r: 2 });
  engraved(g, 'REDHAVEN', x, base - 34, 'bold 7px sans-serif', '#eef3ee', 'center');
  g.strokeStyle = rgba('#fff', 0.5); g.lineWidth = 0.8; g.strokeRect(x - 11.5, base - 43.5, 23, 13);
}

function paintSignboard(g, rnd, d) {
  const x = d.ox - 52, y = d.oy - 46, w = 104, h = 34;
  g.fillStyle = P.steelDark; g.fillRect(x + 8, y + h, 5, 14); g.fillRect(x + w - 13, y + h, 5, 14);
  plate(g, x, y, w, h, P.steelLo, { r: 3 });
  brushed(g, x, y, w, h, 4);
  hazard(g, x + 3, y + h - 7, w - 6, 5);
  engraved(g, 'IRONWORKS', x + w / 2, y + 20, 'bold 17px Georgia, serif', P.uiTrimHi, 'center');
  engraved(g, 'EST. 2026', x + w / 2, y + 29, '7px sans-serif', P.uiDim, 'center');
  boltFrame(g, x, y, w, h, 5, 2.2);
  grime(g, x, y, w, h, 88, 0.8);
}

function paintMinecart(g, rnd, d) {
  const x = d.ox - 18, y = d.oy - 22, w = 36, h = 20;
  g.fillStyle = P.ironDark;
  g.beginPath(); g.arc(x + 8, y + h + 3, 4.5, 0, TAU); g.fill();
  g.beginPath(); g.arc(x + w - 8, y + h + 3, 4.5, 0, TAU); g.fill();
  g.fillStyle = P.steelMid;
  g.beginPath(); g.arc(x + 8, y + h + 3, 1.8, 0, TAU); g.fill();
  g.beginPath(); g.arc(x + w - 8, y + h + 3, 1.8, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - 4, y + h); g.lineTo(x + 4, y + h); g.closePath();
  vgrad(g, x, y, w, h, [[0, P.iron], [0.4, P.ironLo], [1, P.ironDark]]); g.fill();
  g.strokeStyle = rgba('#000', 0.7); g.lineWidth = 1; g.stroke();
  // ore load
  g.fillStyle = '#3a3a42';
  for (let i = 0; i < 9; i++) {
    g.beginPath(); g.arc(x + 6 + rnd() * (w - 12), y + 1 + rnd() * 3, 2 + rnd() * 2.4, 0, TAU); g.fill();
  }
  grime(g, x, y, w, h, 55, 1.2);
}

function paintCrane(g, rnd, d) {
  const cx = d.ox, base = d.oy;
  // legs
  g.strokeStyle = P.paintOrangeLo; g.lineWidth = 6;
  g.beginPath(); g.moveTo(cx - 34, base); g.lineTo(cx - 12, base - 78);
  g.moveTo(cx + 34, base); g.lineTo(cx + 12, base - 78); g.stroke();
  g.strokeStyle = P.paintOrange; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(cx - 34, base); g.lineTo(cx - 12, base - 78);
  g.moveTo(cx + 34, base); g.lineTo(cx + 12, base - 78); g.stroke();
  // lattice cross-bracing
  g.strokeStyle = rgba(P.paintOrangeHi, 0.8); g.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const t = i / 7, t2 = (i + 1) / 7;
    g.beginPath();
    g.moveTo(cx - 34 + 22 * t, base - 78 * t); g.lineTo(cx + 34 - 22 * t2, base - 78 * t2);
    g.moveTo(cx + 34 - 22 * t, base - 78 * t); g.lineTo(cx - 34 + 22 * t2, base - 78 * t2);
    g.stroke();
  }
  // jib
  plate(g, cx - 52, base - 92, 104, 12, P.paintOrange, { r: 2 });
  hazard(g, cx - 52, base - 82, 104, 4, P.paintYellow, P.steelDark, 5);
  // cab
  plate(g, cx - 16, base - 116, 32, 24, P.steelLo, { r: 3 });
  glassPanel(g, cx - 12, base - 112, 24, 12);
  boltFrame(g, cx - 16, base - 116, 32, 24, 4, 1.8);
  // cable + hook
  g.strokeStyle = '#1b1b1f'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx + 34, base - 86); g.lineTo(cx + 34, base - 44); g.stroke();
  g.strokeStyle = P.steelHi; g.lineWidth = 2.4;
  g.beginPath(); g.arc(cx + 34, base - 40, 4.5, 0.3, Math.PI * 1.5); g.stroke();
}

function paintShip(g, rnd, d) {
  const cx = d.ox, base = d.oy;
  // hull
  g.beginPath();
  g.moveTo(cx - 112, base - 34); g.lineTo(cx + 96, base - 34);
  g.quadraticCurveTo(cx + 122, base - 20, cx + 92, base + 8);
  g.lineTo(cx - 96, base + 8);
  g.quadraticCurveTo(cx - 118, base - 10, cx - 112, base - 34);
  g.closePath();
  vgrad(g, cx - 112, base - 34, 230, 44, [[0, '#8b3d33'], [0.35, '#6d2f27'], [0.55, '#2a2a30'], [1, '#16161a']]);
  g.fill();
  g.strokeStyle = rgba('#000', 0.7); g.lineWidth = 1.4; g.stroke();
  g.fillStyle = rgba('#d8cdbc', 0.9);
  engraved(g, 'MV SALTWIND', cx - 40, base - 16, 'bold 11px Georgia, serif', '#e2d8c6', 'left');
  // deck & superstructure
  plate(g, cx - 104, base - 46, 196, 14, P.steelLo, { r: 2 });
  plate(g, cx + 34, base - 86, 56, 42, '#d8d2c4', { r: 3 });
  for (let i = 0; i < 3; i++)
    for (let k = 0; k < 4; k++) glassPanel(g, cx + 40 + k * 12, base - 80 + i * 12, 9, 7);
  // funnel
  plate(g, cx + 54, base - 108, 16, 24, P.paintRed, { r: 2 });
  g.fillStyle = '#1a1a1e'; g.fillRect(cx + 54, base - 108, 16, 4);
  // containers on deck
  for (let i = 0; i < 8; i++) {
    const col = [P.paintBlue, P.paintGreen, P.paintOrange, P.paintRed][(rnd() * 4) | 0];
    plate(g, cx - 100 + i * 17, base - 62 - (i % 2) * 14, 15, 15, col, { r: 1 });
  }
}

function paintMineEntrance(g, rnd, d) {
  const cx = d.ox, base = d.oy;
  // rock face
  g.beginPath();
  g.moveTo(cx - 50, base + 8);
  g.quadraticCurveTo(cx - 44, base - 60, cx, base - 68);
  g.quadraticCurveTo(cx + 46, base - 60, cx + 50, base + 8);
  g.closePath();
  const gr = g.createLinearGradient(cx - 40, base - 60, cx + 40, base + 8);
  gr.addColorStop(0, P.rockHi); gr.addColorStop(0.5, P.rock); gr.addColorStop(1, P.rockLo);
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#1c1b19', 0.7); g.lineWidth = 1.4; g.stroke();
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = rgba('#2a2926', 0.4); g.lineWidth = 0.9;
    const x = cx - 44 + rnd() * 88, y = base - 60 + rnd() * 60;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16); g.stroke();
  }
  // timbered adit
  g.fillStyle = '#0a0a0c';
  g.beginPath(); g.moveTo(cx - 20, base + 8); g.lineTo(cx - 18, base - 26);
  g.quadraticCurveTo(cx, base - 40, cx + 18, base - 26); g.lineTo(cx + 20, base + 8); g.closePath(); g.fill();
  g.fillStyle = '#5d4526';
  g.fillRect(cx - 26, base - 30, 7, 38); g.fillRect(cx + 19, base - 30, 7, 38);
  g.fillRect(cx - 28, base - 36, 56, 8);
  g.strokeStyle = rgba('#2d2011', 0.8); g.lineWidth = 1; g.strokeRect(cx - 28.5, base - 36.5, 57, 9);
  // rails leading out
  g.strokeStyle = '#4a4740'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 8, base - 20); g.lineTo(cx - 10, base + 14);
  g.moveTo(cx + 8, base - 20); g.lineTo(cx + 10, base + 14); g.stroke();
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = '#4a3a22'; g.lineWidth = 2.4;
    const y = base - 18 + i * 7;
    g.beginPath(); g.moveTo(cx - 12, y); g.lineTo(cx + 12, y); g.stroke();
  }
  glow(g, cx, base - 24, 18, P.glowWarm, 0.3);
}

function paintCityBuilding(g, rnd, d, kind) {
  const w = d.w - 12, h = d.h - 20, x = 6, y = 10;
  const roofH = kind === 'factory' || kind === 'warehouse' ? 26 : 16;
  const wallCol = {
    shop: '#a8714a', apartment: '#8d7f6d', office: '#6f7f8c', factory: '#7a7169', warehouse: '#8a8177',
  }[kind];

  // facade
  vgrad(g, x, y + roofH, w, h - roofH, [[0, shade(wallCol, 0.18)], [0.6, wallCol], [1, shade(wallCol, -0.32)]]);
  g.fillRect(x, y + roofH, w, h - roofH);
  // brick / panel texture
  g.save(); g.beginPath(); g.rect(x, y + roofH, w, h - roofH); g.clip();
  if (kind === 'shop' || kind === 'apartment') {
    for (let by = y + roofH; by < y + h; by += 6) {
      g.strokeStyle = rgba('#000', 0.16); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, by); g.lineTo(x + w, by); g.stroke();
      const off = ((by / 6) | 0) % 2 ? 6 : 0;
      for (let bx = x + off; bx < x + w; bx += 12) {
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by + 6); g.stroke();
      }
    }
  } else {
    for (let bx = x; bx < x + w; bx += 9) {
      g.strokeStyle = rgba('#000', 0.2); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(bx, y + roofH); g.lineTo(bx, y + h); g.stroke();
      g.strokeStyle = rgba('#fff', 0.08);
      g.beginPath(); g.moveTo(bx + 1.6, y + roofH); g.lineTo(bx + 1.6, y + h); g.stroke();
    }
  }
  g.restore();

  // roof
  g.beginPath();
  g.moveTo(x - 5, y + roofH); g.lineTo(x + w * 0.5, y); g.lineTo(x + w + 5, y + roofH); g.closePath();
  vgrad(g, x, y, w, roofH, [[0, shade('#54534f', 0.3)], [1, '#3a3936']]); g.fill();
  g.strokeStyle = rgba('#000', 0.6); g.lineWidth = 1.2; g.stroke();
  if (kind === 'factory' || kind === 'warehouse') {
    // sawtooth roof lights
    g.fillStyle = rgba(P.glass, 0.45);
    for (let i = 0; i < 4; i++) g.fillRect(x + 8 + i * (w / 4.4), y + roofH * 0.45, w / 8, roofH * 0.4);
  }

  // windows, lit at random
  const cols = Math.max(2, Math.floor(w / 26)), rows = Math.max(2, Math.floor((h - roofH) / 26));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + 8 + c * ((w - 16) / cols), wy = y + roofH + 8 + r * ((h - roofH - 14) / rows);
      const ww = (w - 16) / cols - 8, wh = (h - roofH - 14) / rows - 10;
      if (ww < 4 || wh < 4) continue;
      const lit = rnd() < 0.45;
      g.fillStyle = shade(wallCol, -0.45); g.fillRect(wx - 1.5, wy - 1.5, ww + 3, wh + 3);
      glassPanel(g, wx, wy, ww, wh, lit ? P.glowWarm : P.glass, lit ? 0.85 : 0.35);
      if (lit) glow(g, wx + ww / 2, wy + wh / 2, ww * 1.5, P.glowWarm, 0.18);
    }
  }

  // ground floor: door / shutter / dock
  const dw = Math.min(46, w * 0.4), dx = x + w / 2 - dw / 2, dy = y + h - 26;
  if (kind === 'factory' || kind === 'warehouse') {
    plate(g, dx - 6, dy, dw + 12, 26, P.steelLo, { r: 1 });
    for (let i = 0; i < 6; i++) {
      g.fillStyle = rgba('#000', 0.2); g.fillRect(dx - 6, dy + 2 + i * 4, dw + 12, 1.6);
    }
    hazard(g, dx - 6, dy + 22, dw + 12, 4, P.paintYellow, P.steelDark, 5);
  } else {
    plate(g, dx, dy, dw, 26, kind === 'shop' ? P.paintGreen : '#5d4a33', { r: 2 });
    glassPanel(g, dx + 4, dy + 4, dw - 8, 14, P.glowWarm, 0.8);
    g.fillStyle = P.brass; g.beginPath(); g.arc(dx + dw - 7, dy + 22, 1.6, 0, TAU); g.fill();
  }
  if (d.label !== undefined) { /* label drawn in-world by renderer */ }

  // signage band
  if (kind === 'shop' || kind === 'office') {
    plate(g, x + 6, y + roofH + 2, w - 12, 12, P.uiPanel, { r: 1 });
    g.fillStyle = rgba(P.uiTrimHi, 0.85);
    g.fillRect(x + 9, y + roofH + 5, w - 18, 1.4);
  }
  grime(g, x, y, w, h + 10, 61, 0.8);
  // roof vents / AC units
  for (let i = 0; i < 2 + ((rnd() * 2) | 0); i++) {
    const vx = x + 10 + rnd() * (w - 30);
    plate(g, vx, y + roofH - 10, 14, 10, P.steelMid, { r: 1 });
    vents(g, vx + 2, y + roofH - 8, 10, 6, 2);
  }
}

function paintFence(g, rnd, d) {
  g.fillStyle = P.steelLo;
  g.fillRect(d.ox - 1.5, d.oy - 26, 3, 26);
  g.strokeStyle = rgba(P.steelMid, 0.9); g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    g.beginPath(); g.moveTo(d.ox - 14, d.oy - 24 + i * 4); g.lineTo(d.ox + 14, d.oy - 24 + i * 4); g.stroke();
  }
}
