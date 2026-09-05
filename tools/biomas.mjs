/**
 * Passeio pelos cinco biomas.
 *
 * Abre o jogo no modo teste, usa o painel F1 para se teleportar até cada bioma
 * e salva uma captura de cada um, mais o diário e o bestiário.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.argv[2] ?? 'dist';
const dir = process.env.CAPTURAS ?? 'tools/capturas-biomas';
fs.mkdirSync(dir, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(raiz, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(5601, r));

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const erros = [];
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
await page.goto('http://localhost:5601/', { waitUntil: 'load' });
await page.waitForTimeout(2500);

const box = await page.locator('#game').boundingBox();
const clique = async (gx, gy) => {
  await page.mouse.move(box.x + (gx / 480) * box.width, box.y + (gy / 270) * box.height);
  await page.mouse.down(); await page.mouse.up();
};
// "Modo teste"
await clique(240, 195);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/00-vale.png` });

// o painel F1 lista "Ir ao bioma: ..." logo no comeco
const biomas = ['vale', 'magico', 'pantano', 'floresta', 'vulcanico', 'deserto'];
for (let i = 0; i < biomas.length; i++) {
  // tira o mouse de cima do painel: senao ele rouba a selecao do teclado
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.keyboard.press('F1');
  await page.waitForTimeout(400);
  if (i === 0) await page.screenshot({ path: `${dir}/01-painel-testes.png` });
  // desce ate a linha do bioma (as 5 primeiras acoes sao de mundo)
  for (let k = 0; k < 5 + i; k++) { await page.keyboard.press('KeyS'); await page.waitForTimeout(45); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${dir}/1${i}-${biomas[i]}.png` });
  // anda um pouco para ver o bioma em movimento
  await page.keyboard.down('KeyD'); await page.waitForTimeout(900); await page.keyboard.up('KeyD');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/1${i}b-${biomas[i]}.png` });
}

// diario
await page.keyboard.press('KeyJ');
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/20-diario.png` });
await page.keyboard.press('KeyJ');
await page.waitForTimeout(300);

// bestiario
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.keyboard.press('KeyQ');
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/21-bestiario.png` });
for (let bloco = 1; bloco <= 4; bloco++) {
  for (let k = 0; k < 6; k++) { await page.keyboard.press('KeyS'); await page.waitForTimeout(40); }
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/2${1 + bloco}-bestiario-${bloco}.png` });
}
await page.keyboard.press('Tab');
await page.waitForTimeout(300);

// fps
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const loop = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res(Math.round((n * 1000) / (performance.now() - t0))); };
  requestAnimationFrame(loop);
}));
console.log('FPS:', fps);
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros de console');
await browser.close();
server.close();
