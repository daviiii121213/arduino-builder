// Particle and floating-text effects: smoke stacks, steam, sparks, dust, fire glow,
// electrical arcs and money popups. Pooled so heavy factories stay smooth.

import { P, rgba } from '../art/palette.js';
import { TAU, clamp } from '../core/utils.js';
import { itemIcon } from '../art/icons.js';

const MAX = 420;

/** Pre-rendered soft puff: drawing a cached sprite is far cheaper than building a
 *  radial gradient per particle per frame. */
const puffCache = new Map();
function puff(color) {
  let c = puffCache.get(color);
  if (c) return c;
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, rgba(color, 1));
  gr.addColorStop(0.45, rgba(color, 0.42));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  puffCache.set(color, cv);
  return cv;
}

export class FX {
  constructor(game) {
    this.game = game;
    this.parts = [];
    this.texts = [];
  }

  add(p) {
    if (this.parts.length >= MAX) return;
    // skip emitters far outside the view: they would never be seen anyway
    const cam = this.game.cam;
    if (cam && cam.vw) {
      const v = cam.view, TS = 32;
      if (p.x * TS < v.x0 - 160 || p.x * TS > v.x1 + 160 || p.y * TS < v.y0 - 160 || p.y * TS > v.y1 + 160) return;
    }
    this.parts.push(p);
  }

  smoke(x, y, n = 1, tint = P.smoke) {
    for (let i = 0; i < n; i++) this.add({
      kind: 'smoke', x: x + (Math.random() - 0.5) * 0.3, y, vx: (Math.random() - 0.5) * 0.18 + 0.12,
      vy: -0.5 - Math.random() * 0.35, life: 2.6 + Math.random() * 1.6, t: 0,
      r: 4 + Math.random() * 5, col: tint, spin: (Math.random() - 0.5) * 2,
    });
  }

  steam(x, y, n = 1) { this.smoke(x, y, n, P.steam); }

  sparks(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = 0.6 + Math.random() * 2.2;
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.4,
        life: 0.4 + Math.random() * 0.5, t: 0, r: 1 + Math.random(), col: Math.random() < 0.4 ? P.glowHot : P.spark });
    }
  }

  dust(x, y, n = 4) {
    for (let i = 0; i < n; i++) this.add({
      kind: 'dust', x, y, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.5 - 0.2,
      life: 0.7 + Math.random() * 0.6, t: 0, r: 2 + Math.random() * 3, col: '#b5a68a',
    });
  }

  fire(x, y, n = 2) {
    for (let i = 0; i < n; i++) this.add({
      kind: 'fire', x: x + (Math.random() - 0.5) * 0.25, y, vx: (Math.random() - 0.5) * 0.2,
      vy: -0.7 - Math.random() * 0.5, life: 0.4 + Math.random() * 0.35, t: 0,
      r: 2.5 + Math.random() * 3, col: Math.random() < 0.5 ? P.glowHot : P.glowWarm,
    });
  }

  arc(x, y) {
    this.add({ kind: 'arc', x, y, life: 0.16, t: 0, r: 10 + Math.random() * 8, col: P.glowCold,
      seed: Math.random() * 1000 });
  }

  item(x, y, id) {
    this.add({ kind: 'item', x, y, vx: (Math.random() - 0.5) * 0.5, vy: -1.4, life: 0.9, t: 0, id, r: 10 });
  }

  text(x, y, str, col = P.uiText, size = 14) {
    this.texts.push({ x, y, str, col, size, t: 0, life: 1.5, vy: -0.9 });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'smoke') { p.vy += dt * 0.06; p.vx *= 1 - dt * 0.3; p.r += dt * 5; }
      else if (p.kind === 'spark') { p.vy += dt * 5.5; p.vx *= 1 - dt * 1.6; }
      else if (p.kind === 'dust') { p.vy += dt * 1.2; }
      else if (p.kind === 'fire') { p.r *= 1 - dt * 0.6; }
      else if (p.kind === 'item') { p.vy += dt * 3.2; }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt; t.y += t.vy * dt; t.vy *= 1 - dt * 1.4;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
  }

  /** Drawn in world space (caller has already applied the camera transform). */
  draw(g, cam) {
    const TS = 32;
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      const sx = p.x * TS, sy = p.y * TS;
      if (p.kind === 'smoke') {
        g.globalAlpha = 0.34 * a;
        g.drawImage(puff(p.col), sx - p.r, sy - p.r, p.r * 2, p.r * 2);
        g.globalAlpha = 1;
      } else if (p.kind === 'spark') {
        g.strokeStyle = rgba(p.col, a); g.lineWidth = p.r * 0.9;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - p.vx * 4, sy - p.vy * 4); g.stroke();
      } else if (p.kind === 'dust') {
        g.globalAlpha = 0.35 * a;
        g.drawImage(puff(p.col), sx - p.r, sy - p.r, p.r * 2, p.r * 2);
        g.globalAlpha = 1;
      } else if (p.kind === 'fire') {
        g.globalAlpha = 0.85 * a;
        g.drawImage(puff(p.col), sx - p.r * 2, sy - p.r * 2, p.r * 4, p.r * 4);
        g.globalAlpha = 1;
      } else if (p.kind === 'arc') {
        g.strokeStyle = rgba(p.col, a); g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(sx, sy);
        let cx = sx, cy = sy;
        for (let i = 0; i < 4; i++) {
          cx += (Math.random() - 0.5) * p.r; cy += (Math.random() - 0.5) * p.r;
          g.lineTo(cx, cy);
        }
        g.stroke();
      } else if (p.kind === 'item') {
        g.globalAlpha = a;
        g.drawImage(itemIcon(p.id), sx - 10, sy - 10, 20, 20);
        g.globalAlpha = 1;
      }
    }
  }

  /** Floating labels are drawn in screen space so they stay legible when zoomed out. */
  drawTexts(g, cam) {
    const TS = 32;
    for (const t of this.texts) {
      const a = clamp(1 - (t.t / t.life) * 1.3, 0, 1);
      const s = cam.worldToScreen(t.x * TS, t.y * TS);
      g.font = `bold ${t.size}px "Segoe UI", sans-serif`;
      g.textAlign = 'center';
      g.fillStyle = `rgba(0,0,0,${0.6 * a})`;
      g.fillText(t.str, s.x + 1, s.y + 1.5);
      g.fillStyle = rgba(t.col, a);
      g.fillText(t.str, s.x, s.y);
    }
  }
}
