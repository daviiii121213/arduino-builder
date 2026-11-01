// Testa o leitor automático com PDFs/imagem de teste. Uso: LIBS=<node_modules> node tests/recognizer.e2e.js [saida]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const LIBS = process.env.LIBS, OUT = process.argv[2] || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const page0 = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const doc = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
const map = { 'three.min.js': 'three/build/three.min.js', 'pdf.min.js': 'pdfjs-dist/build/pdf.min.js', 'pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js', 'jspdf.umd.min.js': 'jspdf/dist/jspdf.umd.min.js' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/*', r => { const u = r.request().url(); if (u === 'http://app.test/') return r.fulfill({ body: doc, contentType: 'text/html' }); const k = Object.keys(map).find(k => u.endsWith('/' + k)); if (k) return r.fulfill({ body: fs.readFileSync(path.join(LIBS, map[k])), contentType: 'application/javascript' }); return r.fulfill({ body: '' }); });
  await page.goto('http://app.test/'); await page.waitForFunction(() => window.__AS_READY); await page.keyboard.press('Escape');
  const results = []; const check = (name, ok, info) => results.push([ok ? 'ok' : 'FAIL', name + (info ? ' — ' + info : '')]);
  const run = async (file, label, expectScale) => {
    await page.evaluate(() => { AS.loadProject(AS.newProject('Leitor')); AS.ui.setViewMode('plan'); if (AS.ui.panel !== 'import') AS.ui.openPanel('import'); });
    await page.waitForTimeout(200);
    await page.setInputFiles('#impFile', file); await page.waitForSelector('#impUse', { timeout: 15000 }); await page.locator('#impUse').click();
    await page.waitForFunction(() => AS.floor().bg, null, { timeout: 15000 }); await page.keyboard.press('Escape'); await page.evaluate(() => AS.editor.setTool('select'));
    await page.waitForSelector('#rgRun'); await page.locator('#rgRun').click(); await page.waitForSelector('#rgApply', { timeout: 20000 });
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `rg-${label}-previa.png`) });
    const rep = await page.evaluate(() => AS.recognizer.preview.report);
    await page.locator('#rgApply').click(); await page.waitForTimeout(300);
    const st = await page.evaluate(() => { const fl = AS.floor(), { rooms } = AS.rooms(fl); return { walls: fl.walls.length, doors: fl.openings.filter(o => o.kind === 'door' && o.type !== 'passagem').length, win: fl.openings.filter(o => o.kind === 'window').length, pass: fl.openings.filter(o => o.type === 'passagem').length, rooms: rooms.map(r => [r.meta?.name, +(r.areaAxis / 1e4).toFixed(2)]), ext: fl.walls.filter(w => w.type === 'exterior').length, undo: AS.history.undo.at(-1)?.label }; });
    console.log(label, JSON.stringify(rep), JSON.stringify(st));
    await page.evaluate(() => AS.ui.setViewMode('split')); await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `rg-${label}-aplicado.png`) });
    return { rep, st };
  };
  for (const [f, label] of [['planta-teste-preenchida.pdf', 'preenchida'], ['planta-teste-contorno.pdf', 'contorno']]) {
    const { rep, st } = await run(path.join(__dirname, 'fixtures', f), label);
    check(`${label}: escala deduzida das cotas (~0,990 cm/px)`, /cotas/.test(rep.scaleSource) && Math.abs(rep.scale - 0.990) < 0.02, rep.scale.toFixed(4) + ' ' + rep.scaleSource);
    const names = st.rooms.map(r => r[0]).sort().join(',');
    check(`${label}: 3 cômodos com nomes do PDF`, st.rooms.length === 3 && names === 'Cozinha,Quarto,Sala', JSON.stringify(st.rooms));
    const areas = st.rooms.map(r => r[1]).sort((a, b) => a - b);
    check(`${label}: áreas pelos eixos 24/24/32 m² (±3%)`, areas.length === 3 && Math.abs(areas[0] - 24) < 0.8 && Math.abs(areas[1] - 24) < 0.8 && Math.abs(areas[2] - 32) < 1, areas.join(','));
    check(`${label}: 3 portas`, st.doors === 3, 'portas=' + st.doors + ' vãos=' + st.pass);
    check(`${label}: 3 janelas`, st.win === 3, 'janelas=' + st.win);
    check(`${label}: paredes externas classificadas`, st.ext >= 4, 'ext=' + st.ext);
    check(`${label}: entra no histórico como uma operação`, st.undo === 'Reconhecer planta do PDF', st.undo);
    await page.keyboard.press('Control+z'); const n = await page.evaluate(() => AS.floor().walls.length); check(`${label}: desfazer remove tudo`, n === 0, 'paredes=' + n);
  }
  // imagens raster: renderiza cada PDF de teste como JPG e lê a imagem (sem vetores nem textos)
  for (const [f, label] of [['planta-teste-preenchida.pdf', 'preenchida'], ['planta-teste-contorno.pdf', 'contorno']]) {
    await page.evaluate(() => { AS.loadProject(AS.newProject('tmp')); if (AS.ui.panel !== 'import') AS.ui.openPanel('import'); });
    await page.setInputFiles('#impFile', path.join(__dirname, 'fixtures', f)); await page.waitForSelector('#impUse');
    const url = await page.evaluate(async () => (await AS.importer.renderPage(1, 2400)).url);
    const imgFile = path.join(OUT, `planta-teste-${label}.jpg`); fs.writeFileSync(imgFile, Buffer.from(url.split(',')[1], 'base64'));
    await page.evaluate(() => { AS.loadProject(AS.newProject('Leitor raster')); AS.ui.setViewMode('plan'); if (AS.ui.panel !== 'import') AS.ui.openPanel('import'); });
    await page.setInputFiles('#impFile', imgFile); await page.waitForSelector('#impUse'); await page.locator('#impUse').click();
    await page.waitForFunction(() => AS.floor().bg); await page.keyboard.press('Escape');
    await page.evaluate(() => { const bg = AS.floor().bg; bg.scale = 3.52778 / (2400 / 842); bg.calibrated = true; AS.editor.setTool('select'); AS.ui.refreshPanel(); });
    await page.waitForSelector('#rgRun'); await page.locator('#rgRun').click(); await page.waitForSelector('#rgApply:not([disabled])', { timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, `rg-raster-${label}-previa.png`) });
    await page.locator('#rgApply').click(); await page.waitForTimeout(300);
    const rs = await page.evaluate(() => { const { rooms } = AS.rooms(); return { walls: AS.floor().walls.length, rooms: rooms.map(r => +(r.areaAxis / 1e4).toFixed(2)).sort((a, b) => a - b), ops: AS.floor().openings.length }; });
    console.log('raster', label, JSON.stringify(rs));
    check(`imagem ${label}: 3 cômodos com áreas ~24/24/32 m²`, rs.rooms.length === 3 && Math.abs(rs.rooms[0] - 24) < 1 && Math.abs(rs.rooms[2] - 32) < 1.2, JSON.stringify(rs));
    check(`imagem ${label}: aberturas nos vãos`, rs.ops >= 5, 'aberturas=' + rs.ops);
  }
  check('sem erros no console', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  for (const [s, n] of results) console.log((s === 'ok' ? '  ok   ' : '  FAIL ') + n);
  console.log(`\n${results.filter(r => r[0] === 'ok').length} passaram, ${results.filter(r => r[0] !== 'ok').length} falharam`);
})();
