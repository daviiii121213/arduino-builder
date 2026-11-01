/* ==========================================================================
   07b — Leitor automático de plantas (PDF vetorial ou imagem)
   Detecta paredes, portas (arcos de abertura), janelas, vãos e nomes de cômodos,
   deduz a escala pelas cotas, e gera objetos NORMAIS do projeto (paredes, aberturas,
   cômodos) — exatamente como se tivessem sido desenhados à mão.
   ========================================================================== */
const RG = AS.recognizer = { preview: null, lastReport: null };
const GG = AS.geo;

/* ---------- utilitários ---------- */
const mulM = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const apM = (M, x, y) => ({ x: M[0] * x + M[2] * y + M[4], y: M[1] * x + M[3] * y + M[5] });
const angOf = (a, b) => { let t = Math.atan2(b.y - a.y, b.x - a.x); if (t < 0) t += Math.PI; if (t >= Math.PI) t -= Math.PI; return t; };
const angDiff = (a, b) => { let d = Math.abs(a - b) % Math.PI; return Math.min(d, Math.PI - d); };

/** Interpreta texto de cota: "3,50" / "3.50" -> 350 cm; "350" -> 350 cm; "2,15m" etc. */
RG.parseDim = (s) => {
  const t = s.trim().toLowerCase().replace(/\s/g, '');
  let m = t.match(/^(\d{1,2})[.,](\d{2})m?$/); if (m) return (+m[1]) * 100 + (+m[2]);
  m = t.match(/^(\d{1,2})[.,](\d)m?$/); if (m) return (+m[1]) * 100 + (+m[2]) * 10;
  m = t.match(/^(\d{2,4})(cm)?$/); if (m) { const v = +m[1]; return v >= 30 && v <= 3000 ? v : null; }
  return null;
};
RG.parseScaleText = (s) => { const m = s.replace(/\s/g, '').match(/(?:esc(?:ala)?\.?:?)?1[:/](\d{2,4})\b/i); return m && +m[1] >= 10 && +m[1] <= 1000 ? +m[1] : null; };

RG.ROOM_WORDS = [['suíte|suite', 'suite'], ['quarto|dormit|dorm\\.', 'quarto'], ['banh|wc|w\\.c|lavabo|sanit|bwc', 'banheiro'], ['cozinha|copa', 'cozinha'], ['jantar', 'jantar'], ['sala|estar|living|tv', 'sala'], ['lavand|serviço|a\\.\\s?s|á\\.\\s?serv|a\\.\\s?serv', 'lavanderia'], ['garag|abrigo|vaga', 'garagem'], ['circula|hall|corredor|circ\\.', 'circulacao'], ['varanda|sacada|terraço|gourmet|alpendre|churrasq', 'varanda'], ['escrit|home\\s?office|estudo', 'escritorio'], ['depós|despensa|closet|dep\\.', 'deposito'], ['escada', 'escada']];
RG.roomTypeOf = (s) => { const t = s.trim(); const hit = RG.ROOM_WORDS.find(([re]) => new RegExp('^(' + re + ')', 'i').test(t)); return hit ? hit[1] : null; };

/* ---------- 1. extração vetorial do PDF (coordenadas em px da imagem de referência) ---------- */
RG.extractVector = async (pageNum, ptScale) => {
  const lib = window.pdfjsLib, doc = AS.importer.doc;
  if (!lib || !doc) return null;
  const page = await doc.getPage(pageNum), vp = page.getViewport({ scale: ptScale });
  const ops = await page.getOperatorList(), O = lib.OPS;
  const segs = [], arcs = [], fills = [];
  let ctm = [1, 0, 0, 1, 0, 0], lw = 1; const stack = [];
  let pending = []; // subcaminhos do último constructPath: [{pts:[...], closed, curves:[...]}]
  const full = () => mulM(vp.transform, ctm);
  const flush = (kind) => {
    const M = full(), sc = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])), wpx = Math.max(0.1, lw * sc);
    for (const sp of pending) {
      const P = sp.pts.map(p => apM(M, p.x, p.y));
      for (let i = 0; i < P.length - 1; i++) if (!sp.curveIdx.has(i)) segs.push({ a: P[i], b: P[i + 1], w: wpx, kind });
      if (sp.closed && P.length > 2 && GG.dist(P[0], P.at(-1)) > 0.01) segs.push({ a: P.at(-1), b: P[0], w: wpx, kind });
      if ((kind === 'fill' || kind === 'both') && P.length >= 3) fills.push(P);
      for (const c of sp.curves) arcs.push(c.map(p => apM(M, p.x, p.y)));
    }
    pending = [];
  };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    switch (fn) {
      case O.save: stack.push({ ctm: ctm.slice(), lw }); break;
      case O.restore: { const s = stack.pop(); if (s) { ctm = s.ctm; lw = s.lw; } break; }
      case O.transform: ctm = mulM(ctm, args); break;
      case O.setLineWidth: lw = args[0]; break;
      case O.paintFormXObjectBegin: stack.push({ ctm: ctm.slice(), lw }); if (args[0]) ctm = mulM(ctm, args[0]); break;
      case O.paintFormXObjectEnd: { const s = stack.pop(); if (s) { ctm = s.ctm; lw = s.lw; } break; }
      case O.constructPath: {
        const [sub, a] = args; let k = 0, cur = null, sp = null;
        const start = (p) => { sp = { pts: [p], closed: false, curves: [], curveIdx: new Set() }; pending.push(sp); cur = p; };
        for (const op of sub) {
          if (op === O.moveTo) { start({ x: a[k], y: a[k + 1] }); k += 2; }
          else if (op === O.lineTo) { const p = { x: a[k], y: a[k + 1] }; k += 2; if (!sp) start(cur || p); sp.pts.push(p); cur = p; }
          else if (op === O.curveTo || op === O.curveTo2 || op === O.curveTo3) {
            let c1, c2, p;
            if (op === O.curveTo) { c1 = { x: a[k], y: a[k + 1] }; c2 = { x: a[k + 2], y: a[k + 3] }; p = { x: a[k + 4], y: a[k + 5] }; k += 6; }
            else if (op === O.curveTo2) { c1 = cur; c2 = { x: a[k], y: a[k + 1] }; p = { x: a[k + 2], y: a[k + 3] }; k += 4; }
            else { c1 = { x: a[k], y: a[k + 1] }; p = { x: a[k + 2], y: a[k + 3] }; c2 = p; k += 4; }
            if (!sp) start(cur || c1);
            sp.curves.push([cur, c1, c2, p]); sp.curveIdx.add(sp.pts.length - 1); sp.pts.push(p); cur = p;
          }
          else if (op === O.closePath) { if (sp) { sp.closed = true; cur = sp.pts[0]; } }
          else if (op === O.rectangle) { const x = a[k], y = a[k + 1], w = a[k + 2], h = a[k + 3]; k += 4; start({ x, y }); sp.pts.push({ x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }); sp.closed = true; }
        }
        break;
      }
      case O.stroke: case O.closeStroke: if (fn === O.closeStroke) pending.forEach(s => s.closed = true); flush('stroke'); break;
      case O.fill: case O.eoFill: pending.forEach(s => s.closed = true); flush('fill'); break;
      case O.fillStroke: case O.eoFillStroke: case O.closeFillStroke: case O.closeEOFillStroke: pending.forEach(s => s.closed = true); flush('both'); break;
      case O.endPath: pending = []; break;
    }
  }
  // textos com direção e centro (px)
  const tc = await page.getTextContent(), texts = [];
  for (const it of tc.items) {
    const s = (it.str || '').trim(); if (!s) continue;
    const T = it.transform, dir = GG.norm({ x: T[0], y: T[1] }), up = GG.norm({ x: T[2], y: T[3] }), h = Math.hypot(T[2], T[3]) || it.height || 8;
    const c = { x: T[4] + dir.x * (it.width || 0) / 2 + up.x * h * 0.35, y: T[5] + dir.y * (it.width || 0) / 2 + up.y * h * 0.35 };
    const P = apM(vp.transform, c.x, c.y), Q = apM(vp.transform, c.x + dir.x * 10, c.y + dir.y * 10);
    texts.push({ str: s, c: P, ang: angOf(P, Q), h: h * ptScale });
  }
  return { segs, arcs, fills, texts };
};

/* ---------- 2. escala: cotas casadas com linhas de cota, ou texto "1:N" ---------- */
RG.inferScale = (vec, ptScale) => {
  const ratios = [];
  const lines = vec.segs.filter(s => GG.dist(s.a, s.b) > 15);
  for (const t of vec.texts) {
    const v = RG.parseDim(t.str); if (!v) continue;
    let best = null, bd = Infinity;
    for (const s of lines) {
      if (angDiff(angOf(s.a, s.b), t.ang) > AS.rad(3)) continue;
      const L = GG.dist(s.a, s.b), pr = GG.projLine(t.c, s.a, s.b);
      if (pr.t < 0.15 || pr.t > 0.85) continue;
      const d = GG.dist(pr.p, t.c); if (d > Math.max(6, t.h * 2.2)) continue;
      // prefere a linha mais próxima cujo centro coincide com o texto
      const score = d + Math.abs(pr.t - 0.5) * L * 0.3;
      if (score < bd) { bd = score; best = { L }; }
    }
    if (best) ratios.push(v / best.L);
  }
  let fromDims = null;
  if (ratios.length >= 2) {
    let bestC = [];
    for (const r of ratios) { const c = ratios.filter(x => Math.abs(x - r) / r < 0.03); if (c.length > bestC.length) bestC = c; }
    if (bestC.length >= 2) { bestC.sort((a, b) => a - b); fromDims = { scale: bestC[Math.floor(bestC.length / 2)], support: bestC.length, total: ratios.length }; }
  }
  let fromText = null;
  for (const t of vec.texts) { const N = RG.parseScaleText(t.str); if (N) { fromText = { N, scale: 0.0352778 * N / ptScale }; break; } }
  return { fromDims, fromText };
};

/* ---------- 3. paredes candidatas por pares de linhas paralelas e traços grossos ---------- */
RG.wallsFromVector = (segsCm, o) => {
  const E = segsCm.filter(s => s.len >= o.minLen * 0.6);
  for (const e of E) { e.ang = angOf(e.a, e.b); e.d = GG.norm(GG.sub(e.b, e.a)); e.n = GG.perp(e.d); e.cov = { 1: [], '-1': [] }; }
  const buckets = new Map(); const bk = (a) => Math.round(AS.deg(a)) % 180;
  E.forEach((e, i) => { const k = bk(e.ang); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); });
  const pairs = [];
  E.forEach((e, i) => {
    const k = bk(e.ang);
    for (const kk of [k - 1, k, k + 1]) for (const j of buckets.get((kk + 180) % 180) || []) {
      if (j <= i) continue; const f = E[j];
      if (angDiff(e.ang, f.ang) > AS.rad(2)) continue;
      const mid = GG.lerp(f.a, f.b, 0.5), off = GG.dot(GG.sub(mid, e.a), e.n), dist = Math.abs(off);
      if (dist < o.minT || dist > o.maxT) continue;
      const s1 = GG.dot(GG.sub(f.a, e.a), e.d), s2 = GG.dot(GG.sub(f.b, e.a), e.d);
      const lo = Math.max(0, Math.min(s1, s2)), hi = Math.min(e.len, Math.max(s1, s2));
      if (hi - lo < Math.min(o.minLen, 0.6 * Math.min(e.len, f.len))) continue;
      pairs.push({ i, j, dist, off, lo, hi });
    }
  });
  pairs.sort((p, q) => p.dist - q.dist);
  const covered = (list, lo, hi) => { let c = 0; for (const [a, b] of list) c += Math.max(0, Math.min(hi, b) - Math.max(lo, a)); return c / (hi - lo); };
  const out = [];
  for (const p of pairs) {
    const e = E[p.i], f = E[p.j], side = Math.sign(p.off);
    const fs1 = GG.dot(GG.sub(GG.add(e.a, GG.mul(e.d, p.lo)), f.a), f.d), fs2 = GG.dot(GG.sub(GG.add(e.a, GG.mul(e.d, p.hi)), f.a), f.d);
    const flo = Math.min(fs1, fs2), fhi = Math.max(fs1, fs2);
    const fside = Math.sign(GG.dot(GG.sub(e.a, f.a), f.n));
    if (covered(e.cov[side], p.lo, p.hi) > 0.5 || covered(f.cov[fside], flo, fhi) > 0.5) continue;
    e.cov[side].push([p.lo, p.hi]); f.cov[fside].push([flo, fhi]);
    const shift = GG.mul(e.n, p.off / 2);
    out.push({ a: GG.add(GG.add(e.a, GG.mul(e.d, p.lo)), shift), b: GG.add(GG.add(e.a, GG.mul(e.d, p.hi)), shift), t: p.dist, src: 'par' });
  }
  for (const s of segsCm) if (s.kind !== 'fill' && s.wcm >= o.minT && s.wcm <= o.maxT && s.len >= o.minLen) out.push({ a: s.a, b: s.b, t: s.wcm, src: 'traço' });
  return out;
};

/* ---------- 4. limpeza: funde colineares, remove contidas ---------- */
RG.mergeCollinear = (W) => {
  let changed = true, guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    outer: for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
      const A = W[i], B = W[j];
      if (angDiff(angOf(A.a, A.b), angOf(B.a, B.b)) > AS.rad(2.5)) continue;
      const d = GG.norm(GG.sub(A.b, A.a)), n = GG.perp(d), LA = GG.dist(A.a, A.b);
      const offA = GG.dot(GG.sub(B.a, A.a), n), offB = GG.dot(GG.sub(B.b, A.a), n);
      if (Math.abs((offA + offB) / 2) > Math.max(A.t, B.t) / 2 + 0.5) continue;
      const s1 = GG.dot(GG.sub(B.a, A.a), d), s2 = GG.dot(GG.sub(B.b, A.a), d), lo = Math.min(s1, s2), hi = Math.max(s1, s2);
      const gap = Math.max(lo - LA, -hi);
      if (gap > 1.5) continue;
      if (Math.max(A.t, B.t) / Math.min(A.t, B.t) > 1.6) {
        // espessuras muito diferentes: a mais fina contida na mais grossa é descartada
        const thin = A.t < B.t ? A : B, thick = thin === A ? B : A;
        const td = GG.norm(GG.sub(thick.b, thick.a)), Lt = GG.dist(thick.a, thick.b);
        const t1 = GG.dot(GG.sub(thin.a, thick.a), td), t2 = GG.dot(GG.sub(thin.b, thick.a), td);
        if (Math.min(t1, t2) >= -thick.t && Math.max(t1, t2) <= Lt + thick.t) { W.splice(W.indexOf(thin), 1); changed = true; break outer; }
        continue;
      }
      const L0 = Math.min(0, lo), L1 = Math.max(LA, hi), w0 = LA, w1 = hi - lo;
      const base = GG.add(A.a, GG.mul(n, (offA + offB) / 2 * w1 / (w0 + w1)));
      W[i] = { ...A, a: GG.add(base, GG.mul(d, L0)), b: GG.add(base, GG.mul(d, L1)), t: (A.t * w0 + B.t * w1) / (w0 + w1) };
      W.splice(j, 1); changed = true; break outer;
    }
  }
  // remove paredes cujo eixo fica dentro do corpo de outra mais grossa (hachuras, linhas internas)
  return W.filter(w => !W.some(v => v !== w && v.t > w.t * 1.15 && (() => { const pa = GG.projSeg(w.a, v.a, v.b), pb = GG.projSeg(w.b, v.a, v.b); return pa.d < v.t / 2 && pb.d < v.t / 2; })()));
};

/* ---------- 5. junta cantos (L e T) ---------- */
RG.joinCorners = (W) => {
  for (const w of W) for (const e of ['a', 'b']) {
    const p = w[e], other = e === 'a' ? w.b : w.a, u = GG.norm(GG.sub(p, other));
    let best = null, bd = Infinity;
    for (const v of W) {
      if (v === w || angDiff(angOf(w.a, w.b), angOf(v.a, v.b)) < AS.rad(20)) continue;
      const X = GG.lineInter(w.a, w.b, v.a, v.b); if (!X) continue;
      const along = GG.dot(GG.sub(X, p), u), dist = GG.dist(X, p);
      const reach = Math.max(v.t, w.t) * 0.75 + 25;
      if (dist > reach || along < -(v.t / 2 + w.t)) continue; // não encurta demais
      const Lv = GG.dist(v.a, v.b), tv = GG.dot(GG.sub(X, v.a), GG.norm(GG.sub(v.b, v.a)));
      if (tv < -reach || tv > Lv + reach) continue;
      if (dist < bd) { bd = dist; best = X; }
    }
    if (best) w[e] = { ...best };
  }
  return W;
};

/* ---------- 6. arcos de porta ---------- */
RG.doorArcs = (arcsCm) => {
  const raw = [];
  for (const [p0, c1, c2, p3] of arcsCm) {
    const t0 = GG.sub(c1, p0), t3 = GG.sub(p3, c2); if (GG.len(t0) < 1e-6 || GG.len(t3) < 1e-6) continue;
    const C = GG.lineInter(p0, GG.add(p0, GG.perp(t0)), p3, GG.add(p3, GG.perp(t3))); if (!C) continue;
    const r0 = GG.dist(C, p0), r3 = GG.dist(C, p3); if (Math.abs(r0 - r3) / Math.max(r0, r3) > 0.12) continue;
    const r = (r0 + r3) / 2; if (r < 45 || r > 180) continue;
    const a0 = Math.atan2(p0.y - C.y, p0.x - C.x), a3 = Math.atan2(p3.y - C.y, p3.x - C.x);
    let sw = Math.abs(a3 - a0); if (sw > Math.PI) sw = 2 * Math.PI - sw;
    raw.push({ c: C, r, p0, p3, sw });
  }
  // agrupa segmentos do mesmo arco
  const arcs = [];
  for (const a of raw) { const g = arcs.find(x => GG.dist(x.c, a.c) < x.r * 0.06 && Math.abs(x.r - a.r) < x.r * 0.08); if (g) { g.sw += a.sw; g.pts.push(a.p0, a.p3); } else arcs.push({ c: a.c, r: a.r, sw: a.sw, pts: [a.p0, a.p3] }); }
  return arcs.filter(a => a.sw > AS.rad(55) && a.sw < AS.rad(125));
};

/* ---------- 7. preenche vãos entre paredes colineares com portas / janelas / vãos livres ---------- */
RG.fillGaps = (W, arcs, winCands, mode) => {
  const openings = []; let changed = true, guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    outer: for (let i = 0; i < W.length; i++) for (let j = 0; j < W.length; j++) {
      if (i === j) continue; const A0 = W[i], B = W[j];
      if (angDiff(angOf(A0.a, A0.b), angOf(B.a, B.b)) > AS.rad(3)) continue;
      if (Math.max(A0.t, B.t) / Math.min(A0.t, B.t) > 1.7) continue;
      // orienta A para que o vão fique na ponta final (b)
      const d0 = GG.norm(GG.sub(A0.b, A0.a)), mB = GG.dot(GG.sub(GG.lerp(B.a, B.b, 0.5), A0.a), d0);
      const A = mB < 0 ? { ...A0, a: A0.b, b: A0.a } : A0;
      const d = GG.norm(GG.sub(A.b, A.a)), n = GG.perp(d), LA = GG.dist(A.a, A.b);
      const off = (GG.dot(GG.sub(B.a, A.a), n) + GG.dot(GG.sub(B.b, A.a), n)) / 2; if (Math.abs(off) > Math.max(A.t, B.t) / 2) continue;
      const s1 = GG.dot(GG.sub(B.a, A.a), d), s2 = GG.dot(GG.sub(B.b, A.a), d), lo = Math.min(s1, s2), hi = Math.max(s1, s2);
      const g = lo - LA; if (g < 45 || g > 320) continue; // B começa depois do fim de A
      const gp0 = GG.add(A.a, GG.mul(d, LA)), gp1 = GG.add(A.a, GG.mul(d, lo)), c = GG.lerp(gp0, gp1, 0.5);
      const T = (A.t + B.t) / 2;
      // linhas paralelas finas dentro do vão = caixilho de janela; parede grossa ou transversal = não é vão
      const inGap = [], gl = GG.dist(gp0, gp1); let blocked = false;
      for (const v of W) {
        if (v === A0 || v === B) continue;
        const par = angDiff(angOf(v.a, v.b), angOf(A.a, A.b)) < AS.rad(3);
        const m = GG.lerp(v.a, v.b, 0.5), pr = GG.projSeg(m, gp0, gp1);
        if (par && pr.d < T * 0.75 && pr.t > 0.02 && pr.t < 0.98 && GG.dist(v.a, v.b) <= gl + T) { if (v.t < 0.75 * T) inGap.push(v); else blocked = true; continue; }
        if (GG.projSeg(c, v.a, v.b).d < v.t / 2 + 2) blocked = true;
      }
      if (blocked) continue;
      let op = null;
      // porta: arco com dobradiça numa das pontas do vão e raio ~ largura do vão (ou metade, porta dupla)
      const near = arcs.filter(a => Math.min(GG.dist(a.c, gp0), GG.dist(a.c, gp1)) < T + 20);
      const single = near.find(a => a.r > g * 0.7 && a.r < g * 1.3);
      const dbl = near.filter(a => a.r > g * 0.35 && a.r < g * 0.65);
      if (single) {
        const atStart = GG.dist(single.c, gp0) < GG.dist(single.c, gp1);
        const mid = single.pts.reduce((s, p) => GG.add(s, p), { x: 0, y: 0 }); const m = GG.mul(mid, 1 / single.pts.length);
        op = { kind: 'door', type: 'giro', width: g, hingeAt: atStart ? gp0 : gp1, sideRef: m, note: 'Porta lida do PDF (arco de abertura)' };
        arcs.splice(arcs.indexOf(single), 1);
      } else if (dbl.length >= 2) {
        op = { kind: 'door', type: 'dupla', width: g, sideRef: dbl[0].pts[0], note: 'Porta dupla lida do PDF' };
        dbl.forEach(a => arcs.splice(arcs.indexOf(a), 1));
      } else {
        const wc = winCands.find(w => { const m = GG.lerp(w.a, w.b, 0.5), pr = GG.projSeg(m, gp0, gp1); return pr.d < T && pr.t > 0.05 && pr.t < 0.95; });
        if (wc || inGap.length) { op = { kind: 'window', type: 'correr', width: g, note: 'Janela lida do PDF (peitoril e altura estimados)' }; if (wc) winCands.splice(winCands.indexOf(wc), 1); }
        else if (mode === 'raster' && g <= 115) op = { kind: 'door', type: 'giro', width: g, note: 'Vão interpretado como porta (tipo estimado)' };
        else if (g <= 260) op = { kind: 'door', type: 'passagem', width: g, note: 'Vão livre detectado' };
      }
      if (!op) continue;
      op.c = c; openings.push(op);
      const farB = s1 > s2 ? B.a : B.b;
      const merged = { ...A, b: { ...farB }, t: (A.t * LA + B.t * (hi - lo)) / (LA + hi - lo) };
      for (const v of [B, ...(op.kind === 'window' ? inGap : [])]) W.splice(W.indexOf(v), 1);
      W[W.indexOf(A0)] = merged; changed = true; break outer;
    }
  }
  return openings;
};


/* ---------- leitura de imagem: faixas escuras horizontais/verticais ---------- */
RG.scanRaster = async (o) => {
  const bg = AS.floor().bg, img = await AS.importer.loadImg(S.project.assets[bg.asset]);
  const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H).data, thr = o.threshold ?? 110, dark = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) dark[i] = (0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]) < thr ? 1 : 0;
  const cmPx = bg.scale / k, minLen = Math.max(8, o.minLen * 0.6 / cmPx);
  const toPlan = (q) => { let x = q.x / k * bg.scale, y = q.y / k * bg.scale; if (bg.rot) { const r = GG.rot({ x, y }, AS.rad(bg.rot)); x = r.x; y = r.y; } return { x: bg.x + x, y: bg.y + y }; };
  const lines = [], thick = [];
  const scan = (horiz) => {
    const A = horiz ? H : W, B = horiz ? W : H, at = (a, b) => horiz ? dark[a * W + b] : dark[b * W + a];
    const open = []; // faixas em crescimento
    const done = [];
    for (let a = 0; a <= A; a++) {
      const runs = [];
      if (a < A) { let st = -1; for (let b = 0; b <= B; b++) { const d = b < B && at(a, b); if (d && st < 0) st = b; if (!d && st >= 0) { if (b - st >= minLen) runs.push([st, b]); st = -1; } } }
      const used = new Set();
      for (let i = open.length - 1; i >= 0; i--) {
        const bd = open[i]; const ri = runs.findIndex((r, j) => !used.has(j) && Math.min(bd.e, r[1]) - Math.max(bd.s, r[0]) > 0.8 * Math.min(bd.e - bd.s, r[1] - r[0]));
        if (ri >= 0) { used.add(ri); const r = runs[ri]; bd.a1 = a; bd.s = Math.max(bd.s, r[0]); bd.e = Math.min(bd.e, r[1]); if (bd.e - bd.s < minLen) { done.push(bd); open.splice(i, 1); } }
        else { done.push(bd); open.splice(i, 1); }
      }
      runs.forEach((r, j) => { if (!used.has(j)) open.push({ a0: a, a1: a, s: r[0], e: r[1] }); });
    }
    // une faixas vizinhas (mesma parede quebrada por emenda/antialiasing), tolerando 2 px de folga
    done.sort((x, y) => x.a0 - y.a0);
    for (let i = 0; i < done.length; i++) for (let j = i + 1; j < done.length; j++) {
      const x = done[i], y = done[j]; if (!x || !y) continue;
      if (y.a0 > x.a1 + 3) continue;
      const ov = Math.min(x.e, y.e) - Math.max(x.s, y.s);
      if (ov > 0.8 * Math.min(x.e - x.s, y.e - y.s) && Math.abs((x.e - x.s) - (y.e - y.s)) < 0.25 * Math.max(x.e - x.s, y.e - y.s)) {
        x.a1 = Math.max(x.a1, y.a1); x.s = Math.min(x.s, y.s); x.e = Math.max(x.e, y.e); done[j] = null; j = i;
      }
    }
    for (const bd of done.filter(Boolean)) {
      const t = bd.a1 - bd.a0 + 1, c = (bd.a0 + bd.a1 + 1) / 2;
      const p = horiz ? [{ x: bd.s, y: c }, { x: bd.e, y: c }] : [{ x: c, y: bd.s }, { x: c, y: bd.e }];
      const a = toPlan(p[0]), b = toPlan(p[1]), tcm = t * cmPx;
      if (tcm >= o.minT && tcm <= o.maxT) thick.push({ a, b, t: tcm, src: 'imagem' });
      else if (tcm < o.minT) lines.push({ a, b, len: GG.dist(a, b), wcm: tcm, kind: 'stroke' });
    }
  };
  scan(true); scan(false);
  return { lines, thick };
};

/* ---------- pipeline principal ---------- */
RG.recognize = async (opts = {}) => {
  const fl = AS.floor(), bg = fl.bg; if (!bg) throw new Error('Importe primeiro o PDF ou a imagem da planta.');
  const o = { minT: 5, maxT: 45, minLen: 40, ...opts };
  const report = { mode: '', scale: bg.scale, scaleSource: bg.calibrated ? 'calibração manual' : 'não calibrada', warnings: [], counts: {} };
  const imgToPlan = (scale) => (q) => { let x = q.x * scale, y = q.y * scale; if (bg.rot) { const r = GG.rot({ x, y }, AS.rad(bg.rot)); x = r.x; y = r.y; } return { x: bg.x + x, y: bg.y + y }; };
  let cand = [], arcs = [], texts = [], scale = bg.scale;
  let vec = null;
  const canVector = AS.importer.doc && bg.source && bg.source === AS.importer.fileName;
  if (canVector) { try { vec = await RG.extractVector(bg.page || 1, bg.ptScale || 1); } catch (e) { console.warn(e); report.warnings.push('Falha ao ler os vetores do PDF: ' + e.message); } }
  const vectorUsable = vec && vec.segs.length >= 12;
  if (vectorUsable) {
    report.mode = 'vetorial';
    if (!bg.calibrated || opts.forceScaleInference) {
      const inf = RG.inferScale(vec, bg.ptScale || 1);
      if (inf.fromDims) { scale = inf.fromDims.scale; report.scaleSource = `deduzida de ${inf.fromDims.support} de ${inf.fromDims.total} cotas do PDF`; }
      else if (inf.fromText) { scale = inf.fromText.scale; report.scaleSource = `texto “escala 1:${inf.fromText.N}” do PDF`; }
      else report.warnings.push('Não foi possível deduzir a escala pelas cotas. As medidas usam a escala atual: calibre com uma cota conhecida e rode o leitor de novo.');
    }
    const P = imgToPlan(scale);
    const segsCm = vec.segs.map(s => { const a = P(s.a), b = P(s.b); return { a, b, len: GG.dist(a, b), wcm: s.w * scale, kind: s.kind }; }).filter(s => s.len > 1);
    cand = RG.wallsFromVector(segsCm, o);
    arcs = RG.doorArcs(vec.arcs.map(c => c.map(P)));
    texts = vec.texts.map(t => ({ ...t, p: P(t.c) }));
  } else {
    report.mode = 'imagem (raster)';
    if (canVector && vec) report.warnings.push('O PDF não tem desenho vetorial nesta página (provavelmente digitalizado); foi usada a leitura da imagem.');
    if (!bg.calibrated) report.warnings.push('Escala não calibrada: calibre com uma cota conhecida antes de aplicar, senão as medidas ficarão erradas.');
    const r = await RG.scanRaster(o);
    // paredes preenchidas viram candidatas direto; paredes em contorno saem dos pares de linhas finas
    cand = r.thick.concat(RG.wallsFromVector(r.lines, o));
    if (bg.text?.length) texts = bg.text.map(t => ({ str: t.str, p: imgToPlan(scale)({ x: t.x, y: t.y }) }));
  }
  report.scale = scale;
  // espessura típica e separação de candidatas finas (linhas de janela)
  cand = cand.filter(w => GG.dist(w.a, w.b) >= 15);
  const byT = cand.filter(w => w.t >= o.minT).map(w => ({ t: w.t, L: GG.dist(w.a, w.b) })).sort((a, b) => a.t - b.t);
  const totL = byT.reduce((s, x) => s + x.L, 0); let acc = 0, typical = 15;
  for (const x of byT) { acc += x.L; if (acc >= totL / 2) { typical = x.t; break; } }
  const thin = cand.filter(w => w.t < Math.min(typical * 0.6, 9.5) || w.t < o.minT);
  let walls = cand.filter(w => !thin.includes(w) && GG.dist(w.a, w.b) >= o.minLen * 0.5);
  walls = RG.mergeCollinear(walls);
  walls = walls.filter(w => GG.dist(w.a, w.b) >= o.minLen * 0.75 || w.t >= typical * 0.8);
  RG.joinCorners(walls);
  walls = RG.mergeCollinear(walls);
  const openings = RG.fillGaps(walls, arcs, thin.slice(), vectorUsable ? 'vector' : 'raster');
  RG.joinCorners(walls);
  // descarta segmentos isolados (linhas de cota, contornos de móveis): parede real encosta em outra
  const touches = (w, p) => walls.some(v => v !== w && (GG.projSeg(p, v.a, v.b).d < v.t / 2 + w.t / 2 + 3));
  const before = walls.length;
  walls = walls.filter(w => touches(w, w.a) || touches(w, w.b) || walls.some(v => v !== w && (GG.projSeg(v.a, w.a, w.b).d < w.t / 2 + 3 || GG.projSeg(v.b, w.a, w.b).d < w.t / 2 + 3)));
  if (before - walls.length) report.warnings.push(`${before - walls.length} segmento(s) isolado(s) ignorado(s) (provavelmente cotas ou móveis).`);

  // ---- monta um pavimento temporário com objetos reais ----
  const tmp = AS.newFloor(fl.name, fl.elevation); tmp.height = fl.height;
  for (const w of walls) AS.addWall(w.a, w.b, { floor: tmp, thickness: Math.round(AS.clamp(w.t, 4, 60) * 2) / 2, height: fl.height || 280, note: 'Reconhecida do PDF' });
  for (const w of tmp.walls) { w.a = { x: Math.round(w.a.x * 2) / 2, y: Math.round(w.a.y * 2) / 2 }; w.b = { x: Math.round(w.b.x * 2) / 2, y: Math.round(w.b.y * 2) / 2 }; }
  AS.autoFix(tmp); AS.splitAtIntersections(tmp);
  let nDoor = 0, nWin = 0, nPass = 0;
  for (const op of openings) {
    let host = null, bd = Infinity;
    for (const w of tmp.walls) { const pr = GG.projSeg(op.c, w.a, w.b), L = AS.wallLen(w); if (pr.d < bd && pr.d < w.thickness && pr.t * L >= op.width / 2 - 2 && pr.t * L <= L - op.width / 2 + 2) { bd = pr.d; host = { w, t: pr.t * L }; } }
    if (!host) continue;
    const extra = { width: Math.round(op.width), type: op.type, note: op.note };
    if (op.kind === 'door') {
      const n = GG.perp(AS.wallDir(host.w));
      if (op.sideRef) extra.side = Math.sign(GG.dot(GG.sub(op.sideRef, op.c), n)) || 1;
      if (op.hingeAt) { const dA = GG.dot(GG.sub(op.hingeAt, host.w.a), AS.wallDir(host.w)); extra.hinge = dA < host.t ? 'a' : 'b'; }
      if (op.type === 'passagem') { extra.height = 210; nPass++; } else nDoor++;
    } else nWin++;
    AS.addOpening(op.kind, host.w, host.t, extra, tmp);
  }
  // cômodos: nomes do PDF
  const det0 = AS.detectRooms(tmp);
  let nLabels = 0;
  for (const t of texts) {
    const ty = RG.roomTypeOf(t.str); if (!ty) continue;
    if (tmp.roomMeta.some(m => GG.dist(m.anchor, t.p) < 60)) continue;
    const room = det0.rooms.find(r => GG.inPoly(t.p, r.poly));
    if (room && tmp.roomMeta.some(m => GG.inPoly(m.anchor, room.poly))) continue; // um nome por cômodo
    const nm = t.str.trim(); AS.addRoomMeta(t.p, nm.charAt(0).toUpperCase() + nm.slice(1).toLowerCase(), ty, tmp, { note: 'Nome lido do PDF' }); nLabels++;
  }
  // paredes externas: as que fazem fronteira com o exterior (apenas um cômodo de um lado)
  const det = AS.detectRooms(tmp);
  const useCount = new Map(); det.rooms.forEach(r => r.wallIds.forEach(id => useCount.set(id, (useCount.get(id) || 0) + 1)));
  const maxT = Math.max(...tmp.walls.map(w => w.thickness), 0);
  for (const w of tmp.walls) if (useCount.get(w.id) === 1 || (!useCount.get(w.id) && w.thickness >= Math.max(18, typical * 1.2))) { w.type = 'exterior'; w.material = 'pint_gelo'; w.materialExt = 'textura_ext'; }
  // cômodos sem nome ficam sinalizados
  for (const r of det.rooms) if (!r.meta) AS.addRoomMeta(GG.labelPoint(r.inner), 'Cômodo (sem nome no PDF)', 'outro', tmp, { uncertain: true });
  report.counts = { walls: tmp.walls.length, doors: nDoor, windows: nWin, passages: nPass, rooms: det.rooms.length, named: nLabels, typical: Math.round(typical) };
  if (!tmp.walls.length) report.warnings.push('Nenhuma parede reconhecida. Ajuste espessuras mínima/máxima, calibre a escala ou use o modo de decalque manual.');
  if (det.rooms.length === 0 && tmp.walls.length) report.warnings.push('As paredes não formam cômodos fechados; revise cantos e vãos depois de aplicar.');
  RG.lastReport = report;
  return { floor: tmp, report, scale };
};

/** Mostra prévia sobre a planta */
RG.showPreview = (res) => {
  const fl = AS.floor();
  RG.preview = { ...res, oldScale: fl.bg.scale };
  if (res.scale !== fl.bg.scale) fl.bg.scale = res.scale; // alinha a referência à escala deduzida durante a prévia
  R2.req();
};
RG.discard = () => { const fl = AS.floor(); if (RG.preview && fl.bg) fl.bg.scale = RG.preview.oldScale; RG.preview = null; R2.req(); };

/** Aplica: as paredes reconhecidas passam a ser paredes normais do projeto */
RG.apply = (replace) => {
  const pv = RG.preview; if (!pv) return;
  const fl = AS.floor(), tmp = pv.floor;
  fl.bg.scale = pv.oldScale; // restaura para o histórico registrar a mudança
  AS.history.run(pv.report.extra ? 'Mapear linhas da imagem' : 'Reconhecer planta do PDF', () => {
    if (replace) { fl.walls = []; fl.openings = []; fl.roomMeta = []; }
    if (pv.scale !== fl.bg.scale) { fl.bg.scale = pv.scale; fl.bg.calibrated = true; fl.bg.scaleSource = pv.report.scaleSource; }
    fl.walls.push(...tmp.walls); fl.openings.push(...tmp.openings); fl.roomMeta.push(...tmp.roomMeta);
    if (!replace) { AS.autoFix(fl); AS.splitAtIntersections(fl); AS.fixOpenings(fl); }
    S.project.meta = { ...(S.project.meta || {}), source: 'pdf', file: fl.bg.source || S.project.meta?.file, recognition: { ...pv.report, at: new Date().toISOString() } };
  });
  RG.preview = null; R2.req();
  const c = pv.report.counts;
  AS.toast(pv.report.extra ? `${c.walls} paredes adicionadas a partir das linhas da imagem (${c.rooms} cômodos fechados)` : `${c.walls} paredes, ${c.doors} portas, ${c.windows} janelas e ${c.rooms} cômodos adicionados ao projeto`, 'ok');
};

/* overlay da prévia */
{
  const base = R2.overlay;
  R2.overlay = (ctx, v, C) => {
    const pv = RG.preview;
    if (pv && S.project.activeFloor && AS.floor().bg) {
      const tmp = pv.floor;
      ctx.save();
      for (const r of AS.detectRooms(tmp).rooms) { R2.path(ctx, r.inner, v); ctx.fillStyle = C.ok; ctx.globalAlpha = 0.12; ctx.fill(); }
      ctx.globalAlpha = 0.75;
      for (const w of tmp.walls) { R2.path(ctx, R2.wallPoly(w), v); ctx.fillStyle = w.type === 'exterior' ? C.sel : C.accent; ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const o of tmp.openings) { const w = tmp.walls.find(x => x.id === o.wallId); if (w) R2.drawOpening(ctx, o, w, v, { ...C, ink: C.ok, paper: C.paper }, false, false, tmp); }
      ctx.font = '600 12px "Archivo", sans-serif'; ctx.textAlign = 'center';
      for (const m of tmp.roomMeta) { const q = R2.toScreen(m.anchor, v); ctx.fillStyle = m.uncertain ? C.warn : C.ok; ctx.fillText(m.name.toUpperCase(), q.x, q.y); }
      ctx.textAlign = 'left'; ctx.restore();
    }
    base(ctx, v, C);
  };
}
