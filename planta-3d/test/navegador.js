// Teste ponta a ponta no Chromium: node planta-3d/test/navegador.js [online|offline] [pasta-saida]
// "online" serve as URLs de CDN a partir de node_modules (mesmas versões), para testar o carregamento sob demanda do pdf.js.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const mode = process.argv[2] || 'offline', outDir = process.argv[3] || '.';
const NM = path.join(__dirname, 'node_modules');
const MAP = [['https://cdn.jsdelivr.net/npm/three@0.147.0/', 'three/'], ['https://cdn.jsdelivr.net/npm/fflate@0.8.2/', 'fflate/'],
  ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/', 'jspdf/dist/'], ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/', 'pdfjs-dist/build/']];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const fetched = [];
  await page.route('**/*', r => { const u = r.request().url(); const m = MAP.find(([p]) => u.startsWith(p));
    if (m) { fetched.push(u.split('/').pop()); return r.fulfill({ body: fs.readFileSync(path.join(NM, m[1] + u.slice(m[0].length))), contentType: 'application/javascript' }); }
    if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  const file = path.join(__dirname, '..', mode === 'online' ? 'planta-3d.html' : 'planta-3d-offline.html');
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const b64 = fs.readFileSync(path.join(__dirname, 'casa-1-50.pdf')).toString('base64');
  await page.evaluate(async b64 => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await window.__pdfimp.open(new File([bin], 'casa-1-50.pdf', { type: 'application/pdf' })); }, b64);
  const st = await page.evaluate(() => window.__pdfimp.state.pages.map(p => ({ n: p.n, fk: p.fk, on: p.on, den: p.den, walls: p.det ? p.det.walls.length : 0, ops: p.det ? p.det.walls.reduce((s, w) => s + w.ops.length, 0) : 0 })));
  console.log('páginas:', JSON.stringify(st));
  await page.screenshot({ path: path.join(outDir, 'revisao-' + mode + '.png') });
  // seleciona uma parede e uma abertura para conferir a interação
  await page.click('#pi-walls tr[data-i="0"] td:nth-child(2)');
  await page.click('#pi-pages .pi-page:nth-child(2)');
  await page.screenshot({ path: path.join(outDir, 'revisao-superior-' + mode + '.png') });
  console.log('botão:', await page.textContent('#pi-ok'), '·', await page.textContent('#pi-msg'));
  await page.click('#pi-ok');
  await page.waitForTimeout(1500);
  const res = await page.evaluate(() => { const E = window.__ed.EDIT, S = window.__p2.wallsModel(); const sel = document.getElementById('pj-sel');
    const ref = window.__SEGS0_REF; return { proj: sel.options[sel.selectedIndex].textContent, G: E.walls.G.length, U: E.walls.U.length, ops: E.walls.G.concat(E.walls.U).reduce((s, w) => s + w.ops.length, 0), msg: document.getElementById('ed-msg').textContent, walls: E.walls }; });
  console.log('projeto:', res.proj, '· paredes G', res.G, 'U', res.U, '· aberturas', res.ops);
  console.log('mensagem:', res.msg);
  // compara com o gabarito sem nenhum ajuste (o alinhamento foi feito pelo próprio app)
  const IMP = require('../src/pdf-import-core.js'); const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'segs0-gabarito.json'), 'utf8'));
  let ok = true; for (const fk of ['G', 'U']) { const c = IMP.compare(res.walls[fk], REF[fk]);
    console.log(fk, `paredes ${c.walls}/${c.refWalls} (criadas ${c.gotWalls}) erro ${c.maxWall.toFixed(2)} cm · aberturas ${c.openings}/${c.refOpenings} erro ${c.maxOp.toFixed(2)} cm · divergências ${c.kindMismatch.length}`);
    if (c.walls !== c.refWalls || c.gotWalls !== c.refWalls || c.maxWall >= 2 || c.openings !== c.refOpenings || c.opExtra || c.maxOp >= 2 || c.kindMismatch.length) ok = false; }
  await page.waitForTimeout(800); await page.screenshot({ path: path.join(outDir, 'projeto-importado-' + mode + '.png') });
  await page.click('#v-2d'); await page.waitForTimeout(800); await page.screenshot({ path: path.join(outDir, 'planta2d-importada-' + mode + '.png') });
  if (mode === 'online') console.log('carregado da CDN:', fetched.filter(f => /pdf/.test(f)).join(', '));
  const real = errors.filter(e => !/fonts\.g|ERR_FAILED|net::/.test(e));
  console.log('erros JS:', real.length ? real : 'nenhum');
  console.log(ok && !real.length ? 'APROVADO' : 'REPROVADO'); await browser.close(); process.exit(ok && !real.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
