/* ==========================================================================
   06 — Gerador automático de plantas (layout em faixas: íntima / circulação / social)
   Produz geometria real e editável: paredes, cômodos, portas, janelas e mobiliário.
   Estudo preliminar — NÃO substitui projeto de arquiteto habilitado.
   ========================================================================== */

AS.rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

AS.GEN_DEFAULTS = { area: 120, bedrooms: 3, bathrooms: 2, suite: true, floors: 1, kitchen: 'm', living: 'm', garage: 1, laundry: true, balcony: true, style: 'contemporaneo', accessible: false, notes: '' };

AS.generatePlan = (reqIn, variant = 0) => {
  const req = Object.assign({}, AS.GEN_DEFAULTS, reqIn);
  req.bedrooms = AS.clamp(req.bedrooms | 0, 0, 6); req.bathrooms = AS.clamp(req.bathrooms | 0, 1, 5); req.floors = AS.clamp(req.floors | 0, 1, 2);
  const rnd = AS.rng(1234 + variant * 7919 + req.bedrooms * 31 + req.area);
  const acc = !!req.accessible;
  const assumptions = [];
  const C = acc ? 120 : 100;               // largura do corredor
  const doorW = acc ? 90 : 80;
  const extT = req.style === 'compacto' ? 15 : 20, intT = req.style === 'compacto' ? 10 : 12;
  const H = 280;
  const mirror = variant % 2 === 1;
  const integrated = variant === 2 || req.style === 'contemporaneo' && variant !== 1;
  const garageRight = (variant % 3) !== 1;

  const kA = { p: 7, m: 10, g: 14 }[req.kitchen] || 10;
  const lA = { p: 12, m: 17, g: 24 }[req.living] || 17;

  // ---------- programa ----------
  const build = (k) => {
    const s = (a) => a * k;
    const beds = [];
    for (let i = 0; i < req.bedrooms; i++) {
      const suite = req.suite && i === 0 && req.bathrooms >= 2;
      beds.push({ name: suite ? 'Suíte' : `Quarto ${req.suite && req.bathrooms >= 2 ? i : i + 1}`, type: suite ? 'suite' : 'quarto', area: s(suite ? 13 : 9.5), suite });
    }
    const baths = [];
    const nb = req.bathrooms;
    const hasSuite = beds.some(b => b.suite);
    for (let i = 0; i < nb; i++) baths.push({ name: i === 0 && hasSuite ? 'Banho suíte' : (nb > 1 && hasSuite ? `Banho social${nb > 2 ? ' ' + i : ''}` : `Banheiro${nb > 1 ? ' ' + (i + 1) : ''}`), type: 'banheiro', suiteBath: i === 0 && hasSuite });
    const social = [];
    if (integrated) social.push({ name: 'Estar / Jantar', type: 'sala', area: s(lA + 8) });
    else { social.push({ name: 'Sala de estar', type: 'sala', area: s(lA) }); social.push({ name: 'Sala de jantar', type: 'jantar', area: s(9) }); }
    social.push({ name: 'Cozinha', type: 'cozinha', area: s(kA) });
    if (req.laundry) social.push({ name: 'Lavanderia', type: 'lavanderia', area: s(4), minW: 170 });
    return { beds, baths, social };
  };

  // ---------- montagem de retângulos ----------
  const layout = (k) => {
    const prog = build(k);
    const rects = []; // {x0,y0,x1,y1,name,type,door:{to, ...}}
    const Dp = Math.max(300, Math.round(Math.sqrt(k) * 340 / 10) * 10);
    const bathColW = acc ? 260 : 220;
    // colunas da faixa íntima
    const cols = [];
    const bedQ = prog.beds.slice();
    if (variant === 2) bedQ.reverse();
    const bathQ = prog.baths.slice();
    const suiteIdx = bedQ.findIndex(b => b.suite);
    const pushBed = (b) => cols.push({ w: Math.max(260, Math.round(b.area * 1e4 / Dp / 10) * 10), rooms: [{ ...b, frac: 1 }] });
    const pushBathCol = (pairWithSuite) => {
      const a = bathQ.shift(); if (!a) return;
      let b = bathQ.length ? bathQ.shift() : null;
      if (a.suiteBath) { // banho suíte no fundo, social (ou closet) junto ao corredor
        const front = b || { name: 'Closet', type: 'deposito', closet: true };
        cols.push({ w: bathColW, rooms: [{ ...a, frac: 0.5, doorSide: pairWithSuite }, { ...front, frac: 0.5 }] });
      } else if (b) cols.push({ w: bathColW, rooms: [{ ...b, frac: 0.5, doorSide: 'auto' }, { ...a, frac: 0.5 }] });
      else cols.push({ w: Math.max(170, bathColW - 40), rooms: [{ ...a, frac: 1 }] });
    };
    if (req.floors === 2) {
      // térreo: faixa de fundos com escada + lavabo + escritório/depósito
      return layout2(k, prog, Dp, bathColW);
    }
    bedQ.forEach((b, i) => {
      pushBed(b);
      if (b.suite) pushBathCol('left');
    });
    while (bathQ.length) pushBathCol('auto');
    if (!cols.length) cols.push({ w: 300, rooms: [{ name: 'Depósito', type: 'deposito', frac: 1 }] });
    let x = 0;
    for (const c of cols) {
      let y = 0;
      for (const r of c.rooms) {
        const h = Math.round(Dp * r.frac);
        // o cômodo de baixo (corredor) recebe porta para o corredor
        rects.push({ x0: x, y0: y, x1: x + c.w, y1: y + h, ...r, _col: c });
        y += h;
      }
      x += c.w;
    }
    const W = x;
    // corredor
    const corr = { x0: 0, y0: Dp, x1: W, y1: Dp + C, name: 'Circulação', type: 'circulacao', corridor: true };
    rects.push(corr);
    // faixa social
    const sumA = prog.social.reduce((s, r) => s + r.area, 0) * 1e4;
    let Df = Math.max(req.garage ? 400 : 340, Math.round(sumA / W / 10) * 10);
    if (req.garage) Df = Math.max(Df, 500 - C);
    let xs = 0; const widths = prog.social.map(r => Math.max(r.minW || 260, r.area * 1e4 / Df));
    const tw = widths.reduce((a, b) => a + b, 0); const fix = prog.social.map((r, i) => r.minW ? widths[i] : null);
    const flexSum = widths.reduce((s, w, i) => s + (fix[i] ? 0 : w), 0), fixedSum = tw - flexSum;
    const order = prog.social.map((r, i) => i);
    if (variant === 1) order.reverse();
    const socRects = [];
    order.forEach((i, n) => {
      const r = prog.social[i];
      let w = fix[i] ? fix[i] : widths[i] * (W - fixedSum) / flexSum;
      w = Math.round(w / 5) * 5; if (n === order.length - 1) w = W - xs;
      const R = { x0: xs, y0: Dp + C, x1: xs + w, y1: Dp + C + Df, ...r }; rects.push(R); socRects.push(R); xs += w;
    });
    // varanda em frente à sala
    if (req.balcony) {
      const sala = socRects.find(r => r.type === 'sala');
      rects.push({ x0: sala.x0, y0: Dp + C + Df, x1: sala.x1, y1: Dp + C + Df + 180, name: 'Varanda', type: 'varanda', balcony: true });
    }
    // garagem
    if (req.garage) {
      const gw = req.garage >= 2 ? 560 : 320;
      const gx0 = garageRight ? W : -gw;
      rects.push({ x0: gx0, y0: Dp, x1: gx0 + gw, y1: Dp + C + Df, name: 'Garagem', type: 'garagem', garage: true });
    }
    return { rects, W, D: Dp + C + Df, Dp, Df, floors: [rects] };
  };

  // ---------- sobrado (2 pavimentos) ----------
  const layout2 = (k, prog, Dp, bathColW) => {
    const stairW = acc ? 120 : 100, stairL = 300;
    // superior: quartos + banhos na faixa de fundos e de frente; escada em coluna fixa
    const up = [], gr = [];
    const beds = prog.beds.slice(), baths = prog.baths.slice();
    const backCols = [], frontCols = [];
    const half = Math.ceil(beds.length / 2);
    beds.forEach((b, i) => (i < half ? backCols : frontCols).push({ w: Math.max(270, Math.round(b.area * 1e4 / Dp / 10) * 10), rooms: [{ ...b, frac: 1 }], suiteCol: b.suite }));
    // banhos superiores: todos menos um (lavabo no térreo) — mínimo 1 em cima
    const lavabo = baths.length >= 2 ? baths.pop() : null;
    if (lavabo) { lavabo.name = 'Lavabo'; lavabo.suiteBath = false; }
    const bathCol = (list) => {
      const a = list.shift(); if (!a) return null; const b = list.shift();
      if (a.suiteBath) return { w: bathColW, rooms: [{ ...a, frac: 0.5, doorSide: 'left' }, { ...(b || { name: 'Closet', type: 'deposito', closet: true }), frac: 0.5 }] };
      if (b) return { w: bathColW, rooms: [{ ...b, frac: 0.5, doorSide: 'auto' }, { ...a, frac: 0.5 }] };
      return { w: 200, rooms: [{ ...a, frac: 1 }] };
    };
    const si = backCols.findIndex(c => c.suiteCol);
    const bc = bathCol(baths); if (bc) backCols.splice(si >= 0 ? si + 1 : backCols.length, 0, bc);
    while (baths.length) { const c = bathCol(baths); if (c) frontCols.push(c); }
    // escada como coluna na faixa de fundos (posição fixa nos dois pavimentos)
    const stairCol = { w: stairW + 20, rooms: [{ name: 'Escada', type: 'escada', frac: 1, stair: true }] };
    backCols.push(stairCol);
    const place = (cols, y0, depth, list) => { let x = 0; for (const c of cols) { let y = y0; for (const r of c.rooms) { const h = Math.round(depth * r.frac); list.push({ x0: x, y0: y, x1: x + c.w, y1: y + h, ...r }); y += h; } x += c.w; } return x; };
    const Wb = place(backCols, 0, Dp, up);
    let Df = Math.max(Dp, 340);
    if (!frontCols.length) frontCols.push({ w: 320, rooms: [{ name: 'Sala íntima', type: 'sala', frac: 1 }] });
    const wf = frontCols.reduce((s, c) => s + c.w, 0);
    let W = Math.max(Wb, wf);
    if (wf < W) frontCols.push({ w: W - wf, rooms: [{ name: 'Sala íntima', type: 'sala', frac: 1 }] });
    else if (Wb < W) { up.push({ x0: Wb, y0: 0, x1: W, y1: Dp, name: 'Escritório', type: 'escritorio' }); }
    place(frontCols, Dp + C, Df, up);
    up.push({ x0: 0, y0: Dp, x1: W, y1: Dp + C, name: 'Circulação', type: 'circulacao', corridor: true });
    if (req.balcony) { const f = up.filter(r => r.y0 === Dp + C)[0]; up.push({ x0: f.x0, y0: Dp + C + Df, x1: f.x1, y1: Dp + C + Df + 150, name: 'Sacada', type: 'varanda', balcony: true }); }
    // térreo: fundos = escritório/depósito + lavabo + escada (mesmo x)
    const stairR = up.find(r => r.stair);
    const backG = [];
    let gx = 0;
    if (stairR.x0 > 0) {
      const rest = stairR.x0;
      if (lavabo && rest >= 200 + 260) { backG.push({ x0: 0, y0: 0, x1: rest - 200, y1: Dp, name: 'Escritório', type: 'escritorio' }); backG.push({ x0: rest - 200, y0: 0, x1: rest, y1: Dp, ...lavabo }); }
      else if (lavabo) backG.push({ x0: 0, y0: 0, x1: rest, y1: Dp, ...lavabo });
      else backG.push({ x0: 0, y0: 0, x1: rest, y1: Dp, name: 'Escritório', type: 'escritorio' });
    }
    backG.push({ x0: stairR.x0, y0: 0, x1: stairR.x1, y1: Dp, name: 'Escada', type: 'escada', stair: true });
    if (stairR.x1 < W) backG.push({ x0: stairR.x1, y0: 0, x1: W, y1: Dp, name: 'Depósito', type: 'deposito' });
    gr.push(...backG);
    gr.push({ x0: 0, y0: Dp, x1: W, y1: Dp + C, name: 'Circulação', type: 'circulacao', corridor: true });
    // social térreo
    const soc = prog.social; const sumA = soc.reduce((s, r) => s + r.area, 0) * 1e4;
    let Dfg = Math.max(Df, req.garage ? 500 - C : 340, Math.round(sumA / W / 10) * 10);
    // superior acompanha a mesma profundidade
    if (Dfg !== Df) { for (const r of up) { if (r.y0 >= Dp + C && !r.balcony) r.y1 = Dp + C + Dfg; if (r.balcony) { r.y0 = Dp + C + Dfg; r.y1 = r.y0 + 150; } } Df = Dfg; }
    let xs = 0; const fixed = soc.map(r => r.minW || 0); const fixedSum = fixed.reduce((a, b) => a + b, 0); const flex = soc.reduce((s, r, i) => s + (fixed[i] ? 0 : r.area), 0);
    const ord = soc.map((r, i) => i); if (variant === 1) ord.reverse();
    ord.forEach((i, n) => { const r = soc[i]; let w = fixed[i] || Math.round(r.area / flex * (W - fixedSum) / 5) * 5; if (n === ord.length - 1) w = W - xs; gr.push({ x0: xs, y0: Dp + C, x1: xs + w, y1: Dp + C + Df, ...r }); xs += w; });
    if (req.balcony) { const sala = gr.find(r => r.type === 'sala'); gr.push({ x0: sala.x0, y0: Dp + C + Df, x1: sala.x1, y1: Dp + C + Df + 180, name: 'Varanda', type: 'varanda', balcony: true }); }
    if (req.garage) { const gw = req.garage >= 2 ? 560 : 320; const gx0 = garageRight ? W : -gw; gr.push({ x0: gx0, y0: Dp, x1: gx0 + gw, y1: Dp + C + Df, name: 'Garagem', type: 'garagem', garage: true }); }
    return { rects: gr, W, D: Dp + C + Df, Dp, Df, floors: [gr, up] };
  };

  // ---------- ajuste de escala para atingir a área desejada ----------
  let k = 1, L = null;
  for (let it = 0; it < 6; it++) {
    L = layout(k);
    const built = L.floors.reduce((s, rs) => s + rs.filter(r => !r.balcony).reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0), 0) / 1e4;
    const ratio = req.area / built;
    if (Math.abs(ratio - 1) < 0.03) break;
    k = AS.clamp(k * Math.pow(ratio, 0.9), 0.55, 2.6);
  }
  if (mirror) for (const rs of L.floors) for (const r of rs) { const a = -r.x1, b = -r.x0; r.x0 = a; r.x1 = b; if (r.doorSide === 'left') r.doorSide = 'right'; }

  // ---------- conversão em projeto editável ----------
  const p = AS.newProject(`Planta gerada — ${req.area} m², ${req.bedrooms} qto${req.bedrooms !== 1 ? 's' : ''}${req.floors > 1 ? ', sobrado' : ''} (opção ${variant + 1})`);
  p.settings.extThickness = extT; p.settings.wallThickness = intT;
  p.floors = [];
  L.floors.forEach((rects, fi) => {
    const fl = AS.newFloor(fi === 0 ? 'Térreo' : 'Pavimento superior', fi * (H + 12));
    fl.height = H;
    p.floors.push(fl);
    buildFloor(fl, rects, fi);
  });
  p.activeFloor = p.floors[0].id;
  // normaliza origem em (0,0) com margem
  const all = p.floors.flatMap(f => f.walls.flatMap(w => [w.a, w.b]));
  const bb = AS.geo.bbox(all);
  for (const f of p.floors) {
    const mv = (pt) => { pt.x = Math.round((pt.x - bb.x0) * 10) / 10; pt.y = Math.round((pt.y - bb.y0) * 10) / 10; };
    f.walls.forEach(w => { mv(w.a); mv(w.b); }); f.roomMeta.forEach(m => mv(m.anchor)); f.furniture.forEach(mv);
  }
  const builtArea = L.floors.reduce((s, rs) => s + rs.filter(r => !r.balcony).reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0), 0) / 1e4;
  assumptions.push(`Área bruta resultante ≈ ${builtArea.toFixed(1)} m² pelos eixos das paredes (solicitado: ${req.area} m²).`);
  assumptions.push(`Corredor de ${C} cm, portas de ${doorW} cm, paredes externas de ${extT} cm e internas de ${intT} cm, pé-direito de ${H} cm.`);
  if (req.bathrooms >= 2 && req.suite && req.bedrooms) assumptions.push('O primeiro banheiro foi tratado como banho da suíte, com porta para a suíte.');
  if (req.floors === 2) assumptions.push('Sobrado: área íntima no pavimento superior; escada reta de 3,00 m na mesma posição nos dois pavimentos.' + (req.bathrooms >= 2 ? ' Um banheiro virou lavabo no térreo.' : ''));
  if (acc) assumptions.push('Acessibilidade: corredor ≥ 1,20 m, portas de 90 cm e banheiros maiores (verificar NBR 9050 no projeto executivo).');
  if (req.notes) assumptions.push('Instruções especiais registradas mas interpretadas apenas parcialmente: "' + req.notes.slice(0, 160) + '"');
  assumptions.push('Mobiliário ilustrativo, posicionado automaticamente. Revise circulação e aberturas.');
  p.meta = { source: 'generator', request: req, variant, assumptions, notes: 'Estudo preliminar gerado automaticamente — não é projeto arquitetônico certificado.' };
  return p;

  // ===== helpers =====
  function buildFloor(fl, rects, fi) {
    // 1) paredes pela união das arestas
    const segsH = new Map(), segsV = new Map();
    const addSeg = (map, c, a, b) => { (map.get(c) || map.set(c, []).get(c)).push([Math.min(a, b), Math.max(a, b)]); };
    for (const r of rects) { addSeg(segsH, r.y0, r.x0, r.x1); addSeg(segsH, r.y1, r.x0, r.x1); addSeg(segsV, r.x0, r.y0, r.y1); addSeg(segsV, r.x1, r.y0, r.y1); }
    const side = (horiz, c, a, b) => {
      const m = (a + b) / 2, res = [];
      for (const r of rects) {
        if (horiz) { if (m > r.x0 && m < r.x1 && (r.y0 === c || r.y1 === c)) res.push(r); }
        else if (m > r.y0 && m < r.y1 && (r.x0 === c || r.x1 === c)) res.push(r);
      }
      return res;
    };
    const mkWalls = (map, horiz) => {
      for (const [c, ivs] of map) {
        const pts = [...new Set(ivs.flat())].sort((a, b) => a - b);
        let run = null;
        const flush = () => { if (!run) return; const A = horiz ? { x: run.a, y: c } : { x: c, y: run.a }, B = horiz ? { x: run.b, y: c } : { x: c, y: run.b }; AS.addWall(A, B, { floor: fl, thickness: run.ext ? extT : intT, height: run.low ? 110 : H, type: run.ext ? 'exterior' : 'interior', material: run.ext ? 'pint_gelo' : 'pint_branca', materialExt: run.ext ? 'textura_ext' : null, note: run.low ? 'Guarda-corpo' : '' }); run = null; };
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const covered = ivs.some(([s, e]) => a >= s - 0.01 && b <= e + 0.01);
          const who = covered ? side(horiz, c, a, b) : [];
          if (!who.length) { flush(); continue; }
          const ext = who.length === 1;
          const balc = who.every(r => r.balcony) || (who.length === 1 && who[0].balcony);
          const low = ext && balc;
          const openTo = who.length === 2 && who.some(r => r.balcony); // parede sala/varanda permanece cheia (recebe porta)
          if (run && run.ext === ext && run.low === low && Math.abs(run.b - a) < 0.01) run.b = b;
          else { flush(); run = { a, b, ext, low, openTo }; }
        }
        flush();
      }
    };
    mkWalls(segsH, true); mkWalls(segsV, false);
    // 2) metadados dos cômodos
    const rmeta = new Map();
    for (const r of rects) rmeta.set(r, AS.addRoomMeta({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }, r.name, r.type, fl));
    // 3) portas
    const shared = (A, B) => {
      if (Math.abs(A.x1 - B.x0) < .01 || Math.abs(A.x0 - B.x1) < .01) { const x = Math.abs(A.x1 - B.x0) < .01 ? A.x1 : A.x0; const a = Math.max(A.y0, B.y0), b = Math.min(A.y1, B.y1); if (b - a > 1) return { horiz: false, c: x, a, b }; }
      if (Math.abs(A.y1 - B.y0) < .01 || Math.abs(A.y0 - B.y1) < .01) { const y = Math.abs(A.y1 - B.y0) < .01 ? A.y1 : A.y0; const a = Math.max(A.x0, B.x0), b = Math.min(A.x1, B.x1); if (b - a > 1) return { horiz: true, c: y, a, b }; }
      return null;
    };
    const wallFor = (s, pos) => { const P = s.horiz ? { x: pos, y: s.c } : { x: s.c, y: pos }; let best = null, bd = 1; for (const w of fl.walls) { const pr = AS.geo.projSeg(P, w.a, w.b); if (pr.d < bd) { bd = pr.d; best = { w, t: pr.t * AS.wallLen(w), P }; } } return best; };
    const placeDoor = (R, T, opts = {}) => {
      const s = shared(R, T); if (!s) return null;
      const w0 = opts.width || doorW, len = s.b - s.a;
      if (len < w0 + 20) return null;
      let pos = opts.center ? (s.a + s.b) / 2 : (opts.atEnd ? s.b - 15 - w0 / 2 - intT / 2 : s.a + 15 + w0 / 2 + intT / 2);
      const hit = wallFor(s, pos); if (!hit) return null;
      const rc = { x: (R.x0 + R.x1) / 2, y: (R.y0 + R.y1) / 2 };
      const dir = AS.wallDir(hit.w), nrm = AS.geo.perp(dir);
      const sideS = Math.sign(AS.geo.dot(AS.geo.sub(rc, hit.P), nrm)) || 1;
      const conflict = fl.openings.some(o => o.wallId === hit.w.id && Math.abs(o.t - hit.t) < (o.width + w0) / 2 + 5);
      if (conflict) { if (!opts.retry) return placeDoor(R, T, { ...opts, atEnd: !opts.atEnd, retry: true }); return null; }
      return AS.addOpening('door', hit.w, hit.t, { width: w0, side: sideS, hinge: opts.hinge || 'a', type: opts.type || 'giro', height: opts.height || 210, material: opts.material || 'mad_freijo' }, fl);
    };
    const corridor = rects.find(r => r.corridor);
    const touches = (A, B) => !!shared(A, B);
    for (const r of rects) {
      if (r.corridor) continue;
      if (r.balcony) { const sala = rects.find(x => !x.balcony && touches(x, r) && (x.type === 'sala' || x.type === 'quarto' || x.type === 'suite')) || rects.find(x => !x.balcony && touches(x, r)); if (sala) { const s = shared(sala, r); placeDoor(r, sala, { width: Math.min(240, s.b - s.a - 60), center: true, type: 'correr', material: 'vidro', height: 220 }); } continue; }
      if (r.garage) {
        // portão na fachada e porta para a circulação/cozinha
        const s = { horiz: true, c: r.y1, a: r.x0, b: r.x1 }; const h = wallFor(s, (r.x0 + r.x1) / 2);
        if (h) AS.addOpening('door', h.w, h.t, { width: req.garage >= 2 ? 480 : 260, height: 230, type: 'correr', material: 'aluminio', side: -1 }, fl);
        if (corridor && touches(r, corridor)) placeDoor(r, corridor, { center: true }); else { const k2 = rects.find(x => x.type === 'cozinha' && touches(x, r)); if (k2) placeDoor(r, k2, {}); }
        continue;
      }
      if (r.closet || r.suiteBath || r.doorSide) {
        // portas laterais (banho suíte / closet) para o quarto vizinho
        const nb = rects.filter(x => (x.type === 'suite' || x.type === 'quarto') && touches(x, r)).sort((a, b) => (b.type === 'suite') - (a.type === 'suite'))[0];
        if (nb && (r.closet || r.suiteBath)) { placeDoor(r, nb, { width: r.closet ? 70 : doorW - 10 }); continue; }
      }
      if (r.stair) { if (corridor && touches(r, corridor)) { const s = shared(r, corridor); const h = wallFor(s, (s.a + s.b) / 2); if (h) AS.addOpening('door', h.w, h.t, { width: Math.min(s.b - s.a - 10, 100), type: 'passagem', side: 1 }, fl); } continue; }
      if (corridor && touches(r, corridor)) {
        const big = r.type === 'sala' || r.type === 'jantar';
        placeDoor(r, corridor, big ? { width: Math.min(160, shared(r, corridor).b - shared(r, corridor).a - 40), type: 'passagem', center: true } : { atEnd: rnd() > 0.5 });
      } else {
        // sem corredor (ex.: banho em pilha na frente): porta para qualquer vizinho social/circulação
        const nb = rects.find(x => x !== r && !x.balcony && touches(x, r) && (x.type === 'circulacao' || x.type === 'quarto' || x.type === 'suite'));
        if (nb) placeDoor(r, nb, {});
      }
    }
    // cozinha ↔ lavanderia, estar ↔ jantar ↔ cozinha (integrações)
    const kit = rects.find(r => r.type === 'cozinha'), lav = rects.find(r => r.type === 'lavanderia'), jan = rects.find(r => r.type === 'jantar'), sala = rects.find(r => r.type === 'sala' && !r.balcony);
    if (kit && lav && touches(kit, lav)) placeDoor(lav, kit, { width: 80 });
    if (sala && jan && touches(sala, jan)) placeDoor(jan, sala, { width: 160, type: 'passagem', center: true });
    if (kit && (jan || sala) && touches(kit, jan || sala)) placeDoor(kit, jan || sala, { width: 120, type: 'passagem', center: true });
    // porta de entrada (só no térreo): fachada da sala
    if (fi === 0 && sala) {
      const facadeY = sala.y1; const balc = rects.find(r => r.balcony);
      if (!balc) { const h = wallFor({ horiz: true, c: facadeY, a: sala.x0, b: sala.x1 }, sala.x0 + 30 + 50); if (h) AS.addOpening('door', h.w, h.t, { width: acc ? 100 : 90, side: -1, material: 'mad_escura', height: 220 }, fl); }
      else { const kitR = kit && kit.y1 === facadeY ? kit : rects.find(r => r.y1 === facadeY && !r.garage && r !== sala && r.type !== 'lavanderia'); const tgt = kitR || sala; const h = wallFor({ horiz: true, c: facadeY, a: tgt.x0, b: tgt.x1 }, tgt === sala ? tgt.x0 + 10 : tgt.x0 + 70); if (h && !fl.openings.some(o => o.wallId === h.w.id && Math.abs(o.t - h.t) < 120)) AS.addOpening('door', h.w, h.t, { width: acc ? 100 : 90, side: -1, material: 'mad_escura', height: 220 }, fl); }
    }
    // 4) janelas nas paredes externas
    for (const r of rects) {
      if (r.corridor || r.garage && false) continue;
      if (r.balcony || r.stair || r.closet) continue;
      const edges = [
        { horiz: true, c: r.y0, a: r.x0, b: r.x1 }, { horiz: true, c: r.y1, a: r.x0, b: r.x1 },
        { horiz: false, c: r.x0, a: r.y0, b: r.y1 }, { horiz: false, c: r.x1, a: r.y0, b: r.y1 },
      ].map(e => ({ e, hit: wallFor(e, (e.a + e.b) / 2) })).filter(x => x.hit && x.hit.w.type === 'exterior' && x.hit.w.height > 200)
        .sort((A, B) => (B.e.b - B.e.a) - (A.e.b - A.e.a));
      if (!edges.length) continue;
      const bath = r.type === 'banheiro', lavd = r.type === 'lavanderia', gar = r.type === 'garagem';
      const spec = bath ? { width: 60, height: 60, sill: 160, type: 'maximar' } : lavd ? { width: 100, height: 80, sill: 120, type: 'basculante' } : gar ? { width: 100, height: 60, sill: 160, type: 'maximar' } : r.type === 'sala' ? { width: 200, height: 140, sill: 80, type: 'correr' } : r.type === 'cozinha' ? { width: 150, height: 100, sill: 110, type: 'correr' } : { width: 150, height: 120, sill: 100, type: 'correr' };
      for (const { e, hit } of edges) {
        const len = e.b - e.a; const wd = Math.min(spec.width, len - 60); if (wd < 50) continue;
        const free = !fl.openings.some(o => o.wallId === hit.w.id && Math.abs(o.t - hit.t) < (o.width + wd) / 2 + 10);
        if (!free) continue;
        AS.addOpening('window', hit.w, hit.t, { ...spec, width: wd }, fl); break;
      }
    }
    // 5) mobiliário ilustrativo
    for (const r of rects) furnish(fl, r);
  }

  function furnish(fl, r) {
    const ix0 = r.x0 + 10, iy0 = r.y0 + 10, ix1 = r.x1 - 10, iy1 = r.y1 - 10, w = ix1 - ix0, d = iy1 - iy0, cx = (ix0 + ix1) / 2, cy = (iy0 + iy1) / 2;
    const add = (type, x, y, rot = 0) => { const f = AS.furnDef(type); if (f.w > w + 5 && f.d > w + 5) return; AS.addFurniture(type, x, y, rot, fl); };
    const back = iy0; // fundos (lado oposto ao corredor na faixa íntima)
    switch (r.type) {
      case 'suite': case 'quarto': {
        const casal = r.type === 'suite' || w >= 300;
        const bed = casal ? AS.furnDef('cama_casal') : AS.furnDef('cama_solteiro');
        if (d < bed.d + 70 || w < bed.w + 20) break;
        add(casal ? 'cama_casal' : 'cama_solteiro', cx, back + bed.d / 2 + 2, 0);
        if (w > bed.w + 110) { add('criado', cx - bed.w / 2 - 25, back + 22, 0); add('criado', cx + bed.w / 2 + 25, back + 22, 0); }
        if (d > bed.d + 150 && w >= 210) add('guarda_roupa', cx, iy1 - 32, 180);
        break;
      }
      case 'sala': {
        if (w < 260 || d < 280) break;
        add('sofa3', cx, iy0 + 50, 0); add('mesa_centro', cx, iy0 + 145, 0);
        if (d > 360) add('rack', cx, iy1 - 25, 180);
        if (r.name.includes('Jantar') && w > 520) { add('mesa_jantar4', ix1 - 90, cy, 90); }
        break;
      }
      case 'jantar': if (w > 200 && d > 240) add('mesa_jantar4', cx, cy, w > d ? 0 : 90); break;
      case 'cozinha': {
        if (w < 180) break;
        let x = ix0 + 35; add('geladeira', x, iy0 + 37, 0); x += 35 + 5;
        if (x + 120 < ix1) { add('pia_coz', x + 60, iy0 + 30, 0); x += 125; }
        if (x + 55 < ix1) add('fogao', x + 28, iy0 + 30, 0);
        break;
      }
      case 'banheiro': {
        if (w < 140 || d < 140) break;
        add('vaso', ix0 + 25, iy0 + 33, 0);
        if (w > 200) add('lavatorio', ix0 + 95, iy0 + 25, 0);
        add('box', ix1 - 45, iy1 - 45, 0);
        break;
      }
      case 'lavanderia': if (w >= 150) { add('tanque', ix0 + 30, iy0 + 28, 0); add('maq_lavar', ix0 + 95, iy0 + 33, 0); } break;
      case 'garagem': add('carro', cx, cy, 0); break;
      case 'escritorio': if (w > 200) add('escrivaninha', cx, iy0 + 30, 0); break;
      case 'escada': AS.addFurniture('escada_reta', cx, cy, 0, fl, { w: Math.min(100, w - 10), d: Math.min(300, d - 20), h: 290 }); break;
    }
  }
};
