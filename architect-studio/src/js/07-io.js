/* ==========================================================================
   07 — Importação (PDF/imagem → referência calibrada, detecção de paredes),
        exportação (JSON/PNG/SVG/PDF/3D) e armazenamento (db do Artifact / localStorage)
   ========================================================================== */

/* ---------------- Importação de PDF / imagem ---------------- */
AS.importer = {
  doc: null, pages: [], textItems: [], fileName: '',
  async loadFile(file) {
    this.fileName = file.name;
    const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    if (isPdf) return this.loadPdf(await file.arrayBuffer());
    if (/^image\//.test(file.type)) {
      const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      const img = await AS.importer.loadImg(url);
      this.doc = null; this.pages = [{ n: 1, thumb: url, w: img.naturalWidth, h: img.naturalHeight, url }]; this.textItems = [];
      return { kind: 'image', pages: this.pages };
    }
    throw new Error('Formato não suportado. Use PDF, PNG, JPG ou WEBP.');
  },
  loadImg: (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Imagem inválida')); i.src = url; }),
  async loadPdf(buf) {
    const lib = window.pdfjsLib;
    if (!lib) throw new Error('O leitor de PDF (pdf.js) não carregou — sem acesso à CDN. Exporte a página do PDF como PNG/JPG e importe a imagem.');
    try { lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) { }
    const doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    this.doc = doc; this.pages = [];
    for (let n = 1; n <= Math.min(doc.numPages, 30); n++) {
      const page = await doc.getPage(n), vp = page.getViewport({ scale: 1 });
      const s = 180 / Math.max(vp.width, vp.height), v2 = page.getViewport({ scale: s });
      const cv = document.createElement('canvas'); cv.width = v2.width; cv.height = v2.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: v2 }).promise;
      // análise: texto e operadores vetoriais
      const tc = await page.getTextContent();
      const ops = await page.getOperatorList();
      const OPS = lib.OPS; let paths = 0, images = 0;
      for (const fn of ops.fnArray) { if (fn === OPS.constructPath) paths++; if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject || fn === OPS.paintInlineImageXObject) images++; }
      this.pages.push({ n, thumb: cv.toDataURL('image/png'), w: vp.width, h: vp.height, text: tc.items.map(i => ({ str: i.str, x: i.transform[4], y: vp.height - i.transform[5], h: i.height })).filter(i => i.str.trim()), paths, images });
    }
    return { kind: 'pdf', pages: this.pages, numPages: doc.numPages };
  },
  /** Renderiza a página em alta resolução e devolve dataURL (JPEG para caber no armazenamento) */
  async renderPage(n, maxPx = 3000) {
    const pg = this.pages.find(p => p.n === n);
    if (!this.doc) return { url: pg.url, w: pg.w, h: pg.h, ptScale: 1 };
    const page = await this.doc.getPage(n), vp1 = page.getViewport({ scale: 1 });
    const scale = Math.min(4, maxPx / Math.max(vp1.width, vp1.height)), vp = page.getViewport({ scale });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return { url: cv.toDataURL('image/jpeg', 0.86), w: cv.width, h: cv.height, ptScale: scale };
  },
  /** Coloca a imagem como referência no pavimento ativo. scale = cm por pixel da imagem */
  setReference(url, w, h, info = {}) {
    const fl = AS.floor(), id = AS.uid('img');
    AS.history.run('Importar referência', () => {
      S.project.assets[id] = url;
      // escala inicial: largura da imagem ≈ 15 m (até calibrar)
      const scale = info.scale || 1500 / w;
      fl.bg = { asset: id, x: 0, y: 0, w, h, scale, opacity: 0.55, visible: true, rot: 0, calibrated: !!info.scale, source: info.source || '', page: info.page || 1, text: info.text || [] , ptScale: info.ptScale || 1 };
    });
    R2.fit();
  },
  calibrate(p1, p2, realCm) {
    const fl = AS.floor(), bg = fl.bg; if (!bg) return;
    const d = AS.geo.dist(p1, p2); if (d < 1) throw new Error('Pontos muito próximos');
    const k = realCm / d;
    AS.history.run('Calibrar escala', () => {
      // escala em torno do primeiro ponto
      bg.x = p1.x + (bg.x - p1.x) * k; bg.y = p1.y + (bg.y - p1.y) * k; bg.scale *= k; bg.calibrated = true;
    });
    R2.fit();
    return bg.scale;
  },
  /**
   * Detecção experimental de paredes em raster: procura faixas escuras horizontais/verticais longas.
   * Retorna candidatos [{a,b,thickness}] em coordenadas da planta.
   */
  async detectWalls(opts = {}) {
    const fl = AS.floor(), bg = fl.bg; if (!bg) throw new Error('Importe uma referência primeiro');
    const img = await this.loadImg(S.project.assets[bg.asset]);
    const maxW = 1400, k = Math.min(1, maxW / img.naturalWidth);
    const W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, W, H);
    const data = g.getImageData(0, 0, W, H).data;
    const thr = opts.threshold ?? 110;
    const dark = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const r = data[i * 4], gg = data[i * 4 + 1], b = data[i * 4 + 2]; dark[i] = (0.3 * r + 0.59 * gg + 0.11 * b) < thr ? 1 : 0; }
    const cmPerPx = bg.scale / k; // cm por pixel reduzido
    const minLen = Math.max(8, (opts.minLenCm ?? 60) / cmPerPx);
    const minT = Math.max(2, (opts.minThickCm ?? 8) / cmPerPx), maxT = (opts.maxThickCm ?? 40) / cmPerPx;
    const out = [];
    const scan = (horiz) => {
      const A = horiz ? H : W, B = horiz ? W : H, at = (a, b) => horiz ? dark[a * W + b] : dark[b * W + a];
      // runs por linha
      const runs = [];
      for (let a = 0; a < A; a++) { let s = -1; for (let b = 0; b <= B; b++) { const d = b < B && at(a, b); if (d && s < 0) s = b; if (!d && s >= 0) { if (b - s >= minLen) runs.push({ a, s, e: b }); s = -1; } } }
      // agrupa runs adjacentes sobrepostas em faixas
      const bands = [];
      for (const r of runs) {
        const band = bands.find(bd => bd.a1 === r.a - 1 && Math.min(bd.e, r.e) - Math.max(bd.s, r.s) > minLen * 0.7);
        if (band) { band.a1 = r.a; band.s = Math.round((band.s * band.n + r.s) / (band.n + 1)); band.e = Math.round((band.e * band.n + r.e) / (band.n + 1)); band.n++; }
        else bands.push({ a0: r.a, a1: r.a, s: r.s, e: r.e, n: 1 });
      }
      for (const bd of bands) {
        const t = bd.a1 - bd.a0 + 1; if (t < minT || t > maxT) continue;
        const c = (bd.a0 + bd.a1 + 1) / 2;
        const p = horiz ? [{ x: bd.s, y: c }, { x: bd.e, y: c }] : [{ x: c, y: bd.s }, { x: c, y: bd.e }];
        out.push({ a: p[0], b: p[1], t, horiz });
      }
    };
    scan(true); scan(false);
    // para coordenadas da planta
    const toPlan = (q) => { let x = q.x / k * bg.scale, y = q.y / k * bg.scale; if (bg.rot) { const r = AS.geo.rot({ x, y }, AS.rad(bg.rot)); x = r.x; y = r.y; } return { x: bg.x + x, y: bg.y + y }; };
    let walls = out.map(o => ({ a: toPlan(o.a), b: toPlan(o.b), thickness: Math.round(o.t * cmPerPx), horiz: o.horiz }));
    // estende extremidades até encontrar paredes perpendiculares (fecha cantos)
    for (const w of walls) for (const e of ['a', 'b']) {
      let best = null, bd = 40;
      for (const v of walls) { if (v === w || v.horiz === w.horiz) continue; const pr = AS.geo.projLine(w[e], v.a, v.b); const x = AS.geo.lineInter(w.a, w.b, v.a, v.b); if (!x) continue; const d = AS.geo.dist(x, w[e]); const onV = AS.geo.projSeg(x, v.a, v.b).d < v.thickness; if (d < bd && onV) { bd = d; best = x; } }
      if (best) w[e] = best;
    }
    walls = walls.map(w => ({ ...w, a: { x: AS.round(w.a.x, 1), y: AS.round(w.a.y, 1) }, b: { x: AS.round(w.b.x, 1), y: AS.round(w.b.y, 1) }, thickness: AS.clamp(AS.round(w.thickness, 1), 5, 40) }));
    return walls;
  },
};

/* ---------------- Downloads ---------------- */
AS.download = async (filename, data, mime) => {
  try {
    const dl = await AS.cap('downloads');
    if (dl) {
      const r = await dl.save({ filename, data });
      AS.toast(r.status === 'delivered' ? `Arquivo entregue: ${filename}` : `Arquivo salvo: ${filename}`, 'ok'); return true;
    }
  } catch (e) {
    if (e?.code === 'declined') { AS.toast('Download cancelado'); return false; }
    if (e?.code && !['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) { AS.toast('Não foi possível salvar: ' + (e.message || e.code), 'err'); return false; }
  }
  // Sem a capacidade de download: tenta link direto (funciona fora do visualizador) e mostra prévia
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    AS.ui.showExportFallback(filename, url, mime, typeof data === 'string' ? data : null);
  } catch (e) { AS.toast('Exportação indisponível neste ambiente', 'err'); }
  return false;
};

AS.exporter = {
  slug: () => (S.project.name || 'projeto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'projeto',
  async json(includeAssets = true) {
    const txt = JSON.stringify(AS.serialize(includeAssets), null, 1);
    return AS.download(this.slug() + '.json', txt, 'application/json');
  },
  async png() {
    const cv = R2.renderExport(1.6);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    return AS.download(this.slug() + '-' + AS.floor().name.toLowerCase().replace(/\s+/g, '-') + '.png', blob, 'image/png');
  },
  async png3d() {
    const url = V3.snapshot(); const blob = await (await fetch(url)).blob();
    return AS.download(this.slug() + '-3d.png', blob, 'image/png');
  },
  svgString(fl = AS.floor()) {
    const walls = fl.walls.filter(w => !w.hidden); if (!walls.length) throw new Error('A planta está vazia');
    const b = AS.geo.bbox(walls.flatMap(w => [w.a, w.b])), m = 80;
    const X = (x) => (x - b.x0 + m).toFixed(1), Y = (y) => (y - b.y0 + m).toFixed(1);
    const W = b.w + m * 2, H = b.h + m * 2 + 40;
    const pts = (poly) => poly.map(p => X(p.x) + ',' + Y(p.y)).join(' ');
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${(W / 100).toFixed(2)}m" height="${(H / 100).toFixed(2)}m" font-family="Archivo, Helvetica, Arial, sans-serif">\n<title>${AS.esc(S.project.name)} — ${AS.esc(fl.name)}</title>\n<desc>Unidades: 1 unidade do SVG = 1 cm. Gerado por Architect Studio Ultra.</desc>\n<rect width="100%" height="100%" fill="#fff"/>\n<g id="comodos">`;
    const { rooms } = AS.rooms(fl);
    for (const r of rooms) s += `\n<polygon points="${pts(r.inner)}" fill="${r.meta?.color || AS.roomType(r.meta?.type).color}" data-name="${AS.esc(AS.roomName(r))}" data-area-m2="${(r.area / 1e4).toFixed(2)}"/>`;
    s += '\n</g>\n<g id="moveis" fill="none" stroke="#777" stroke-width="1">';
    for (const f of fl.furniture) if (!f.hidden) s += `\n<rect x="${X(f.x - f.w / 2)}" y="${Y(f.y - f.d / 2)}" width="${f.w}" height="${f.d}" rx="3" transform="rotate(${f.rot || 0} ${X(f.x)} ${Y(f.y)})"><title>${AS.esc(f.name)}</title></rect>`;
    s += '\n</g>\n<g id="paredes" stroke="#1b1d22" stroke-width="2">';
    for (const w of walls) { const e = R2.wallExt(w, fl); s += `\n<polygon points="${pts(R2.wallPoly(w, e.a, e.b))}" fill="${w.type === 'exterior' ? '#3a3d44' : '#6b6f78'}" data-id="${w.id}" data-length-cm="${AS.wallLen(w).toFixed(1)}" data-thickness-cm="${w.thickness}"/>`; }
    s += '\n</g>\n<g id="paredes-preenchimento" stroke="none">';
    for (const w of walls) { const e = R2.wallExt(w, fl); s += `\n<polygon points="${pts(R2.wallPoly(w, e.a, e.b))}" fill="${w.type === 'exterior' ? '#3a3d44' : '#6b6f78'}"/>`; }
    s += '\n</g>\n<g id="aberturas" stroke="#1b1d22" stroke-width="1.2" fill="none">';
    for (const o of fl.openings) {
      const w = fl.walls.find(x => x.id === o.wallId); if (!w || o.hidden) continue;
      const g = R2.openingGeom(o, w), h = w.thickness / 2 + 0.6;
      const cut = [AS.geo.add(g.p0, AS.geo.mul(g.n, h)), AS.geo.add(g.p1, AS.geo.mul(g.n, h)), AS.geo.sub(g.p1, AS.geo.mul(g.n, h)), AS.geo.sub(g.p0, AS.geo.mul(g.n, h))];
      s += `\n<polygon points="${pts(cut)}" fill="#fff" stroke="none"/>`;
      if (o.kind === 'window') { for (const k of [-0.5, 0.5]) { const A = AS.geo.add(g.p0, AS.geo.mul(g.n, h * k)), B = AS.geo.add(g.p1, AS.geo.mul(g.n, h * k)); s += `<line x1="${X(A.x)}" y1="${Y(A.y)}" x2="${X(B.x)}" y2="${Y(B.y)}"/>`; } }
      else if (o.type === 'giro' || o.type === 'dupla') {
        const nn = AS.geo.mul(g.n, o.side || 1), hp = o.hinge === 'b' ? g.p1 : g.p0, op = o.hinge === 'b' ? g.p0 : g.p1;
        const f0 = AS.geo.add(hp, AS.geo.mul(nn, h)), tip = AS.geo.add(f0, AS.geo.mul(nn, o.width)), end = AS.geo.add(op, AS.geo.mul(nn, h));
        const sweep = AS.geo.cross(AS.geo.sub(tip, f0), AS.geo.sub(end, f0)) > 0 ? 1 : 0;
        s += `<line x1="${X(f0.x)}" y1="${Y(f0.y)}" x2="${X(tip.x)}" y2="${Y(tip.y)}" stroke-width="2"/><path d="M${X(tip.x)} ${Y(tip.y)} A${o.width} ${o.width} 0 0 ${sweep} ${X(end.x)} ${Y(end.y)}" stroke-dasharray="3 3"/>`;
      } else s += `<line x1="${X(g.p0.x)}" y1="${Y(g.p0.y)}" x2="${X(g.p1.x)}" y2="${Y(g.p1.y)}" stroke-dasharray="4 3"/>`;
    }
    s += '\n</g>\n<g id="cotas" font-family="IBM Plex Mono, monospace" font-size="11" fill="#5a5f6a" text-anchor="middle">';
    for (const w of walls) { const L = AS.wallLen(w); if (L < 40) continue; const mid = AS.geo.lerp(w.a, w.b, 0.5), n = AS.geo.perp(AS.wallDir(w)), q = AS.geo.add(mid, AS.geo.mul(n, w.thickness / 2 + 14)); let ang = AS.deg(Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x)); if (ang > 90 || ang < -90) ang += 180; s += `\n<text x="${X(q.x)}" y="${Y(q.y)}" transform="rotate(${ang.toFixed(1)} ${X(q.x)} ${Y(q.y)})">${AS.units.fmt(L)}</text>`; }
    for (const d of fl.dims) { s += `\n<line x1="${X(d.a.x)}" y1="${Y(d.a.y)}" x2="${X(d.b.x)}" y2="${Y(d.b.y)}" stroke="#1f5fbf"/><text x="${X((d.a.x + d.b.x) / 2)}" y="${Y((d.a.y + d.b.y) / 2) - 4}" fill="#1f5fbf">${AS.units.fmt(AS.geo.dist(d.a, d.b))}</text>`; }
    s += '\n</g>\n<g id="rotulos" text-anchor="middle">';
    for (const r of rooms) s += `\n<text x="${X(r.label.x)}" y="${Y(r.label.y)}" font-size="14" font-weight="600" fill="#14161a">${AS.esc(AS.roomName(r).toUpperCase())}</text><text x="${X(r.label.x)}" y="${(+Y(r.label.y) + 16).toFixed(1)}" font-size="11" fill="#4a4f59" font-family="IBM Plex Mono, monospace">${AS.units.fmtArea(r.area)}</text>`;
    s += `\n</g>\n<text x="${m}" y="${(H - 16).toFixed(0)}" font-size="13" fill="#14161a">${AS.esc(S.project.name)} — ${AS.esc(fl.name)} · área útil ${AS.units.fmtArea(rooms.reduce((a, r) => a + r.area, 0))}</text>\n<rect x="${(W - m - 100).toFixed(0)}" y="${(H - 26).toFixed(0)}" width="100" height="4" fill="#14161a"/><text x="${(W - m + 8).toFixed(0)}" y="${(H - 20).toFixed(0)}" font-size="11">1 m</text>\n</svg>`;
    return s;
  },
  async svg() { return AS.download(this.slug() + '.svg', this.svgString(), 'image/svg+xml'); },
  async pdf() {
    const J = window.jspdf?.jsPDF; if (!J) throw new Error('Biblioteca jsPDF não carregou (sem acesso à CDN). Use PNG ou SVG.');
    const doc = new J({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const PW = 420, PH = 297, M = 12;
    S.project.floors.forEach((fl, i) => {
      if (!fl.walls.length) return;
      if (i > 0 && doc.getNumberOfPages() >= 1 && doc.__used) doc.addPage('a3', 'landscape');
      doc.__used = true;
      const cv = R2.renderExport(1.4, fl, 60);
      const ratio = Math.min((PW - M * 2) / cv.width, (PH - M * 2 - 34) / cv.height);
      doc.addImage(cv.toDataURL('image/png'), 'PNG', M, M, cv.width * ratio, cv.height * ratio);
      // escala real aproximada: 1.4 px/cm => ratio mm/px => mm por cm
      const mmPerCm = 1.4 * ratio, scaleDen = Math.round(10 / mmPerCm);
      const y = PH - M - 28;
      doc.setDrawColor(30); doc.rect(M, y, PW - M * 2, 28);
      doc.setFontSize(14); doc.text(`${S.project.name}`, M + 4, y + 8);
      doc.setFontSize(9);
      const met = AS.metrics(fl);
      doc.text(`Pavimento: ${fl.name}  ·  Área útil: ${AS.units.fmtArea(met.util)}  ·  Área construída aprox.: ${AS.units.fmtArea(met.built)}  ·  Escala aprox. 1:${scaleDen} em A3`, M + 4, y + 15);
      const rooms = AS.rooms(fl).rooms.map(r => `${AS.roomName(r)} ${AS.units.fmtArea(r.area)}`).join('  ·  ');
      doc.text(doc.splitTextToSize(rooms, PW - M * 2 - 8).slice(0, 2), M + 4, y + 21);
      doc.setFontSize(7); doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Architect Studio Ultra · Estudo — não substitui projeto técnico assinado`, PW - M - 4, y + 26, { align: 'right' });
    });
    if (V3.ok) { try { const img = V3.snapshot(); doc.addPage('a3', 'landscape'); const c = V3.renderer.domElement; const r = Math.min((PW - M * 2) / c.width, (PH - M * 2) / c.height); doc.addImage(img, 'PNG', M, M, c.width * r, c.height * r); doc.setFontSize(10); doc.text('Vista 3D', M, PH - 6); } catch (e) { } }
    const blob = doc.output('blob');
    return AS.download(this.slug() + '.pdf', blob, 'application/pdf');
  },
};

/* ---------------- Capacidades do Artifact ---------------- */
AS._caps = {};
AS.cap = (name) => {
  if (!(name in AS._caps)) AS._caps[name] = (async () => { try { return window.claude?.use ? await window.claude.use(name) : null; } catch (e) { return null; } })();
  return AS._caps[name];
};

/* ---------------- Armazenamento ---------------- */
AS.storage = {
  mode: 'local', uid: null, db: null, ready: false,
  LS_INDEX: 'asu.projects.index', LS_PREFIX: 'asu.project.',
  ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return v === undefined ? null : false; } },
  async init() {
    const [db, user] = await Promise.all([AS.cap('db'), AS.cap('user')]);
    if (db && user) {
      try { const id = await user.id(); if (id) { this.db = db; this.uid = id; this.mode = 'db'; } } catch (e) { }
    }
    this.ready = true; AS.bus.emit('storage');
  },
  col() { return this.db.collection('data/users/' + this.uid + '/projects'); },
  async list() {
    const out = new Map();
    try { const idx = JSON.parse(this.ls(this.LS_INDEX) || '[]'); for (const p of idx) out.set(p.id, { ...p, where: 'local' }); } catch (e) { }
    if (this.mode === 'db') {
      try { const snap = await this.col().get(); for (const d of snap.docs) { const v = d.data(); out.set(d.id, { id: d.id, name: v.name, modified: v.modified, created: v.created, where: 'nuvem' }); } }
      catch (e) { console.warn('db list', e); }
    }
    return [...out.values()].sort((a, b) => (b.modified || 0) - (a.modified || 0));
  },
  async save(p) {
    const full = JSON.stringify(AS.serialize(true));
    const lean = JSON.stringify(AS.serialize(false));
    const results = [];
    if (this.mode === 'db') {
      try { await this.col().doc(p.id).set({ name: p.name, modified: p.modified || Date.now(), created: p.created, json: full.length < 900000 ? full : lean, hasAssets: full.length < 900000 }); results.push('nuvem'); }
      catch (e) {
        try { await this.col().doc(p.id).set({ name: p.name, modified: p.modified || Date.now(), created: p.created, json: lean, hasAssets: false }); results.push('nuvem (sem imagens de referência)'); }
        catch (e2) { console.warn('db save', e2); }
      }
    }
    let ok = this.ls(this.LS_PREFIX + p.id, full);
    if (!ok) ok = this.ls(this.LS_PREFIX + p.id, lean) && 'lean';
    if (ok) {
      results.push(ok === 'lean' ? 'navegador (sem imagens)' : 'navegador');
      try { const idx = JSON.parse(this.ls(this.LS_INDEX) || '[]').filter(x => x.id !== p.id); idx.push({ id: p.id, name: p.name, modified: p.modified, created: p.created }); this.ls(this.LS_INDEX, JSON.stringify(idx)); } catch (e) { }
    }
    if (!results.length) throw new Error('Nenhum armazenamento disponível. Use Exportar → JSON para guardar o projeto.');
    return results;
  },
  async load(id) {
    if (this.mode === 'db') { try { const d = await this.col().doc(id).get(); if (d.exists) return JSON.parse(d.data().json); } catch (e) { console.warn('db load', e); } }
    const s = this.ls(this.LS_PREFIX + id); if (s) return JSON.parse(s);
    throw new Error('Projeto não encontrado no armazenamento');
  },
  async remove(id) {
    if (this.mode === 'db') { try { await this.col().doc(id).delete(); } catch (e) { } }
    this.ls(this.LS_PREFIX + id, null);
    try { const idx = JSON.parse(this.ls(this.LS_INDEX) || '[]').filter(x => x.id !== id); this.ls(this.LS_INDEX, JSON.stringify(idx)); } catch (e) { }
  },
  async saveCurrent(verbose = false) {
    try {
      S.project.modified = Date.now();
      const where = await this.save(S.project);
      AS.lastSaved = { ts: Date.now(), where };
      AS.bus.emit('saved', where);
      if (verbose) AS.toast('Projeto salvo: ' + where.join(' + '), 'ok');
      return true;
    } catch (e) { AS.toast(e.message, 'err'); AS.bus.emit('saved', null); return false; }
  },
};
