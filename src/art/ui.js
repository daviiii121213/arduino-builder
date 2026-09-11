// UI art kit: riveted metal panels, machined buttons, gauge-style bars and a set of
// drawn glyph icons. Frames are cached per size so the HUD stays cheap to draw.

import { makeCanvas, rr, plate, brushed, grime, bolt, boltFrame, vgrad, hgrad,
         glassPanel, hazard, glow, led, engraved, noiseOverlay } from './draw.js';
import { P, rgba, shade, mix } from './palette.js';
import { TAU } from '../core/utils.js';

const frameCache = new Map();

export const FONT = {
  h1: 'bold 22px Georgia, serif',
  h2: 'bold 16px Georgia, serif',
  h3: 'bold 13px "Segoe UI", sans-serif',
  body: '13px "Segoe UI", sans-serif',
  small: '11px "Segoe UI", sans-serif',
  tiny: '10px "Segoe UI", sans-serif',
  mono: 'bold 13px "Consolas", monospace',
  monoS: '11px "Consolas", monospace',
};

/** Big riveted panel used by every full-screen window. */
export function panelTexture(w, h, variant = 'main') {
  const key = `${w}x${h}:${variant}`;
  if (frameCache.has(key)) return frameCache.get(key);
  const { c, g } = makeCanvas(w, h);
  const base = variant === 'dark' ? '#1b1f25' : P.uiPanel;

  g.fillStyle = 'rgba(0,0,0,0.55)'; rr(g, 3, 5, w - 6, h - 6, 8); g.fill();
  plate(g, 0, 0, w - 3, h - 3, base, { r: 8 });
  brushed(g, 0, 0, w - 3, h - 3, 91, 0.06);

  // inner recessed field
  g.save(); rr(g, 8, 8, w - 19, h - 19, 6); g.clip();
  vgrad(g, 8, 8, w - 19, h - 19, [[0, shade(base, -0.22)], [1, shade(base, -0.08)]]);
  g.fillRect(8, 8, w - 19, h - 19);
  g.restore();
  rr(g, 8.5, 8.5, w - 20, h - 20, 6);
  g.strokeStyle = rgba('#000', 0.7); g.lineWidth = 1.4; g.stroke();
  rr(g, 10, 10, w - 23, h - 23, 5);
  g.strokeStyle = rgba('#ffffff', 0.07); g.lineWidth = 1; g.stroke();

  // brass trim line under the title bar
  g.fillStyle = rgba(P.uiTrim, 0.55); g.fillRect(10, 34, w - 23, 1.6);
  g.fillStyle = rgba(P.uiTrimHi, 0.3); g.fillRect(10, 35.6, w - 23, 0.8);

  // rivets around the border
  const step = 34;
  for (let x = 14; x < w - 12; x += step) { bolt(g, x, 5.5, 2.2, P.steelHi); bolt(g, x, h - 8.5, 2.2, P.steelHi); }
  for (let y = 14; y < h - 12; y += step) { bolt(g, 5.5, y, 2.2, P.steelHi); bolt(g, w - 8.5, y, 2.2, P.steelHi); }
  // corner gussets
  for (const [gx, gy, sx, sy] of [[0, 0, 1, 1], [w - 3, 0, -1, 1], [0, h - 3, 1, -1], [w - 3, h - 3, -1, -1]]) {
    g.save(); g.translate(gx, gy); g.scale(sx, sy);
    g.fillStyle = rgba(P.uiTrim, 0.45);
    g.beginPath(); g.moveTo(2, 2); g.lineTo(20, 2); g.lineTo(2, 20); g.closePath(); g.fill();
    g.restore();
  }
  // soft vignette instead of heavy grime: keeps large panels clean and readable
  const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vig;
  g.save(); rr(g, 8, 8, w - 19, h - 19, 6); g.clip(); g.fillRect(0, 0, w, h); g.restore();
  noiseOverlay(g, 0, 0, w, h, 12, 0.022);
  frameCache.set(key, c);
  return c;
}

export function drawPanel(g, x, y, w, h, variant = 'main') {
  g.drawImage(panelTexture(Math.round(w), Math.round(h), variant), Math.round(x), Math.round(y));
}

/** Small inset slot (inventory cells, list rows). */
export function slot(g, x, y, w, h, opts = {}) {
  rr(g, x, y, w, h, 3);
  vgrad(g, x, y, w, h, [[0, '#151a1f'], [1, '#1e242b']]); g.fill();
  g.strokeStyle = rgba('#000', 0.8); g.lineWidth = 1.2; g.stroke();
  rr(g, x + 1.4, y + 1.4, w - 2.8, h - 2.8, 2.4);
  g.strokeStyle = rgba('#ffffff', opts.hover ? 0.22 : 0.07); g.lineWidth = 1; g.stroke();
  if (opts.selected) {
    rr(g, x + 0.5, y + 0.5, w - 1, h - 1, 3);
    g.strokeStyle = P.uiTrimHi; g.lineWidth = 1.8; g.stroke();
    glow(g, x + w / 2, y + h / 2, Math.max(w, h) * 0.7, P.uiTrimHi, 0.12);
  }
}

/** Machined button with a pressed state. */
export function button(g, x, y, w, h, label, opts = {}) {
  const base = opts.danger ? P.paintRed : opts.primary ? P.uiTrim : P.steelLo;
  const col = opts.disabled ? shade(base, -0.42) : opts.hover ? shade(base, 0.14) : base;
  const dy = opts.pressed ? 1 : 0;
  g.fillStyle = rgba('#000', 0.5); rr(g, x + 1, y + 3, w, h, 4); g.fill();
  plate(g, x, y + dy, w, h, col, { r: 4 });
  if (!opts.disabled) {
    g.save(); rr(g, x, y + dy, w, h, 4); g.clip();
    g.fillStyle = rgba('#ffffff', opts.hover ? 0.12 : 0.06);
    g.fillRect(x, y + dy, w, h * 0.42); g.restore();
  }
  bolt(g, x + 4.5, y + dy + 4.5, 1.5); bolt(g, x + w - 4.5, y + dy + 4.5, 1.5);
  bolt(g, x + 4.5, y + dy + h - 4.5, 1.5); bolt(g, x + w - 4.5, y + dy + h - 4.5, 1.5);
  if (label) engraved(g, label, x + w / 2, y + dy + h / 2 + 4.5, opts.font || FONT.h3,
    opts.disabled ? P.uiDim : opts.primary ? '#1d1608' : P.uiText, 'center');
  return { x, y, w, h };
}

/** Tab strip button. */
export function tab(g, x, y, w, h, label, active, hover) {
  const base = active ? P.uiTrim : '#323943';
  g.fillStyle = rgba('#000', 0.45); rr(g, x + 1, y + 2, w, h, 4); g.fill();
  plate(g, x, y, w, h - (active ? 0 : 2), hover && !active ? shade(base, 0.12) : base, { r: 4 });
  engraved(g, label, x + w / 2, y + h / 2 + 4, FONT.h3, active ? '#1d1608' : P.uiText, 'center');
  if (active) { g.fillStyle = P.uiTrimHi; g.fillRect(x + 3, y + h - 3, w - 6, 2); }
}

/** Horizontal gauge bar with a machined bezel. */
export function bar(g, x, y, w, h, frac, color, opts = {}) {
  frac = Math.max(0, Math.min(1, frac));
  g.fillStyle = '#0e1216'; rr(g, x, y, w, h, h / 2); g.fill();
  g.strokeStyle = rgba('#000', 0.85); g.lineWidth = 1.2; g.stroke();
  if (frac > 0.01) {
    g.save(); rr(g, x + 1.5, y + 1.5, w - 3, h - 3, (h - 3) / 2); g.clip();
    vgrad(g, x, y, w, h, [[0, shade(color, 0.35)], [0.5, color], [1, shade(color, -0.3)]]);
    g.fillRect(x + 1.5, y + 1.5, (w - 3) * frac, h - 3);
    // ribbing
    g.fillStyle = rgba('#000', 0.12);
    for (let i = 0; i < w; i += 6) g.fillRect(x + i, y, 2, h);
    g.fillStyle = rgba('#ffffff', 0.22);
    g.fillRect(x + 1.5, y + 2, (w - 3) * frac, (h - 3) * 0.34);
    g.restore();
  }
  rr(g, x + 1, y + 1, w - 2, h - 2, (h - 2) / 2);
  g.strokeStyle = rgba('#ffffff', 0.10); g.lineWidth = 1; g.stroke();
  if (opts.label) {
    // dark text reads better over a bright fill; light text over the empty track
    const over = frac > 0.55;
    engraved(g, opts.label, x + w / 2, y + h / 2 + 3.6, FONT.tiny,
      opts.labelColor || (over ? 'rgba(10,14,10,0.85)' : P.uiText), 'center');
  }
}

export function tooltipBox(g, x, y, w, h) {
  g.fillStyle = 'rgba(0,0,0,0.55)'; rr(g, x + 2, y + 3, w, h, 5); g.fill();
  plate(g, x, y, w, h, '#252b33', { r: 5 });
  rr(g, x + 3, y + 3, w - 6, h - 6, 3);
  g.strokeStyle = rgba(P.uiTrim, 0.55); g.lineWidth = 1; g.stroke();
}

/** Drawn glyph icons for the HUD (no fonts, no emoji). */
const glyphCache = new Map();
export function glyph(name, size = 20, color = P.uiTrimHi) {
  const key = name + size + color;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const { c, g } = makeCanvas(size, size);
  const s = size / 20;
  g.save(); g.scale(s, s); g.translate(10, 10);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 1.8; g.lineJoin = 'round'; g.lineCap = 'round';
  switch (name) {
    case 'money':
      g.beginPath(); g.arc(0, 0, 7.5, 0, TAU); g.stroke();
      g.lineWidth = 1.6; g.beginPath();
      g.moveTo(2.8, -3.4); g.quadraticCurveTo(-3.6, -5.2, -3.2, -1.4);
      g.quadraticCurveTo(-2.8, 1, 2.4, 1.4); g.quadraticCurveTo(4.2, 3.6, -2.8, 3.6);
      g.stroke();
      g.beginPath(); g.moveTo(0, -6.4); g.lineTo(0, 6.4); g.lineWidth = 1.1; g.stroke();
      break;
    case 'xp':
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * TAU;
        const a2 = a + TAU / 10;
        g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
        g.lineTo(Math.cos(a2) * 3.5, Math.sin(a2) * 3.5);
      }
      g.closePath(); g.fill();
      break;
    case 'power':
      g.beginPath();
      g.moveTo(2.5, -8.5); g.lineTo(-4.5, 1); g.lineTo(-0.5, 1); g.lineTo(-2.5, 8.5);
      g.lineTo(4.5, -1); g.lineTo(0.5, -1); g.closePath(); g.fill();
      break;
    case 'wrench':
      g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(-5, 5); g.lineTo(4, -4); g.stroke();
      g.lineWidth = 2;
      g.beginPath(); g.arc(5.5, -5.5, 3.4, 0.6, 5.2); g.stroke();
      g.beginPath(); g.arc(-6, 6, 2.2, 0, TAU); g.fill();
      break;
    case 'box':
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-8, -3.5); g.lineTo(0, -7.5); g.lineTo(8, -3.5);
      g.lineTo(8, 4.5); g.lineTo(0, 8.5); g.lineTo(-8, 4.5); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(-8, -3.5); g.lineTo(0, 0.5); g.lineTo(8, -3.5); g.moveTo(0, 0.5); g.lineTo(0, 8.5); g.stroke();
      break;
    case 'flask':
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-2.5, -7.5); g.lineTo(-2.5, -2); g.lineTo(-7, 6);
      g.quadraticCurveTo(-8, 8.5, -5, 8.5); g.lineTo(5, 8.5);
      g.quadraticCurveTo(8, 8.5, 7, 6); g.lineTo(2.5, -2); g.lineTo(2.5, -7.5); g.stroke();
      g.beginPath(); g.moveTo(-4.5, -7.5); g.lineTo(4.5, -7.5); g.stroke();
      g.globalAlpha = 0.55; g.beginPath(); g.moveTo(-5.6, 4); g.lineTo(5.6, 4); g.lineTo(6.6, 6.6);
      g.quadraticCurveTo(7.4, 8.5, 4.6, 8.5); g.lineTo(-4.6, 8.5);
      g.quadraticCurveTo(-7.4, 8.5, -6.6, 6.6); g.closePath(); g.fill(); g.globalAlpha = 1;
      break;
    case 'map':
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-8, -5.5); g.lineTo(-2.6, -7.5); g.lineTo(2.6, -5); g.lineTo(8, -7.5);
      g.lineTo(8, 5.5); g.lineTo(2.6, 7.5); g.lineTo(-2.6, 5); g.lineTo(-8, 7.5); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(-2.6, -7.5); g.lineTo(-2.6, 5); g.moveTo(2.6, -5); g.lineTo(2.6, 7.5); g.stroke();
      break;
    case 'mission':
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-6.5, -8); g.lineTo(6.5, -8); g.lineTo(6.5, 8); g.lineTo(-6.5, 8); g.closePath(); g.stroke();
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-3.6, -1.5); g.lineTo(-1.2, 1); g.lineTo(3.8, -4); g.stroke();
      g.beginPath(); g.moveTo(-3.6, 4.5); g.lineTo(3.8, 4.5); g.stroke();
      break;
    case 'gearIcon': {
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
        g.lineTo(Math.cos(a + 0.2) * 5.4, Math.sin(a + 0.2) * 5.4);
        g.lineTo(Math.cos(a + TAU / 8 - 0.2) * 5.4, Math.sin(a + TAU / 8 - 0.2) * 5.4);
      }
      g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'clock':
      g.lineWidth = 1.7; g.beginPath(); g.arc(0, 0, 7.6, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -4.4); g.moveTo(0, 0); g.lineTo(3.4, 1.6); g.stroke();
      break;
    case 'heart':
      g.beginPath();
      g.moveTo(0, 7.5);
      g.bezierCurveTo(-9, 1.5, -7, -7.5, 0, -3.5);
      g.bezierCurveTo(7, -7.5, 9, 1.5, 0, 7.5);
      g.closePath(); g.fill();
      break;
    case 'stamina':
      g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(-7.5, 4); g.lineTo(-3.5, -3); g.lineTo(0, 2); g.lineTo(3.5, -6); g.lineTo(7.5, 1); g.stroke();
      break;
    case 'people':
      g.beginPath(); g.arc(-3, -3.4, 2.8, 0, TAU); g.fill();
      g.beginPath(); g.arc(4, -2.2, 2.2, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-8.5, 7.5); g.quadraticCurveTo(-3, 0.5, 2.5, 7.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(1.5, 7.5); g.quadraticCurveTo(4.5, 2, 8.5, 7.5); g.closePath(); g.fill();
      break;
    case 'chart':
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-8, 7); g.lineTo(8, 7); g.moveTo(-8, 7); g.lineTo(-8, -8); g.stroke();
      g.fillRect(-5.5, -1, 3, 8); g.fillRect(-0.5, -5, 3, 12); g.fillRect(4.5, -8, 3, 15);
      break;
    case 'water':
      g.beginPath();
      g.moveTo(0, -8.5); g.quadraticCurveTo(7.5, 1, 4.5, 5.2);
      g.quadraticCurveTo(0, 10.5, -4.5, 5.2); g.quadraticCurveTo(-7.5, 1, 0, -8.5);
      g.closePath(); g.fill();
      break;
    case 'close':
      g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-5.5, -5.5); g.lineTo(5.5, 5.5); g.moveTo(5.5, -5.5); g.lineTo(-5.5, 5.5); g.stroke();
      break;
    case 'arrow':
      g.beginPath(); g.moveTo(-5, -7); g.lineTo(6, 0); g.lineTo(-5, 7); g.closePath(); g.fill();
      break;
    default:
      g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.stroke();
  }
  g.restore();
  glyphCache.set(key, c);
  return c;
}

/** Section heading with a brass rule. */
export function heading(g, text, x, y, w) {
  engraved(g, text, x, y, FONT.h2, P.uiTrimHi);
  const tw = g.measureText(text).width;
  g.fillStyle = rgba(P.uiTrim, 0.35);
  g.fillRect(x + tw + 10, y - 5, Math.max(0, w - tw - 12), 1.4);
}

export function label(g, text, x, y, color = P.uiText, font = FONT.body, align = 'left') {
  engraved(g, text, x, y, font, color, align);
}

/** Wraps text to a width, returns the y after the last line. */
export function wrapText(g, text, x, y, maxW, lh = 15, font = FONT.small, color = P.uiDim) {
  g.font = font; g.fillStyle = color; g.textAlign = 'left';
  const words = String(text).split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; }
    else line = t;
  }
  if (line) { g.fillText(line, x, y); y += lh; }
  return y;
}
