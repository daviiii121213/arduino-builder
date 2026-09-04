/**
 * Teste de fumaça do Cronos Jurássico.
 *
 * Sobe a pasta dist/ num servidor local, abre o jogo num Chromium controlado,
 * joga sozinho (menu, cinemática, combate, casa, pausa, morte e renascimento),
 * salva capturas de tela e informa erros de console e o FPS médio.
 *
 * Uso:  npm run build && npx playwright install chromium && npm run smoke
 * As capturas ficam em tools/capturas/.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.argv[2] ?? 'dist';
const dir = process.env.CAPTURAS ?? 'tools/capturas';
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
await new Promise((r) => server.listen(5599, r));

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const erros = [];
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

await page.goto('http://localhost:5599/', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/1-menu.png` });

// clicar em "Nova expedição"
const box = await page.locator('#game').boundingBox();
const clique = async (gx, gy) => {
  await page.mouse.move(box.x + (gx / 480) * box.width, box.y + (gy / 270) * box.height);
  await page.mouse.down(); await page.mouse.up();
};
await clique(240, 160);
await page.waitForTimeout(2200);
await page.screenshot({ path: `${dir}/2-cinematica.png` });

// avançar diálogos
for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(700); }
await page.screenshot({ path: `${dir}/3-maquina.png` });
for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(600); }
await page.screenshot({ path: `${dir}/4-tunel.png` });
for (let i = 0; i < 14; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(450); }
await page.waitForTimeout(4200);
await page.screenshot({ path: `${dir}/4b-tunel.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/5-jogo.png` });

// andar e atacar
await page.keyboard.down('KeyW');
await page.waitForTimeout(900);
await page.keyboard.up('KeyW');
await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.4);
await page.mouse.down({ button: 'right' });
await page.waitForTimeout(220);
await page.screenshot({ path: `${dir}/6-ataque.png` });
await page.mouse.up({ button: 'right' });

// explorar procurando dinossauros, atacando pelo caminho
const passear = async (tecla, segundos, atacando) => {
  await page.keyboard.down(tecla);
  if (atacando) await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(segundos * 1000);
  if (atacando) await page.mouse.up({ button: 'right' });
  await page.keyboard.up(tecla);
};
await passear('KeyS', 4, false);
await page.screenshot({ path: `${dir}/7a-mundo.png` });
await passear('KeyS', 4, false);
await page.screenshot({ path: `${dir}/7b-mundo.png` });
await passear('KeyD', 5, true);
await page.screenshot({ path: `${dir}/7c-combate.png` });
await passear('KeyS', 5, true);
await page.screenshot({ path: `${dir}/7d-combate.png` });
await passear('KeyA', 5, true);
await page.screenshot({ path: `${dir}/7-mundo.png` });

// ficar parado perto dos dinossauros: testa dano e tela de fim de jogo
await page.waitForTimeout(22000);
await page.screenshot({ path: `${dir}/7e-dano.png` });

// se morreu, acordar em casa (testa o renascimento)
await clique(240, 141);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${dir}/7f-renascer.png` });

// bestiário
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/8-bestiario.png` });
await page.keyboard.press('Escape');

// procurar a casa: voltar ao norte e interagir
await page.keyboard.down('KeyW');
await page.waitForTimeout(14000);
await page.keyboard.up('KeyW');
await page.screenshot({ path: `${dir}/9-casa.png` });
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
await page.screenshot({ path: `${dir}/10-interior.png` });

// pausa
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/11-pausa.png` });

const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(Math.round((n / (performance.now() - t0)) * 1000)); };
  requestAnimationFrame(f);
}));

console.log('FPS aproximado:', fps);
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'nenhum erro de console');
await browser.close();
server.close();
