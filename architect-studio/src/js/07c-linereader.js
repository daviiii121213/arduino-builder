/* ==========================================================================
   07c — Leitor de linhas da imagem
   Vetoriza a imagem de referência (foto, escaneado, PNG/JPG ou página de PDF):
   binariza → remove textos/ruído → afina (esqueleto) → rastreia traços →
   simplifica em segmentos retos (qualquer ângulo) → cada segmento vira uma parede.
   ========================================================================== */
const LR = AS.lineReader = {};

/** Limiar automático (Otsu) sobre a luminância */
LR.otsu = (gray) => {
  const hist = new Array(256).fill(0); for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break;
    sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; thr = t; }
  }
  return AS.clamp(thr, 40, 220);
};

/** Afinamento Zhang-Suen in-place. bin: Uint8Array 0/1 */
LR.thin = (bin, W, H) => {
  let list = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (bin[y * W + x]) list.push(y * W + x);
  const del = [];
  for (let iter = 0; iter < 200; iter++) {
    let changed = false;
    for (const step of [0, 1]) {
      del.length = 0;
      for (const i of list) {
        if (!bin[i]) continue;
        const p2 = bin[i - W], p3 = bin[i - W + 1], p4 = bin[i + 1], p5 = bin[i + W + 1], p6 = bin[i + W], p7 = bin[i + W - 1], p8 = bin[i - 1], p9 = bin[i - W - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (step === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        del.push(i);
      }
      for (const i of del) bin[i] = 0;
      if (del.length) changed = true;
    }
    list = list.filter(i => bin[i]);
    if (!changed) break;
  }
  return bin;
};

/** Transformada de distância chanfrada 3-4 (aprox. distância ao fundo, em px) */
LR.distance = (bin, W, H) => {
  const INF = 1e9, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = bin[i] ? INF : 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!d[i]) continue; d[i] = Math.min(d[i], d[i - 1] + 3, d[i - W] + 3, d[i - W - 1] + 4, d[i - W + 1] + 4); }
  for (let y = H - 2; y > 0; y--) for (let x = W - 2; x > 0; x--) { const i = y * W + x; if (!d[i]) continue; d[i] = Math.min(d[i], d[i + 1] + 3, d[i + W] + 3, d[i + W + 1] + 4, d[i + W - 1] + 4); }
  for (let i = 0; i < W * H; i++) d[i] = d[i] >= INF ? 0 : d[i] / 3;
  return d;
};

/** Remove componentes conexos pequenos (textos, ruído). Retorna nº removido */
LR.dropSmall = (bin, W, H, minDiag, minPixels) => {
  const lab = new Int32Array(W * H), stack = []; let removed = 0, id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!bin[s] || lab[s]) continue;
    id++; stack.push(s); lab[s] = id; const pix = []; let x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (stack.length) {
      const i = stack.pop(); pix.push(i); const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (bin[j] && !lab[j]) { lab[j] = id; stack.push(j); }
      }
    }
    if (Math.hypot(x1 - x0, y1 - y0) < minDiag || pix.length < minPixels) { for (const i of pix) bin[i] = 0; removed++; }
  }
  return removed;
};

/** Rastreia o esqueleto em polilinhas (listas de pixels).
 *  Classificação por número de cruzamentos (robusta a "degraus" de linhas diagonais):
 *  1 = ponta, 2 = caminho, >=3 = junção. */
LR.trace = (sk, W, H) => {
  const RING = [-W, -W + 1, 1, W + 1, W, W - 1, -1, -W - 1]; // N, NE, E, SE, S, SW, W, NW (circular)
  const cross = (i) => { let a = 0; for (let k = 0; k < 8; k++) if (!sk[i + RING[k]] && sk[i + RING[(k + 1) % 8]]) a++; return a; };
  const nb = (i) => RING.map(o => i + o).filter(j => sk[j]);
  const kind = new Uint8Array(W * H), visited = new Uint8Array(W * H), pts = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (!sk[i]) continue; pts.push(i);
    const n = nb(i).length, c = cross(i);
    kind[i] = n === 0 ? 0 : c === 2 && n <= 4 ? 2 : 1; // 1 = nó (ponta/junção), 2 = caminho
  }
  const adj = (a, b) => { const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0; return Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1; };
  const d2 = (a, b) => { const dx = a % W - b % W, dy = ((a / W) | 0) - ((b / W) | 0); return dx * dx + dy * dy; };
  const lines = [], nodePairs = new Set();
  const walk = (start, first) => {
    const path = [start, first], inPath = new Set(path); let prev = start, cur = first;
    while (kind[cur] === 2) {
      visited[cur] = 1;
      // candidatos à frente: vizinhos ainda não usados; o início só vale para fechar um laço
      const cands = nb(cur).filter(j => j !== prev && (j === start ? path.length > 4 : !inPath.has(j) && !(kind[j] === 2 && visited[j])));
      if (!cands.length) break;
      cands.sort((a, b) => d2(b, prev) - d2(a, prev));
      const next = cands.find(j => kind[j] === 1 && !adj(j, prev)) ?? cands[0];
      for (const j of cands) if (j !== next && kind[j] === 2 && adj(j, prev)) visited[j] = 1; // pixel redundante do degrau
      path.push(next); inPath.add(next); prev = cur; cur = next;
      if (next === start) break;
    }
    return path;
  };
  for (const n of pts) {
    if (kind[n] !== 1) continue;
    for (const q of nb(n)) {
      if (kind[q] === 1) { const k = Math.min(n, q) + ':' + Math.max(n, q); if (!nodePairs.has(k)) { nodePairs.add(k); lines.push([n, q]); } continue; }
      if (visited[q]) continue;
      lines.push(walk(n, q));
    }
  }
  // laços fechados sem nós (ex.: retângulo desenhado com traço fino)
  for (const p of pts) {
    if (visited[p] || kind[p] !== 2) continue;
    const q = nb(p)[0]; if (q === undefined) continue;
    kind[p] = 1; lines.push(walk(p, q)); kind[p] = 2; visited[p] = 1;
  }
  return lines.filter(l => l.length >= 2).map(l => l.map(i => ({ x: i % W, y: (i / W) | 0, i })));
};

/** Douglas-Peucker */
LR.simplify = (pts, tol) => {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = AS.geo.projSeg(pts[i], pts[a], pts[b]).d; if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
};

/**
 * Leitura completa. opts: {threshold:'auto'|n, minLen(cm), thickMode:'auto'|'fixo', thick(cm), minThick(cm),
 *   straighten(bool), ignoreText(bool), mergeDouble(bool), tolerance(px)}
 */
LR.read = async (opts = {}) => {
  const fl = AS.floor(), bg = fl.bg; if (!bg) throw new Error('Importe primeiro a imagem ou o PDF da planta.');
  const o = { threshold: 'auto', minLen: 30, thickMode: 'auto', thick: 15, minThick: 8, maxThick: 60, straighten: true, ignoreText: true, mergeDouble: false, fillGaps: true, ignoreArcs: true, ignoreLoose: false, tolerance: 1.6, ...opts };
  const t0 = performance.now();
  const img = await AS.importer.loadImg(S.project.assets[bg.asset]);
  const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H).data, gray = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) gray[i] = Math.round(0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]);
  const thr = o.threshold === 'auto' ? LR.otsu(gray) : +o.threshold;
  const bin = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; bin[i] = gray[i] < thr ? 1 : 0; }
  const cmPx = bg.scale / k; // cm por pixel reduzido
  const minLenPx = Math.max(4, o.minLen / cmPx);
  let removed = 0;
  if (o.ignoreText) removed = LR.dropSmall(bin, W, H, minLenPx * 1.2, 12);
  const dist = LR.distance(bin, W, H);
  const sk = LR.thin(bin.slice(), W, H);
  const polys = LR.trace(sk, W, H);
  // segmentos
  let segs = [];
  let arcsSkipped = 0;
  for (const pl of polys) {
    const simp = LR.simplify(pl, o.tolerance);
    if (o.ignoreArcs && simp.length >= 4 && (() => { let tot = 0, mx = 0; for (let i = 0; i < simp.length - 1; i++) { const l = AS.geo.dist(simp[i], simp[i + 1]); tot += l; mx = Math.max(mx, l); } return mx < 0.45 * tot; })()) {
      // arco: vários trechos curtos virando sempre para o mesmo lado, giro total de 50°–130°
      const turns = []; for (let i = 1; i < simp.length - 1; i++) { const a1 = Math.atan2(simp[i].y - simp[i - 1].y, simp[i].x - simp[i - 1].x), a2 = Math.atan2(simp[i + 1].y - simp[i].y, simp[i + 1].x - simp[i].x); let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turns.push(d); }
      const same = turns.every(t => Math.sign(t) === Math.sign(turns[0]) && Math.abs(t) < AS.rad(50)), tot = Math.abs(turns.reduce((x, y) => x + y, 0));
      if (same && tot > AS.rad(35) && tot < AS.rad(130)) { arcsSkipped++; continue; }
    }
    for (let i = 0; i < simp.length - 1; i++) {
      const a = simp[i], b = simp[i + 1], L = AS.geo.dist(a, b);
      // espessura: mediana da distância ao fundo ao longo do trecho
      const i0 = pl.indexOf(a), i1 = pl.indexOf(b), ds = [];
      for (let j = Math.min(i0, i1); j <= Math.max(i0, i1); j++) ds.push(dist[pl[j].i]);
      ds.sort((p, q) => p - q);
      const widthPx = Math.max(1, 2 * (ds[Math.floor(ds.length / 2)] || 0.5) - 1);
      segs.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, L, w: widthPx, free: [false, false] });
    }
  }
  // poda: rebarbas curtas do esqueleto (trechos pequenos com uma ponta solta)
  const keyOf = (p) => p.x + ',' + p.y;
  const cnt = new Map(); for (const s of segs) for (const p of [s.a, s.b]) cnt.set(keyOf(p), (cnt.get(keyOf(p)) || 0) + 1);
  segs = segs.filter(s => { const loose = cnt.get(keyOf(s.a)) === 1 || cnt.get(keyOf(s.b)) === 1; return !(loose && s.L < Math.max(minLenPx, s.w * 1.8)) ; });
  // endireita trechos quase horizontais/verticais
  const ANG = AS.rad(3);
  if (o.straighten) for (const s of segs) {
    const ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x), m = Math.abs(Math.sin(ang)), c = Math.abs(Math.cos(ang));
    s.dir = m < Math.sin(ANG) ? 'h' : c < Math.sin(ANG) ? 'v' : null;
  }
  // conecta pontas próximas (agrupamento) — paredes encostadas compartilham o mesmo vértice
  const pts = []; segs.forEach((s, si) => { pts.push({ p: s.a, s: si, e: 'a' }, { p: s.b, s: si, e: 'b' }); });
  const parent = pts.map((_, i) => i); const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const grid = new Map(), cell = 6; pts.forEach((q, i) => { const key = Math.floor(q.p.x / cell) + ',' + Math.floor(q.p.y / cell); (grid.get(key) || grid.set(key, []).get(key)).push(i); });
  pts.forEach((q, i) => {
    const tol = Math.max(3, segs[q.s].w * 0.75);
    const cx = Math.floor(q.p.x / cell), cy = Math.floor(q.p.y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get((cx + dx) + ',' + (cy + dy)) || []) {
      if (j <= i || pts[j].s === q.s) continue;
      if (AS.geo.dist(q.p, pts[j].p) <= tol) parent[find(i)] = find(j);
    }
  });
  const clusters = new Map(); pts.forEach((q, i) => { const r = find(i); (clusters.get(r) || clusters.set(r, []).get(r)).push(q); });
  for (const members of clusters.values()) {
    // usa coordenadas de trechos horizontais/verticais quando houver (cantos retos)
    const hs = members.filter(m => segs[m.s].dir === 'h'), vs = members.filter(m => segs[m.s].dir === 'v');
    const avg = (arr, f) => arr.reduce((t, m) => t + f(m), 0) / arr.length;
    const yH = hs.length ? avg(hs, m => (segs[m.s].a.y + segs[m.s].b.y) / 2) : null;
    const xV = vs.length ? avg(vs, m => (segs[m.s].a.x + segs[m.s].b.x) / 2) : null;
    const P = { x: xV ?? avg(members, m => m.p.x), y: yH ?? avg(members, m => m.p.y) };
    for (const m of members) m.np = P;
  }
  for (const q of pts) { segs[q.s][q.e] = q.np; }
  // pontas soltas restantes: alinha as dos trechos H/V entre si
  for (const s of segs) {
    if (s.dir === 'h') { const y = (s.a.y + s.b.y) / 2; if (s.a.y !== s.b.y) { s.a = { ...s.a, y }; s.b = { ...s.b, y }; } }
    if (s.dir === 'v') { const x = (s.a.x + s.b.x) / 2; if (s.a.x !== s.b.x) { s.a = { ...s.a, x }; s.b = { ...s.b, x }; } }
  }
  // para coordenadas da planta (cm)
  const toPlan = (q) => { let x = q.x / k * bg.scale, y = q.y / k * bg.scale; if (bg.rot) { const r = AS.geo.rot({ x, y }, AS.rad(bg.rot)); x = r.x; y = r.y; } return { x: bg.x + x, y: bg.y + y }; };
  let walls = segs.map(s => {
    const a = toPlan(s.a), b = toPlan(s.b), wcm = s.w * cmPx;
    const t = o.thickMode === 'fixo' ? o.thick : AS.clamp(wcm, o.minThick, o.maxThick);
    return { a, b, t, wcm, len: AS.geo.dist(a, b) };
  }).filter(w => w.len >= o.minLen);
  let paired = 0;
  if (o.mergeDouble) {
    // linhas duplas paralelas (contorno de parede) viram uma parede só
    const lines = walls.map(w => ({ a: w.a, b: w.b, len: w.len, wcm: w.wcm, kind: 'stroke' }));
    const pairs = AS.recognizer.wallsFromVector(lines, { minT: 5, maxT: 45, minLen: o.minLen }).filter(p => p.src === 'par');
    const inside = (w) => pairs.some(p => { const pa = AS.geo.projSeg(w.a, p.a, p.b), pb = AS.geo.projSeg(w.b, p.a, p.b); return pa.d <= p.t / 2 + 2 && pb.d <= p.t / 2 + 2; });
    const rest = walls.filter(w => !inside(w));
    paired = walls.length - rest.length;
    walls = rest.concat(pairs.map(p => ({ a: p.a, b: p.b, t: o.thickMode === 'fixo' ? o.thick : AS.clamp(p.t, o.minThick, o.maxThick), len: AS.geo.dist(p.a, p.b) })));
    AS.recognizer.joinCorners(walls);
  }
  // linhas soltas (não tocam nenhuma outra): normalmente cotas
  let loose = 0;
  if (o.ignoreLoose) {
    const touch = (w, p) => walls.some(v => v !== w && AS.geo.projSeg(p, v.a, v.b).d < v.t / 2 + w.t / 2 + 3);
    const keep = walls.filter(w => touch(w, w.a) || touch(w, w.b) || walls.some(v => v !== w && (AS.geo.projSeg(v.a, w.a, w.b).d < w.t / 2 + 3 || AS.geo.projSeg(v.b, w.a, w.b).d < w.t / 2 + 3)));
    loose = walls.length - keep.length; walls = keep;
  }
  // vãos entre paredes alinhadas viram portas/passagens (as linhas continuam sendo paredes)
  const openings = o.fillGaps ? AS.recognizer.fillGaps(walls, [], [], 'raster') : [];
  // pavimento temporário com paredes reais
  const tmp = AS.newFloor(fl.name, fl.elevation); tmp.height = fl.height;
  for (const w of walls) AS.addWall({ x: Math.round(w.a.x * 2) / 2, y: Math.round(w.a.y * 2) / 2 }, { x: Math.round(w.b.x * 2) / 2, y: Math.round(w.b.y * 2) / 2 }, { floor: tmp, thickness: Math.round(w.t * 2) / 2, height: fl.height || 280, note: 'Linha lida da imagem' });
  AS.autoFix(tmp);
  if (openings.length) AS.splitAtIntersections(tmp);
  // arcos de porta que escaparam: áreas pequenas fechadas por trechos curtos inclinados
  if (o.ignoreArcs) {
    const inclined = (w) => { const a = Math.abs(Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x)) % (Math.PI / 2); return a > AS.rad(4) && a < AS.rad(86); };
    for (let pass = 0; pass < 3; pass++) {
      const small = AS.detectRooms(tmp).rooms.filter(r => r.areaAxis < 15000);
      const kill = new Set();
      for (const r of small) { const ws = r.wallIds.map(id => tmp.walls.find(w => w.id === id)).filter(w => w && inclined(w) && AS.wallLen(w) < 130); if (ws.length >= 2) ws.forEach(w => kill.add(w.id)); }
      if (!kill.size) break;
      arcsSkipped += kill.size; tmp.walls = tmp.walls.filter(w => !kill.has(w.id));
    }
  }
  let nDoor = 0, nPass = 0;
  for (const op of openings) {
    let host = null, bd = Infinity;
    for (const w of tmp.walls) { const pr = AS.geo.projSeg(op.c, w.a, w.b), L = AS.wallLen(w); if (pr.d < bd && pr.d < w.thickness && pr.t * L >= op.width / 2 - 2 && pr.t * L <= L - op.width / 2 + 2) { bd = pr.d; host = { w, t: pr.t * L }; } }
    if (!host) continue;
    AS.addOpening('door', host.w, host.t, { width: Math.round(op.width), type: op.type, note: op.note }, tmp);
    if (op.type === 'passagem') nPass++; else nDoor++;
  }
  const det = AS.detectRooms(tmp);
  const ms = Math.round(performance.now() - t0);
  const report = {
    mode: 'linhas da imagem', scale: bg.scale, scaleSource: bg.calibrated ? 'calibração' : 'não calibrada', warnings: [],
    counts: { walls: tmp.walls.length, doors: nDoor, windows: 0, passages: nPass, rooms: det.rooms.length, named: 0, typical: Math.round(walls.length ? walls.map(w => w.t).sort((a, b) => a - b)[Math.floor(walls.length / 2)] : 0) },
    extra: { threshold: thr, removed, paired, ms, arcs: arcsSkipped, loose, angled: walls.filter(w => { const a = Math.abs(Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x)) % (Math.PI / 2); return a > AS.rad(3) && a < AS.rad(87); }).length },
  };
  if (!bg.calibrated) report.warnings.push('Escala não calibrada: os comprimentos das paredes podem estar errados. Calibre com uma cota conhecida e leia de novo.');
  if (!tmp.walls.length) report.warnings.push('Nenhuma linha encontrada. Tente outro limiar de escuro ou um comprimento mínimo menor.');
  if (tmp.walls.length > 600) report.warnings.push(`Muitas linhas (${tmp.walls.length}). Aumente o comprimento mínimo ou ative "ignorar textos e detalhes pequenos".`);
  return { floor: tmp, report, scale: bg.scale };
};
