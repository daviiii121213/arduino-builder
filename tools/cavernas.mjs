/**
 * Passeio pelas duas cavernas.
 *
 * Abre o jogo no modo teste e usa o painel F1 para visitar andares das duas
 * cavernas, a arena do chefe, o bestiário e a coleção de arqueologia.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.argv[2] ?? 'dist';
const dir = process.env.CAPTURAS ?? 'tools/capturas-cavernas';
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
await new Promise((r) => server.listen(5603, r));

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const erros = [];
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
await page.goto('http://localhost:5603/', { waitUntil: 'load' });
await page.waitForTimeout(2600);

const box = await page.locator('#game').boundingBox();
const clique = async (gx, gy) => {
  await page.mouse.move(box.x + (gx / 480) * box.width, box.y + (gy / 270) * box.height);
  await page.mouse.down(); await page.mouse.up();
};
await clique(240, 195); // Modo teste
await page.waitForTimeout(2600);
await page.screenshot({ path: `${dir}/00-vale.png` });

// as acoes de caverna vem depois de: 5 mundo + 6 biomas = 11
const acao = async (indice, nome, espera = 1600) => {
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.keyboard.press('F1');
  await page.waitForTimeout(400);
  for (let k = 0; k < indice; k++) { await page.keyboard.press('KeyS'); await page.waitForTimeout(38); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(espera);
  await page.screenshot({ path: `${dir}/${nome}.png` });
};

await acao(11, '10-gruta-1');
// anda um pouco para ver a luz seguir
await page.keyboard.down('KeyD'); await page.waitForTimeout(1000); await page.keyboard.up('KeyD');
await page.waitForTimeout(500);
await page.screenshot({ path: `${dir}/11-gruta-1b.png` });
await acao(12, '12-gruta-10-chefe', 2400);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/13-gruta-chefe.png` });
await acao(13, '20-mina-1');
await acao(14, '21-mina-10-chefe', 2400);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/22-mina-chefe.png` });
await acao(15, '30-fossil', 1200);

// bestiario e colecao
await page.keyboard.press('Tab'); await page.waitForTimeout(400);
await page.keyboard.press('KeyQ'); await page.waitForTimeout(300);
for (let k = 0; k < 26; k++) { await page.keyboard.press('KeyS'); await page.waitForTimeout(30); }
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/40-bestiario-cavernas.png` });
await page.keyboard.press('KeyQ'); await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/41-colecao.png` });
await page.keyboard.press('Tab'); await page.waitForTimeout(300);
await page.keyboard.press('KeyJ'); await page.waitForTimeout(500);
await page.screenshot({ path: `${dir}/42-diario.png` });
await page.keyboard.press('KeyJ'); await page.waitForTimeout(300);

const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const loop = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(loop); else res(Math.round((n * 1000) / (performance.now() - t0))); };
  requestAnimationFrame(loop);
}));
console.log('FPS:', fps);
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros de console');
await browser.close();
server.close();
