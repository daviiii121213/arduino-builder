/* ==========================================================================
   04 — Editor 2D: ferramentas, snaps, seleção, arrastes, atalhos, menu de contexto
   ========================================================================== */
const ED = AS.editor = {
  pointer: { x: 0, y: 0, w: { x: 0, y: 0 } },
  chain: null,          // desenho de parede em andamento {start, last}
  rectStart: null,      // ferramenta cômodo
  measureStart: null,
  drag: null,
  hover: null,
  snapInfo: null,
  guides: [],
  placing: null,        // {type} mobiliário
  calib: null,          // calibração de escala {p1, p2}
  spaceDown: false,
  pointers: new Map(),
};

ED.TOOLS = {
  select: { name: 'Selecionar / mover', key: 'V', cursor: 'default' },
  wall: { name: 'Desenhar parede', key: 'W', cursor: 'crosshair' },
  room: { name: 'Desenhar cômodo (retângulo)', key: 'R', cursor: 'crosshair' },
  door: { name: 'Adicionar porta', key: 'D', cursor: 'copy' },
  window: { name: 'Adicionar janela', key: 'J', cursor: 'copy' },
  furniture: { name: 'Adicionar móvel', key: 'M', cursor: 'copy' },
  measure: { name: 'Medir / cotar', key: 'T', cursor: 'crosshair' },
  split: { name: 'Dividir parede', key: 'X', cursor: 'crosshair' },
  pan: { name: 'Mover vista', key: 'H', cursor: 'grab' },
  calibrate: { name: 'Calibrar escala da referência', key: '', cursor: 'crosshair' },
  bgmove: { name: 'Posicionar referência', key: '', cursor: 'move' },
};

ED.setTool = (t, extra) => {
  ED.chain = null; ED.rectStart = null; ED.measureStart = null; ED.calib = t === 'calibrate' ? { pts: [] } : null;
  if (t !== 'furniture') ED.placing = null;
  if (t === 'furniture' && extra) ED.placing = { type: extra, rot: 0 };
  S.tool = t;
  ED.hideNumInput();
  if (R2.canvas) R2.canvas.style.cursor = ED.TOOLS[t]?.cursor || 'default';
  AS.bus.emit('tool', t);
  const hints = {
    select: 'Clique para selecionar · Shift+clique soma à seleção · arraste em área vazia para seleção em janela · botão direito: menu',
    wall: 'Clique para iniciar, clique para cada vértice · digite um número para comprimento exato · Esc/duplo clique encerra · Shift desliga snaps',
    room: 'Clique e arraste (ou clique em dois cantos) para criar um cômodo retangular com 4 paredes',
    door: 'Passe sobre uma parede e clique para inserir a porta', window: 'Passe sobre uma parede e clique para inserir a janela',
    furniture: 'Clique para posicionar · R gira 90° · Esc cancela', measure: 'Clique em dois pontos para criar uma cota',
    split: 'Clique sobre uma parede para dividi-la no ponto', pan: 'Arraste para mover a vista (também: botão do meio ou Espaço+arrastar)',
    calibrate: 'Clique em dois pontos da referência cuja distância real você conhece', bgmove: 'Arraste a imagem de referência para posicioná-la',
  };
  AS.hint(hints[t] || '');
  R2.req();
};

/* ---------- Snap ---------- */
ED.snap = (p, opts = {}) => {
  const fl = AS.floor(), st = S.project.settings, v = R2.view;
  const tolPx = 12, tol = tolPx / v.s;
  ED.guides = [];
  if (opts.free) return { p, kind: null };
  let best = null;
  // vértices
  if (st.snapCorner) for (const w of fl.walls) {
    if (opts.excludeWall && opts.excludeWall.has(w.id)) continue;
    for (const e of [w.a, w.b]) { const d = AS.geo.dist(e, p); if (d < tol && (!best || d < best.d)) best = { p: { ...e }, d, kind: 'vértice' }; }
  }
  if (best) return best;
  // meio / linha da parede
  if (st.snapWall) for (const w of fl.walls) {
    if (opts.excludeWall && opts.excludeWall.has(w.id)) continue;
    const mid = AS.geo.lerp(w.a, w.b, 0.5);
    if (AS.geo.dist(mid, p) < tol * 0.8) return { p: mid, d: 0, kind: 'meio da parede' };
    const pr = AS.geo.projSeg(p, w.a, w.b);
    if (pr.d < tol * 0.8 && (!best || pr.d < best.d)) best = { p: pr.p, d: pr.d, kind: 'parede', wall: w };
  }
  // ângulo a partir do ponto anterior
  let q = { ...p }, kind = null;
  if (opts.from && st.angleSnap) {
    const d = AS.geo.sub(p, opts.from), L = AS.geo.len(d);
    if (L > 0) {
      const ang = Math.atan2(d.y, d.x), stepA = Math.PI / 4, a2 = Math.round(ang / stepA) * stepA;
      if (Math.abs(ang - a2) < AS.rad(6)) {
        q = { x: opts.from.x + Math.cos(a2) * L, y: opts.from.y + Math.sin(a2) * L }; kind = 'ângulo ' + Math.round(((AS.deg(a2) % 360) + 360) % 360) + '°';
        if (best && best.wall) { const x = AS.geo.lineInter(opts.from, q, best.wall.a, best.wall.b); if (x && AS.geo.dist(x, q) < tol) return { p: x, kind: 'parede + ângulo' }; }
      }
    }
  }
  if (best) return best;
  // alinhamento com vértices existentes
  if (st.snapAlign) {
    let ax = null, ay = null;
    for (const w of fl.walls) for (const e of [w.a, w.b]) {
      if (opts.excludeWall && opts.excludeWall.has(w.id)) continue;
      if (Math.abs(e.x - q.x) < tol * 0.6 && (!ax || Math.abs(e.x - q.x) < Math.abs(ax.x - q.x))) ax = e;
      if (Math.abs(e.y - q.y) < tol * 0.6 && (!ay || Math.abs(e.y - q.y) < Math.abs(ay.y - q.y))) ay = e;
    }
    if (ax && (!kind || Math.abs(Math.cos(Math.atan2(q.y - (opts.from?.y || 0), q.x - (opts.from?.x || 0)))) < 0.99)) { q.x = ax.x; ED.guides.push({ a: ax, b: { ...q } }); kind = kind || 'alinhamento'; }
    if (ay && (!kind || kind === 'alinhamento' || Math.abs(Math.sin(Math.atan2(q.y - (opts.from?.y || 0), q.x - (opts.from?.x || 0)))) < 0.99)) { q.y = ay.y; ED.guides.push({ a: ay, b: { ...q } }); kind = kind || 'alinhamento'; }
    if (ED.guides.length) return { p: q, kind };
  }
  if (kind) return { p: q, kind };
  if (st.snapGrid) { const g = st.grid || 10; return { p: { x: AS.round(q.x, g), y: AS.round(q.y, g) }, kind: 'grade' }; }
  return { p: q, kind: null };
};

/* ---------- Hit test ---------- */
ED.hit = (p, opts = {}) => {
  const fl = AS.floor(), v = R2.view, tol = 6 / v.s;
  // alças de seleção
  if (!opts.noHandles) for (const s of S.sel) {
    if (s.kind === 'wall') { const w = AS.find('wall', s.id); if (!w || w.locked) continue; for (const e of ['a', 'b']) if (AS.geo.dist(w[e], p) < 8 / v.s) return { kind: 'handle', wall: w, end: e }; }
    if (s.kind === 'furniture') {
      const f = AS.find('furniture', s.id); if (!f || f.locked) continue;
      const loc = AS.geo.rot({ x: p.x - f.x, y: p.y - f.y }, -AS.rad(f.rot || 0));
      if (Math.hypot(loc.x, loc.y + f.d / 2 + 26 / v.s) < 8 / v.s) return { kind: 'rotate', f };
      if (Math.abs(loc.x - (f.w / 2 + 2.5 / v.s)) < 8 / v.s && Math.abs(loc.y - (f.d / 2 + 2.5 / v.s)) < 8 / v.s) return { kind: 'resize', f };
    }
    if (s.kind === 'opening') {
      const o = AS.find('opening', s.id); if (!o || o.locked) continue; const w = fl.walls.find(x => x.id === o.wallId); if (!w) continue;
      const g = R2.openingGeom(o, w);
      if (AS.geo.dist(g.p0, p) < 8 / v.s) return { kind: 'ohandle', o, w, end: 0 };
      if (AS.geo.dist(g.p1, p) < 8 / v.s) return { kind: 'ohandle', o, w, end: 1 };
    }
  }
  for (const d of fl.dims) { if (AS.geo.projSeg(p, d.a, d.b).d < tol) return { kind: 'dim', id: d.id }; }
  for (const o of fl.openings) {
    if (o.hidden) continue; const w = fl.walls.find(x => x.id === o.wallId); if (!w || w.hidden) continue;
    const g = R2.openingGeom(o, w), pr = AS.geo.projSeg(p, g.p0, g.p1);
    if (pr.d < w.thickness / 2 + tol) return { kind: 'opening', id: o.id };
  }
  if (S.project.settings.showFurniture) for (let i = fl.furniture.length - 1; i >= 0; i--) {
    const f = fl.furniture[i]; if (f.hidden) continue;
    const loc = AS.geo.rot({ x: p.x - f.x, y: p.y - f.y }, -AS.rad(f.rot || 0));
    if (Math.abs(loc.x) <= f.w / 2 + tol && Math.abs(loc.y) <= f.d / 2 + tol) {
      // tapetes ficam por baixo: só se nada mais
      if (f.type === 'tapete' && !opts.allowRug) { opts.rug = f; continue; }
      return { kind: 'furniture', id: f.id };
    }
  }
  let bw = null, bd = Infinity;
  for (const w of fl.walls) { if (w.hidden) continue; const pr = AS.geo.projSeg(p, w.a, w.b); if (pr.d < w.thickness / 2 + tol && pr.d < bd) { bd = pr.d; bw = w; } }
  if (bw) return { kind: 'wall', id: bw.id };
  if (opts.rug) return { kind: 'furniture', id: opts.rug.id };
  const { rooms } = AS.rooms(fl);
  for (const r of rooms) if (AS.geo.inPoly(p, r.inner)) return { kind: 'room', room: r };
  return null;
};

/* ---------- Seleção ---------- */
ED.select = (items, add = false) => {
  const expand = (it) => { // grupos
    const o = AS.find(it.kind, it.id); if (!o?.groupId) return [it];
    const fl = AS.floor(), res = [];
    for (const w of fl.walls) if (w.groupId === o.groupId) res.push({ kind: 'wall', id: w.id });
    for (const f of fl.furniture) if (f.groupId === o.groupId) res.push({ kind: 'furniture', id: f.id });
    return res;
  };
  let list = items.flatMap(expand);
  if (add) {
    const cur = S.sel.slice();
    for (const it of list) { const i = cur.findIndex(s => s.kind === it.kind && s.id === it.id); if (i >= 0) cur.splice(i, 1); else cur.push(it); }
    list = cur;
  }
  S.sel = list.filter((it, i) => list.findIndex(x => x.kind === it.kind && x.id === it.id) === i);
  AS.bus.emit('selection'); R2.req();
};
ED.selected = (kind) => S.sel.filter(s => !kind || s.kind === kind).map(s => ({ ...s, o: AS.find(s.kind, s.id) })).filter(s => s.o);

/* ---------- Overlay (pré-visualizações) ---------- */
R2.overlay = (ctx, v, C) => {
  const P = ED.pointer.w, S2 = (p) => R2.toScreen(p, v);
  // guias
  ctx.save(); ctx.strokeStyle = C.accent; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.8;
  for (const g of ED.guides) { const a = S2(g.a), b = S2(g.b); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.restore();
  // indicador de snap
  if (ED.snapInfo && ['wall', 'room', 'measure', 'split', 'calibrate', 'select'].includes(S.tool) && (S.tool !== 'select' || ED.drag)) {
    const q = S2(ED.snapInfo.p);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5;
    if (ED.snapInfo.kind === 'vértice') { ctx.strokeRect(q.x - 6, q.y - 6, 12, 12); }
    else if (ED.snapInfo.kind) { ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.stroke(); }
    if (ED.snapInfo.kind && ED.snapInfo.kind !== 'grade') { ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.fillStyle = C.accent; ctx.fillText(ED.snapInfo.kind, q.x + 10, q.y - 8); }
  }
  // parede em desenho
  if (S.tool === 'wall' && ED.chain && ED.snapInfo) {
    const a = ED.chain.last, b = ED.snapInfo.p, th = S.project.settings.wallThickness;
    const tmp = { a, b, thickness: th };
    if (AS.geo.dist(a, b) > 0.5) {
      R2.path(ctx, R2.wallPoly(tmp), v); ctx.fillStyle = C.accent; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      R2.drawDim(ctx, a, b, th / 2 + 24 / v.s, v, C.accent, AS.units.fmt(AS.geo.dist(a, b)) + ' · ' + Math.round(((AS.deg(Math.atan2(-(b.y - a.y), b.x - a.x)) % 360) + 360) % 360) + '°', null, AS.floor(), true);
    }
    const s0 = S2(ED.chain.start); ctx.strokeStyle = C.accent; ctx.beginPath(); ctx.arc(s0.x, s0.y, 6, 0, Math.PI * 2); ctx.stroke();
  }
  // cômodo retangular
  if (S.tool === 'room' && ED.rectStart && ED.snapInfo) {
    const a = ED.rectStart, b = ED.snapInfo.p;
    const pts = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
    R2.path(ctx, pts, v); ctx.fillStyle = C.accent; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '600 12px "IBM Plex Mono", monospace';
    R2.drawDim(ctx, pts[0], pts[1], -20 / v.s, v, C.accent, AS.units.fmt(Math.abs(b.x - a.x)), null, AS.floor(), true);
    R2.drawDim(ctx, pts[1], pts[2], -20 / v.s, v, C.accent, AS.units.fmt(Math.abs(b.y - a.y)), null, AS.floor(), true);
    const c = S2({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); ctx.fillStyle = C.accent; ctx.textAlign = 'center'; ctx.fillText(AS.units.fmtArea(Math.abs((b.x - a.x) * (b.y - a.y))), c.x, c.y); ctx.textAlign = 'left';
  }
  // medição
  if ((S.tool === 'measure' && ED.measureStart || S.tool === 'calibrate' && ED.calib?.pts.length === 1) && ED.snapInfo) {
    const a = S.tool === 'measure' ? ED.measureStart : ED.calib.pts[0];
    ctx.font = '600 12px "IBM Plex Mono", monospace';
    R2.drawDim(ctx, a, ED.snapInfo.p, 0, v, C.accent, AS.units.fmt(AS.geo.dist(a, ED.snapInfo.p)), null, AS.floor(), true);
  }
  if (S.tool === 'calibrate' && ED.calib) for (const p of ED.calib.pts) { const q = S2(p); ctx.strokeStyle = C.sel; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x - 8, q.y); ctx.lineTo(q.x + 8, q.y); ctx.moveTo(q.x, q.y - 8); ctx.lineTo(q.x, q.y + 8); ctx.stroke(); }
  // porta/janela sob o cursor
  if ((S.tool === 'door' || S.tool === 'window') && ED.hover?.wall) {
    const w = ED.hover.wall, def = S.tool === 'door' ? 80 : 120;
    const tmp = { kind: S.tool, width: Math.min(def, AS.wallLen(w) - 2), t: ED.hover.t, type: S.tool === 'door' ? 'giro' : 'correr', side: ED.hover.side, hinge: 'a' };
    ctx.globalAlpha = 0.7; R2.drawOpening(ctx, tmp, w, v, { ...C, ink: C.accent, paper: C.paper }, false, false, AS.floor()); ctx.globalAlpha = 1;
  }
  // divisão
  if (S.tool === 'split' && ED.hover?.wall) { const q = S2(ED.hover.p); ctx.strokeStyle = C.sel; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x - 7, q.y - 7); ctx.lineTo(q.x + 7, q.y + 7); ctx.moveTo(q.x + 7, q.y - 7); ctx.lineTo(q.x - 7, q.y + 7); ctx.stroke(); }
  // móvel em posicionamento
  if (S.tool === 'furniture' && ED.placing) {
    const d = AS.furnDef(ED.placing.type), sp = ED.snapInfo?.p || P;
    ctx.globalAlpha = 0.6; R2.drawFurniture(ctx, { ...d, x: sp.x, y: sp.y, rot: ED.placing.rot }, v, { ...C, muted: C.accent }, false, false); ctx.globalAlpha = 1;
  }
  // seleção em janela
  if (ED.drag?.type === 'marquee') {
    const a = S2(ED.drag.start), b = S2(P);
    ctx.fillStyle = C.accent; ctx.globalAlpha = 0.08; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.globalAlpha = 1;
    ctx.strokeStyle = C.accent; ctx.setLineDash([4, 3]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
  }
};

/* ---------- Entrada numérica de comprimento ---------- */
ED.showNumInput = (initial = '') => {
  const box = document.getElementById('numInput'), inp = document.getElementById('numInputField');
  const q = R2.toScreen(ED.pointer.w);
  box.hidden = false; box.style.left = Math.min(R2.w - 190, q.x + 18) + 'px'; box.style.top = Math.max(4, q.y - 44) + 'px';
  document.getElementById('numInputUnit').textContent = AS.units.mode;
  inp.value = initial; inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
};
ED.hideNumInput = () => { const b = document.getElementById('numInput'); if (b) b.hidden = true; };
ED.applyNumInput = () => {
  const inp = document.getElementById('numInputField');
  const L = AS.units.parse(inp.value);
  ED.hideNumInput(); R2.canvas.focus();
  if (!isFinite(L) || L <= 0) return AS.toast('Comprimento inválido. Exemplos: 3,5 · 350cm · 3m50', 'err');
  if (S.tool === 'wall' && ED.chain) {
    const tgt = ED.snapInfo?.p || ED.pointer.w;
    let d = AS.geo.sub(tgt, ED.chain.last); if (AS.geo.len(d) < 0.01) d = { x: 1, y: 0 };
    d = AS.geo.norm(d);
    const b = AS.geo.add(ED.chain.last, AS.geo.mul(d, L));
    ED.commitWallSegment(ED.chain.last, { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10 });
  }
};

ED.commitWallSegment = (a, b) => {
  if (AS.geo.dist(a, b) < 2) return;
  AS.history.run('Desenhar parede', () => {
    const w = AS.addWall(a, b);
    // conecta em T dividindo a parede atingida (mantém topologia limpa)
    for (const p of [a, b]) for (const v of AS.floor().walls) {
      if (v === w) continue; const L = AS.wallLen(v), pr = AS.geo.projSeg(p, v.a, v.b);
      if (pr.d < 0.6 && pr.t * L > 2 && pr.t * L < L - 2) { AS.splitWall(v, pr.t * L); break; }
    }
  });
  const closes = ED.chain && AS.geo.eq(b, ED.chain.start, 0.6);
  if (closes) { ED.chain = null; AS.toast('Contorno fechado'); }
  else ED.chain = { start: ED.chain?.start || a, last: b };
};

/* ---------- Ponteiro ---------- */
ED.onDown = (e) => {
  R2.canvas.focus();
  R2.canvas.setPointerCapture(e.pointerId);
  ED.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (ED.pointers.size === 2) { // pinça
    const [p1, p2] = [...ED.pointers.values()];
    ED.drag = { type: 'pinch', d0: Math.hypot(p1.x - p2.x, p1.y - p2.y), s0: R2.view.s, c: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, v0: { ...R2.view } };
    return;
  }
  const p = R2.toWorld(e.offsetX, e.offsetY);
  ED.pointer = { x: e.offsetX, y: e.offsetY, w: p };
  if (e.button === 1 || e.button === 0 && (ED.spaceDown || S.tool === 'pan')) { ED.drag = { type: 'pan', sx: e.offsetX, sy: e.offsetY, ox: R2.view.ox, oy: R2.view.oy }; R2.canvas.style.cursor = 'grabbing'; return; }
  if (e.button === 2) return;
  const free = e.shiftKey && S.tool !== 'select';
  const tool = S.tool;
  if (tool === 'wall') {
    const sp = ED.snap(p, { from: ED.chain?.last, free }).p;
    if (!ED.chain) { ED.chain = { start: sp, last: sp }; }
    else ED.commitWallSegment(ED.chain.last, sp);
    R2.req(); return;
  }
  if (tool === 'room') { const sp = ED.snap(p, { free }).p; if (!ED.rectStart) { ED.rectStart = sp; ED.drag = { type: 'rect' }; } else ED.finishRect(sp); return; }
  if (tool === 'measure') {
    const sp = ED.snap(p, { free, from: ED.measureStart }).p;
    if (!ED.measureStart) ED.measureStart = sp;
    else { const a = ED.measureStart; ED.measureStart = null; if (AS.geo.dist(a, sp) > 1) AS.history.run('Cota', () => AS.floor().dims.push({ id: AS.uid('dm'), a, b: sp, off: 0 })); }
    R2.req(); return;
  }
  if (tool === 'calibrate') {
    const sp = ED.snap(p, { free: true }).p; ED.calib.pts.push(sp);
    if (ED.calib.pts.length === 2) AS.bus.emit('calibrate', ED.calib.pts.slice());
    R2.req(); return;
  }
  if (tool === 'bgmove') { const bg = AS.floor().bg; if (bg) ED.drag = { type: 'bg', start: p, x0: bg.x, y0: bg.y }; return; }
  if (tool === 'door' || tool === 'window') {
    const h = ED.wallUnder(p); if (!h) return AS.toast('Clique sobre uma parede');
    let o; AS.history.run(tool === 'door' ? 'Adicionar porta' : 'Adicionar janela', () => { o = AS.addOpening(tool, h.wall, AS.round(h.t, 5), { side: h.side }); });
    ED.select([{ kind: 'opening', id: o.id }]); return;
  }
  if (tool === 'split') { const h = ED.wallUnder(p); if (!h) return; AS.history.run('Dividir parede', () => AS.splitWall(h.wall, AS.round(h.t, 1))); return; }
  if (tool === 'furniture' && ED.placing) {
    const sp = ED.snapInfo?.p || p; let f;
    AS.history.run('Adicionar móvel', () => { f = AS.addFurniture(ED.placing.type, Math.round(sp.x), Math.round(sp.y), ED.placing.rot); });
    if (!e.altKey) { ED.setTool('select'); ED.select([{ kind: 'furniture', id: f.id }]); }
    return;
  }
  // ---- seleção ----
  const hit = ED.hit(p);
  if (!hit) { if (!e.shiftKey) ED.select([]); ED.drag = { type: 'marquee', start: p, add: e.shiftKey }; return; }
  if (hit.kind === 'handle') { AS.history.begin(); ED.drag = { type: 'endpoint', wall: hit.wall, end: hit.end, joined: AS.wallsAt(hit.wall[hit.end], AS.floor(), 1, hit.wall.id).filter(j => !j.w.locked), moved: false }; return; }
  if (hit.kind === 'rotate') { AS.history.begin(); ED.drag = { type: 'rotate', f: hit.f }; return; }
  if (hit.kind === 'resize') { AS.history.begin(); ED.drag = { type: 'resize', f: hit.f }; return; }
  if (hit.kind === 'ohandle') { AS.history.begin(); ED.drag = { type: 'owidth', o: hit.o, w: hit.w, end: hit.end }; return; }
  let item = hit.kind === 'room' ? { kind: 'room', id: AS.ensureRoomMetaLazy(hit.room) } : { kind: hit.kind, id: hit.id };
  const already = S.sel.some(s => s.kind === item.kind && s.id === item.id);
  if (e.shiftKey) ED.select([item], true);
  else if (!already) ED.select([item]);
  // arraste da seleção
  AS.history.begin();
  ED.drag = { type: 'move', start: p, last: p, moved: false, snapStart: hit.kind === 'wall' ? null : null };
  ED.prepareMove();
};
AS.ensureRoomMetaLazy = (room) => { if (room.meta) return room.meta.id; let id; AS.history.run('Identificar cômodo', () => { id = AS.ensureRoomMeta(room).id; }); return id; };

ED.prepareMove = () => {
  const fl = AS.floor();
  const wallIds = new Set(ED.selected('wall').filter(s => !s.o.locked).map(s => s.id));
  // pontos a mover: extremidades das paredes selecionadas + extremidades coincidentes de outras paredes
  const pts = [];
  for (const id of wallIds) { const w = AS.find('wall', id); pts.push({ w, e: 'a', o: { ...w.a } }, { w, e: 'b', o: { ...w.b } }); }
  const joined = [];
  for (const w of fl.walls) {
    if (wallIds.has(w.id) || w.locked) continue;
    for (const e of ['a', 'b']) for (const id of wallIds) { const s = AS.find('wall', id); if (G2.eq(w[e], s.a, 1) || G2.eq(w[e], s.b, 1)) { joined.push({ w, e, o: { ...w[e] } }); break; } }
  }
  ED.drag.walls = pts; ED.drag.joined = joined;
  ED.drag.furn = ED.selected('furniture').filter(s => !s.o.locked).map(s => ({ f: s.o, x: s.o.x, y: s.o.y }));
  ED.drag.opens = ED.selected('opening').filter(s => !s.o.locked).map(s => ({ o: s.o, t: s.o.t, wallId: s.o.wallId }));
  ED.drag.rooms = ED.selected('room').map(s => ({ m: s.o, a: { ...s.o.anchor }, l: s.o.labelPos ? { ...s.o.labelPos } : null }));
  ED.drag.dims = ED.selected('dim').map(s => ({ d: s.o, a: { ...s.o.a }, b: { ...s.o.b } }));
  ED.drag.excl = wallIds;
  // referência de snap: primeira extremidade de parede selecionada
  ED.drag.ref = pts[0] ? { ...pts[0].o } : null;
};

ED.wallUnder = (p, tolPx = 14) => {
  const fl = AS.floor(); let best = null;
  for (const w of fl.walls) {
    if (w.hidden) continue; const pr = AS.geo.projSeg(p, w.a, w.b);
    if (pr.d < w.thickness / 2 + tolPx / R2.view.s && (!best || pr.d < best.d)) {
      const n = AS.geo.perp(AS.wallDir(w));
      best = { wall: w, t: pr.t * AS.wallLen(w), d: pr.d, p: pr.p, side: Math.sign(AS.geo.dot(AS.geo.sub(p, pr.p), n)) || 1 };
    }
  }
  return best;
};

ED.onMove = (e) => {
  if (ED.pointers.has(e.pointerId)) ED.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  const p = R2.toWorld(e.offsetX, e.offsetY);
  ED.pointer = { x: e.offsetX, y: e.offsetY, w: p };
  AS.bus.emit('pointer', p);
  const d = ED.drag, free = e.shiftKey;
  if (d?.type === 'pinch' && ED.pointers.size === 2) {
    const [p1, p2] = [...ED.pointers.values()], dist = Math.hypot(p1.x - p2.x, p1.y - p2.y), c = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    Object.assign(R2.view, d.v0); const wc = R2.toWorld(d.c.x, d.c.y);
    R2.view.s = AS.clamp(d.s0 * dist / d.d0, 0.02, 10); R2.view.ox = c.x - wc.x * R2.view.s; R2.view.oy = c.y - wc.y * R2.view.s; R2.req(); return;
  }
  if (d?.type === 'pan') { R2.view.ox = d.ox + e.offsetX - d.sx; R2.view.oy = d.oy + e.offsetY - d.sy; R2.req(); AS.bus.emit('view'); return; }
  const tool = S.tool;
  if (tool === 'wall') { ED.snapInfo = ED.snap(p, { from: ED.chain?.last, free }); R2.req(); return; }
  if (tool === 'room' || tool === 'measure' || tool === 'calibrate') { ED.snapInfo = ED.snap(p, { free: free || tool === 'calibrate', from: tool === 'measure' ? ED.measureStart : null }); R2.req(); return; }
  if (tool === 'door' || tool === 'window' || tool === 'split') { ED.hover = ED.wallUnder(p); R2.req(); return; }
  if (tool === 'furniture') { const g = S.project.settings.snapGrid ? 5 : 1; ED.snapInfo = { p: { x: AS.round(p.x, g), y: AS.round(p.y, g) } }; R2.req(); return; }
  if (!d) { // hover para cursor
    const h = ED.hit(p);
    R2.canvas.style.cursor = !h ? 'default' : h.kind === 'handle' || h.kind === 'resize' || h.kind === 'ohandle' ? 'pointer' : h.kind === 'rotate' ? 'alias' : 'move';
    return;
  }
  if (d.type === 'bg') { const bg = AS.floor().bg; bg.x = d.x0 + p.x - d.start.x; bg.y = d.y0 + p.y - d.start.y; R2.req(); return; }
  if (d.type === 'marquee') { R2.req(); return; }
  if (d.type === 'endpoint') {
    const w = d.wall, other = d.end === 'a' ? w.b : w.a;
    const sn = ED.snap(p, { from: other, free, excludeWall: new Set([w.id, ...d.joined.map(j => j.w.id)]) }); ED.snapInfo = sn;
    const np = sn.p; if (AS.geo.dist(np, other) < 2) return;
    w[d.end] = { ...np }; for (const j of d.joined) j.w[j.e] = { ...np };
    d.moved = true; AS.fixOpenings(); ED.liveChanged(); return;
  }
  if (d.type === 'rotate') { const f = d.f; let a = AS.deg(Math.atan2(p.y - f.y, p.x - f.x)) + 90; if (!free) a = AS.round(a, 15); f.rot = ((a % 360) + 360) % 360; ED.liveChanged(); return; }
  if (d.type === 'resize') { const f = d.f; const loc = AS.geo.rot({ x: p.x - f.x, y: p.y - f.y }, -AS.rad(f.rot || 0)); f.w = Math.max(10, AS.round(Math.abs(loc.x) * 2, free ? 1 : 5)); f.d = Math.max(10, AS.round(Math.abs(loc.y) * 2, free ? 1 : 5)); ED.liveChanged(); return; }
  if (d.type === 'owidth') {
    const o = d.o, w = d.w, L = AS.wallLen(w), t = AS.geo.projSeg(p, w.a, w.b).t * L;
    const fixedEnd = d.end === 0 ? o.t + o.width / 2 : o.t - o.width / 2;
    let nw = AS.round(Math.abs(fixedEnd - t), free ? 1 : 5); nw = AS.clamp(nw, 30, L - 2);
    o.width = nw; o.t = d.end === 0 ? fixedEnd - nw / 2 : fixedEnd + nw / 2; AS.fixOpenings(); ED.liveChanged(); return;
  }
  if (d.type === 'move') {
    let delta = AS.geo.sub(p, d.start);
    if (!d.moved && AS.geo.len(delta) * R2.view.s < 3) return;
    d.moved = true;
    // snap da referência
    if (d.ref && !free) { const sn = ED.snap(AS.geo.add(d.ref, delta), { excludeWall: d.excl }); ED.snapInfo = sn; delta = AS.geo.sub(sn.p, d.ref); }
    else if (!free && S.project.settings.snapGrid && !d.opens.length) { const g = S.project.settings.grid; delta = { x: AS.round(delta.x, g / 2), y: AS.round(delta.y, g / 2) }; }
    for (const q of d.walls) q.w[q.e] = AS.geo.add(q.o, delta);
    for (const q of d.joined) q.w[q.e] = AS.geo.add(q.o, delta);
    for (const q of d.furn) { q.f.x = Math.round((q.x + delta.x) * 10) / 10; q.f.y = Math.round((q.y + delta.y) * 10) / 10; }
    for (const q of d.rooms) { q.m.anchor = AS.geo.add(q.a, delta); q.m.labelPos = AS.geo.add(q.l || q.a, delta); }
    for (const q of d.dims) { q.d.a = AS.geo.add(q.a, delta); q.d.b = AS.geo.add(q.b, delta); }
    if (d.opens.length && !d.walls.length) {
      // portas/janelas deslizam pela parede; podem saltar para outra parede
      for (const q of d.opens) {
        const h = ED.wallUnder(p, 20);
        if (h && h.wall.id !== q.o.wallId && d.opens.length === 1) { q.o.wallId = h.wall.id; q.o.t = h.t; q.wallId = h.wall.id; q.t = h.t; d.start = p; }
        else { const w = AS.find('wall', q.o.wallId); if (!w) continue; const dir = AS.wallDir(w); q.o.t = AS.round(q.t + AS.geo.dot(delta, dir), free ? 1 : 5); }
      }
    }
    AS.fixOpenings(); ED.liveChanged(); return;
  }
};
ED.liveChanged = AS.throttle(() => { AS.changed(true); }, 40);

ED.onUp = (e) => {
  ED.pointers.delete(e.pointerId);
  const d = ED.drag; ED.drag = null;
  if (!d) return;
  if (d.type === 'pan') { R2.canvas.style.cursor = ED.TOOLS[S.tool].cursor; return; }
  if (d.type === 'pinch') return;
  if (d.type === 'bg') { AS.history.begin(); AS.history.commit('Mover referência'); AS.bus.emit('changed', false); return; }
  if (d.type === 'rect') { const sp = ED.snapInfo?.p; if (sp && AS.geo.dist(sp, ED.rectStart) * R2.view.s > 12) ED.finishRect(sp); return; }
  if (d.type === 'marquee') {
    const p = ED.pointer.w, a = d.start; const x0 = Math.min(a.x, p.x), x1 = Math.max(a.x, p.x), y0 = Math.min(a.y, p.y), y1 = Math.max(a.y, p.y);
    if ((x1 - x0) * R2.view.s < 4) { R2.req(); return; }
    const inside = (q) => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1, fl = AS.floor(), items = [];
    for (const w of fl.walls) if (!w.hidden && inside(w.a) && inside(w.b)) items.push({ kind: 'wall', id: w.id });
    for (const f of fl.furniture) if (!f.hidden && inside(f)) items.push({ kind: 'furniture', id: f.id });
    for (const o of fl.openings) { const w = fl.walls.find(x => x.id === o.wallId); if (w && inside(R2.openingGeom(o, w).c)) items.push({ kind: 'opening', id: o.id }); }
    ED.select(items, d.add); AS.toast(`${items.length} objeto(s) selecionado(s)`); return;
  }
  ED.snapInfo = null; ED.guides = [];
  const labels = { endpoint: 'Editar extremidade da parede', rotate: 'Girar móvel', resize: 'Redimensionar móvel', owidth: 'Redimensionar abertura', move: 'Mover seleção' };
  if (d.type === 'move' && !d.moved) { AS.history.pending = null; return; }
  if (d.type === 'endpoint') { // conecta em T se soltar sobre parede
    const w = d.wall, p = w[d.end];
    for (const v of AS.floor().walls) { if (v === w || d.joined.some(j => j.w === v)) continue; const L = AS.wallLen(v), pr = AS.geo.projSeg(p, v.a, v.b); if (pr.d < 0.6 && pr.t * L > 2 && pr.t * L < L - 2) { AS.splitWall(v, pr.t * L); break; } }
  }
  AS.history.commit(labels[d.type] || 'Editar');
  R2.req();
};

ED.finishRect = (b) => {
  const a = ED.rectStart; ED.rectStart = null;
  if (Math.abs(b.x - a.x) < 30 || Math.abs(b.y - a.y) < 30) { AS.toast('Cômodo muito pequeno (mínimo 30 cm)', 'err'); R2.req(); return; }
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const pts = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  AS.history.run('Desenhar cômodo', () => {
    const fl = AS.floor();
    for (let i = 0; i < 4; i++) {
      const p = pts[i], q = pts[(i + 1) % 4];
      // evita duplicar paredes existentes exatamente coincidentes
      const exists = fl.walls.some(w => (G2.eq(w.a, p, 1) && G2.eq(w.b, q, 1)) || (G2.eq(w.a, q, 1) && G2.eq(w.b, p, 1)));
      if (!exists) AS.addWall(p, q);
    }
    AS.addRoomMeta({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, 'Cômodo', 'outro');
  });
  R2.req();
};

ED.onWheel = (e) => {
  e.preventDefault();
  if (e.ctrlKey || !e.shiftKey && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) ED.zoomWheel(e);
  else { R2.view.ox -= e.deltaX || e.deltaY; R2.req(); }
};
ED.zoomWheel = (e) => { const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)); R2.zoomAt(f, e.offsetX, e.offsetY); };

ED.onDbl = () => { if (S.tool === 'wall' && ED.chain) { ED.chain = null; AS.toast('Desenho de paredes encerrado'); R2.req(); } else if (S.tool === 'select') { const h = ED.hit(ED.pointer.w, { noHandles: true }); if (h?.kind === 'room') AS.bus.emit('focusProp', 'name'); } };

/* ---------- Operações sobre a seleção ---------- */
ED.ops = {
  delete() {
    if (!S.sel.length) return;
    const n = S.sel.length;
    AS.history.run('Excluir', () => {
      const fl = AS.floor(), ids = new Set(S.sel.filter(s => !AS.find(s.kind, s.id)?.locked).map(s => s.id));
      fl.walls = fl.walls.filter(w => !ids.has(w.id));
      fl.openings = fl.openings.filter(o => !ids.has(o.id) && fl.walls.some(w => w.id === o.wallId));
      fl.furniture = fl.furniture.filter(f => !ids.has(f.id));
      fl.roomMeta = fl.roomMeta.filter(m => !ids.has(m.id));
      fl.dims = fl.dims.filter(d => !ids.has(d.id));
    });
    ED.select([]); AS.toast(`${n} objeto(s) excluído(s)`);
  },
  copy() {
    if (!S.sel.length) return;
    const fl = AS.floor(), sel = new Set(S.sel.map(s => s.id));
    const walls = fl.walls.filter(w => sel.has(w.id));
    const wIds = new Set(walls.map(w => w.id));
    S.clipboard = AS.clone({ walls, furniture: fl.furniture.filter(f => sel.has(f.id)), openings: fl.openings.filter(o => wIds.has(o.wallId) || sel.has(o.id)), dims: fl.dims.filter(d => sel.has(d.id)) });
    AS.toast(`${S.sel.length} objeto(s) copiado(s)`);
  },
  paste(offset = 50) {
    const cb = S.clipboard; if (!cb) return AS.toast('Área de transferência vazia');
    const items = [];
    AS.history.run('Colar', () => {
      const fl = AS.floor(), map = {};
      for (const w of cb.walls) { const n = AS.clone(w); n.id = AS.uid('w'); map[w.id] = n.id; n.a.x += offset; n.a.y += offset; n.b.x += offset; n.b.y += offset; n.groupId = null; fl.walls.push(n); items.push({ kind: 'wall', id: n.id }); }
      for (const o of cb.openings) { const n = AS.clone(o); n.id = AS.uid('op'); if (map[o.wallId]) n.wallId = map[o.wallId]; else { n.t += offset; } if (!fl.walls.some(w => w.id === n.wallId)) continue; fl.openings.push(n); items.push({ kind: 'opening', id: n.id }); }
      for (const f of cb.furniture) { const n = AS.clone(f); n.id = AS.uid('fu'); n.x += offset; n.y += offset; n.groupId = null; fl.furniture.push(n); items.push({ kind: 'furniture', id: n.id }); }
      for (const d of cb.dims) { const n = AS.clone(d); n.id = AS.uid('dm'); n.a.x += offset; n.a.y += offset; n.b.x += offset; n.b.y += offset; fl.dims.push(n); items.push({ kind: 'dim', id: n.id }); }
      AS.fixOpenings();
    });
    ED.select(items);
  },
  duplicate() { ED.ops.copy(); ED.ops.paste(50); },
  rotate90() {
    const sel = ED.selected().filter(s => !s.o.locked); if (!sel.length) return;
    const pts = [];
    for (const s of sel) { if (s.kind === 'wall') pts.push(s.o.a, s.o.b); if (s.kind === 'furniture') pts.push(s.o); }
    if (!pts.length) return;
    const b = AS.geo.bbox(pts), c = { x: b.x0 + b.w / 2, y: b.y0 + b.h / 2 };
    AS.history.run('Girar 90°', () => {
      for (const s of sel) {
        if (s.kind === 'wall') { s.o.a = AS.geo.rot(s.o.a, Math.PI / 2, c); s.o.b = AS.geo.rot(s.o.b, Math.PI / 2, c); }
        if (s.kind === 'furniture') { const q = sel.length > 1 ? AS.geo.rot(s.o, Math.PI / 2, c) : s.o; s.o.x = q.x; s.o.y = q.y; s.o.rot = ((s.o.rot || 0) + 90) % 360; }
      }
    });
  },
  flip() { const ops = ED.selected('opening'); if (!ops.length) return; AS.history.run('Inverter abertura', () => ops.forEach(s => { if (s.o.side === 1 && s.o.hinge === 'a') s.o.hinge = 'b'; else if (s.o.hinge === 'b' && s.o.side === 1) { s.o.side = -1; } else if (s.o.side === -1 && s.o.hinge === 'b') s.o.hinge = 'a'; else { s.o.side = 1; } })); },
  group() {
    const sel = ED.selected().filter(s => s.kind === 'wall' || s.kind === 'furniture'); if (sel.length < 2) return AS.toast('Selecione 2 ou mais paredes/móveis para agrupar');
    const g = AS.uid('g'); AS.history.run('Agrupar', () => sel.forEach(s => { s.o.groupId = g; })); AS.toast(`Grupo criado com ${sel.length} objetos`);
  },
  ungroup() { const sel = ED.selected().filter(s => s.o.groupId); if (!sel.length) return; AS.history.run('Desagrupar', () => sel.forEach(s => { s.o.groupId = null; })); AS.toast('Grupo desfeito'); },
  lock() { const sel = ED.selected(); if (!sel.length) return; const v = !sel.every(s => s.o.locked); AS.history.run(v ? 'Bloquear' : 'Desbloquear', () => sel.forEach(s => { s.o.locked = v; })); AS.toast(v ? 'Objetos bloqueados' : 'Objetos desbloqueados'); },
  hide() { const sel = ED.selected(); if (!sel.length) return; AS.history.run('Ocultar', () => sel.forEach(s => { s.o.hidden = true; })); ED.select([]); AS.toast('Objetos ocultos — "Mostrar ocultos" no menu de contexto'); },
  showAll() { AS.history.run('Mostrar ocultos', () => { const fl = AS.floor(); [...fl.walls, ...fl.openings, ...fl.furniture].forEach(o => { o.hidden = false; }); }); },
  selectAll() { const fl = AS.floor(); ED.select([...fl.walls.map(w => ({ kind: 'wall', id: w.id })), ...fl.furniture.map(f => ({ kind: 'furniture', id: f.id })), ...fl.openings.map(o => ({ kind: 'opening', id: o.id }))]); },
  nudge(dx, dy) {
    const sel = ED.selected().filter(s => !s.o.locked); if (!sel.length) return;
    AS.history.begin(); ED.drag = { start: { x: 0, y: 0 } }; ED.prepareMove(); const d = ED.drag; ED.drag = null;
    for (const q of d.walls) q.w[q.e] = AS.geo.add(q.o, { x: dx, y: dy });
    for (const q of d.joined) q.w[q.e] = AS.geo.add(q.o, { x: dx, y: dy });
    for (const q of d.furn) { q.f.x += dx; q.f.y += dy; }
    for (const q of d.opens) { const w = AS.find('wall', q.o.wallId); if (w) q.o.t += AS.geo.dot({ x: dx, y: dy }, AS.wallDir(w)); }
    for (const q of d.dims) { q.d.a = AS.geo.add(q.a, { x: dx, y: dy }); q.d.b = AS.geo.add(q.b, { x: dx, y: dy }); }
    AS.fixOpenings(); AS.history.commit('Mover (teclado)');
  },
  splitMid() { const ws = ED.selected('wall'); if (!ws.length) return; AS.history.run('Dividir parede ao meio', () => ws.forEach(s => AS.splitWall(s.o, AS.wallLen(s.o) / 2))); },
  merge() { const ws = ED.selected('wall'); if (ws.length !== 2) return AS.toast('Selecione exatamente 2 paredes colineares conectadas', 'err'); AS.history.run('Unir paredes', () => AS.mergeWalls(ws[0].o, ws[1].o)); ED.select([{ kind: 'wall', id: ws[0].id }]); },
};

/* ---------- Teclado ---------- */
ED.onKey = (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
    if (e.target.id === 'numInputField') { if (e.key === 'Enter') { e.preventDefault(); ED.applyNumInput(); } if (e.key === 'Escape') { ED.hideNumInput(); R2.canvas.focus(); } }
    return;
  }
  if (!document.getElementById('modal').hidden) { if (e.key === 'Escape') AS.ui.closeModal(); return; }
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); return AS.history.doUndo(); }
  if (mod && (k === 'y' || k === 'z' && e.shiftKey)) { e.preventDefault(); return AS.history.doRedo(); }
  if (mod && k === 'c') { e.preventDefault(); return ED.ops.copy(); }
  if (mod && k === 'v') { e.preventDefault(); return ED.ops.paste(); }
  if (mod && k === 'd') { e.preventDefault(); return ED.ops.duplicate(); }
  if (mod && k === 'a') { e.preventDefault(); return ED.ops.selectAll(); }
  if (mod && k === 'g') { e.preventDefault(); return e.shiftKey ? ED.ops.ungroup() : ED.ops.group(); }
  if (mod && k === 's') { e.preventDefault(); return AS.storage.saveCurrent(true); }
  if (mod && k === 'l') { e.preventDefault(); return ED.ops.lock(); }
  if (mod) return;
  if (e.key === ' ') { ED.spaceDown = true; R2.canvas.style.cursor = 'grab'; e.preventDefault(); return; }
  if (e.key === 'Escape') { if (ED.chain || ED.rectStart || ED.measureStart || ED.placing) { ED.chain = null; ED.rectStart = null; ED.measureStart = null; if (S.tool === 'furniture') ED.setTool('select'); R2.req(); } else if (S.tool !== 'select') ED.setTool('select'); else ED.select([]); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return ED.ops.delete(); }
  if (e.key === 'Enter' && S.tool === 'wall') { ED.chain = null; R2.req(); return; }
  if (S.tool === 'wall' && ED.chain && /^[0-9]$/.test(e.key)) { e.preventDefault(); return ED.showNumInput(e.key); }
  if (e.key.startsWith('Arrow')) {
    e.preventDefault(); const st = e.shiftKey ? 10 : 1;
    const [dx, dy] = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    if (S.sel.length) ED.ops.nudge(dx, dy); else { R2.view.ox -= dx * 20; R2.view.oy -= dy * 20; R2.req(); }
    return;
  }
  if (k === 'r') { if (S.tool === 'furniture' && ED.placing) { ED.placing.rot = (ED.placing.rot + 90) % 360; R2.req(); return; } if (S.sel.length) return ED.ops.rotate90(); return ED.setTool('room'); }
  if (k === 'f') { if (ED.selected('opening').length) return ED.ops.flip(); return R2.fit(); }
  if (k === 'h' && e.shiftKey) return ED.ops.hide();
  const map = { v: 'select', w: 'wall', d: 'door', j: 'window', t: 'measure', x: 'split', h: 'pan', m: 'furniture' };
  if (map[k]) { if (k === 'm') { AS.ui.openPanel('furniture'); return; } return ED.setTool(map[k]); }
  if (k === '+' || k === '=') return R2.zoomAt(1.2, R2.w / 2, R2.h / 2);
  if (k === '-') return R2.zoomAt(1 / 1.2, R2.w / 2, R2.h / 2);
  if (k === '1') return AS.ui.setViewMode('plan');
  if (k === '2') return AS.ui.setViewMode('split');
  if (k === '3') return AS.ui.setViewMode('3d');
  if (k === '?') return AS.ui.showShortcuts();
};
ED.onKeyUp = (e) => { if (e.key === ' ') { ED.spaceDown = false; if (R2.canvas) R2.canvas.style.cursor = ED.TOOLS[S.tool]?.cursor || 'default'; } };

/* ---------- Menu de contexto ---------- */
ED.onContext = (e) => {
  e.preventDefault();
  const p = R2.toWorld(e.offsetX, e.offsetY);
  if (S.tool === 'wall' && ED.chain) { ED.chain = null; R2.req(); return; }
  const h = ED.hit(p, { noHandles: true });
  if (h && !S.sel.some(s => s.id === (h.id || h.room?.meta?.id))) {
    if (h.kind === 'room') ED.select([{ kind: 'room', id: AS.ensureRoomMetaLazy(h.room) }]); else ED.select([{ kind: h.kind, id: h.id }]);
  }
  const has = S.sel.length > 0, walls = ED.selected('wall'), ops = ED.selected('opening');
  const items = [
    has && { label: 'Copiar', key: 'Ctrl+C', fn: ED.ops.copy },
    S.clipboard && { label: 'Colar', key: 'Ctrl+V', fn: () => ED.ops.paste() },
    has && { label: 'Duplicar', key: 'Ctrl+D', fn: ED.ops.duplicate },
    has && { label: 'Girar 90°', key: 'R', fn: ED.ops.rotate90 },
    ops.length && { label: 'Inverter abertura', key: 'F', fn: ED.ops.flip },
    walls.length && { sep: true },
    walls.length && { label: 'Dividir ao meio', fn: ED.ops.splitMid },
    walls.length === 2 && { label: 'Unir paredes', fn: ED.ops.merge },
    walls.length === 1 && { label: 'Inserir porta aqui', fn: () => { const w = walls[0].o; const t = AS.geo.projSeg(p, w.a, w.b).t * AS.wallLen(w); let o; AS.history.run('Adicionar porta', () => { o = AS.addOpening('door', w, t); }); ED.select([{ kind: 'opening', id: o.id }]); } },
    walls.length === 1 && { label: 'Inserir janela aqui', fn: () => { const w = walls[0].o; const t = AS.geo.projSeg(p, w.a, w.b).t * AS.wallLen(w); let o; AS.history.run('Adicionar janela', () => { o = AS.addOpening('window', w, t); }); ED.select([{ kind: 'opening', id: o.id }]); } },
    has && { sep: true },
    has && { label: 'Agrupar', key: 'Ctrl+G', fn: ED.ops.group },
    has && { label: 'Desagrupar', key: 'Ctrl+Shift+G', fn: ED.ops.ungroup },
    has && { label: 'Bloquear / desbloquear', key: 'Ctrl+L', fn: ED.ops.lock },
    has && { label: 'Ocultar', key: 'Shift+H', fn: ED.ops.hide },
    has && { label: 'Excluir', key: 'Del', fn: ED.ops.delete, danger: true },
    { sep: true },
    { label: 'Mostrar ocultos', fn: ED.ops.showAll },
    { label: 'Selecionar tudo', key: 'Ctrl+A', fn: ED.ops.selectAll },
    { label: 'Enquadrar planta', key: 'F', fn: () => R2.fit() },
  ].filter(Boolean);
  AS.ui.contextMenu(e.clientX, e.clientY, items);
};

ED.bind = (canvas) => {
  canvas.addEventListener('pointerdown', ED.onDown);
  canvas.addEventListener('pointermove', ED.onMove);
  canvas.addEventListener('pointerup', ED.onUp);
  canvas.addEventListener('pointercancel', (e) => { ED.pointers.delete(e.pointerId); if (ED.drag && ED.drag.type !== 'pan') AS.history.cancel(); ED.drag = null; });
  canvas.addEventListener('wheel', ED.onWheel, { passive: false });
  canvas.addEventListener('dblclick', ED.onDbl);
  canvas.addEventListener('contextmenu', ED.onContext);
  canvas.addEventListener('pointerleave', () => { ED.hover = null; R2.req(); });
  window.addEventListener('keydown', ED.onKey);
  window.addEventListener('keyup', ED.onKeyUp);
};
