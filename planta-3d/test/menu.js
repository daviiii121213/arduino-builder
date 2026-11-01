// Teste do menu inicial (Importar / Continuar / Carregar): node planta-3d/test/menu.js [pasta-saida]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || '.';
const shot = (page, n) => page.screenshot({ path: path.join(outDir, n + '.png') });
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  const url = 'file://' + path.join(__dirname, '..', 'planta-3d-offline.html');
  const check = (c, m) => { console.log((c ? 'ok   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1; };
  await page.goto(url); await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  check(await page.isVisible('#home'), 'menu aparece ao abrir');
  check(await page.isDisabled('#hm-continue') && await page.isDisabled('#hm-load'), 'sem projetos: Continuar e Carregar desativados');
  await shot(page, 'menu-vazio');
  // Importar → PDF
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#hm-import')]);
  await fc.setFiles(path.join(__dirname, 'casa-1-50.pdf'));
  await page.waitForFunction(() => !document.getElementById('home').hidden === false && document.getElementById('pi-ok') && !document.getElementById('pi-ok').disabled, null, { timeout: 120000 });
  check(!(await page.isVisible('#home')) && await page.isVisible('#pdfimp'), 'Importar PDF fecha o menu e abre a revisão');
  await page.click('#pi-ok'); await page.waitForFunction(() => document.getElementById('brand-sub').textContent.includes('Importado'), null, { timeout: 60000 });
  // Importar → .json (segundo projeto)
  await page.click('#v-home'); check(await page.isVisible('#home'), 'botão Início reabre o menu');
  const proj = await page.evaluate(() => JSON.stringify(window.__ed.EDIT));
  const jf = path.join(outDir, 'Meu projeto.json'); fs.writeFileSync(jf, proj);
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#hm-import')]); await fc2.setFiles(jf); await page.waitForFunction(() => document.getElementById('brand-sub').textContent.includes('Meu projeto'), null, { timeout: 60000 }).catch(() => {});
  check(!(await page.isVisible('#home')) && (await page.textContent('#brand-sub')).includes('Meu projeto'), 'Importar .json cria e abre "Meu projeto"');
  // recarrega: Continuar = último projeto mexido
  await page.reload(); await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  check(await page.isVisible('#home'), 'menu aparece de novo ao recarregar');
  const sub = await page.textContent('#hm-cont-sub'); console.log('      Continuar:', sub);
  check(sub.includes('Meu projeto'), 'Continuar aponta para o último projeto aberto');
  await shot(page, 'menu-com-projetos');
  await page.click('#hm-load'); const n = await page.$$eval('#hm-list li', l => l.length);
  check(n === 2, 'Carregar lista os 2 projetos'); await shot(page, 'menu-carregar');
  await page.fill('#hm-q', 'casa'); check(await page.$$eval('#hm-list li', l => l.length) === 1, 'busca filtra a lista');
  await page.click('#hm-list li button'); await page.waitForTimeout(500);
  check((await page.textContent('#brand-sub')).includes('Importado – casa-1-50') && !(await page.isVisible('#home')), 'Abrir carrega o projeto escolhido');
  const w = await page.evaluate(() => { const W = window.__ed.EDIT.walls; return W.G.length + W.U.length; }); check(w === 29, 'projeto carregado tem 29 paredes');
  await page.click('#v-home'); await page.click('#hm-continue'); await page.waitForTimeout(300);
  check((await page.textContent('#brand-sub')).includes('Importado – casa-1-50'), 'Continuar retoma o último aberto');
  await page.click('#v-home'); await page.keyboard.press('Escape'); check(!(await page.isVisible('#home')), 'Esc fecha o menu');
  const p2 = await ctx.newPage(); await p2.setViewportSize({ width: 390, height: 844 }); await p2.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p2.goto(url, { timeout: 120000 }); await p2.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); await shot(p2, 'menu-celular');
  check(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'celular: sem rolagem horizontal');
  console.log('erros JS:', errors.length ? errors : 'nenhum'); if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
