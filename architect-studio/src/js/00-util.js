'use strict';
/* ==========================================================================
   00 — Utilitários e geometria
   Unidade interna: centímetros (cm). Eixo Y da planta cresce para "baixo".
   ========================================================================== */

const AS = window.AS = {};

AS.uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
AS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
AS.round = (v, step = 1) => Math.round(v / step) * step;
AS.clone = (o) => JSON.parse(JSON.stringify(o));
AS.deg = (r) => r * 180 / Math.PI;
AS.rad = (d) => d * Math.PI / 180;
AS.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const G = AS.geo = {
  EPS: 1e-6,
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  mul: (a, s) => ({ x: a.x * s, y: a.y * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  cross: (a, b) => a.x * b.y - a.y * b.x,
  len: (a) => Math.hypot(a.x, a.y),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  norm(a) { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; },
  perp: (a) => ({ x: -a.y, y: a.x }),
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  eq: (a, b, tol = 0.5) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol,
  rot(p, ang, c = { x: 0, y: 0 }) {
    const s = Math.sin(ang), co = Math.cos(ang), dx = p.x - c.x, dy = p.y - c.y;
    return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co };
  },
  /** Projeção de p no segmento ab: {t (0..1), d (distância), p (ponto)} */
  projSeg(p, a, b) {
    const ab = G.sub(b, a), l2 = G.dot(ab, ab);
    let t = l2 ? G.dot(G.sub(p, a), ab) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const q = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    return { t, d: G.dist(p, q), p: q };
  },
  /** Projeção na reta infinita */
  projLine(p, a, b) {
    const ab = G.sub(b, a), l2 = G.dot(ab, ab) || 1;
    const t = G.dot(G.sub(p, a), ab) / l2;
    return { t, p: { x: a.x + ab.x * t, y: a.y + ab.y * t } };
  },
  /** Interseção de segmentos; retorna {p,t,u} ou null */
  segInter(a, b, c, d) {
    const r = G.sub(b, a), s = G.sub(d, c), den = G.cross(r, s);
    if (Math.abs(den) < 1e-9) return null;
    const ca = G.sub(c, a), t = G.cross(ca, s) / den, u = G.cross(ca, r) / den;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
    return { p: { x: a.x + r.x * t, y: a.y + r.y * t }, t, u };
  },
  /** Interseção de retas infinitas */
  lineInter(a, b, c, d) {
    const r = G.sub(b, a), s = G.sub(d, c), den = G.cross(r, s);
    if (Math.abs(den) < 1e-9) return null;
    const t = G.cross(G.sub(c, a), s) / den;
    return { x: a.x + r.x * t, y: a.y + r.y * t };
  },
  areaSigned(poly) {
    let s = 0;
    for (let i = 0, n = poly.length; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; s += a.x * b.y - b.x * a.y; }
    return s / 2;
  },
  area: (poly) => Math.abs(G.areaSigned(poly)),
  perimeter(poly) { let s = 0; for (let i = 0; i < poly.length; i++) s += G.dist(poly[i], poly[(i + 1) % poly.length]); return s; },
  centroid(poly) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, n = poly.length; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n], f = p.x * q.y - q.x * p.y;
      a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
    }
    if (Math.abs(a) < 1e-9) { const b = G.bbox(poly); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }
    return { x: cx / (3 * a), y: cy / (3 * a) };
  },
  bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  },
  inPoly(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c;
    }
    return c;
  },
  /** Ponto interno "bom" para rótulo: centróide se interno, senão varredura */
  labelPoint(poly) {
    const c = G.centroid(poly);
    if (G.inPoly(c, poly)) return c;
    const b = G.bbox(poly); let best = null, bestD = -1;
    for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
      const p = { x: b.x0 + b.w * i / 12, y: b.y0 + b.h * j / 12 };
      if (!G.inPoly(p, poly)) continue;
      let d = Infinity;
      for (let k = 0; k < poly.length; k++) d = Math.min(d, G.projSeg(p, poly[k], poly[(k + 1) % poly.length]).d);
      if (d > bestD) { bestD = d; best = p; }
    }
    return best || c;
  },
  /** Polígono deslocado para dentro; offs[i] = recuo da aresta i (poly[i]->poly[i+1]) */
  insetPoly(poly, offs) {
    const n = poly.length; if (n < 3) return poly.slice();
    const ccw = G.areaSigned(poly) > 0; // em coords y-baixo, "ccw" matemático
    const lines = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n], d = G.norm(G.sub(b, a));
      // normal interna
      let nrm = ccw ? { x: -d.y, y: d.x } : { x: d.y, y: -d.x };
      const o = offs[i] || 0;
      lines.push([G.add(a, G.mul(nrm, o)), G.add(b, G.mul(nrm, o))]);
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const L0 = lines[(i - 1 + n) % n], L1 = lines[i];
      const p = G.lineInter(L0[0], L0[1], L1[0], L1[1]);
      out.push(p && G.dist(p, poly[i]) < 500 ? p : L1[0]);
    }
    // validação: se mudou orientação ou área ficou absurda, devolve original
    const a0 = G.areaSigned(poly), a1 = G.areaSigned(out);
    if (Math.sign(a0) !== Math.sign(a1) || Math.abs(a1) > Math.abs(a0)) return poly.slice();
    return out;
  },
  simplify(poly, tol = 0.5) {
    // remove vértices colineares e duplicados
    let pts = poly.filter((p, i) => !G.eq(p, poly[(i + 1) % poly.length], 0.01));
    let changed = true;
    while (changed && pts.length > 3) {
      changed = false;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
        const ab = G.sub(b, a), bc = G.sub(c, b);
        if (Math.abs(G.cross(G.norm(ab), G.norm(bc))) < 1e-4 && G.dot(ab, bc) > 0) { pts.splice(i, 1); changed = true; break; }
      }
    }
    return pts;
  },
};

/* ---------- Unidades ---------- */
AS.units = {
  mode: 'm', precision: 2,
  fmt(cm, mode = AS.units.mode, prec = AS.units.precision) {
    if (cm == null || !isFinite(cm)) return '—';
    let v, u;
    if (mode === 'mm') { v = cm * 10; u = 'mm'; prec = Math.max(0, prec - 2); }
    else if (mode === 'cm') { v = cm; u = 'cm'; prec = Math.max(0, prec - 2); }
    else { v = cm / 100; u = 'm'; }
    return v.toLocaleString('pt-BR', { minimumFractionDigits: prec, maximumFractionDigits: prec }) + ' ' + u;
  },
  fmtNum(cm, mode = AS.units.mode) { // número sem unidade, para campos
    const v = mode === 'mm' ? cm * 10 : mode === 'cm' ? cm : cm / 100;
    const p = mode === 'm' ? 3 : mode === 'cm' ? 1 : 0;
    return String(+v.toFixed(p)).replace('.', ',');
  },
  fmtArea(cm2) {
    return (cm2 / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m²';
  },
  /** Aceita "3,5", "3.5m", "350cm", "3500 mm", "3m50". Sem unidade: unidade atual. */
  parse(str, mode = AS.units.mode) {
    if (str == null) return NaN;
    let s = String(str).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return NaN;
    let m = s.match(/^(\d+)m(\d{1,2})$/); // 3m50
    if (m) return (+m[1]) * 100 + (+m[2].padEnd(2, '0'));
    m = s.match(/^(-?[\d.,]+)(mm|cm|m)?$/);
    if (!m) return NaN;
    let num = m[1];
    if (num.includes(',') && num.includes('.')) num = num.replace(/\./g, '').replace(',', '.');
    else num = num.replace(',', '.');
    const v = parseFloat(num); if (!isFinite(v)) return NaN;
    const u = m[2] || mode;
    return u === 'mm' ? v / 10 : u === 'cm' ? v : v * 100;
  },
  label() { return AS.units.mode; },
};

/* ---------- Eventos simples ---------- */
AS.bus = {
  h: {},
  on(ev, fn) { (this.h[ev] ||= []).push(fn); },
  emit(ev, ...a) { (this.h[ev] || []).forEach(f => { try { f(...a); } catch (e) { console.error(ev, e); } }); },
};

AS.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
AS.throttle = (fn, ms) => {
  let last = 0, t = null;
  return (...a) => {
    const now = performance.now();
    if (now - last >= ms) { last = now; fn(...a); }
    else { clearTimeout(t); t = setTimeout(() => { last = performance.now(); fn(...a); }, ms - (now - last)); }
  };
};
AS.fmtDate = (ts) => ts ? new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
