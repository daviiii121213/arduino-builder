/* ==========================================================================
   02 — Modelo do projeto, histórico, operações de parede e detecção de cômodos
   ========================================================================== */
const G2 = AS.geo;

AS.newFloor = (name = 'Térreo', elevation = 0) => ({
  id: AS.uid('fl'), name, elevation, height: 280, slab: 12,
  walls: [], openings: [], furniture: [], roomMeta: [], dims: [], bg: null, visible: true,
});

AS.newProject = (name = 'Novo projeto') => {
  const f = AS.newFloor();
  return {
    schema: 'architect-studio-ultra/1', id: AS.uid('prj'), name,
    created: Date.now(), modified: Date.now(),
    units: 'm', precision: 2,
    floors: [f], activeFloor: f.id,
    materials: AS.clone(AS.DEFAULT_MATERIALS),
    assets: {},
    settings: { wallThickness: 15, extThickness: 20, wallHeight: 280, grid: 10, snapGrid: true, snapWall: true, snapCorner: true, snapAlign: true, angleSnap: true, showDims: true, showGrid: true, showFurniture: true, showLower: false, roomAreaMode: 'util' },
    view3d: { ceilings: false, cutaway: false, allFloors: true, shadows: true, roof: false },
    meta: { source: 'manual', notes: '' },
  };
};

/* ---------- Estado global ---------- */
AS.state = {
  project: null,
  sel: [],            // [{kind:'wall'|'opening'|'furniture'|'room'|'dim', id}]
  tool: 'select',
  viewMode: 'split',
  clipboard: null,
  version: 0,         // incrementa a cada alteração de geometria
};
const S = AS.state;

AS.floor = () => S.project.floors.find(f => f.id === S.project.activeFloor) || S.project.floors[0];
AS.floorById = (id) => S.project.floors.find(f => f.id === id);
AS.mat = (id) => S.project.materials.find(m => m.id === id) || AS.DEFAULT_MATERIALS.find(m => m.id === id) || AS.DEFAULT_MATERIALS[0];
AS.find = (kind, id, fl = AS.floor()) => {
  const list = kind === 'wall' ? fl.walls : kind === 'opening' ? fl.openings : kind === 'furniture' ? fl.furniture : kind === 'room' ? fl.roomMeta : kind === 'dim' ? fl.dims : [];
  return list.find(o => o.id === id);
};
AS.wallLen = (w) => G2.dist(w.a, w.b);
AS.wallDir = (w) => G2.norm(G2.sub(w.b, w.a));

/* ---------- Histórico (opera sobre os dados reais do projeto) ---------- */
AS.history = {
  undo: [], redo: [], max: 120, pending: null,
  snap() { const p = S.project; return JSON.stringify({ floors: p.floors, materials: p.materials, activeFloor: p.activeFloor, settings: p.settings, name: p.name, view3d: p.view3d }); },
  restore(str) {
    const d = JSON.parse(str); Object.assign(S.project, d);
    S.sel = S.sel.filter(s => AS.find(s.kind, s.id));
    AS.changed(true);
  },
  begin() { if (!this.pending) this.pending = this.snap(); },
  cancel() { if (this.pending) { this.restore(this.pending); this.pending = null; } },
  commit(label) {
    const before = this.pending ?? null; this.pending = null;
    if (before == null) return;
    const after = this.snap();
    if (before === after) return;
    this.undo.push({ label, data: before, ts: Date.now() });
    if (this.undo.length > this.max) this.undo.shift();
    this.redo = [];
    S.project.modified = Date.now();
    AS.changed(true);
    AS.bus.emit('history');
  },
  /** Executa fn como uma única operação desfazível */
  run(label, fn) { this.begin(); try { fn(); } catch (e) { console.error(e); this.cancel(); AS.toast('Erro: ' + e.message, 'err'); return; } this.commit(label); },
  doUndo() {
    const e = this.undo.pop(); if (!e) return AS.toast('Nada para desfazer');
    this.redo.push({ label: e.label, data: this.snap(), ts: Date.now() });
    this.restore(e.data); AS.toast('Desfeito: ' + e.label); AS.bus.emit('history');
  },
  doRedo() {
    const e = this.redo.pop(); if (!e) return AS.toast('Nada para refazer');
    this.undo.push({ label: e.label, data: this.snap(), ts: Date.now() });
    this.restore(e.data); AS.toast('Refeito: ' + e.label); AS.bus.emit('history');
  },
  jump(idx) { // volta ao estado antes da entrada idx
    while (this.undo.length > idx) { const e = this.undo.pop(); this.redo.push({ label: e.label, data: this.snap(), ts: Date.now() }); this.restore(e.data); }
    AS.bus.emit('history');
  },
  clear() { this.undo = []; this.redo = []; this.pending = null; AS.bus.emit('history'); },
};

/** Notifica alterações. geom=true invalida cômodos e cena 3D. */
AS.changed = (geom = true) => {
  if (geom) { S.version++; AS.roomsCache = null; }
  AS.bus.emit('changed', geom);
};

/* ---------- Operações de paredes ---------- */
AS.addWall = (a, b, opts = {}) => {
  const fl = opts.floor || AS.floor(), st = S.project?.settings || { wallThickness: 15, wallHeight: 280 };
  if (G2.dist(a, b) < 1) return null;
  const w = {
    id: AS.uid('w'), a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y },
    thickness: opts.thickness ?? st.wallThickness, height: opts.height ?? fl.height ?? st.wallHeight,
    material: opts.material || 'pint_branca', materialExt: opts.materialExt || null,
    type: opts.type || 'interior', locked: false, hidden: false, groupId: null, note: opts.note || '',
  };
  fl.walls.push(w); return w;
};

/** Paredes conectadas a um ponto (extremidades coincidentes) */
AS.wallsAt = (p, fl = AS.floor(), tol = 1, exceptId = null) => {
  const r = [];
  for (const w of fl.walls) {
    if (w.id === exceptId) continue;
    if (G2.eq(w.a, p, tol)) r.push({ w, end: 'a' });
    if (G2.eq(w.b, p, tol)) r.push({ w, end: 'b' });
  }
  return r;
};

/** Mantém aberturas dentro da parede após mudanças */
AS.fixOpenings = (fl = AS.floor()) => {
  for (const o of fl.openings) {
    const w = fl.walls.find(x => x.id === o.wallId);
    if (!w) continue;
    const L = AS.wallLen(w);
    o.width = Math.min(o.width, Math.max(10, L - 2));
    o.t = AS.clamp(o.t, o.width / 2, Math.max(o.width / 2, L - o.width / 2));
  }
  fl.openings = fl.openings.filter(o => fl.walls.some(w => w.id === o.wallId));
};

/** Divide a parede no ponto (distância t em cm a partir de a). Aberturas são redistribuídas. */
AS.splitWall = (w, tcm, fl = AS.floor()) => {
  const L = AS.wallLen(w);
  if (tcm <= 1 || tcm >= L - 1) return null;
  const p = G2.lerp(w.a, w.b, tcm / L);
  const w2 = AS.clone(w); w2.id = AS.uid('w'); w2.a = { ...p }; w2.b = { ...w.b };
  w.b = { ...p };
  fl.walls.push(w2);
  for (const o of fl.openings) if (o.wallId === w.id && o.t > tcm) { o.wallId = w2.id; o.t -= tcm; }
  AS.fixOpenings(fl);
  return w2;
};

/** Une duas paredes colineares que compartilham uma extremidade */
AS.mergeWalls = (w1, w2, fl = AS.floor()) => {
  const d1 = AS.wallDir(w1), d2 = AS.wallDir(w2);
  if (Math.abs(G2.cross(d1, d2)) > 0.01) throw new Error('As paredes não são colineares');
  let shared = null;
  for (const e1 of ['a', 'b']) for (const e2 of ['a', 'b']) if (G2.eq(w1[e1], w2[e2], 1)) shared = [e1, e2];
  if (!shared) throw new Error('As paredes não compartilham uma extremidade');
  const far1 = shared[0] === 'a' ? w1.b : w1.a, far2 = shared[1] === 'a' ? w2.b : w2.a;
  // aberturas: recalcula t pela projeção
  const opens = fl.openings.filter(o => o.wallId === w1.id || o.wallId === w2.id).map(o => {
    const w = o.wallId === w1.id ? w1 : w2; const c = G2.lerp(w.a, w.b, o.t / AS.wallLen(w)); return { o, c };
  });
  w1.a = { ...far1 }; w1.b = { ...far2 };
  fl.walls = fl.walls.filter(w => w.id !== w2.id);
  for (const { o, c } of opens) { o.wallId = w1.id; o.t = G2.projSeg(c, w1.a, w1.b).t * AS.wallLen(w1); }
  AS.fixOpenings(fl);
};

/** Divide todas as paredes nos pontos de cruzamento / junção em T */
AS.splitAtIntersections = (fl = AS.floor()) => {
  let count = 0, guard = 0, changed = true;
  while (changed && guard++ < 50) {
    changed = false;
    outer: for (const w of fl.walls) {
      const L = AS.wallLen(w);
      for (const v of fl.walls) {
        if (v === w) continue;
        for (const p of [v.a, v.b]) { // junção em T
          const pr = G2.projSeg(p, w.a, w.b);
          if (pr.d < 1 && pr.t * L > 2 && pr.t * L < L - 2) { AS.splitWall(w, pr.t * L, fl); count++; changed = true; break outer; }
        }
        const x = G2.segInter(w.a, w.b, v.a, v.b);
        if (x && x.t * L > 2 && x.t * L < L - 2) {
          const Lv = AS.wallLen(v);
          if (x.u * Lv > 2 && x.u * Lv < Lv - 2) { AS.splitWall(w, x.t * L, fl); AS.splitWall(v, x.u * Lv, fl); count++; changed = true; break outer; }
        }
      }
    }
  }
  return count;
};

/* ---------- Validação geométrica ---------- */
AS.validate = (fl = AS.floor()) => {
  const issues = [];
  const W = fl.walls;
  for (const w of W) {
    const L = AS.wallLen(w);
    if (L < 2) issues.push({ level: 'erro', code: 'zero', msg: 'Parede com comprimento nulo ou quase nulo', ids: [w.id] });
    if (w.thickness <= 0 || w.height <= 0) issues.push({ level: 'erro', code: 'dim', msg: 'Parede com espessura ou altura inválida', ids: [w.id] });
  }
  // extremidades soltas e quase conectadas
  const ends = [];
  for (const w of W) for (const e of ['a', 'b']) ends.push({ w, e, p: w[e] });
  for (const E of ends) {
    const conn = ends.some(o => o !== E && G2.eq(o.p, E.p, 1));
    const onWall = W.some(v => v !== E.w && G2.projSeg(E.p, v.a, v.b).d < 1);
    if (!conn && !onWall) {
      const near = ends.find(o => o.w !== E.w && G2.dist(o.p, E.p) < 15);
      if (near) issues.push({ level: 'aviso', code: 'near', msg: `Extremidades quase conectadas (${AS.units.fmt(G2.dist(near.p, E.p))} de folga)`, ids: [E.w.id, near.w.id], fix: true });
      else issues.push({ level: 'info', code: 'free', msg: 'Extremidade de parede solta (não conectada)', ids: [E.w.id] });
    }
  }
  // sobreposição colinear
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
    const a = W[i], b = W[j], da = AS.wallDir(a), db = AS.wallDir(b);
    if (Math.abs(G2.cross(da, db)) > 0.01) {
      const x = G2.segInter(a.a, a.b, b.a, b.b);
      if (x) {
        const La = AS.wallLen(a), Lb = AS.wallLen(b);
        const inA = x.t * La > 2 && x.t * La < La - 2, inB = x.u * Lb > 2 && x.u * Lb < Lb - 2;
        if (inA && inB) issues.push({ level: 'info', code: 'cross', msg: 'Paredes se cruzam sem junção (use "Dividir nas interseções" se desejar)', ids: [a.id, b.id] });
      }
      continue;
    }
    if (G2.projLine(b.a, a.a, a.b).p && G2.dist(G2.projLine(b.a, a.a, a.b).p, b.a) > 1) continue;
    const La = AS.wallLen(a), t0 = G2.projLine(b.a, a.a, a.b).t * La, t1 = G2.projLine(b.b, a.a, a.b).t * La;
    const ov = Math.min(La, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
    if (ov > 2) issues.push({ level: 'erro', code: 'overlap', msg: `Paredes sobrepostas (${AS.units.fmt(ov)})`, ids: [a.id, b.id], fix: true });
  }
  // aberturas
  for (const o of fl.openings) {
    const w = W.find(x => x.id === o.wallId);
    if (!w) { issues.push({ level: 'erro', code: 'orphan', msg: 'Abertura sem parede', ids: [o.id], fix: true }); continue; }
    if (o.height + (o.sill || 0) > w.height + 0.5) issues.push({ level: 'aviso', code: 'tall', msg: `${o.kind === 'door' ? 'Porta' : 'Janela'} mais alta que a parede`, ids: [o.id] });
    for (const p of fl.openings) if (p !== o && p.wallId === o.wallId && p.id > o.id && Math.abs(p.t - o.t) < (p.width + o.width) / 2 - 0.5)
      issues.push({ level: 'erro', code: 'opov', msg: 'Aberturas sobrepostas na mesma parede', ids: [o.id, p.id] });
  }
  return issues;
};

/** Correções automáticas seguras */
AS.autoFix = (fl = AS.floor()) => {
  let n = 0;
  const before = fl.walls.length;
  fl.walls = fl.walls.filter(w => AS.wallLen(w) >= 2); n += before - fl.walls.length;
  // une extremidades próximas (<15cm)
  const ends = []; for (const w of fl.walls) for (const e of ['a', 'b']) ends.push({ w, e });
  for (const E of ends) {
    const p = E.w[E.e];
    const connected = ends.some(o => o !== E && G2.eq(o.w[o.e], p, 1)) || fl.walls.some(v => v !== E.w && G2.projSeg(p, v.a, v.b).d < 1);
    if (connected) continue;
    let best = null, bd = 15;
    for (const o of ends) { if (o.w === E.w) continue; const d = G2.dist(o.w[o.e], p); if (d < bd) { bd = d; best = o; } }
    if (best) { E.w[E.e] = { ...best.w[best.e] }; n++; }
  }
  // remove duplicatas idênticas
  const seen = new Set();
  fl.walls = fl.walls.filter(w => {
    const k = [w.a, w.b].map(p => Math.round(p.x) + ',' + Math.round(p.y)).sort().join('|');
    if (seen.has(k)) { n++; return false; } seen.add(k); return true;
  });
  AS.fixOpenings(fl);
  return n;
};

/* ---------- Detecção de cômodos (faces mínimas do grafo planar) ---------- */
AS.detectRooms = (fl = AS.floor()) => {
  const walls = fl.walls.filter(w => !w.hidden && AS.wallLen(w) > 1);
  // 1. segmentos e pontos de quebra
  const segs = walls.map(w => ({ w, a: w.a, b: w.b, cuts: [0, 1] }));
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], L = G2.dist(s.a, s.b);
    for (let j = 0; j < segs.length; j++) {
      if (i === j) continue;
      const o = segs[j];
      if (j > i) { const x = G2.segInter(s.a, s.b, o.a, o.b); if (x) { s.cuts.push(x.t); o.cuts.push(x.u); } }
      for (const p of [o.a, o.b]) { const pr = G2.projSeg(p, s.a, s.b); if (pr.d < 1.5 && pr.t * L > 0.5 && pr.t * L < L - 0.5) s.cuts.push(pr.t); }
    }
  }
  // 2. nós (fundidos por tolerância) e arestas
  const nodes = [];
  const nodeAt = (p) => {
    for (let i = 0; i < nodes.length; i++) if (G2.dist(nodes[i], p) < 1.5) return i;
    nodes.push({ x: p.x, y: p.y, out: [] }); return nodes.length - 1;
  };
  const edgeSet = new Map();
  for (const s of segs) {
    const cuts = [...new Set(s.cuts.map(t => Math.round(t * 1e6) / 1e6))].sort((a, b) => a - b);
    for (let k = 0; k < cuts.length - 1; k++) {
      const p = G2.lerp(s.a, s.b, cuts[k]), q = G2.lerp(s.a, s.b, cuts[k + 1]);
      if (G2.dist(p, q) < 1) continue;
      const u = nodeAt(p), v = nodeAt(q); if (u === v) continue;
      const key = u < v ? u + '-' + v : v + '-' + u;
      if (!edgeSet.has(key)) edgeSet.set(key, { u, v, w: s.w });
    }
  }
  // 3. remove arestas pendentes (grau 1) iterativamente
  let edges = [...edgeSet.values()];
  let pruned = true;
  while (pruned) {
    pruned = false; const deg = new Array(nodes.length).fill(0);
    for (const e of edges) { deg[e.u]++; deg[e.v]++; }
    const ne = edges.filter(e => deg[e.u] > 1 && deg[e.v] > 1);
    if (ne.length !== edges.length) { edges = ne; pruned = true; }
  }
  // 4. semi-arestas ordenadas por ângulo
  const half = [];
  for (const n of nodes) n.out = [];
  edges.forEach((e) => {
    const h1 = { from: e.u, to: e.v, w: e.w, used: false }, h2 = { from: e.v, to: e.u, w: e.w, used: false };
    h1.twin = h2; h2.twin = h1; half.push(h1, h2); nodes[e.u].out.push(h1); nodes[e.v].out.push(h2);
  });
  for (const n of nodes) {
    for (const h of n.out) h.ang = Math.atan2(nodes[h.to].y - n.y, nodes[h.to].x - n.x);
    n.out.sort((a, b) => a.ang - b.ang);
  }
  // 5. percorre faces: em cada nó, sai pela próxima aresta no sentido horário a partir da gêmea
  const faces = [];
  for (const h0 of half) {
    if (h0.used) continue;
    const poly = [], ws = []; let h = h0, guard = 0;
    while (!h.used && guard++ < 2000) {
      h.used = true; poly.push({ x: nodes[h.from].x, y: nodes[h.from].y }); ws.push(h.w);
      const n = nodes[h.to], out = n.out, idx = out.indexOf(h.twin);
      h = out[(idx - 1 + out.length) % out.length];
    }
    if (h !== h0 || poly.length < 3) continue;
    const a = G2.areaSigned(poly);
    if (a > 1) faces.push({ poly, ws, a }); // faces internas (orientação positiva); a externa fica negativa
  }
  // 6. monta cômodos e associa metadados (âncora dentro do polígono)
  const rooms = [];
  const metaUsed = new Set();
  faces.sort((x, y) => x.a - y.a);
  for (const f of faces) {
    if (f.a < 5000) continue; // < 0,5 m² ignorado (ex.: shafts)
    const insetOffs = f.ws.map(w => w.thickness / 2);
    const inner = G2.insetPoly(f.poly, insetOffs);
    const room = {
      key: f.poly.map(p => Math.round(p.x / 5) + ',' + Math.round(p.y / 5)).sort().join(';'),
      poly: f.poly, inner, areaAxis: f.a, area: G2.area(inner), perimeter: G2.perimeter(inner), wallIds: [...new Set(f.ws.map(w => w.id))], meta: null,
    };
    const bb = G2.bbox(inner); room.width = bb.w; room.length = bb.h;
    for (const m of fl.roomMeta) if (!metaUsed.has(m.id) && G2.inPoly(m.anchor, f.poly)) { room.meta = m; metaUsed.add(m.id); break; }
    room.label = room.meta?.labelPos && G2.inPoly(room.meta.labelPos, f.poly) ? room.meta.labelPos : G2.labelPoint(inner);
    rooms.push(room);
  }
  return { rooms, orphanMeta: fl.roomMeta.filter(m => !metaUsed.has(m.id)) };
};

AS.roomsCache = null;
AS.rooms = (fl = AS.floor()) => {
  AS.roomsCache ||= {};
  const k = fl.id + ':' + S.version;
  if (!AS.roomsCache[k]) AS.roomsCache[k] = AS.detectRooms(fl);
  return AS.roomsCache[k];
};
AS.roomName = (r) => r.meta?.name || 'Cômodo sem nome';
AS.roomById = (metaId, fl = AS.floor()) => AS.rooms(fl).rooms.find(r => r.meta?.id === metaId);

/** Garante que o cômodo tenha metadados (para renomear, colorir etc.) */
AS.ensureRoomMeta = (room, fl = AS.floor()) => {
  if (room.meta) return room.meta;
  const m = { id: AS.uid('rm'), anchor: { ...room.label }, labelPos: null, name: 'Cômodo', type: 'outro', color: null, floorMaterial: null, ceiling: true };
  fl.roomMeta.push(m); room.meta = m; return m;
};

AS.addRoomMeta = (anchor, name, type, fl = AS.floor(), extra = {}) => {
  const t = AS.roomType(type);
  const m = { id: AS.uid('rm'), anchor: { ...anchor }, labelPos: null, name: name || t.name, type: t.id, color: null, floorMaterial: null, ceiling: true, ...extra };
  fl.roomMeta.push(m); return m;
};

/* ---------- Aberturas ---------- */
AS.addOpening = (kind, wall, t, opts = {}, fl = AS.floor()) => {
  const o = kind === 'door'
    ? { id: AS.uid('op'), kind, wallId: wall.id, t, width: 80, height: 210, sill: 0, type: 'giro', hinge: 'a', side: 1, material: 'mad_freijo', frame: 'mad_freijo', locked: false, hidden: false, ...opts }
    : { id: AS.uid('op'), kind, wallId: wall.id, t, width: 120, height: 110, sill: 100, type: 'correr', hinge: 'a', side: 1, material: 'vidro', frame: 'aluminio', locked: false, hidden: false, ...opts };
  const L = AS.wallLen(wall);
  o.width = Math.min(o.width, L - 2);
  o.t = AS.clamp(o.t, o.width / 2, L - o.width / 2);
  fl.openings.push(o); return o;
};

AS.addFurniture = (type, x, y, rot = 0, fl = AS.floor(), extra = {}) => {
  const d = AS.furnDef(type);
  const f = { id: AS.uid('fu'), type, name: d.name, x, y, w: d.w, d: d.d, h: d.h, rot, material: d.mat, elev: 0, locked: false, hidden: false, groupId: null, ...extra };
  fl.furniture.push(f); return f;
};

/* ---------- Métricas gerais ---------- */
AS.metrics = (fl = AS.floor()) => {
  const { rooms } = AS.rooms(fl);
  const walls = fl.walls;
  let built = 0;
  // área construída ≈ soma das áreas pelo eixo + meia espessura das paredes externas (aprox. pelo contorno)
  const util = rooms.reduce((s, r) => s + r.area, 0);
  const axis = rooms.reduce((s, r) => s + r.areaAxis, 0);
  const ext = walls.filter(w => w.type === 'exterior').reduce((s, w) => s + AS.wallLen(w) * w.thickness / 2, 0);
  built = axis + ext;
  return { rooms: rooms.length, util, axis, built, walls: walls.length, wallLen: walls.reduce((s, w) => s + AS.wallLen(w), 0), doors: fl.openings.filter(o => o.kind === 'door').length, windows: fl.openings.filter(o => o.kind === 'window').length, furniture: fl.furniture.length };
};

/* ---------- Serialização ---------- */
AS.serialize = (includeAssets = true) => {
  const p = AS.clone(S.project);
  if (!includeAssets) p.assets = {};
  // anexa cômodos calculados (somente leitura) para consumo externo
  p.computed = { generatedAt: new Date().toISOString(), floors: S.project.floors.map(fl => ({ floorId: fl.id, name: fl.name, rooms: AS.rooms(fl).rooms.map(r => ({ id: r.meta?.id || null, name: AS.roomName(r), type: r.meta?.type || null, boundary: r.inner.map(p => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1) })), area_m2: +(r.area / 1e4).toFixed(3), perimeter_m: +(r.perimeter / 100).toFixed(3), floor: fl.id })) })) };
  return p;
};

AS.validateProjectData = (p) => {
  const errs = [];
  if (!p || typeof p !== 'object') return ['Arquivo não é um objeto JSON'];
  if (!Array.isArray(p.floors) || !p.floors.length) errs.push('Campo "floors" ausente ou vazio');
  for (const f of p.floors || []) {
    if (!Array.isArray(f.walls)) errs.push(`Pavimento ${f.name || '?'}: "walls" inválido`);
    for (const w of f.walls || []) if (!w.a || !w.b || !isFinite(w.a.x) || !isFinite(w.b.y)) { errs.push(`Parede ${w.id} com coordenadas inválidas`); break; }
  }
  return errs;
};

AS.normalizeProject = (p) => {
  const base = AS.newProject(p.name || 'Projeto importado');
  const out = Object.assign(base, p);
  out.settings = Object.assign(AS.newProject().settings, p.settings || {});
  out.view3d = Object.assign(AS.newProject().view3d, p.view3d || {});
  out.materials = p.materials?.length ? p.materials : AS.clone(AS.DEFAULT_MATERIALS);
  for (const m of AS.DEFAULT_MATERIALS) if (!out.materials.some(x => x.id === m.id)) out.materials.push(AS.clone(m));
  out.assets = p.assets || {};
  for (const f of out.floors) {
    f.walls ||= []; f.openings ||= []; f.furniture ||= []; f.roomMeta ||= []; f.dims ||= [];
    f.height ||= 280; f.elevation ||= 0; if (f.visible === undefined) f.visible = true;
    for (const w of f.walls) { w.id ||= AS.uid('w'); w.thickness ||= 15; w.height ||= f.height; w.material ||= 'pint_branca'; w.type ||= 'interior'; }
  }
  if (!out.floors.some(f => f.id === out.activeFloor)) out.activeFloor = out.floors[0].id;
  delete out.computed;
  return out;
};
