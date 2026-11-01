/* Planta 3D – Importador de PDF vetorial (núcleo sem interface).
 * Entrada: uma página de PDF lida com pdf.js 3.x (page.getOperatorList / getTextContent).
 * Saída: paredes no formato do app ({a,b,t,h,ops[]}, cm, x para a direita, z para baixo).
 * Funciona no navegador (window.PDFIMP) e no Node (module.exports) para o teste de aceite.
 */
(function (root) {
'use strict';
const PT_PER_CM_1 = 72 / 2.54;           // pontos por cm de papel
const hyp = Math.hypot;

/* ---------- 1. extração dos primitivos da página ---------- */
function colorKey(args) {
  if (!args) return '#000000';
  if (typeof args[0] === 'string') return args[0].toLowerCase();             // pdf.js no navegador: "#rrggbb"
  const v = [args[0], args[1], args[2]].map(x => Math.max(0, Math.min(255, Math.round(+x || 0))));
  return '#' + v.map(x => x.toString(16).padStart(2, '0')).join('');
}
function grayKey(args) { const g = Math.round((+(args && args[0]) || 0) * (args && args[0] > 1 ? 1 : 255)); return colorKey([g, g, g]); }
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const app = (m, x, y) => [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];

/** Lê caminhos (com cor de preenchimento/traço, espessura e tracejado) e textos de uma página.
 *  Coordenadas em pontos, origem no canto superior esquerdo da página (y para baixo). */
async function extractPage(page, OPS) {
  const vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  const fills = [], strokes = [];
  let gs = { ctm: vp.transform.slice(), fill: '#000000', stroke: '#000000', lw: 1, dash: false };
  const stack = [];
  let cur = [];                                      // subcaminhos do último constructPath
  const flush = (fill, stroke) => {
    for (const sp of cur) {
      if (sp.pts.length < 2) continue;
      const pts = sp.pts.map(p => app(gs.ctm, p[0], p[1]));
      const sc = Math.sqrt(Math.abs(gs.ctm[0]*gs.ctm[3] - gs.ctm[1]*gs.ctm[2])) || 1;
      if (fill && pts.length >= 3) fills.push({ pts, color: gs.fill });
      if (stroke) strokes.push({ pts, closed: sp.closed, color: gs.stroke, lw: gs.lw * sc, dash: gs.dash, curved: sp.curved });
    }
    cur = [];
  };
  const P = OPS;
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    switch (fn) {
      case P.save: stack.push(Object.assign({}, gs, { ctm: gs.ctm.slice() })); break;
      case P.restore: if (stack.length) gs = stack.pop(); break;
      case P.transform: gs.ctm = mul(gs.ctm, a); break;
      case P.setFillRGBColor: gs.fill = colorKey(a); break;
      case P.setStrokeRGBColor: gs.stroke = colorKey(a); break;
      case P.setFillGray: gs.fill = grayKey(a); break;
      case P.setStrokeGray: gs.stroke = grayKey(a); break;
      case P.setLineWidth: gs.lw = +a[0]; break;
      case P.setDash: gs.dash = !!(a && a[0] && a[0].length); break;
      case P.constructPath: {
        const ops = a[0], c = a[1]; let k = 0, sp = null;
        const start = (x, y) => { sp = { pts: [[x, y]], closed: false, curved: false }; cur.push(sp); };
        for (const op of ops) {
          if (op === P.moveTo) { start(c[k], c[k+1]); k += 2; }
          else if (op === P.lineTo) { if (!sp) start(c[k], c[k+1]); else sp.pts.push([c[k], c[k+1]]); k += 2; }
          else if (op === P.curveTo) { if (sp) { sp.pts.push([c[k+4], c[k+5]]); sp.curved = true; } k += 6; }
          else if (op === P.curveTo2 || op === P.curveTo3) { if (sp) { sp.pts.push([c[k+2], c[k+3]]); sp.curved = true; } k += 4; }
          else if (op === P.closePath) { if (sp) sp.closed = true; }
          else if (op === P.rectangle) { const x = c[k], y = c[k+1], w = c[k+2], h = c[k+3]; k += 4; sp = { pts: [[x, y], [x+w, y], [x+w, y+h], [x, y+h]], closed: true, curved: false }; cur.push(sp); }
        }
        break; }
      case P.fill: case P.eoFill: flush(true, false); break;
      case P.stroke: flush(false, true); break;
      case P.closeStroke: cur.forEach(s => s.closed = true); flush(false, true); break;
      case P.fillStroke: case P.eoFillStroke: flush(true, true); break;
      case P.closeFillStroke: case P.closeEOFillStroke: cur.forEach(s => s.closed = true); flush(true, true); break;
      case P.endPath: cur = []; break;
    }
  }
  const tc = await page.getTextContent();
  const texts = [];
  for (const it of tc.items) {
    const s = (it.str || '').trim(); if (!s) continue;
    const m = mul(vp.transform, it.transform);
    const ang = Math.atan2(m[1], m[0]);
    // ponto médio do texto (pdf.js ancora no início da linha de base)
    const w = it.width || 0, h = it.height || hyp(m[2], m[3]);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const x = m[4] + ux * w / 2 + uy * h * 0.35, y = m[5] + uy * w / 2 - ux * h * 0.35;
    texts.push({ str: s, x, y, ang, h });
  }
  // remove duplicatas de texto (alguns geradores repetem itens)
  return { W: vp.width, H: vp.height, fills, strokes, texts };
}

/* ---------- 2. escala ---------- */
/** Procura "Escala 1:50", "ESC. 1/100" etc. Retorna o denominador ou null. */
function scaleFromText(texts) {
  const all = texts.map(t => t.str).join(' ');
  const m = all.match(/esc(?:ala|\.)?\s*:?\s*1\s*[:/]\s*(\d{1,4})/i);
  return m ? +m[1] : null;
}
const ptPerCm = denom => PT_PER_CM_1 / denom;

/* ---------- utilidades geométricas ---------- */
function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i+1) % p.length]; s += a[0]*b[1] - b[0]*a[1]; } return s / 2; }
function dedupe(p, eps) { const o = []; for (const q of p) { if (!o.length || hyp(q[0]-o[o.length-1][0], q[1]-o[o.length-1][1]) > eps) o.push(q); } if (o.length > 1 && hyp(o[0][0]-o[o.length-1][0], o[0][1]-o[o.length-1][1]) <= eps) o.pop(); return o; }
/** Polígono de 4 vértices com cantos retos → retângulo orientado {c, u(unit), L, T} (L ao longo de u). */
function asRect(p, eps) {
  p = dedupe(p, eps || 0.05);
  // remove vértices colineares
  if (p.length > 4) { const o = []; for (let i = 0; i < p.length; i++) { const a = p[(i+p.length-1) % p.length], b = p[i], c = p[(i+1) % p.length]; const cr = (b[0]-a[0])*(c[1]-b[1]) - (b[1]-a[1])*(c[0]-b[0]); if (Math.abs(cr) > 1e-3 * hyp(b[0]-a[0], b[1]-a[1]) * hyp(c[0]-b[0], c[1]-b[1]) + 1e-9) o.push(b); } p = o; }
  if (p.length !== 4) return null;
  const e = [0, 1, 2, 3].map(i => [p[(i+1) % 4][0] - p[i][0], p[(i+1) % 4][1] - p[i][1]]);
  for (let i = 0; i < 4; i++) { const a = e[i], b = e[(i+1) % 4]; const la = hyp(...a), lb = hyp(...b); if (la < 1e-6 || lb < 1e-6) return null; if (Math.abs((a[0]*b[0] + a[1]*b[1]) / (la*lb)) > 0.02) return null; }
  const l0 = hyp(...e[0]), l1 = hyp(...e[1]);
  const c = [(p[0][0]+p[1][0]+p[2][0]+p[3][0]) / 4, (p[0][1]+p[1][1]+p[2][1]+p[3][1]) / 4];
  return { c, u: [e[0][0]/l0, e[0][1]/l0], L: l0, T: l1 };
}
// direção canônica (ângulo em [0,180) graus) e eixo
function canonDir(u) { let a = Math.atan2(u[1], u[0]) * 180 / Math.PI; if (a < 0) a += 180; if (a >= 179.95) a -= 180; const r = a * Math.PI / 180; return { ang: a, u: [Math.cos(r), Math.sin(r)] }; }
const nrm = u => [-u[1], u[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1];
function angDiff(a, b) { let d = Math.abs(a - b) % 180; return Math.min(d, 180 - d); }

/* ---------- 3. detecção ---------- */
const DEF = {
  tMin: 5, tMax: 45,            // espessura plausível de parede (cm)
  colTol: 0.8,                  // tolerância para eixos colineares (cm)
  angTol: 0.6,                  // graus
  joinTol: 0.6,                 // folga máxima entre peças contíguas (cm)
  wallH: 300, doorH: 210,
};

function pickWallColor(fills, opt) {
  const g = {};
  for (const f of fills) { const r = asRect(f.pts); const k = f.color; (g[k] = g[k] || { n: 0, thin: 0, area: 0 }); g[k].n++; g[k].area += Math.abs(area(f.pts));
    if (r) { const t = Math.min(r.L, r.T); if (t >= opt.tMin && t <= opt.tMax) g[k].thin++; } }
  let best = null; for (const k in g) { const s = g[k].thin * 3 + g[k].n; if (!best || s > best.s) best = { k, s }; }
  return best && best.k;
}

/**
 * Converte os primitivos de uma página em paredes.
 * prims: saída de extractPage; denom: denominador da escala (50 para 1:50).
 * Retorna {walls, extras, warnings, stats, wallColor}.
 */
function detect(prims, denom, options) {
  const opt = Object.assign({}, DEF, options || {});
  const s = ptPerCm(denom);
  const toCm = p => [p[0] / s, p[1] / s];
  const fills = prims.fills.map(f => ({ pts: f.pts.map(toCm), color: f.color }));
  const strokes = prims.strokes.map(k => ({ pts: k.pts.map(toCm), closed: k.closed, color: k.color, lw: k.lw / s, dash: k.dash, curved: k.curved }));
  const texts = prims.texts.map(t => ({ str: t.str, x: t.x / s, y: t.y / s, ang: t.ang }));
  const warnings = [];
  const wallColor = opt.wallColor || pickWallColor(fills, opt);
  if (!wallColor) return { walls: [], extras: [], warnings: ['Nenhum preenchimento encontrado: o PDF parece não ser vetorial.'], stats: {} };

  /* 3a. peças de parede (retângulos preenchidos finos) */
  const pieces = [], extras = [];
  for (const f of fills) {
    if (f.color !== wallColor) continue;
    const r = asRect(f.pts);
    if (!r) { extras.push(f.pts); continue; }
    const cand = [];
    if (r.T >= opt.tMin && r.T <= opt.tMax) cand.push({ u: r.u, L: r.L, T: r.T });
    if (r.L >= opt.tMin && r.L <= opt.tMax) cand.push({ u: nrm(r.u), L: r.T, T: r.L });
    if (!cand.length) { extras.push(f.pts); continue; }
    // pilar: peça "gorda" e curta (ex.: 50 × 40 cm)
    if (Math.min(r.L, r.T) >= 25 && Math.max(r.L, r.T) / Math.min(r.L, r.T) < 2.5) { extras.push(f.pts); continue; }
    pieces.push({ c: r.c, cand, poly: f.pts });
  }
  /* 3b. símbolos de esquadrias (traços na cor das paredes ou muito escuros) */
  const dark = c => { const v = parseInt(c.slice(1), 16); const r = v >> 16, g = (v >> 8) & 255, b = v & 255; return r + g + b < 3 * 90; };
  const sym = strokes.filter(k => k.color === wallColor || dark(k.color));
  const opens = [];   // {kind, ang, u, n, off(eixo), s0, s1 (ao longo de u), t?, sideHint, raw}
  const lineOf = (p, q) => { const L = hyp(q[0]-p[0], q[1]-p[1]); return { L, d: canonDir([(q[0]-p[0]) / L, (q[1]-p[1]) / L]) }; };
  // janelas / portas-janela: retângulo fechado de traço, lado curto = espessura da parede
  const winRects = [];
  for (const k of sym) {
    if (!k.closed || k.dash || k.curved) continue;
    const r = asRect(k.pts); if (!r) continue;
    let u = r.u, L = r.L, T = r.T; if (T > L) { u = nrm(u); [L, T] = [T, L]; }
    if (T < opt.tMin || T > opt.tMax || L < 25) continue;
    const d = canonDir(u), n = nrm(d.u);
    winRects.push({ c: r.c, u: d.u, n, ang: d.ang, L, T });
  }
  // linhas retas simples (folhas de porta, linhas internas de janela, porta de correr)
  const segs = sym.filter(k => !k.closed && k.pts.length === 2).map(k => { const p = k.pts[0], q = k.pts[1]; const l = lineOf(p, q); return { p, q, L: l.L, ang: l.d.ang, u: l.d.u, lw: k.lw, dash: k.dash }; }).filter(x => x.L > 1);
  // arcos tracejados (giro de porta)
  const arcs = sym.filter(k => !k.closed && k.dash && k.pts.length >= 6);
  for (const w of winRects) {
    const inner = segs.filter(sg => !sg.dash && angDiff(sg.ang, w.ang) < opt.angTol && Math.abs(dot([sg.p[0]-w.c[0], sg.p[1]-w.c[1]], w.n)) < w.T / 2 - 0.3 && Math.abs(dot([(sg.p[0]+sg.q[0])/2 - w.c[0], (sg.p[1]+sg.q[1])/2 - w.c[1]], w.u)) < w.L / 2);
    const offs = inner.map(sg => dot([sg.p[0]-w.c[0], sg.p[1]-w.c[1]], w.n));
    const twoTracks = offs.some(o => o > 0.4) && offs.some(o => o < -0.4);
    const kind = twoTracks ? 'slide' : 'bascula';
    // linha de soleira do lado de fora → peitoril zero
    const sillLine = segs.some(sg => !sg.dash && angDiff(sg.ang, w.ang) < opt.angTol && Math.abs(Math.abs(dot([sg.p[0]-w.c[0], sg.p[1]-w.c[1]], w.n)) - (w.T/2 + 3)) < 1.2 && sg.L > w.L * 0.8);
    const a0 = dot(w.c, w.u);
    opens.push({ kind, ang: w.ang, u: w.u, n: w.n, off: dot(w.c, w.n), s0: a0 - w.L/2, s1: a0 + w.L/2, t: w.T, sill0: sillLine, src: 'janela' });
  }
  // portas de abrir: arco tracejado + folha
  for (const ar of arcs) {
    const A = ar.pts[0], B = ar.pts[ar.pts.length - 1];
    // centro: ponto equidistante de todos os pontos do arco → extremidade de uma folha
    let best = null;
    for (const sg of segs) { if (sg.dash) continue; for (const [h, tip] of [[sg.p, sg.q], [sg.q, sg.p]]) {
      const rs = ar.pts.map(p => hyp(p[0]-h[0], p[1]-h[1])); const mean = rs.reduce((x, y) => x + y, 0) / rs.length; const dev = Math.max(...rs.map(r => Math.abs(r - mean)));
      if (dev > 0.6 || Math.abs(mean - sg.L) > 1) continue;
      const nearTip = Math.min(hyp(A[0]-tip[0], A[1]-tip[1]), hyp(B[0]-tip[0], B[1]-tip[1]));
      if (nearTip > 1.5) continue;
      if (!best || dev < best.dev) best = { h, tip, R: mean, dev, seg: sg };
    } }
    if (!best) continue;
    const axisPt = hyp(A[0]-best.tip[0], A[1]-best.tip[1]) < hyp(B[0]-best.tip[0], B[1]-best.tip[1]) ? B : A;   // extremidade do arco sobre o eixo da parede
    const v = [axisPt[0] - best.h[0], axisPt[1] - best.h[1]]; const Lv = hyp(...v);
    const d = canonDir([v[0]/Lv, v[1]/Lv]), n = nrm(d.u);
    const sh = dot(best.h, d.u), sa = dot(axisPt, d.u);
    const lo = Math.min(sh, sa), hi = Math.max(sh, sa);
    const hingeAtStart = sh < sa;   // dobradiça no início (menor coordenada) do vão
    const tipSide = Math.sign(dot([best.tip[0]-best.h[0], best.tip[1]-best.h[1]], n)) || 1;
    const ang = Math.round(Math.acos(Math.max(-1, Math.min(1, dot([best.tip[0]-best.h[0], best.tip[1]-best.h[1]], [v[0]/Lv, v[1]/Lv]) / best.R))) * 180 / Math.PI);
    opens.push({ kind: 'door', ang: d.ang, u: d.u, n, off: dot(best.h, n), s0: lo - 4, s1: hi + 4, leaf: best.R, hingeAtStart, tipSide, swing: ang, src: 'porta', usedSeg: best.seg });
    best.seg.used = true;
  }
  // portas de correr: traço grosso + traço tracejado paralelos, sobrepostos
  for (const th of segs) {
    if (th.dash || th.used || th.lw < 0.9) continue;
    const mate = segs.find(sg => sg.dash && angDiff(sg.ang, th.ang) < opt.angTol && Math.abs(Math.abs(dot([sg.p[0]-th.p[0], sg.p[1]-th.p[1]], nrm(th.u))) - 3) < 1.2);
    if (!mate) continue;
    const u = th.u, n = nrm(u);
    const xs = [th.p, th.q, mate.p, mate.q].map(p => dot(p, u));
    opens.push({ kind: 'slide-door', ang: th.ang, u, n, offLine: dot(th.p, n), offMate: dot(mate.p, n), s0: Math.min(...xs), s1: Math.max(...xs), src: 'correr' });
  }

  // chanfros: peças curtas encostadas num preenchimento não retangular são peças fixas, não paredes —
  // exceto quando continuam uma parede/esquadria colinear e o contato é pela lateral (ponta de parede inclinada).
  const onPoly = (q, poly) => poly.some((a, i) => { const b = poly[(i+1) % poly.length]; const L = hyp(b[0]-a[0], b[1]-a[1]) || 1e-9; const t = Math.max(0, Math.min(1, ((q[0]-a[0])*(b[0]-a[0]) + (q[1]-a[1])*(b[1]-a[1])) / (L*L))); return hyp(a[0] + t*(b[0]-a[0]) - q[0], a[1] + t*(b[1]-a[1]) - q[1]) < 0.3; });
  const odd = extras.slice();
  const geomOf = (pc, cd) => { const d = canonDir(cd.u), n = nrm(d.u); const a = dot(pc.c, d.u); return { ang: d.ang, u: d.u, off: dot(pc.c, n), s0: a - cd.L/2, s1: a + cd.L/2, t: cd.T }; };
  const sameLine = (g, h) => angDiff(g.ang, h.ang) < opt.angTol && Math.abs(g.off - h.off) < opt.colTol && Math.abs(g.t - h.t) < 1.2 && g.s0 <= h.s1 + opt.joinTol && g.s1 >= h.s0 - opt.joinTol;
  const attached = [];
  for (const pc of pieces) {
    if (Math.max(...pc.cand.map(c => c.L)) >= 60) continue;
    const P4 = dedupe(pc.poly, 0.05); const shared = [];
    for (let k = 0; k < P4.length; k++) { const a = P4[k], b = P4[(k+1) % P4.length]; if (hyp(b[0]-a[0], b[1]-a[1]) > 1 && odd.some(ex => onPoly(a, ex) && onPoly(b, ex))) shared.push(canonDir([b[0]-a[0], b[1]-a[1]]).ang); }
    if (shared.length) attached.push({ pc, shared });
  }
  const winGeoms = () => winRects.map(w => { const a0 = dot(w.c, w.u); return { ang: w.ang, off: dot(w.c, w.n), s0: a0 - w.L/2, s1: a0 + w.L/2, t: w.T }; });
  {
    const WG = winGeoms(), att = new Set(attached.map(x => x.pc));
    const others = pieces.filter(p => !att.has(p));
    for (const { pc, shared } of attached) {
      const keep = pc.cand.find(cd => { const g = geomOf(pc, cd); if (!shared.every(an => angDiff(an, g.ang) < 1)) return false;
        return WG.some(h => sameLine(g, h)) || others.some(o => o.cand.some(oc => sameLine(g, geomOf(o, oc)))); });
      if (keep) pc.cand = [keep]; else { extras.push(pc.poly); pieces.splice(pieces.indexOf(pc), 1); }
    }
  }
  /* 3c. orientação das peças ambíguas e agrupamento por eixo */
  const lineKey = (ang, off, t) => ({ ang, off, t });
  const lines = [];   // {ang,u,n,off,t, items:[{s0,s1,type,ref}]}
  const findLine = (ang, off, t, tTol) => lines.find(l => angDiff(l.ang, ang) < opt.angTol && Math.abs(l.off - off) < opt.colTol && (t == null || Math.abs(l.t - t) < (tTol || opt.colTol)));
  const addLine = (ang, u, off, t) => { const l = { ang, u, n: nrm(u), off, t, items: [] }; lines.push(l); return l; };
  const pieceGeom = (pc, cd) => { const d = canonDir(cd.u), n = nrm(d.u); const a = dot(pc.c, d.u); return { ang: d.ang, u: d.u, n, off: dot(pc.c, n), s0: a - cd.L/2, s1: a + cd.L/2, t: cd.T }; };
  // primeiro as peças sem ambiguidade (e as alongadas), depois as que têm 2 leituras
  const order = pieces.slice().sort((p, q) => (p.cand.length - q.cand.length) || (Math.max(...q.cand.map(c => c.L)) - Math.max(...p.cand.map(c => c.L))));
  const touches = (l, g) => l.items.some(it => g.s0 <= it.s1 + opt.joinTol && g.s1 >= it.s0 - opt.joinTol);
  const opensAsGeom = opens.filter(o => o.kind !== 'slide-door').map(o => ({ ang: o.ang, off: o.off, s0: o.s0, s1: o.s1, t: o.t }));
  for (const pc of order) {
    let pick = null;
    if (pc.cand.length === 1) pick = pieceGeom(pc, pc.cand[0]);
    else {
      const gs = pc.cand.map(c => pieceGeom(pc, c));
      const score = g => { const l = findLine(g.ang, g.off, g.t); let sc = 0; if (l && touches(l, g)) sc += 2; if (opensAsGeom.some(o => angDiff(o.ang, g.ang) < opt.angTol && Math.abs(o.off - g.off) < opt.colTol && g.s0 <= o.s1 + opt.joinTol && g.s1 >= o.s0 - opt.joinTol)) sc += 2; sc += (g.s1 - g.s0) > g.t ? 1 : 0; return sc; };
      pick = gs.slice().sort((a, b) => score(b) - score(a))[0];
    }
    const l = findLine(pick.ang, pick.off, pick.t) || addLine(pick.ang, pick.u, pick.off, pick.t);
    l.items.push({ s0: pick.s0, s1: pick.s1, type: 'wall' });
  }
  // aberturas → linha correspondente
  let orphan = 0;
  for (const o of opens) {
    let l = null;
    if (o.kind === 'slide-door') {
      // o traço fica a t/2+2 do eixo; procura a linha cuja face coincide e cujas peças tocam o vão
      l = lines.filter(L => angDiff(L.ang, o.ang) < opt.angTol && Math.abs(Math.abs(L.off - o.offLine) - (L.t/2 + 2)) < 1.2 && L.items.some(it => Math.abs(it.s1 - o.s0) < 2 || Math.abs(it.s0 - o.s1) < 2))[0];
    } else if (o.t != null) l = findLine(o.ang, o.off, o.t, 1.2) || findLine(o.ang, o.off, null);
    else l = lines.filter(L => angDiff(L.ang, o.ang) < opt.angTol && Math.abs(L.off - o.off) < opt.colTol).sort((a, b) => Math.abs(a.off - o.off) - Math.abs(b.off - o.off))[0];
    if (!l && o.t != null) l = addLine(o.ang, o.u, o.off, o.t);
    if (!l) { orphan++; continue; }
    // ajusta o vão às peças vizinhas (as faces das peças são mais exatas que o desenho da folha)
    let s0 = o.s0, s1 = o.s1;
    const walls = l.items.filter(it => it.type === 'wall');
    const left = walls.filter(it => Math.abs(it.s1 - s0) < 5).sort((a, b) => Math.abs(a.s1 - s0) - Math.abs(b.s1 - s0))[0];
    const right = walls.filter(it => Math.abs(it.s0 - s1) < 5).sort((a, b) => Math.abs(a.s0 - s1) - Math.abs(b.s0 - s1))[0];
    if (left) s0 = left.s1; if (right) s1 = right.s0;
    l.items.push({ s0, s1, type: 'op', o });
  }
  if (orphan) warnings.push(orphan + ' símbolo(s) de esquadria sem parede correspondente foram ignorados.');

  /* 3d. paredes = sequências contíguas de peças + vãos numa mesma linha */
  const walls = [];
  for (const l of lines) {
    const it = l.items.slice().sort((a, b) => a.s0 - b.s0);
    let run = null;
    const close = () => { if (run && run.items.some(x => x.type === 'wall')) walls.push(makeWall(l, run, texts, opt)); run = null; };
    for (const x of it) {
      if (run && x.s0 <= run.s1 + opt.joinTol) { run.items.push(x); run.s1 = Math.max(run.s1, x.s1); }
      else { close(); run = { s0: x.s0, s1: x.s1, items: [x] }; }
    }
    close();
  }
  // ordem estável: horizontais de cima para baixo, depois verticais, depois inclinadas
  walls.sort((a, b) => (a._rank - b._rank) || (a._off - b._off) || (a.a[0] - b.a[0]));
  walls.forEach(w => { delete w._rank; delete w._off; });
  const nOps = walls.reduce((n, w) => n + w.ops.length, 0);
  return { walls, extras, warnings, wallColor, stats: { pieces: pieces.length, windows: winRects.length, doors: opens.filter(o => o.kind === 'door').length, slideDoors: opens.filter(o => o.kind === 'slide-door').length, walls: walls.length, openings: nOps, extras: extras.length } };
}

const r2 = v => Math.round(v * 100) / 100;
function makeWall(l, run, texts, opt) {
  const P = s => [l.u[0] * s + l.n[0] * l.off, l.u[1] * s + l.n[1] * l.off];
  const a = P(run.s0), b = P(run.s1);
  const ops = [];
  for (const x of run.items.filter(x => x.type === 'op')) {
    const o = x.o, w = x.s1 - x.s0, c = (x.s0 + x.s1) / 2 - run.s0;
    const op = { c: r2(c), w: r2(w) };
    // rótulo "largura · altura/peitoril" ao lado do vão
    const mid = P((x.s0 + x.s1) / 2);
    const lab = nearestLabel(texts, mid, Math.max(40, l.t / 2 + 25));
    if (o.kind === 'slide' || o.kind === 'bascula') {
      op.kind = o.kind;
      if (lab && lab.h != null) { op.h = lab.h; op.sill = lab.sill; }
      else if (o.sill0) { op.h = opt.doorH; op.sill = 0; }
      else if (o.kind === 'bascula') { op.h = 50; op.sill = 160; }
      else { op.h = 100; op.sill = 110; }
      if (op.kind === 'slide') op.n = 2;
    } else if (o.kind === 'slide-door') { op.kind = 'slide-door'; op.sill = 0; op.h = opt.doorH; }
    else {
      op.kind = w >= 110 ? 'pivot' : 'door'; op.sill = 0; op.h = opt.doorH;
      // sentido de abertura (o eixo da parede vai de a para b = sentido crescente de s)
      const hinge = o.hingeAtStart ? 'a' : 'b', side = o.tipSide >= 0 ? 1 : -1;
      const leaf = r2(o.leaf), ang = o.swing || 90;
      op.door = { hinge, side, ang, leaf };
      if (op.kind === 'pivot') Object.assign(op.door, { mat: 'entry', th: 5 });
    }
    op._lab = lab ? lab.str : null;
    ops.push(op);
  }
  ops.sort((p, q) => p.c - q.c);
  const horiz = Math.abs(l.u[1]) < 1e-3, vert = Math.abs(l.u[0]) < 1e-3;
  return { a: a.map(r2), b: b.map(r2), t: r2(l.t), h: opt.wallH, ops, _rank: horiz ? 0 : vert ? 1 : 2, _off: horiz ? a[1] : vert ? a[0] : a[1] };
}
function nearestLabel(texts, p, maxD) {
  let best = null;
  for (const t of texts) {
    const m = t.str.replace(/\s+/g, ' ').match(/^(\d{2,4})\s*[·x×.\-]\s*(\d{2,3})\s*\/\s*(\d{1,3})$/);
    const d = hyp(t.x - p[0], t.y - p[1]); if (d > maxD) continue;
    if (m && (!best || d < best.d)) best = { d, str: t.str, w: +m[1], h: +m[2], sill: +m[3] };
  }
  return best;
}

/* ---------- 4. escala automática (sem texto "Escala") ---------- */
/** Testa escalas comuns e escolhe a que faz mais cotas numéricas coincidirem com medidas das peças. */
function guessScale(prims) {
  const nums = prims.texts.map(t => t.str.replace(',', '.')).filter(s => /^\d{2,5}(\.\d+)?$/.test(s)).map(Number);
  if (!nums.length) return null;
  let best = null;
  for (const den of [20, 25, 50, 75, 100, 125, 200, 250, 500]) {
    const r = detect(prims, den);
    if (!r.walls.length) continue;
    const meas = [];
    r.walls.forEach(w => { meas.push(hyp(w.b[0]-w.a[0], w.b[1]-w.a[1])); w.ops.forEach(o => meas.push(o.w)); });
    const hit = nums.filter(v => meas.some(m => Math.abs(m - v) <= Math.max(1, v * 0.01))).length;
    if (!best || hit > best.hit) best = { den, hit };
  }
  return best && best.hit >= 3 ? best.den : null;
}

/* ---------- 5. alinhamento (a origem do PDF é arbitrária) ---------- */
/** Translação que faz as faces das paredes de A coincidirem com as de B (votação por faces). */
function alignOffset(A, B) {
  const faces = (W, horiz) => { const v = []; for (const w of W) { const dx = w.b[0]-w.a[0], dz = w.b[1]-w.a[1]; const L = hyp(dx, dz) || 1;
    if (horiz && Math.abs(dz) / L < 1e-3) v.push({ c: w.a[1] - w.t/2, len: L }, { c: w.a[1] + w.t/2, len: L });
    if (!horiz && Math.abs(dx) / L < 1e-3) v.push({ c: w.a[0] - w.t/2, len: L }, { c: w.a[0] + w.t/2, len: L }); } return v; };
  const vote = (fa, fb) => { const bins = new Map(); for (const p of fa) for (const q of fb) { const d = Math.round((q.c - p.c) * 2) / 2; bins.set(d, (bins.get(d) || 0) + Math.min(p.len, q.len)); }
    let bd = 0, bv = -1; for (const [d, v] of bins) { const s = v + (bins.get(d - 0.5) || 0) + (bins.get(d + 0.5) || 0); if (s > bv) { bv = s; bd = d; } }
    // refina: média das diferenças próximas do pico
    let sum = 0, n = 0; for (const p of fa) for (const q of fb) { const d = q.c - p.c; if (Math.abs(d - bd) <= 0.8) { sum += d; n++; } } return n ? sum / n : bd; };
  return [vote(faces(A, false), faces(B, false)), vote(faces(A, true), faces(B, true))];
}
function translate(W, d) { return W.map(w => Object.assign({}, w, { a: [r2(w.a[0] + d[0]), r2(w.a[1] + d[1])], b: [r2(w.b[0] + d[0]), r2(w.b[1] + d[1])] })); }
/** Origem padrão quando não há referência: face externa esquerda em x=0 e face externa inferior em z=0. */
function normalizeOrigin(W) {
  let minX = 1e9, maxZ = -1e9;
  for (const w of W) { const dx = w.b[0]-w.a[0], dz = w.b[1]-w.a[1], L = hyp(dx, dz) || 1, nx = -dz/L, nz = dx/L;
    for (const p of [w.a, w.b]) for (const sg of [-1, 1]) { minX = Math.min(minX, p[0] + nx*sg*w.t/2); maxZ = Math.max(maxZ, p[1] + nz*sg*w.t/2); } }
  return translate(W, [-minX, -maxZ]);
}

/* ---------- 6. nomes de esquadrias (P1, J1, PJ1…) quando o PDF não traz o quadro ---------- */
function nameOpenings(floors) {
  const kinds = {}; const next = { P: 1, J: 1, PJ: 1 };
  for (const W of floors) for (const w of W) for (const o of w.ops) {
    if (o.name) continue;
    const pre = (o.kind === 'slide' && (o.sill || 0) === 0) ? 'PJ' : (o.kind === 'slide' || o.kind === 'bascula') ? 'J' : 'P';
    const key = pre + '|' + o.kind + '|' + Math.round(o.w / 5) * 5 + '|' + o.h + '|' + (o.sill || 0);
    if (!kinds[key]) kinds[key] = pre + (next[pre]++);
    o.name = kinds[key];
  }
}

/* ---------- 7. comparação com um gabarito (teste de aceite) ---------- */
function compare(got, ref) {
  const segKey = w => { const dx = w.b[0]-w.a[0], dz = w.b[1]-w.a[1]; return { L: hyp(dx, dz) }; };
  const ends = w => [w.a, w.b];
  const dist = (p, q) => hyp(p[0]-q[0], p[1]-q[1]);
  const used = new Set(), pairs = [], missing = [];
  for (const r of ref) {
    let best = null;
    got.forEach((g, i) => { if (used.has(i)) return; const d1 = Math.max(dist(g.a, r.a), dist(g.b, r.b)), d2 = Math.max(dist(g.a, r.b), dist(g.b, r.a)); const d = Math.min(d1, d2); if (!best || d < best.d) best = { i, d, flip: d2 < d1 }; });
    if (best && best.d < 30) { used.add(best.i); pairs.push({ r, g: got[best.i], d: best.d, flip: best.flip }); } else missing.push(r);
  }
  const extra = got.filter((g, i) => !used.has(i));
  let maxWall = 0, maxOp = 0, maxT = 0, opPairs = 0, opMissing = [], opExtra = 0, kindMismatch = [];
  for (const p of pairs) {
    maxWall = Math.max(maxWall, p.d); maxT = Math.max(maxT, Math.abs(p.g.t - p.r.t));
    const L = segKey(p.g).L;
    const gops = p.g.ops.map(o => Object.assign({}, o, { c: p.flip ? L - o.c : o.c }));
    const u = new Set();
    for (const ro of p.r.ops) {
      let b = null; gops.forEach((go, i) => { if (u.has(i)) return; const d = Math.max(Math.abs((go.c - go.w/2) - (ro.c - ro.w/2)), Math.abs((go.c + go.w/2) - (ro.c + ro.w/2))); if (!b || d < b.d) b = { i, d }; });
      if (b && b.d < 30) { u.add(b.i); opPairs++; maxOp = Math.max(maxOp, b.d); const go = gops[b.i];
        if (ro.door && go.door) { const gd = p.flip ? { hinge: go.door.hinge === 'a' ? 'b' : 'a', side: -go.door.side } : go.door; if (gd.hinge !== ro.door.hinge || gd.side !== ro.door.side || Math.abs(go.door.ang - ro.door.ang) > 2 || Math.abs(go.door.leaf - ro.door.leaf) > 1) kindMismatch.push({ wall: p.r.id, ref: JSON.stringify(ro.door), got: JSON.stringify(go.door) }); }
        if (go.kind !== ro.kind || (go.h != null && ro.h != null && go.h !== ro.h) || (go.sill || 0) !== (ro.sill || 0)) kindMismatch.push({ wall: p.r.id, ref: ro.kind + ' ' + ro.h + '/' + (ro.sill||0), got: go.kind + ' ' + go.h + '/' + (go.sill||0) }); }
      else opMissing.push({ wall: p.r.id, op: ro });
    }
    opExtra += gops.length - u.size;
  }
  return { walls: pairs.length, refWalls: ref.length, gotWalls: got.length, missing, extra, maxWall, maxT, openings: opPairs, refOpenings: ref.reduce((n, w) => n + w.ops.length, 0), opMissing, opExtra, maxOp, kindMismatch };
}

const API = { extractPage, scaleFromText, guessScale, ptPerCm, detect, alignOffset, translate, normalizeOrigin, nameOpenings, compare };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PDFIMP = API;
})(typeof window !== 'undefined' ? window : globalThis);
