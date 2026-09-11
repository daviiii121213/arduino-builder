// Character sprite sheets. Every person in the game (player, workers, townsfolk) is
// drawn from the same rig with different palettes, uniforms, headgear and props, so
// the crowd looks individual but consistent.

import { makeCanvas, rr, glow, dropShadow } from './draw.js';
import { P, rgba, shade, mix } from './palette.js';
import { mulberry32 } from '../core/rng.js';
import { TAU } from '../core/utils.js';

export const FW = 34, FH = 46;           // frame size
export const COLS = 8;                   // 0 idle | 1..5 walk | 6..7 work
export const ROWS = 4;                   // dir: 0 N, 1 E, 2 S, 3 W

const SKIN = ['#f0c8a0', '#e0b088', '#c99167', '#a9734c', '#845334', '#5f3a22'];
const HAIR = ['#2b1d13', '#4a2f1b', '#7a4b22', '#b08544', '#d8cfc0', '#1a1a1e', '#6b3a2a'];

export const ROLE_STYLE = {
  player:    { shirt: '#c8622a', pants: '#3a4450', helmet: P.paintYellow, vest: true, tool: 'wrench' },
  worker:    { shirt: '#4d6a86', pants: '#39424d', helmet: P.paintYellow, vest: true, tool: 'box' },
  engineer:  { shirt: '#d8d2c4', pants: '#39424d', helmet: '#e8e2d4', vest: true, tool: 'tablet', glasses: true },
  mechanic:  { shirt: '#5a5f46', pants: '#3b3f30', helmet: '#8a5a2a', vest: false, tool: 'wrench' },
  logistics: { shirt: '#3f7a52', pants: '#39424d', helmet: P.paintOrange, vest: true, tool: 'box' },
  manager:   { shirt: '#2e3a4a', pants: '#242c36', helmet: null, vest: false, tool: 'tablet', tie: true },
  researcher:{ shirt: '#e6e9ec', pants: '#4a5560', helmet: null, vest: false, tool: 'tablet', coat: true, glasses: true },
  technician:{ shirt: '#6a4f86', pants: '#39424d', helmet: '#bfc6cd', vest: true, tool: 'wrench' },
  civilian:  { shirt: null, pants: null, helmet: null, vest: false, tool: null },
  vendor:    { shirt: '#8a5a2a', pants: '#4a3a2a', helmet: null, vest: false, tool: 'box', apron: true },
};

const sheetCache = new Map();

export function characterSheet(role = 'worker', seed = 1) {
  const key = role + ':' + (seed % 12);
  if (sheetCache.has(key)) return sheetCache.get(key);
  const rnd = mulberry32(4242 + seed * 7919 + role.length * 37);
  const base = ROLE_STYLE[role] || ROLE_STYLE.worker;
  const look = {
    skin: SKIN[(rnd() * SKIN.length) | 0],
    hair: HAIR[(rnd() * HAIR.length) | 0],
    shirt: base.shirt || ['#8a5a4a', '#4a6a8a', '#6a7a4a', '#7a4a6a', '#8a7a4a'][(rnd() * 5) | 0],
    pants: base.pants || ['#3a3f4a', '#4a4038', '#2f3a44'][(rnd() * 3) | 0],
    helmet: base.helmet,
    vest: base.vest, tool: base.tool, tie: base.tie, coat: base.coat,
    glasses: base.glasses || rnd() < 0.15,
    apron: base.apron,
    beard: rnd() < 0.3, long: rnd() < 0.35,
    boots: '#2a2622',
  };
  const { c, g } = makeCanvas(FW * COLS, FH * ROWS);
  for (let dir = 0; dir < ROWS; dir++)
    for (let col = 0; col < COLS; col++) {
      g.save();
      g.translate(col * FW, dir * FH);
      drawFrame(g, look, dir, col);
      g.restore();
    }
  const sheet = { canvas: c, fw: FW, fh: FH, look };
  sheetCache.set(key, sheet);
  return sheet;
}

function drawFrame(g, L, dir, col) {
  const cx = FW / 2, feet = FH - 5;
  const walk = col >= 1 && col <= 5;
  const work = col >= 6;
  const phase = walk ? (col - 1) / 5 : 0;
  const swing = walk ? Math.sin(phase * TAU) : 0;
  const bob = walk ? Math.abs(Math.cos(phase * TAU)) * 1.4 : 0;
  const workPose = work ? (col === 6 ? 0 : 1) : -1;

  // ---- ground shadow
  g.save();
  g.fillStyle = 'rgba(8,10,14,0.30)';
  g.beginPath(); g.ellipse(cx, feet + 1, 8.5, 3.4, 0, 0, TAU); g.fill();
  g.restore();

  const top = feet - 32 - bob;     // shoulder line
  const side = dir === 1 ? 1 : dir === 3 ? -1 : 0;

  // ---- legs
  const legSwing = swing * 4.2;
  for (const s of [-1, 1]) {
    const off = s * (side ? 1.2 : 3.1);
    const fwd = side ? legSwing * s * side : legSwing * s;
    g.fillStyle = s === 1 ? L.pants : shade(L.pants, -0.18);
    rr(g, cx + off - 2.6 + (side ? fwd * 0.6 : 0), top + 17, 5.2, 12 + (side ? 0 : Math.abs(fwd) * 0.1), 2.2);
    g.fill();
    // boot
    g.fillStyle = L.boots;
    rr(g, cx + off - 3 + (side ? fwd * 0.8 : 0), feet - 4, 6, 4.4, 1.8); g.fill();
    g.fillStyle = rgba('#fff', 0.12);
    g.fillRect(cx + off - 3 + (side ? fwd * 0.8 : 0), feet - 4, 6, 1);
  }

  // ---- torso
  const tw = side ? 9.5 : 12, th = 17;
  const tx = cx - tw / 2, ty = top + 2;
  const gr = g.createLinearGradient(tx, ty, tx + tw, ty + th);
  gr.addColorStop(0, shade(L.shirt, 0.2)); gr.addColorStop(0.55, L.shirt); gr.addColorStop(1, shade(L.shirt, -0.28));
  g.fillStyle = gr; rr(g, tx, ty, tw, th, 3); g.fill();
  g.strokeStyle = rgba('#000', 0.35); g.lineWidth = 0.8; g.stroke();

  if (L.coat) {   // lab coat overlay
    g.fillStyle = rgba('#f2f4f6', 0.95);
    rr(g, tx - 1, ty + 1, tw + 2, th + 4, 3); g.fill();
    g.strokeStyle = rgba('#b9bfc6', 0.9); g.lineWidth = 0.8; g.stroke();
    if (dir === 2) { g.strokeStyle = rgba('#aeb5bc', 0.9); g.beginPath(); g.moveTo(cx, ty + 2); g.lineTo(cx, ty + th + 3); g.stroke(); }
  }
  if (L.apron) {
    g.fillStyle = rgba('#6b4a2a', 0.9); rr(g, tx + 1, ty + 5, tw - 2, th - 3, 2); g.fill();
  }
  if (L.vest) {   // hi-vis vest with reflective bands
    g.fillStyle = rgba('#e8e24a', 0.92);
    rr(g, tx - 0.8, ty + 3, tw + 1.6, th - 3, 2.4); g.fill();
    g.strokeStyle = rgba('#8a8420', 0.8); g.lineWidth = 0.7; g.stroke();
    g.fillStyle = rgba('#d8dde2', 0.95);
    g.fillRect(tx - 0.8, ty + 7, tw + 1.6, 2);
    g.fillRect(tx - 0.8, ty + 12, tw + 1.6, 2);
    if (dir === 2) { g.fillStyle = rgba('#8a8420', 0.5); g.fillRect(cx - 0.5, ty + 3, 1, th - 3); }
  }
  if (L.tie && dir === 2) {
    g.fillStyle = '#a63a2e';
    g.beginPath(); g.moveTo(cx, ty + 1); g.lineTo(cx + 1.8, ty + 4); g.lineTo(cx, ty + 12); g.lineTo(cx - 1.8, ty + 4); g.closePath(); g.fill();
  }

  // ---- arms
  const armSwing = walk ? -swing * 4 : 0;
  const armY = ty + 3;
  for (const s of [-1, 1]) {
    let ax = cx + s * (tw / 2 + 1.2), ay = armY, len = 11, ang = 0;
    if (workPose >= 0) { ang = s * (workPose ? -0.9 : -0.5); ay -= 1; }
    else if (side) { ang = s === side ? armSwing * 0.12 : -armSwing * 0.12; }
    else ang = s * 0.08 + armSwing * 0.05 * s;
    g.save(); g.translate(ax, ay); g.rotate(ang);
    g.fillStyle = L.coat ? '#f2f4f6' : shade(L.shirt, s === 1 ? -0.1 : 0.08);
    rr(g, -2.1, 0, 4.2, len * 0.6, 2); g.fill();
    g.fillStyle = L.skin;             // forearm / hand
    rr(g, -1.9, len * 0.55, 3.8, len * 0.45, 1.8); g.fill();
    g.restore();
  }

  // ---- head
  const hy = top - 2.5, hr = 5.6;
  g.fillStyle = L.skin;
  g.beginPath(); g.ellipse(cx, hy, hr, hr * 1.06, 0, 0, TAU); g.fill();
  g.fillStyle = rgba('#000', 0.10);
  g.beginPath(); g.ellipse(cx + (side ? side * 1.6 : 0), hy + 1.6, hr * 0.9, hr * 0.7, 0, 0, TAU); g.fill();
  // neck shadow
  g.fillStyle = rgba('#000', 0.22); g.fillRect(cx - 2.2, hy + hr * 0.8, 4.4, 2);

  // hair
  if (!L.helmet || dir === 0) {
    g.fillStyle = L.hair;
    g.beginPath(); g.arc(cx, hy - 0.8, hr * 1.02, Math.PI, TAU); g.fill();
    if (L.long) { g.fillRect(cx - hr, hy - 1, hr * 2, 5); }
  }
  // face (only when facing camera or sideways)
  if (dir === 2) {
    g.fillStyle = '#2a2118';
    g.beginPath(); g.arc(cx - 2, hy + 0.4, 0.75, 0, TAU); g.fill();
    g.beginPath(); g.arc(cx + 2, hy + 0.4, 0.75, 0, TAU); g.fill();
    g.strokeStyle = rgba('#6b4636', 0.8); g.lineWidth = 0.7;
    g.beginPath(); g.arc(cx, hy + 2.6, 1.5, 0.2, Math.PI - 0.2); g.stroke();
    if (L.beard) { g.fillStyle = rgba(L.hair, 0.85); g.beginPath(); g.arc(cx, hy + 2.4, 3.4, 0.15, Math.PI - 0.15); g.fill(); }
    if (L.glasses) {
      g.strokeStyle = rgba('#1c1c20', 0.9); g.lineWidth = 0.8;
      g.beginPath(); g.arc(cx - 2, hy + 0.4, 1.9, 0, TAU); g.arc(cx + 2, hy + 0.4, 1.9, 0, TAU); g.stroke();
      g.fillStyle = rgba(P.glass, 0.3);
      g.beginPath(); g.arc(cx - 2, hy + 0.4, 1.8, 0, TAU); g.fill();
      g.beginPath(); g.arc(cx + 2, hy + 0.4, 1.8, 0, TAU); g.fill();
    }
  } else if (side) {
    g.fillStyle = '#2a2118';
    g.beginPath(); g.arc(cx + side * 2.4, hy + 0.4, 0.7, 0, TAU); g.fill();
  }

  // helmet
  if (L.helmet && dir !== 0) {
    const hg = g.createLinearGradient(cx - hr, hy - hr, cx + hr, hy);
    hg.addColorStop(0, shade(L.helmet, 0.32)); hg.addColorStop(0.6, L.helmet); hg.addColorStop(1, shade(L.helmet, -0.3));
    g.fillStyle = hg;
    g.beginPath(); g.arc(cx, hy - 0.6, hr * 1.08, Math.PI, TAU); g.fill();
    g.fillRect(cx - hr * 1.08, hy - 1.4, hr * 2.16, 1.8);
    // brim
    g.fillStyle = shade(L.helmet, -0.18);
    const bx = side ? cx + side * 1.5 : cx;
    rr(g, bx - hr * 1.1, hy - 0.4, hr * 2.2, 1.8, 0.9); g.fill();
    g.strokeStyle = rgba('#000', 0.4); g.lineWidth = 0.6; g.stroke();
    // crest rib
    g.fillStyle = rgba('#fff', 0.22);
    if (dir === 2) g.fillRect(cx - 0.7, hy - hr * 1.05, 1.4, hr * 0.9);
  } else if (L.helmet && dir === 0) {
    g.fillStyle = shade(L.helmet, -0.05);
    g.beginPath(); g.arc(cx, hy, hr * 1.08, 0, TAU); g.fill();
    g.fillStyle = rgba('#fff', 0.2);
    g.beginPath(); g.arc(cx - 1.6, hy - 1.6, hr * 0.4, 0, TAU); g.fill();
  }

  // ---- carried tool / prop
  if (L.tool && (workPose >= 0 || col === 0)) {
    const hx = cx + (side ? side * 7 : 7), hy2 = top + 13;
    if (L.tool === 'wrench') {
      g.save(); g.translate(hx, hy2); g.rotate(workPose === 1 ? -0.5 : 0.25);
      g.strokeStyle = P.steelHi; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -9); g.stroke();
      g.fillStyle = P.steelMid; g.beginPath(); g.arc(0, -10, 2.6, 0, TAU); g.fill();
      g.fillStyle = '#1a1c20'; g.beginPath(); g.arc(0, -10.6, 1.2, 0, TAU); g.fill();
      g.lineCap = 'butt'; g.restore();
    } else if (L.tool === 'box') {
      g.fillStyle = '#a5804a'; rr(g, cx - 6, top + 8, 12, 9, 1.5); g.fill();
      g.strokeStyle = '#4a3717'; g.lineWidth = 0.9; g.stroke();
      g.beginPath(); g.moveTo(cx - 6, top + 12.5); g.lineTo(cx + 6, top + 12.5); g.stroke();
    } else if (L.tool === 'tablet') {
      g.save(); g.translate(cx + (side ? side * 5 : 5), top + 12); g.rotate(-0.2);
      g.fillStyle = '#2a2f36'; rr(g, -3.5, -2.5, 7, 5, 1); g.fill();
      g.fillStyle = rgba(P.glowCold, 0.8); g.fillRect(-2.8, -1.9, 5.6, 3.8);
      g.restore();
    }
  }
}

/** Small 3/4 portrait used by dialogue and the employee roster. */
export function portrait(role, seed, size = 56) {
  const { c, g } = makeCanvas(size, size);
  const sheet = characterSheet(role, seed);
  g.imageSmoothingEnabled = true;
  const s = size / 18;
  g.save();
  g.beginPath(); rr(g, 0, 0, size, size, 6); g.clip();
  const bg = g.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#333a44'); bg.addColorStop(1, '#1c2128');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  g.drawImage(sheet.canvas, 2 * FW, 2 * FH, FW, FH, size / 2 - (FW * s) / 2, size * 0.08 - 2 * s, FW * s, FH * s);
  g.restore();
  g.strokeStyle = rgba('#0d0f12', 0.9); g.lineWidth = 2; rr(g, 1, 1, size - 2, size - 2, 6); g.stroke();
  g.strokeStyle = rgba(P.uiTrim, 0.6); g.lineWidth = 1; rr(g, 2.5, 2.5, size - 5, size - 5, 5); g.stroke();
  return c;
}
