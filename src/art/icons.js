// Item icons. Each material/component gets a purpose-drawn illustration used in the
// inventory, tooltips, machine panels, belts and on the factory floor.

import { makeCanvas, rr, plate, glow, bolt, vgrad, glassPanel, dropShadow } from './draw.js';
import { P, rgba, shade, mix } from './palette.js';
import { mulberry32 } from '../core/rng.js';
import { TAU } from '../core/utils.js';
import { ITEMS } from '../data/items.js';

export const ICON = 40;
const cache = new Map();

export function itemIcon(id) {
  if (cache.has(id)) return cache.get(id);
  const it = ITEMS[id];
  const { c, g } = makeCanvas(ICON, ICON);
  if (it) {
    const rnd = mulberry32(id.length * 977 + id.charCodeAt(0) * 53 + 11);
    g.save(); g.translate(ICON / 2, ICON / 2);
    dropShadow(g, -11, 9, 22, 8, 0.35);
    (KIND[it.art.kind] || kindRock)(g, it.art, rnd);
    g.restore();
  }
  cache.set(id, c);
  return c;
}

/** Tiny version used for items riding a conveyor belt. */
const smallCache = new Map();
export function itemChip(id, size = 18) {
  const key = id + ':' + size;
  if (smallCache.has(key)) return smallCache.get(key);
  const { c, g } = makeCanvas(size, size);
  g.drawImage(itemIcon(id), 0, 0, ICON, ICON, 0, 0, size, size);
  smallCache.set(key, c);
  return c;
}

// --------------------------------------------------------------- icon kinds
// All draw centred on (0,0) within a ~34px box.

function facetBlob(g, rnd, r, a, b, n = 7) {
  g.beginPath();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU, rr2 = r * (0.72 + rnd() * 0.45);
    pts.push([Math.cos(ang) * rr2, Math.sin(ang) * rr2 * 0.88]);
  }
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  const gr = g.createLinearGradient(-r, -r, r, r);
  gr.addColorStop(0, b); gr.addColorStop(0.55, a); gr.addColorStop(1, shade(a, -0.35));
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#000', 0.55); g.lineWidth = 1.2; g.stroke();
  return pts;
}

function kindRock(g, art, rnd) {
  facetBlob(g, rnd, 13, art.a, art.b);
  g.fillStyle = rgba('#ffffff', 0.16);
  g.beginPath(); g.ellipse(-4, -4, 5, 3, -0.5, 0, TAU); g.fill();
}

function kindOre(g, art, rnd) {
  facetBlob(g, rnd, 13, art.a, art.b);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * TAU, r = rnd() * 8;
    g.fillStyle = rgba(art.fleck || art.b, 0.9);
    g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 1.1 + rnd() * 1.5, 0, TAU); g.fill();
    g.fillStyle = rgba('#ffffff', 0.4);
    g.beginPath(); g.arc(Math.cos(a) * r - 0.5, Math.sin(a) * r - 0.5, 0.6, 0, TAU); g.fill();
  }
}

function kindLog(g, art, rnd) {
  g.save(); g.rotate(-0.32);
  vgrad(g, -14, -6, 28, 12, [[0, shade(art.b, 0.15)], [0.45, art.a], [1, shade(art.a, -0.4)]]);
  rr(g, -14, -6, 28, 12, 5); g.fill();
  g.strokeStyle = rgba('#3a2a16', 0.8); g.lineWidth = 1.2; g.stroke();
  // end grain rings
  g.fillStyle = '#d6b483'; g.beginPath(); g.ellipse(12, 0, 3.4, 5.6, 0, 0, TAU); g.fill();
  g.strokeStyle = rgba('#8a6a3a', 0.9); g.lineWidth = 0.8;
  for (let i = 1; i <= 2; i++) { g.beginPath(); g.ellipse(12, 0, 1.2 * i, 2 * i, 0, 0, TAU); g.stroke(); }
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = rgba('#4a341c', 0.5); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-12 + rnd() * 20, -5 + rnd() * 10); g.lineTo(-8 + rnd() * 20, -5 + rnd() * 10); g.stroke();
  }
  g.restore();
}

function kindGrain(g, art, rnd) {
  // heap of pellets
  for (let i = 0; i < 24; i++) {
    const a = rnd() * Math.PI, r = rnd() * 12;
    const x = Math.cos(a) * r, y = 6 - Math.sin(a) * r * 0.7;
    const rad = 1.6 + rnd() * 1.4;
    const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
    gr.addColorStop(0, art.b); gr.addColorStop(1, art.a);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    g.strokeStyle = rgba('#000', 0.25); g.lineWidth = 0.5; g.stroke();
  }
}

function kindFluid(g, art, rnd) {
  // stoppered flask
  g.beginPath();
  g.moveTo(-4, -13); g.lineTo(4, -13); g.lineTo(4, -6);
  g.quadraticCurveTo(12, 2, 10, 9);
  g.quadraticCurveTo(8, 14, 0, 14);
  g.quadraticCurveTo(-8, 14, -10, 9);
  g.quadraticCurveTo(-12, 2, -4, -6); g.closePath();
  g.fillStyle = rgba('#cfe6ee', 0.25); g.fill();
  g.save(); g.clip();
  vgrad(g, -12, -2, 24, 18, [[0, art.b], [1, art.a]]);
  g.fillRect(-12, 1, 24, 16);
  g.fillStyle = rgba('#ffffff', 0.35); g.fillRect(-12, 1, 24, 1.4);
  g.restore();
  g.strokeStyle = rgba('#e8f4f8', 0.6); g.lineWidth = 1.2; g.stroke();
  g.fillStyle = rgba('#ffffff', 0.35);
  g.beginPath(); g.ellipse(-5, 4, 1.6, 6, 0.25, 0, TAU); g.fill();
  g.fillStyle = '#8a6a3a'; rr(g, -5, -16, 10, 4, 1.4); g.fill();
}

function kindPlate(g, art, rnd) {
  for (let i = 2; i >= 0; i--) {
    const y = i * 3 - 3;
    g.save(); g.translate(i * -1.5, y);
    g.beginPath();
    g.moveTo(-14, 0); g.lineTo(0, -7); g.lineTo(14, 0); g.lineTo(0, 7); g.closePath();
    const gr = g.createLinearGradient(-14, -7, 14, 7);
    gr.addColorStop(0, art.b); gr.addColorStop(0.5, mix(art.a, art.b, 0.4)); gr.addColorStop(1, art.a);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 1; g.stroke();
    g.restore();
  }
  g.fillStyle = rgba('#ffffff', 0.35);
  g.beginPath(); g.moveTo(-8, -4); g.lineTo(-2, -7); g.lineTo(2, -5); g.lineTo(-4, -2); g.closePath(); g.fill();
}

function kindIngot(g, art, rnd) {
  const draw = (ox, oy) => {
    g.save(); g.translate(ox, oy);
    g.beginPath();
    g.moveTo(-12, 4); g.lineTo(-9, -4); g.lineTo(9, -4); g.lineTo(12, 4); g.closePath();
    const gr = g.createLinearGradient(0, -4, 0, 4);
    gr.addColorStop(0, art.b); gr.addColorStop(0.5, mix(art.a, art.b, 0.5)); gr.addColorStop(1, art.a);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = rgba('#000', 0.55); g.lineWidth = 1; g.stroke();
    g.fillStyle = rgba('#ffffff', 0.4);
    g.fillRect(-7, -3, 12, 1.4);
    g.restore();
  };
  draw(-3, 7); draw(4, 7); draw(0, -2);
}

function kindSheet(g, art, rnd) {
  g.save(); g.rotate(-0.15);
  g.beginPath(); g.moveTo(-13, -9); g.lineTo(13, -9); g.lineTo(13, 9); g.lineTo(-13, 9); g.closePath();
  const gr = g.createLinearGradient(-13, -9, 13, 9);
  gr.addColorStop(0, rgba(art.b, 0.85)); gr.addColorStop(0.5, rgba(art.a, 0.6)); gr.addColorStop(1, rgba(art.b, 0.85));
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#dff2f8', 0.8); g.lineWidth = 1.4; g.stroke();
  g.fillStyle = rgba('#ffffff', 0.35);
  g.beginPath(); g.moveTo(-10, 9); g.lineTo(0, -9); g.lineTo(4, -9); g.lineTo(-6, 9); g.closePath(); g.fill();
  g.restore();
}

function kindGear(g, art, rnd) {
  const R = 13, teeth = 9;
  g.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * TAU, a1 = a0 + TAU / teeth * 0.5, a2 = a0 + TAU / teeth;
    g.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
    g.lineTo(Math.cos(a0 + 0.12) * (R + 3.4), Math.sin(a0 + 0.12) * (R + 3.4));
    g.lineTo(Math.cos(a1 - 0.12) * (R + 3.4), Math.sin(a1 - 0.12) * (R + 3.4));
    g.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
    g.lineTo(Math.cos(a2) * R, Math.sin(a2) * R);
  }
  g.closePath();
  const gr = g.createLinearGradient(-R, -R, R, R);
  gr.addColorStop(0, art.b); gr.addColorStop(0.5, mix(art.a, art.b, 0.35)); gr.addColorStop(1, art.a);
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#000', 0.55); g.lineWidth = 1.1; g.stroke();
  g.fillStyle = shade(art.a, -0.35); g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
  g.strokeStyle = rgba('#000', 0.5); g.stroke();
  g.fillStyle = rgba('#ffffff', 0.25);
  g.beginPath(); g.arc(0, 0, 9, Math.PI * 1.1, Math.PI * 1.7); g.lineWidth = 2; g.strokeStyle = rgba('#fff', 0.25); g.stroke();
}

function kindBracket(g, art, rnd) {
  g.save(); g.rotate(-0.25);
  g.beginPath();
  g.moveTo(-13, -8); g.lineTo(6, -8); g.lineTo(13, -1); g.lineTo(13, 8);
  g.lineTo(2, 8); g.lineTo(2, 0); g.lineTo(-13, 0); g.closePath();
  const gr = g.createLinearGradient(-13, -8, 13, 8);
  gr.addColorStop(0, art.b); gr.addColorStop(0.55, mix(art.a, art.b, 0.4)); gr.addColorStop(1, art.a);
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#000', 0.55); g.lineWidth = 1.1; g.stroke();
  bolt(g, -9, -4, 2, art.b); bolt(g, 8, 4, 2, art.b);
  g.fillStyle = rgba('#fff', 0.3); g.fillRect(-12, -7, 16, 1.2);
  g.restore();
}

function kindCoil(g, art, rnd) {
  g.strokeStyle = art.a; g.lineWidth = 3.4;
  for (let i = 0; i < 5; i++) {
    g.beginPath(); g.ellipse(0, -7 + i * 3.6, 11 - i * 0.4, 4.4, 0, 0, TAU); g.stroke();
  }
  g.strokeStyle = art.b; g.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    g.beginPath(); g.ellipse(0, -7.8 + i * 3.6, 11 - i * 0.4, 4.4, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  }
  g.strokeStyle = art.b; g.lineWidth = 2;
  g.beginPath(); g.moveTo(10, 9); g.quadraticCurveTo(15, 6, 13, 1); g.stroke();
}

function kindBoard(g, art, rnd) {
  rr(g, -13, -11, 26, 22, 2);
  const gr = g.createLinearGradient(-13, -11, 13, 11);
  gr.addColorStop(0, art.b); gr.addColorStop(1, art.a);
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#000', 0.6); g.lineWidth = 1; g.stroke();
  // traces
  g.strokeStyle = rgba(art.fleck || P.gold, 0.85); g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    let x = -11 + rnd() * 22, y = -9 + rnd() * 18;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x += (rnd() - 0.5) * 10; y += (rnd() - 0.5) * 10; g.lineTo(x, y); }
    g.stroke();
  }
  // chips
  g.fillStyle = '#1a1a1e'; rr(g, -7, -5, 11, 8, 1); g.fill();
  g.fillStyle = rgba('#fff', 0.12); g.fillRect(-6.4, -4.4, 9.8, 1);
  g.fillStyle = P.gold;
  for (let i = 0; i < 4; i++) { g.fillRect(-7 - 2, -4 + i * 2, 2, 1); g.fillRect(4, -4 + i * 2, 2, 1); }
  g.fillStyle = '#b03026'; rr(g, 6, 3, 5, 4, 1); g.fill();
  g.fillStyle = P.glowCold; g.beginPath(); g.arc(8, -7, 1.6, 0, TAU); g.fill();
}

function kindFrame(g, art, rnd) {
  const draw = (x, y, w, h) => {
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, art.b); gr.addColorStop(1, art.a);
    g.fillStyle = gr; rr(g, x, y, w, h, 1.5); g.fill();
    g.strokeStyle = rgba('#000', 0.55); g.lineWidth = 1; g.stroke();
  };
  draw(-14, -12, 28, 5); draw(-14, 8, 28, 5);
  draw(-14, -12, 5, 25); draw(9, -12, 5, 25);
  g.strokeStyle = art.a; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(-9, -7); g.lineTo(9, 8); g.moveTo(9, -7); g.lineTo(-9, 8); g.stroke();
  g.strokeStyle = rgba('#fff', 0.2); g.lineWidth = 1;
  g.beginPath(); g.moveTo(-9, -7); g.lineTo(9, 8); g.stroke();
  bolt(g, -11.5, -9.5, 1.8); bolt(g, 11.5, -9.5, 1.8);
  bolt(g, -11.5, 10.5, 1.8); bolt(g, 11.5, 10.5, 1.8);
}

function kindMotor(g, art, rnd) {
  // body
  rr(g, -12, -8, 20, 16, 4);
  const gr = g.createLinearGradient(0, -8, 0, 8);
  gr.addColorStop(0, shade(art.a, 0.3)); gr.addColorStop(0.5, art.a); gr.addColorStop(1, shade(art.a, -0.35));
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#000', 0.6); g.lineWidth = 1; g.stroke();
  // cooling fins
  g.strokeStyle = rgba('#000', 0.3); g.lineWidth = 1.4;
  for (let i = -9; i < 6; i += 3) { g.beginPath(); g.moveTo(i, -8); g.lineTo(i, 8); g.stroke(); }
  // copper windings visible at the end bell
  g.fillStyle = art.b; g.beginPath(); g.arc(10, 0, 6, 0, TAU); g.fill();
  g.strokeStyle = shade(art.b, -0.4); g.lineWidth = 1;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(10, 0, 1.2 * i + 1, 0, TAU); g.stroke(); }
  // shaft
  g.fillStyle = P.steelHi; g.fillRect(-16, -1.6, 5, 3.2);
  bolt(g, -10, -6, 1.6); bolt(g, -10, 6, 1.6);
}

function kindArm(g, art, rnd) {
  g.save(); g.translate(-2, 4);
  g.fillStyle = art.a; rr(g, -10, 4, 20, 7, 2); g.fill();
  g.strokeStyle = rgba('#000', 0.6); g.lineWidth = 1; g.stroke();
  const seg = (x1, y1, x2, y2, w, col) => {
    g.save(); g.translate(x1, y1); g.rotate(Math.atan2(y2 - y1, x2 - x1));
    const len = Math.hypot(x2 - x1, y2 - y1);
    const gr = g.createLinearGradient(0, -w / 2, 0, w / 2);
    gr.addColorStop(0, shade(col, 0.3)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.35));
    g.fillStyle = gr; rr(g, 0, -w / 2, len, w, w / 2.4); g.fill();
    g.strokeStyle = rgba('#000', 0.55); g.lineWidth = 1; g.stroke();
    g.restore();
  };
  seg(0, 3, -8, -8, 6.5, art.b);
  seg(-8, -8, 8, -14, 5.5, art.b);
  g.fillStyle = P.steelDark; g.beginPath(); g.arc(0, 3, 3, 0, TAU); g.fill();
  g.beginPath(); g.arc(-8, -8, 2.6, 0, TAU); g.fill();
  // gripper
  g.strokeStyle = P.steelHi; g.lineWidth = 2;
  g.beginPath(); g.moveTo(8, -14); g.lineTo(13, -17); g.moveTo(8, -14); g.lineTo(13, -11); g.stroke();
  g.restore();
}

function kindModule(g, art, rnd) {
  rr(g, -13, -13, 26, 26, 3);
  const gr = g.createLinearGradient(-13, -13, 13, 13);
  gr.addColorStop(0, shade(art.a, 0.3)); gr.addColorStop(1, shade(art.a, -0.3));
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba('#000', 0.65); g.lineWidth = 1.2; g.stroke();
  glassPanel(g, -8, -8, 16, 16, art.b, 0.8);
  glow(g, 0, 0, 12, art.b, 0.45);
  g.strokeStyle = rgba('#ffffff', 0.5); g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.stroke();
  for (const [x, y] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) bolt(g, x, y, 1.7, P.steelHi);
}

function kindCrate(g, art, rnd) {
  // shipping crate with a banded lid and stencilled mark
  g.beginPath(); g.moveTo(-14, -6); g.lineTo(0, -13); g.lineTo(14, -6); g.lineTo(0, 1); g.closePath();
  g.fillStyle = shade(art.b, 0.15); g.fill();
  g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 1; g.stroke();
  g.beginPath(); g.moveTo(-14, -6); g.lineTo(0, 1); g.lineTo(0, 14); g.lineTo(-14, 7); g.closePath();
  g.fillStyle = art.a; g.fill(); g.strokeStyle = rgba('#000', 0.5); g.stroke();
  g.beginPath(); g.moveTo(14, -6); g.lineTo(0, 1); g.lineTo(0, 14); g.lineTo(14, 7); g.closePath();
  g.fillStyle = shade(art.a, -0.25); g.fill(); g.strokeStyle = rgba('#000', 0.5); g.stroke();
  // strapping
  g.strokeStyle = rgba(art.b, 0.9); g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-7, -9.5); g.lineTo(-7, 10.5); g.moveTo(7, -9.5); g.lineTo(7, 10.5); g.stroke();
  g.fillStyle = rgba('#f0ead8', 0.75);
  g.beginPath(); g.moveTo(-10, 2); g.lineTo(-4, 5); g.lineTo(-4, 8); g.lineTo(-10, 5); g.closePath(); g.fill();
}

const KIND = {
  rock: kindRock, ore: kindOre, log: kindLog, grain: kindGrain, fluid: kindFluid,
  plate: kindPlate, ingot: kindIngot, sheet: kindSheet, gear: kindGear, bracket: kindBracket,
  coil: kindCoil, board: kindBoard, frame: kindFrame, motor: kindMotor, arm: kindArm,
  module: kindModule, crate: kindCrate,
};
