// Testa o "Leitor de linhas da imagem". Uso: LIBS=<node_modules> node tests/linereader.e2e.js [saida]
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
  // imagens das plantas de teste (renderizadas dos PDFs) + imagem sintética com diagonais
  const imgs = [];
  for (const f of ['planta-teste-preenchida.pdf', 'planta-teste-contorno.pdf']) {
    await page.evaluate(() => { AS.loadProject(AS.newProject('tmp')); if (AS.ui.panel !== 'import') AS.ui.openPanel('import'); });
    await page.setInputFiles('#impFile', path.join(__dirname, 'fixtures', f)); await page.waitForSelector('#impUse');
    const url = await page.evaluate(async () => (await AS.importer.renderPage(1, 2400)).url);
    const file = path.join(OUT, f.replace('.pdf', '.jpg')); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    imgs.push({ file, label: f.includes('preench') ? 'preenchida' : 'contorno', scale: 3.52778 / (2400 / 842) });
  }
  const synth = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1050; const g = c.getContext('2d');
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, 1600, 1050);
    // leve ruído, como foto/escaneado
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; g.fillRect(Math.random() * 1600, Math.random() * 1050, 1, 1); }
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 12; g.lineCap = 'square'; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(200, 200); g.lineTo(1200, 200); g.lineTo(1200, 700); g.lineTo(700, 900); g.lineTo(200, 700); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(200, 450); g.lineTo(700, 200); g.stroke();
    g.fillStyle = '#222'; g.font = '28px sans-serif'; g.fillText('SALA 53,75 m²', 640, 520); g.fillText('HALL', 260, 300);
    return c.toDataURL('image/jpeg', 0.9);
  });
  const sf = path.join(OUT, 'sintetica-diagonais.jpg'); fs.writeFileSync(sf, Buffer.from(synth.split(',')[1], 'base64'));
  imgs.push({ file: sf, label: 'diagonais', scale: 1 });
  for (const im of imgs) {
    await page.evaluate(() => { AS.loadProject(AS.newProject('Linhas')); AS.ui.setViewMode('plan'); if (AS.ui.panel !== 'import') AS.ui.openPanel('import'); });
    await page.setInputFiles('#impFile', im.file); await page.waitForSelector('#impUse'); await page.locator('#impUse').click();
    await page.waitForFunction(() => AS.floor().bg);
    await page.evaluate((s) => { const bg = AS.floor().bg; bg.scale = s; bg.calibrated = true; AS.ui.refreshPanel(); }, im.scale);
    await page.waitForSelector('#lrRun'); if (im.label === 'contorno') await page.locator('#lrDbl').check(); await page.locator('#lrRun').click();
    await page.waitForSelector('#lrOut #rgApply:not([disabled])', { timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, `lr-${im.label}-previa.png`) });
    const rep = await page.evaluate(() => AS.recognizer.preview.report);
    await page.locator('#lrOut #rgApply').click(); await page.waitForTimeout(300);
    const st = await page.evaluate(() => { const fl = AS.floor(), { rooms } = AS.rooms(fl); return { walls: fl.walls.length, rooms: rooms.map(r => +(r.areaAxis / 1e4).toFixed(2)).sort((a, b) => a - b), undo: AS.history.undo.at(-1)?.label, diag: fl.walls.filter(w => { const a = Math.abs(Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x)) % (Math.PI / 2); return a > 0.05 && a < Math.PI / 2 - 0.05; }).map(w => Math.round(AS.wallLen(w))) }; });
    console.log(im.label, JSON.stringify(rep.extra), JSON.stringify(st));
    await page.evaluate(() => AS.ui.setViewMode('split')); await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `lr-${im.label}-aplicado.png`) });
    check(`${im.label}: linhas viraram paredes editáveis`, st.walls > 0 && st.undo === 'Mapear linhas da imagem', `paredes=${st.walls}`);
    if (im.label === 'diagonais') {
      check('diagonais: 2 cômodos de 6,25 e 53,75 m² (±6%)', st.rooms.length === 2 && Math.abs(st.rooms[0] - 6.25) < 0.4 && Math.abs(st.rooms[1] - 53.75) < 1.6, JSON.stringify(st.rooms));
      check('diagonais: 3 paredes inclinadas detectadas', st.diag.length >= 3, JSON.stringify(st.diag));
      check('diagonais: textos ignorados', rep.extra.removed >= 2, 'removidos=' + rep.extra.removed);
      // edição: arrastar seleciona e altera uma parede reconhecida
      const ok = await page.evaluate(() => { const w = AS.floor().walls[0]; AS.editor.select([{ kind: 'wall', id: w.id }]); AS.history.run('teste', () => { w.thickness = 25; }); return AS.floor().walls[0].thickness === 25 && !!document.querySelector('#wL'); });
      check('diagonais: parede reconhecida é editável no painel', ok);
    } else {
      const want = [24, 24, 32];
      check(`${im.label}: 3 cômodos fechados ~24/24/32 m²`, st.rooms.length === 3 && st.rooms.every((a, i) => Math.abs(a - want[i]) < 1.2), JSON.stringify(st.rooms));
    }
  }
  check('sem erros no console', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  for (const [s, n] of results) console.log((s === 'ok' ? '  ok   ' : '  FAIL ') + n);
  console.log(`\n${results.filter(r => r[0] === 'ok').length} passaram, ${results.filter(r => r[0] !== 'ok').length} falharam`);
})();
