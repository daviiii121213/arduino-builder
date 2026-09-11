// Painterly primitives. Everything drawn in the game is assembled from these so that
// machines, buildings, props and UI all share the same material language.

import { P, rgba, shade, mix } from './palette.js';
import { mulberry32 } from '../core/rng.js';
import { TAU } from '../core/utils.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  return { c, g };
}

/** Rounded rectangle path. */
export function rr(g, x, y, w, h, r = 3) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Vertical gradient fill helper. */
export function vgrad(g, x, y, w, h, stops) {
  const gr = g.createLinearGradient(x, y, x, y + h);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  g.fillStyle = gr;
  return gr;
}

export function hgrad(g, x, y, w, h, stops) {
  const gr = g.createLinearGradient(x, y, x + w, y);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  g.fillStyle = gr;
  return gr;
}

/**
 * A bevelled metal plate: the fundamental building block of every machine.
 * Top-lit, with a bright top edge, dark bottom edge and soft body gradient.
 */
export function plate(g, x, y, w, h, base, opt = {}) {
  const r = opt.r ?? 3;
  rr(g, x, y, w, h, r);
  vgrad(g, x, y, w, h, [
    [0, shade(base, 0.30)],
    [0.14, shade(base, 0.12)],
    [0.55, base],
    [1, shade(base, -0.30)],
  ]);
  g.fill();
  // rim light
  g.save(); rr(g, x, y, w, h, r); g.clip();
  g.strokeStyle = rgba(shade(base, 0.55), 0.85); g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(x + 1, y + 1.1); g.lineTo(x + w - 1, y + 1.1); g.stroke();
  g.strokeStyle = rgba('#000000', 0.5);
  g.beginPath(); g.moveTo(x + 1, y + h - 0.9); g.lineTo(x + w - 1, y + h - 0.9); g.stroke();
  g.restore();
  if (opt.outline !== false) {
    rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
    g.strokeStyle = rgba(shade(base, -0.62), 0.9); g.lineWidth = 1; g.stroke();
  }
}

/** Brushed-metal streaks, adds tactile surface noise without looking like flat colour. */
export function brushed(g, x, y, w, h, seed = 1, amt = 0.09) {
  const rnd = mulberry32(seed);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let i = 0; i < w * 0.9; i++) {
    const px = x + rnd() * w;
    g.strokeStyle = rgba(rnd() > 0.5 ? '#ffffff' : '#000000', rnd() * amt);
    g.lineWidth = rnd() * 1.4 + 0.2;
    g.beginPath(); g.moveTo(px, y + rnd() * h * 0.2); g.lineTo(px + (rnd() - 0.5) * 2, y + h - rnd() * h * 0.2); g.stroke();
  }
  g.restore();
}

/** Grime / rust build-up in corners and along the base — sells the "used" industrial look. */
export function grime(g, x, y, w, h, seed = 7, strength = 0.5) {
  const rnd = mulberry32(seed);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const n = Math.max(6, Math.floor(w * h / 90));
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w, py = y + h - Math.pow(rnd(), 1.7) * h;
    const rad = rnd() * Math.min(w, h) * 0.22 + 1;
    const col = rnd() > 0.55 ? P.rust : '#000000';
    const gr = g.createRadialGradient(px, py, 0, px, py, rad);
    gr.addColorStop(0, rgba(col, rnd() * 0.22 * strength));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill();
  }
  g.restore();
}

/** A row/ring of bolts. */
export function bolt(g, x, y, r = 2, tint = P.steelHi) {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
  gr.addColorStop(0, shade(tint, 0.35));
  gr.addColorStop(0.6, tint);
  gr.addColorStop(1, shade(tint, -0.45));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = rgba('#000000', 0.45); g.lineWidth = 0.7; g.stroke();
  g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(x - r * 0.55, y - r * 0.2); g.lineTo(x + r * 0.55, y + r * 0.2); g.stroke();
}

export function boltFrame(g, x, y, w, h, inset = 3.5, r = 1.9, tint = P.steelHi) {
  bolt(g, x + inset, y + inset, r, tint);
  bolt(g, x + w - inset, y + inset, r, tint);
  bolt(g, x + inset, y + h - inset, r, tint);
  bolt(g, x + w - inset, y + h - inset, r, tint);
}

/** Ventilation louvres. */
export function vents(g, x, y, w, h, count = 4, base = P.steelLo) {
  const gap = h / count;
  for (let i = 0; i < count; i++) {
    const vy = y + i * gap + gap * 0.16;
    const vh = gap * 0.55;
    g.fillStyle = shade(base, -0.5); rr(g, x, vy, w, vh, vh * 0.4); g.fill();
    g.fillStyle = rgba(shade(base, 0.4), 0.55);
    rr(g, x, vy + vh * 0.55, w, vh * 0.42, vh * 0.3); g.fill();
  }
}

/** Hazard stripes, clipped to the current path/region. */
export function hazard(g, x, y, w, h, a = P.paintYellow, b = P.steelDark, pitch = 7) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = a; g.fillRect(x, y, w, h);
  g.fillStyle = b;
  for (let i = -h; i < w + h; i += pitch * 2) {
    g.beginPath();
    g.moveTo(x + i, y + h); g.lineTo(x + i + pitch, y + h);
    g.lineTo(x + i + pitch + h, y); g.lineTo(x + i + h, y);
    g.closePath(); g.fill();
  }
  g.globalAlpha = 0.25; g.fillStyle = '#000';
  g.fillRect(x, y + h * 0.72, w, h * 0.28); g.globalAlpha = 1;
  g.restore();
}

/** Glass / display panel with reflection sweep. */
export function glassPanel(g, x, y, w, h, tint = P.glass, lit = 0.6) {
  rr(g, x, y, w, h, 2);
  vgrad(g, x, y, w, h, [[0, shade(tint, -0.55)], [0.5, mix(tint, '#0a1418', 1 - lit)], [1, shade(tint, -0.7)]]);
  g.fill();
  g.save(); rr(g, x, y, w, h, 2); g.clip();
  g.fillStyle = rgba('#ffffff', 0.18);
  g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * 0.55, y); g.lineTo(x + w * 0.85, y); g.lineTo(x + w * 0.2, y + h); g.closePath(); g.fill();
  g.restore();
  rr(g, x + 0.5, y + 0.5, w - 1, h - 1, 2); g.strokeStyle = rgba('#000', 0.7); g.lineWidth = 1; g.stroke();
}

/** Soft radial glow — used for lamps, furnaces, sparks, indicator LEDs. */
export function glow(g, x, y, r, color, strength = 0.8) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, strength));
  gr.addColorStop(0.4, rgba(color, strength * 0.35));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

export function led(g, x, y, r, color, on = true) {
  g.fillStyle = shade(P.steelDark, -0.2);
  g.beginPath(); g.arc(x, y, r + 1, 0, TAU); g.fill();
  if (on) glow(g, x, y, r * 3, color, 0.55);
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  gr.addColorStop(0, on ? shade(color, 0.6) : shade(color, -0.5));
  gr.addColorStop(1, on ? color : shade(color, -0.72));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

/** Pipe segment with specular highlight running along its length. */
export function pipe(g, x1, y1, x2, y2, w, base = P.steel) {
  const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
  g.save(); g.translate(x1, y1); g.rotate(ang);
  vgrad(g, 0, -w / 2, len, w, [
    [0, shade(base, -0.45)], [0.22, shade(base, 0.35)], [0.45, base], [1, shade(base, -0.55)]]);
  g.fillRect(0, -w / 2, len, w);
  g.strokeStyle = rgba('#000', 0.5); g.lineWidth = 1;
  g.strokeRect(0.5, -w / 2 + 0.5, len - 1, w - 1);
  // flanges
  g.fillStyle = shade(base, -0.15);
  g.fillRect(-1, -w / 2 - 1.5, 3, w + 3);
  g.fillRect(len - 2, -w / 2 - 1.5, 3, w + 3);
  g.restore();
}

/** Chunky drop shadow used under every free-standing object. */
export function dropShadow(g, x, y, w, h, a = 0.32) {
  g.save();
  const gr = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) / 1.6);
  gr.addColorStop(0, `rgba(6,8,11,${a})`);
  gr.addColorStop(1, 'rgba(6,8,11,0)');
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 1.7, h / 1.7, 0, 0, TAU); g.fill();
  g.restore();
}

/** Warning placard / signage with a pictogram slot. */
export function sign(g, x, y, w, h, color = P.paintYellow, glyph) {
  rr(g, x, y, w, h, 1.5);
  g.fillStyle = shade(color, -0.1); g.fill();
  g.strokeStyle = rgba('#000', 0.75); g.lineWidth = 1; g.stroke();
  g.fillStyle = rgba('#000', 0.8);
  if (glyph === 'bolt') {
    g.beginPath();
    g.moveTo(x + w * 0.56, y + h * 0.14); g.lineTo(x + w * 0.3, y + h * 0.55);
    g.lineTo(x + w * 0.48, y + h * 0.55); g.lineTo(x + w * 0.4, y + h * 0.88);
    g.lineTo(x + w * 0.7, y + h * 0.42); g.lineTo(x + w * 0.5, y + h * 0.42);
    g.closePath(); g.fill();
  } else if (glyph === 'excl') {
    g.fillRect(x + w * 0.44, y + h * 0.18, w * 0.12, h * 0.45);
    g.fillRect(x + w * 0.44, y + h * 0.7, w * 0.12, h * 0.12);
  }
}

/** Text with an engraved/embossed feel for UI. */
export function engraved(g, text, x, y, font, color = P.uiText, align = 'left') {
  g.font = font; g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillText(text, x, y + 1.2);
  g.fillStyle = color; g.fillText(text, x, y);
}

export function noiseOverlay(g, x, y, w, h, seed = 3, amt = 0.06) {
  const rnd = mulberry32(seed);
  const img = g.getImageData(x, y, Math.max(1, w | 0), Math.max(1, h | 0));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (rnd() - 0.5) * 255 * amt;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(img, x, y);
}
