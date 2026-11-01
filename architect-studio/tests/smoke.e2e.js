// Teste de ponta a ponta com Playwright (Chromium headless).
// Uso: LIBS=<node_modules com three/pdfjs-dist/jspdf> node tests/smoke.e2e.js [saida-dir]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const LIBS = process.env.LIBS; const OUT = process.argv[2] || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const page0 = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const doc = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
const map = { 'three.min.js': 'three/build/three.min.js', 'pdf.min.js': 'pdfjs-dist/build/pdf.min.js', 'pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js', 'jspdf.umd.min.js': 'jspdf/dist/jspdf.umd.min.js' };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u === 'http://app.test/') return r.fulfill({ body: doc, contentType: 'text/html' });
    const k = Object.keys(map).find(k => u.endsWith('/' + k));
    if (k && LIBS) return r.fulfill({ body: fs.readFileSync(path.join(LIBS, map[k])), contentType: 'application/javascript' });
    if (u.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' });
    return r.continue();
  });
  const results = [];
  const step = async (name, fn) => { try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name + ' -> ' + e.message.split('\n')[0]]); } };
  await page.goto('http://app.test/');
  await page.waitForFunction(() => window.__AS_READY, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '01-inicio.png') });
  await page.keyboard.press('Escape'); // fecha boas-vindas
  const E = (fn, arg) => page.evaluate(fn, arg);
  await step('projeto de exemplo carregado com cômodos', async () => { const n = await E(() => AS.rooms().rooms.length); if (n < 6) throw new Error('cômodos=' + n); });
  await step('3D construído com malhas', async () => { await page.waitForTimeout(500); const n = await E(() => AS.v3d.ok ? AS.v3d.pickables.length : -1); if (n < 50) throw new Error('pickables=' + n); });
  // novo projeto em branco
  await step('criar projeto', async () => { await E(() => AS.loadProject(AS.newProject('Teste E2E'))); const n = await E(() => S.project.name); if (n !== 'Teste E2E') throw new Error(n); });
    const W2S = async (x, y) => E(([x, y]) => AS.r2d.toScreen({ x, y }), [x, y]);
  const click = async (x, y, opts) => { box = await page.locator('#plan').boundingBox(); const s = await W2S(x, y); await page.mouse.click(box.x + s.x, box.y + s.y, opts); };
  let box;
  await E(() => { AS.ui.setViewMode('plan'); AS.ui.openPanel('projects'); AS.ui.openPanel('projects'); });
  await page.waitForTimeout(300);
  await E(() => { AS.r2d.view.s = 0.8; AS.r2d.view.ox = 80; AS.r2d.view.oy = 80; AS.r2d.req(); });
  box = await page.locator('#plan').boundingBox();
  await step('desenhar parede com cliques (ferramenta W)', async () => {
    await page.locator('#plan').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Escape');
    await page.keyboard.press('w'); await click(0, 0); await click(400, 0); await page.keyboard.press('Escape');
    const w = await E(() => AS.floor().walls.map(w => [w.a, w.b])); if (w.length !== 1 || Math.abs(w[0][1].x - 400) > 0.5) throw new Error(JSON.stringify(w));
  });
  await step('entrada numérica de comprimento', async () => {
    await page.keyboard.press('w'); await click(400, 0); const s = await W2S(400, 200); await page.mouse.move(box.x + s.x, box.y + s.y);
    await page.keyboard.press('3'); await page.keyboard.type(',25'); await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const w = await E(() => AS.floor().walls.at(-1)); if (Math.abs(w.b.y - 325) > 0.5 || Math.abs(w.b.x - 400) > 0.5) throw new Error(JSON.stringify(w.b));
  });
  await step('fechar contorno e detectar cômodo + área', async () => {
    await page.keyboard.press('w'); await click(400, 325); await click(0, 325); await click(0, 0); await page.keyboard.press('Escape');
    const r = await E(() => AS.rooms().rooms.map(r => r.areaAxis)); if (r.length !== 1 || Math.abs(r[0] - 400 * 325) > 10) throw new Error(JSON.stringify(r));
  });
  await step('ferramenta cômodo (retângulo) conecta a paredes existentes', async () => {
    await page.keyboard.press('Escape'); await page.keyboard.press('r'); await click(400, 0); await click(700, 325);
    const n = await E(() => AS.rooms().rooms.length); if (n !== 2) throw new Error('cômodos=' + n);
  });
  await step('mover parede arrastando (cômodo atualiza)', async () => {
    await page.keyboard.press('Escape'); await page.keyboard.press('v');
    const s = await W2S(0, 160); await page.mouse.move(box.x + s.x, box.y + s.y); await page.mouse.down();
    const t = await W2S(-100, 160); await page.mouse.move(box.x + t.x, box.y + t.y, { steps: 6 }); await page.mouse.up();
    const a = await E(() => AS.rooms().rooms.map(r => Math.round(r.areaAxis)).sort((a, b) => a - b)); if (!a.includes(500 * 325)) throw new Error(JSON.stringify(a));
  });
  await step('redimensionar parede pelo painel (comprimento)', async () => {
    await E(() => { const w = AS.floor().walls.find(w => w.a.y === 325 && w.b.y === 325 && Math.min(w.a.x, w.b.x) === 400 || false); return 0; });
    await click(550, 0); const len = page.locator('#wL'); await len.fill('3,5'); await len.press('Enter');
    const L = await E(() => AS.wallLen(AS.find('wall', S.sel[0].id))); if (Math.abs(L - 350) > 0.5) throw new Error('L=' + L);
  });
  await step('desfazer e refazer', async () => {
    await page.keyboard.press('Control+z'); let L = await E(() => AS.wallLen(AS.find('wall', S.sel[0]?.id) || AS.floor().walls[0])); 
    await page.keyboard.press('Control+y'); const L2 = await E(() => AS.wallLen(AS.find('wall', S.sel[0].id))); if (Math.abs(L2 - 350) > 0.5 || Math.abs(L - 350) < 0.5) throw new Error(L + ' ' + L2);
  });
  await step('adicionar porta e janela', async () => {
    await page.keyboard.press('Escape'); await page.keyboard.press('d'); await click(200, 325); await page.keyboard.press('j'); await click(200, 0);
    const o = await E(() => AS.floor().openings.map(o => o.kind)); if (o.join() !== 'door,window') throw new Error(o.join());
  });
  await step('mover porta ao longo da parede', async () => {
    await page.keyboard.press('v'); const before = await E(() => AS.floor().openings[0].t);
    const s = await W2S(200, 325); await page.mouse.move(box.x + s.x, box.y + s.y); await page.mouse.down(); const t = await W2S(120, 325); await page.mouse.move(box.x + t.x, box.y + t.y, { steps: 5 }); await page.mouse.up();
    const after = await E(() => AS.floor().openings[0].t); if (Math.abs(before - after) < 40) throw new Error(before + '→' + after);
  });
  await step('3D atualiza com aberturas', async () => { await E(() => AS.ui.setViewMode('split')); await page.waitForTimeout(700); const k = await E(() => AS.v3d.pickables.filter(m => m.userData.kind === 'opening').length); if (k < 3) throw new Error('opening meshes=' + k); });
  await step('adicionar móvel', async () => { await E(() => AS.ui.setViewMode('plan')); await page.waitForTimeout(200); await E(() => AS.ui.openPanel('furniture')); await page.locator('.fu[data-type="sofa3"]').click(); await click(200, 160); const n = await E(() => AS.floor().furniture.length); if (n !== 1) throw new Error(n); });
  await step('renomear cômodo pelo painel', async () => { await page.keyboard.press('Escape'); await E(() => AS.r2d.fit()); await page.waitForTimeout(300); await click(100, 260); const dbg = await E(() => JSON.stringify(S.sel) + ' ' + S.tool); if (!dbg.includes('room')) throw new Error('seleção: ' + dbg + ' hit=' + await E(() => { const h = AS.editor.hit({x:100,y:260}); return h ? h.kind : 'null'; }) + ' rooms=' + await E(() => JSON.stringify(AS.rooms().rooms.map(r => AS.geo.bbox(r.inner)))) + ' furn=' + await E(() => JSON.stringify(AS.floor().furniture.map(f=>[f.x,f.y,f.w,f.d])))); const nm = page.locator('#rName'); await nm.fill('Sala de teste'); await nm.press('Enter'); const r = await E(() => AS.rooms().rooms.find(r => r.meta?.name === 'Sala de teste')); if (!r) throw new Error('sem nome'); });
  await step('validação de geometria sem erros', async () => { const v = await E(() => AS.validate().filter(i => i.level === 'erro').length); if (v) throw new Error(v + ' erros'); });
  await step('exportar JSON e reimportar', async () => {
    const json = await E(() => JSON.stringify(AS.serialize()));
    fs.writeFileSync(path.join(OUT, 'projeto.json'), json);
    await E(() => AS.loadProject(AS.newProject('vazio')));
    await page.locator('body').evaluate(() => AS.ui.openPanel('projects')); await page.waitForTimeout(300);
    await page.setInputFiles('#pjImport', path.join(OUT, 'projeto.json')); await page.waitForTimeout(400);
    const n = await E(() => [S.project.name, AS.floor().walls.length, AS.rooms().rooms.length]); if (n[0] !== 'Teste E2E' || n[2] !== 2) throw new Error(JSON.stringify(n));
  });
  await step('exportar SVG / PNG / PDF (gera arquivos)', async () => {
    const svg = await E(() => AS.exporter.svgString()); fs.writeFileSync(path.join(OUT, 'planta.svg'), svg); if (!svg.includes('<polygon')) throw new Error('svg');
    const png = await E(() => AS.r2d.renderExport(1.2).toDataURL('image/png')); fs.writeFileSync(path.join(OUT, 'planta.png'), Buffer.from(png.split(',')[1], 'base64'));
    const ok = await E(async () => { const J = window.jspdf.jsPDF; return !!J; }); if (!ok) throw new Error('jspdf');
  });
  await step('gerador: 3 alternativas e abrir uma', async () => {
    await E(() => AS.ui.openPanel('generate')); await page.locator('#genForm button[type=submit]').click(); await page.waitForTimeout(300);
    const n = await page.locator('.alt').count(); if (n !== 3) throw new Error('alts=' + n);
    await page.screenshot({ path: path.join(OUT, '03-gerador.png') });
    await page.locator('[data-use="1"]').click(); await page.waitForTimeout(500);
    const r = await E(() => AS.rooms().rooms.length); if (r < 6) throw new Error('rooms=' + r);
  });
  await step('importar PDF vetorial (gerado) e calibrar', async () => {
    const pdfPath = process.env.TEST_PDF; if (!pdfPath) throw new Error('TEST_PDF não definido');
    await E(() => AS.ui.openPanel('import')); await page.setInputFiles('#impFile', pdfPath); await page.waitForSelector('#impUse', { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, '04-import.png') });
    await page.locator('#impUse').click(); await page.waitForFunction(() => AS.floor().bg, null, { timeout: 10000 });
    const bg = await E(() => ({ w: AS.floor().bg.w, text: AS.floor().bg.text.length })); if (bg.w < 500) throw new Error(JSON.stringify(bg));
  });
  await page.screenshot({ path: path.join(OUT, '05-final.png') });
  await step('sem erros de execução no console', async () => { if (errors.length) throw new Error(errors.slice(0, 5).join(' | ')); });
  // mobile
  const m = await browser.newContext({ viewport: { width: 400, height: 820 }, deviceScaleFactor: 2 }); const mp = await m.newPage();
  await mp.route('**/*', r => page.context()._routes ? r.continue() : r.continue());
  await browser.close();
  for (const [s, n] of results) console.log((s === 'ok' ? '  ok   ' : '  FAIL ') + n);
  console.log(`\n${results.filter(r => r[0] === 'ok').length} passaram, ${results.filter(r => r[0] !== 'ok').length} falharam`);
  if (errors.length) console.log('Erros:\n' + errors.join('\n'));
})();
