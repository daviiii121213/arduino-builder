/* ==========================================================================
   03 — Renderização 2D da planta (Canvas). Também usada para exportar PNG/PDF.
   ========================================================================== */
const R2 = AS.r2d = {
  canvas: null, ctx: null, dpr: 1,
  view: { s: 0.6, ox: 0, oy: 0 }, // px por cm, deslocamento em px
  w: 0, h: 0,
  overlay: null, // desenhado pelo editor (preview, guias, marquee)
  imgs: {},      // cache de imagens de fundo
  dirty: true,
};

R2.colors = () => {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  return { paper: g('--canvas'), grid: g('--grid'), gridMajor: g('--grid-major'), wall: g('--wall'), wallFill: g('--wall-fill'), ink: g('--ink'), muted: g('--muted'), accent: g('--accent'), sel: g('--sel'), dim: g('--dim'), room: g('--room-label'), warn: g('--warn'), ok: g('--ok') };
};

R2.init = (canvas) => {
  R2.canvas = canvas; R2.ctx = canvas.getContext('2d');
  const ro = new ResizeObserver(() => R2.resize()); ro.observe(canvas.parentElement);
  R2.resize();
  const loop = () => { if (R2.dirty) { R2.dirty = false; R2.draw(); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
};
R2.req = () => { R2.dirty = true; };
R2.resize = () => {
  const el = R2.canvas.parentElement, r = el.getBoundingClientRect();
  R2.dpr = Math.min(2, window.devicePixelRatio || 1);
  const nw = Math.max(10, r.width), nh = Math.max(10, r.height);
  // mantém o centro da vista ao redimensionar (abrir/fechar painéis)
  if (R2.w > 50 && R2.h > 50 && !R2.needFit) { R2.view.ox += (nw - R2.w) / 2; R2.view.oy += (nh - R2.h) / 2; }
  R2.w = nw; R2.h = nh;
  R2.canvas.width = R2.w * R2.dpr; R2.canvas.height = R2.h * R2.dpr;
  R2.canvas.style.width = R2.w + 'px'; R2.canvas.style.height = R2.h + 'px';
  if (R2.needFit && R2.w >= 120 && R2.h >= 120 && S.project) R2.fit();
  R2.req();
};
R2.toWorld = (sx, sy, v = R2.view) => ({ x: (sx - v.ox) / v.s, y: (sy - v.oy) / v.s });
R2.toScreen = (p, v = R2.view) => ({ x: p.x * v.s + v.ox, y: p.y * v.s + v.oy });

R2.fit = (fl = AS.floor(), pad = 60) => {
  R2.needFit = R2.w < 120 || R2.h < 120; // ainda sem layout: refaz ao redimensionar
  const pts = [];
  for (const w of fl.walls) pts.push(w.a, w.b);
  for (const f of fl.furniture) pts.push({ x: f.x, y: f.y });
  if (fl.bg && fl.bg.w) pts.push({ x: fl.bg.x, y: fl.bg.y }, { x: fl.bg.x + fl.bg.w * fl.bg.scale, y: fl.bg.y + fl.bg.h * fl.bg.scale });
  if (!pts.length) { R2.view.s = 0.5; R2.view.ox = R2.w / 2; R2.view.oy = R2.h / 2; R2.req(); return; }
  const b = AS.geo.bbox(pts);
  const s = Math.min((R2.w - pad * 2) / Math.max(100, b.w), (R2.h - pad * 2) / Math.max(100, b.h));
  R2.view.s = AS.clamp(s, 0.02, 8);
  R2.view.ox = R2.w / 2 - (b.x0 + b.w / 2) * R2.view.s;
  R2.view.oy = R2.h / 2 - (b.y0 + b.h / 2) * R2.view.s;
  R2.req(); AS.bus.emit('view');
};
R2.zoomAt = (factor, sx, sy) => {
  const v = R2.view, p = R2.toWorld(sx, sy);
  v.s = AS.clamp(v.s * factor, 0.02, 10);
  v.ox = sx - p.x * v.s; v.oy = sy - p.y * v.s; R2.req(); AS.bus.emit('view');
};

/* ---------- desenho de padrões de materiais (hachura simples para piso no 2D) ---------- */
R2.matColor = (id) => AS.mat(id)?.color || '#ccc';

/** Polígono do corpo da parede (retângulo) */
R2.wallPoly = (w, extendA = 0, extendB = 0) => {
  const d = AS.wallDir(w), n = AS.geo.perp(d), h = w.thickness / 2;
  const a = AS.geo.sub(w.a, AS.geo.mul(d, extendA)), b = AS.geo.add(w.b, AS.geo.mul(d, extendB));
  return [AS.geo.add(a, AS.geo.mul(n, h)), AS.geo.add(b, AS.geo.mul(n, h)), AS.geo.sub(b, AS.geo.mul(n, h)), AS.geo.sub(a, AS.geo.mul(n, h))];
};
/** extensão de junção: quando a extremidade encontra outra parede, estende metade da espessura máxima */
R2.wallExt = (w, fl) => {
  const ext = { a: 0, b: 0 };
  for (const e of ['a', 'b']) {
    const others = AS.wallsAt(w[e], fl, 1, w.id).filter(o => Math.abs(AS.geo.cross(AS.wallDir(o.w), AS.wallDir(w))) > 0.2);
    if (others.length) ext[e] = Math.max(...others.map(o => o.w.thickness)) / 2;
    else { // termina sobre o meio de outra parede (T)
      const host = fl.walls.find(v => v.id !== w.id && !v.hidden && AS.geo.projSeg(w[e], v.a, v.b).d < 1.5);
      if (host) ext[e] = host.thickness / 2;
    }
  }
  return ext;
};

R2.path = (ctx, pts, v) => {
  ctx.beginPath();
  pts.forEach((p, i) => { const q = R2.toScreen(p, v); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.closePath();
};

/**
 * Desenha a planta em ctx. opts: {view, w, h, export:true, floor, selection, colors}
 */
R2.drawPlan = (ctx, opts = {}) => {
  const v = opts.view || R2.view, fl = opts.floor || AS.floor(), C = opts.colors || R2.colors();
  const st = S.project.settings, W = opts.w ?? R2.w, H = opts.h ?? R2.h;
  const sel = opts.export ? new Set() : new Set(S.sel.map(s => s.kind + ':' + s.id));
  const isSel = (k, id) => sel.has(k + ':' + id);
  ctx.fillStyle = opts.export ? '#ffffff' : C.paper; ctx.fillRect(0, 0, W, H);

  // imagem de referência (PDF/PNG importado)
  if (fl.bg && fl.bg.visible !== false && !opts.export) {
    const asset = S.project.assets[fl.bg.asset];
    if (asset) {
      let img = R2.imgs[fl.bg.asset];
      if (!img) { img = new Image(); img.onload = () => R2.req(); img.src = asset; R2.imgs[fl.bg.asset] = img; }
      if (img.complete && img.naturalWidth) {
        const p = R2.toScreen({ x: fl.bg.x, y: fl.bg.y }, v);
        ctx.save(); ctx.globalAlpha = fl.bg.opacity ?? 0.5;
        ctx.translate(p.x, p.y); if (fl.bg.rot) ctx.rotate(AS.rad(fl.bg.rot));
        ctx.drawImage(img, 0, 0, fl.bg.w * fl.bg.scale * v.s, fl.bg.h * fl.bg.scale * v.s);
        ctx.restore();
      }
    }
  }

  // grade
  if (st.showGrid && !opts.export) {
    const steps = [5, 10, 25, 50, 100, 250, 500, 1000];
    let minor = steps.find(s => s * v.s >= 9) || 1000;
    const major = minor * (minor === 25 || minor === 250 ? 4 : 5) * (minor === 5 ? 2 : 1);
    const p0 = R2.toWorld(0, 0, v), p1 = R2.toWorld(W, H, v);
    ctx.lineWidth = 1;
    for (const [step, col] of [[minor, C.grid], [major, C.gridMajor]]) {
      ctx.strokeStyle = col; ctx.beginPath();
      for (let x = Math.floor(p0.x / step) * step; x <= p1.x; x += step) { const sx = Math.round(x * v.s + v.ox) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
      for (let y = Math.floor(p0.y / step) * step; y <= p1.y; y += step) { const sy = Math.round(y * v.s + v.oy) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
      ctx.stroke();
    }
  }

  // pavimento inferior (fantasma) para alinhamento
  if (st.showLower && !opts.export) {
    const idx = S.project.floors.indexOf(fl);
    const lower = S.project.floors[idx - 1];
    if (lower) {
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = C.muted;
      for (const w of lower.walls) { R2.path(ctx, R2.wallPoly(w), v); ctx.fill(); }
      ctx.restore();
    }
  }

  // cômodos
  const { rooms } = AS.rooms(fl);
  for (const r of rooms) {
    const m = r.meta, t = AS.roomType(m?.type);
    const col = m?.color || (m ? t.color : null);
    R2.path(ctx, r.inner, v);
    ctx.fillStyle = col ? col : (opts.export ? '#f4f2ee' : C.grid);
    ctx.globalAlpha = opts.export ? 1 : 0.75; ctx.fill(); ctx.globalAlpha = 1;
    if (m && isSel('room', m.id)) { ctx.fillStyle = C.sel; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.sel; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); }
  }

  // mobiliário (abaixo das paredes)
  if (st.showFurniture) for (const f of fl.furniture) { if (f.hidden) continue; R2.drawFurniture(ctx, f, v, C, isSel('furniture', f.id), opts.export); }

  // paredes: contorno (traço grosso) e preenchimento por cima => união limpa
  const walls = fl.walls.filter(w => !w.hidden);
  const polys = walls.map(w => { const e = R2.wallExt(w, fl); return { w, poly: R2.wallPoly(w, e.a, e.b) }; });
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = opts.export ? '#1b1d22' : C.wall; ctx.lineWidth = Math.max(1.2, Math.min(2.2, v.s * 2));
  for (const { poly } of polys) { R2.path(ctx, poly, v); ctx.stroke(); }
  for (const { w, poly } of polys) {
    R2.path(ctx, poly, v);
    ctx.fillStyle = opts.export ? (w.type === 'exterior' ? '#3a3d44' : '#6b6f78') : (w.type === 'exterior' ? C.wall : C.wallFill);
    if (w.note === 'Guarda-corpo') ctx.fillStyle = opts.export ? '#b9bcc2' : C.muted;
    ctx.fill();
  }
  // aberturas: recorte + símbolo
  for (const o of fl.openings) { if (o.hidden) continue; const w = fl.walls.find(x => x.id === o.wallId); if (!w || w.hidden) continue; R2.drawOpening(ctx, o, w, v, C, isSel('opening', o.id), opts.export, fl); }
  // seleção de paredes
  for (const { w, poly } of polys) {
    if (!isSel('wall', w.id)) continue;
    R2.path(ctx, poly, v); ctx.strokeStyle = C.sel; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.sel; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
    for (const p of [w.a, w.b]) { const q = R2.toScreen(p, v); ctx.fillStyle = '#fff'; ctx.strokeStyle = C.sel; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(q.x - 5, q.y - 5, 10, 10); ctx.fill(); ctx.stroke(); }
    if (w.locked) { const m = R2.toScreen(AS.geo.lerp(w.a, w.b, 0.5), v); ctx.fillStyle = C.sel; ctx.font = '600 11px var(--f-ui), sans-serif'; ctx.fillText('🔒', m.x - 6, m.y - 8); }
  }

  // cotas das paredes
  if (st.showDims || opts.export) {
    ctx.font = `500 ${opts.export ? 12 : 11}px "IBM Plex Mono", ui-monospace, monospace`;
    for (const w of walls) {
      const L = AS.wallLen(w); if (L * v.s < 38) continue;
      if (!opts.export && !st.showDims && !isSel('wall', w.id)) continue;
      R2.drawDim(ctx, w.a, w.b, (w.type === 'exterior' ? 1 : 0.6) * (w.thickness / 2 + 26 / v.s), v, opts.export ? '#5a5f6a' : C.dim, AS.units.fmt(L), w, fl);
    }
  } else {
    for (const s of S.sel) if (s.kind === 'wall') { const w = AS.find('wall', s.id, fl); if (w) R2.drawDim(ctx, w.a, w.b, w.thickness / 2 + 26 / v.s, v, C.sel, AS.units.fmt(AS.wallLen(w)), w, fl); }
  }
  // cotas manuais (ferramenta medir)
  for (const d of fl.dims) {
    R2.drawDim(ctx, d.a, d.b, d.off || 0, v, isSel('dim', d.id) ? C.sel : (opts.export ? '#1f5fbf' : C.accent), AS.units.fmt(AS.geo.dist(d.a, d.b)), null, fl, true);
  }

  // rótulos de cômodos
  for (const r of rooms) {
    const q = R2.toScreen(r.label, v), m = r.meta;
    const area = st.roomAreaMode === 'eixo' ? r.areaAxis : r.area;
    const bb = AS.geo.bbox(r.inner), maxW = bb.w * v.s;
    if (maxW < 40) continue;
    const fs = AS.clamp(v.s * 28, 10, 16);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.export ? '#14161a' : C.room;
    let name = (m ? m.name : 'Cômodo').toUpperCase(), nfs = fs;
    ctx.font = `600 ${nfs}px "Archivo", "IBM Plex Sans", sans-serif`;
    const avail = maxW - 10;
    while (ctx.measureText(name).width > avail && nfs > 8) { nfs -= 0.5; ctx.font = `600 ${nfs}px "Archivo", "IBM Plex Sans", sans-serif`; }
    while (ctx.measureText(name).width > avail && name.length > 4) name = name.slice(0, -2) + '…';
    ctx.fillText(name, q.x, q.y - fs * 0.55);
    ctx.font = `500 ${fs * 0.82}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = opts.export ? '#4a4f59' : C.muted;
    ctx.fillText(AS.units.fmtArea(area), q.x, q.y + fs * 0.6);
    if (m?.uncertain) { ctx.fillStyle = C.warn; ctx.fillText('medidas estimadas', q.x, q.y + fs * 1.7); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  if (!opts.export && R2.overlay) R2.overlay(ctx, v, C);
};

R2.drawDim = (ctx, a, b, off, v, color, text, wall, fl, manual = false) => {
  const d = AS.geo.norm(AS.geo.sub(b, a)); let n = AS.geo.perp(d);
  // posiciona a cota para fora do cômodo (lado oposto ao centro do desenho) para paredes externas
  if (wall && wall.type === 'exterior') {
    const c = R2._center || { x: 0, y: 0 };
    const mid = AS.geo.lerp(a, b, 0.5);
    if (AS.geo.dot(AS.geo.sub(mid, c), n) < 0) n = AS.geo.mul(n, -1);
  }
  const A = R2.toScreen(AS.geo.add(a, AS.geo.mul(n, off)), v), B = R2.toScreen(AS.geo.add(b, AS.geo.mul(n, off)), v);
  const a0 = R2.toScreen(a, v), b0 = R2.toScreen(b, v);
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
  ctx.globalAlpha = manual ? 1 : 0.9;
  if (off) { ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(A.x, A.y); ctx.moveTo(b0.x, b0.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]); }
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  // marcas oblíquas (padrão arquitetônico)
  for (const P of [A, B]) { ctx.beginPath(); ctx.moveTo(P.x - 4, P.y + 4); ctx.lineTo(P.x + 4, P.y - 4); ctx.stroke(); }
  const ang = Math.atan2(B.y - A.y, B.x - A.x);
  const m = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  ctx.translate(m.x, m.y); let r = ang; if (r > Math.PI / 2 || r < -Math.PI / 2) r += Math.PI; ctx.rotate(r);
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() || '#fff';
  if (ctx.canvas.dataset.export) ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.85; ctx.fillRect(-tw / 2 - 3, -14, tw + 6, 13); ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, 0, -4);
  ctx.restore();
};

R2.openingGeom = (o, w) => {
  const d = AS.wallDir(w), n = AS.geo.perp(d), L = AS.wallLen(w);
  const c = AS.geo.lerp(w.a, w.b, o.t / L);
  const p0 = AS.geo.sub(c, AS.geo.mul(d, o.width / 2)), p1 = AS.geo.add(c, AS.geo.mul(d, o.width / 2));
  return { d, n, c, p0, p1, L };
};

R2.drawOpening = (ctx, o, w, v, C, selected, exp, fl) => {
  const { d, n, c, p0, p1 } = R2.openingGeom(o, w);
  const h = w.thickness / 2 + 0.6;
  const cut = [AS.geo.add(p0, AS.geo.mul(n, h)), AS.geo.add(p1, AS.geo.mul(n, h)), AS.geo.sub(p1, AS.geo.mul(n, h)), AS.geo.sub(p0, AS.geo.mul(n, h))];
  R2.path(ctx, cut, v); ctx.fillStyle = exp ? '#ffffff' : C.paper; ctx.fill();
  const ink = selected ? C.sel : (exp ? '#1b1d22' : C.ink);
  ctx.strokeStyle = ink; ctx.lineWidth = selected ? 2 : 1.2;
  // batentes
  ctx.beginPath();
  for (const p of [p0, p1]) { const A = R2.toScreen(AS.geo.add(p, AS.geo.mul(n, h)), v), B = R2.toScreen(AS.geo.sub(p, AS.geo.mul(n, h)), v); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); }
  ctx.stroke();
  const S2 = (p) => R2.toScreen(p, v);
  if (o.kind === 'window') {
    ctx.beginPath();
    for (const k of [-0.25, 0.25]) { const A = S2(AS.geo.add(p0, AS.geo.mul(n, h * k * 2))), B = S2(AS.geo.add(p1, AS.geo.mul(n, h * k * 2))); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); }
    ctx.stroke();
    if (o.type === 'correr') { ctx.beginPath(); const A = S2(AS.geo.add(c, AS.geo.mul(n, h * 0.5))), B = S2(AS.geo.sub(c, AS.geo.mul(n, h * 0.5))); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
  } else {
    const side = o.side || 1, nn = AS.geo.mul(n, side);
    const hingeP = o.hinge === 'b' ? p1 : p0, otherP = o.hinge === 'b' ? p0 : p1;
    const face = AS.geo.add(hingeP, AS.geo.mul(nn, h)), faceO = AS.geo.add(otherP, AS.geo.mul(nn, h));
    if (o.type === 'giro' || o.type === 'dupla') {
      const leaves = o.type === 'dupla' ? [[p0, p1, o.width / 2], [p1, p0, o.width / 2]] : [[hingeP, otherP, o.width]];
      for (const [hp, op, lw] of leaves) {
        const f = AS.geo.add(hp, AS.geo.mul(nn, h)), fo = AS.geo.add(op, AS.geo.mul(nn, h));
        const along = AS.geo.norm(AS.geo.sub(fo, f));
        const tip = AS.geo.add(f, AS.geo.mul(nn, lw));
        const F = S2(f), T = S2(tip);
        ctx.beginPath(); ctx.moveTo(F.x, F.y); ctx.lineTo(T.x, T.y); ctx.lineWidth = selected ? 2.5 : 2; ctx.stroke();
        // arco
        const a1 = Math.atan2(T.y - F.y, T.x - F.x), endP = S2(AS.geo.add(f, AS.geo.mul(along, lw))), a2 = Math.atan2(endP.y - F.y, endP.x - F.x);
        let diff = a2 - a1; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
        ctx.beginPath(); ctx.lineWidth = 0.9; ctx.setLineDash([3, 3]); ctx.arc(F.x, F.y, lw * v.s, a1, a1 + diff, diff < 0); ctx.stroke(); ctx.setLineDash([]);
      }
    } else if (o.type === 'correr') {
      ctx.lineWidth = selected ? 2.5 : 2;
      const half = o.width / 2;
      const l1a = AS.geo.add(p0, AS.geo.mul(n, h * 0.35)), l1b = AS.geo.add(l1a, AS.geo.mul(d, half + 5));
      const l2b = AS.geo.sub(p1, AS.geo.mul(n, h * 0.35)), l2a = AS.geo.sub(l2b, AS.geo.mul(d, half + 5));
      ctx.beginPath(); let A = S2(l1a), B = S2(l1b); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); A = S2(l2a); B = S2(l2b); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    } else { // passagem
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.beginPath(); const A = S2(p0), B = S2(p1); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (selected) {
    for (const p of [p0, p1]) { const q = S2(p); ctx.fillStyle = '#fff'; ctx.strokeStyle = C.sel; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    R2.drawDim(ctx, p0, p1, -(w.thickness / 2 + 18 / v.s), v, C.sel, AS.units.fmt(o.width), null, fl, true);
  }
};

/* ---------- símbolos de mobiliário (vista superior) ---------- */
R2.drawFurniture = (ctx, f, v, C, selected, exp) => {
  const c = R2.toScreen(f, v), s = v.s;
  const w = f.w * s, d = f.d * s;
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(AS.rad(f.rot || 0));
  const ink = selected ? C.sel : (exp ? '#30333a' : C.muted);
  const fill = exp ? '#ffffff' : (R2._furnFill ||= getComputedStyle(document.documentElement).getPropertyValue('--furn').trim());
  ctx.lineWidth = selected ? 1.8 : 1; ctx.strokeStyle = ink; ctx.fillStyle = fill;
  const rr = (x, y, ww, hh, r = 3) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, ww, hh, Math.min(r, ww / 2, hh / 2)); else ctx.rect(x, y, ww, hh); };
  const box = () => { rr(-w / 2, -d / 2, w, d, 2 * s); ctx.fill(); ctx.stroke(); };
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const circ = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
  switch (f.type) {
    case 'cama_casal': case 'cama_queen': case 'cama_solteiro': {
      box(); const pw = f.type === 'cama_solteiro' ? w * 0.7 : w * 0.4, ph = 28 * s;
      if (f.type === 'cama_solteiro') { rr(-pw / 2, -d / 2 + 8 * s, pw, ph, 6 * s); ctx.fill(); ctx.stroke(); }
      else { rr(-w / 2 + 8 * s, -d / 2 + 8 * s, pw, ph, 6 * s); ctx.fill(); ctx.stroke(); rr(w / 2 - 8 * s - pw, -d / 2 + 8 * s, pw, ph, 6 * s); ctx.fill(); ctx.stroke(); }
      line(-w / 2, -d / 2 + 50 * s, w / 2, -d / 2 + 50 * s); line(-w / 2, -d / 2 + 50 * s, w / 2 - 20 * s, d / 2); break;
    }
    case 'sofa3': case 'sofa2': case 'poltrona': {
      box(); rr(-w / 2, -d / 2, w, 22 * s, 3 * s); ctx.stroke(); rr(-w / 2, -d / 2, 18 * s, d, 3 * s); ctx.stroke(); rr(w / 2 - 18 * s, -d / 2, 18 * s, d, 3 * s); ctx.stroke();
      const n = f.type === 'sofa3' ? 3 : f.type === 'sofa2' ? 2 : 1, cw = (w - 36 * s) / n; for (let i = 1; i < n; i++) line(-w / 2 + 18 * s + cw * i, -d / 2 + 22 * s, -w / 2 + 18 * s + cw * i, d / 2); break;
    }
    case 'mesa_jantar4': case 'mesa_jantar6': {
      const n = f.type === 'mesa_jantar6' ? 3 : 2, chW = 42 * s, chD = 40 * s;
      for (let i = 0; i < n; i++) { const x = -w / 2 + w * (i + 0.5) / n - chW / 2; rr(x, -d / 2 - chD * 0.6, chW, chD, 4 * s); ctx.fill(); ctx.stroke(); rr(x, d / 2 - chD * 0.4, chW, chD, 4 * s); ctx.fill(); ctx.stroke(); }
      box(); break;
    }
    case 'mesa_redonda': { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; circ(Math.cos(a) * w * 0.55, Math.sin(a) * w * 0.55, 18 * s); } circ(0, 0, w / 2); break; }
    case 'vaso': { rr(-w / 2, -d / 2, w, 18 * s, 3 * s); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 6 * s, w / 2 - 1, (d - 18 * s) / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break; }
    case 'lavatorio': case 'pia_coz': case 'tanque': { box(); const bw = Math.min(w * 0.55, 60 * s); ctx.beginPath(); ctx.ellipse(0, 3 * s, bw / 2, d * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); circ(0, -d / 2 + 7 * s, 2 * s); break; }
    case 'fogao': case 'cooktop': { box(); for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) circ(x * w * 0.23, y * d * 0.22, Math.min(w, d) * 0.14); break; }
    case 'geladeira': { box(); line(-w / 2, d / 2 - 6 * s, w / 2, d / 2 - 6 * s); ctx.font = `${Math.max(7, 11 * s * 2.2)}px sans-serif`; break; }
    case 'box': { box(); line(-w / 2, -d / 2, w / 2, d / 2); line(w / 2, -d / 2, -w / 2, d / 2); circ(0, 0, 4 * s); break; }
    case 'banheira': { box(); rr(-w / 2 + 8 * s, -d / 2 + 8 * s, w - 16 * s, d - 16 * s, 25 * s); ctx.stroke(); break; }
    case 'guarda_roupa': case 'armario_coz': case 'armario_alto': case 'estante': case 'rack': {
      box(); const n = Math.max(1, Math.round(f.w / 50)); for (let i = 1; i < n; i++) line(-w / 2 + w * i / n, -d / 2, -w / 2 + w * i / n, d / 2);
      if (f.type === 'guarda_roupa') line(-w / 2, -d / 2 + 4 * s, w / 2, -d / 2 + 4 * s); break;
    }
    case 'planta': { ctx.fillStyle = exp ? '#e6efe2' : '#a9c49a55'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; circ(Math.cos(a) * w * 0.22, Math.sin(a) * w * 0.22, w * 0.22); } ctx.fillStyle = fill; circ(0, 0, w * 0.18); break; }
    case 'tapete': { ctx.setLineDash([2, 3]); box(); ctx.setLineDash([]); break; }
    case 'carro': { rr(-w / 2, -d / 2, w, d, 30 * s); ctx.fill(); ctx.stroke(); rr(-w / 2 + 15 * s, -d / 2 + 110 * s, w - 30 * s, 100 * s, 15 * s); ctx.stroke(); rr(-w / 2 + 15 * s, d / 2 - 140 * s, w - 30 * s, 70 * s, 15 * s); ctx.stroke(); break; }
    case 'escada_reta': {
      box(); const steps = Math.max(2, Math.round(f.d / 28));
      for (let i = 1; i < steps; i++) line(-w / 2, -d / 2 + d * i / steps, w / 2, -d / 2 + d * i / steps);
      line(0, d / 2 - 10 * s, 0, -d / 2 + 15 * s); line(0, -d / 2 + 15 * s, -6 * s, -d / 2 + 27 * s); line(0, -d / 2 + 15 * s, 6 * s, -d / 2 + 27 * s); break;
    }
    case 'cadeira': case 'banqueta': { box(); if (f.type === 'cadeira') line(-w / 2, -d / 2 + 6 * s, w / 2, -d / 2 + 6 * s); break; }
    default: box(); line(-w / 2, -d / 2, w / 2, d / 2);
  }
  if (selected) {
    ctx.strokeStyle = C.sel; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2; ctx.strokeRect(-w / 2 - 3, -d / 2 - 3, w + 6, d + 6); ctx.setLineDash([]);
    // alça de rotação e de redimensionamento
    ctx.beginPath(); ctx.moveTo(0, -d / 2 - 3); ctx.lineTo(0, -d / 2 - 22); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -d / 2 - 26, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(w / 2 - 2, d / 2 - 2, 9, 9); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
};

R2.draw = () => {
  if (!S.project || !R2.ctx) return;
  const ctx = R2.ctx;
  ctx.setTransform(R2.dpr, 0, 0, R2.dpr, 0, 0);
  const fl = AS.floor();
  const pts = fl.walls.flatMap(w => [w.a, w.b]);
  R2._center = pts.length ? (() => { const b = AS.geo.bbox(pts); return { x: b.x0 + b.w / 2, y: b.y0 + b.h / 2 }; })() : { x: 0, y: 0 };
  R2._furnFill = null;
  R2.drawPlan(ctx, {});
};

/** Renderiza a planta para um canvas fora da tela (exportação) */
R2.renderExport = (scalePxPerCm = 1.2, fl = AS.floor(), margin = 80) => {
  const pts = fl.walls.flatMap(w => [w.a, w.b]).concat(fl.furniture.map(f => ({ x: f.x, y: f.y })));
  if (!pts.length) throw new Error('A planta está vazia');
  const b = AS.geo.bbox(pts);
  const W = Math.ceil(b.w * scalePxPerCm + margin * 2), H = Math.ceil(b.h * scalePxPerCm + margin * 2 + 50);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.dataset.export = '1';
  const ctx = cv.getContext('2d');
  const view = { s: scalePxPerCm, ox: margin - b.x0 * scalePxPerCm, oy: margin + 40 - b.y0 * scalePxPerCm };
  R2._center = { x: b.x0 + b.w / 2, y: b.y0 + b.h / 2 };
  R2.drawPlan(ctx, { view, w: W, h: H, export: true, floor: fl });
  // carimbo
  ctx.fillStyle = '#14161a'; ctx.font = '600 20px "Archivo", sans-serif'; ctx.fillText(S.project.name + ' — ' + fl.name, margin, 36);
  const m = AS.metrics(fl);
  ctx.font = '13px "IBM Plex Mono", monospace'; ctx.fillStyle = '#4a4f59';
  ctx.fillText(`Área útil ${AS.units.fmtArea(m.util)} · ${m.rooms} cômodos · escala gráfica abaixo · Architect Studio Ultra`, margin, H - 18);
  // escala gráfica 1 m
  const sx = W - margin - 100 * scalePxPerCm, sy = H - 30;
  ctx.fillStyle = '#14161a'; ctx.fillRect(sx, sy, 100 * scalePxPerCm, 4); ctx.fillText('1 m', sx + 100 * scalePxPerCm + 6, sy + 6);
  return cv;
};
