/**
 * Teste do desfecho, do perigo noturno e do mapa novo.
 *
 * Roda no modo teste: escolhe um personagem, confere o relógio às 23:00,
 * viaja até a casa do Ancião, dispara o final inteiro (entrega da Cronolita,
 * conserto, túnel, reencontro), passa pela tela de conclusão, pelos créditos
 * e pela confirmação de apagar a partida.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.argv[2] ?? 'dist';
const dir = process.env.CAPTURAS ?? 'tools/capturas-final';
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
await new Promise((r) => server.listen(5611, r));

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const erros = [];
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
await page.goto('http://localhost:5611/', { waitUntil: 'load' });
await page.waitForTimeout(2600);

const box = await page.locator('#game').boundingBox();
const pt = (gx, gy) => ({ x: box.x + (gx / 480) * box.width, y: box.y + (gy / 270) * box.height });
const clique = async (gx, gy) => { const p = pt(gx, gy); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); };

await page.screenshot({ path: `${dir}/00-menu.png` });
// "Modo teste" (sem save: Nova 142, Pular 164, Teste 186)
await clique(240, 195);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${dir}/01-escolha.png` });
// escolhe a Nina (4) e começa
await page.keyboard.press('Digit4');
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/02-escolha-nina.png` });
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${dir}/03-mundo-nina.png` });

const acao = async (i, espera = 1400) => {
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.keyboard.press('F1'); await page.waitForTimeout(340);
  for (let k = 0; k < i; k++) { await page.keyboard.press('KeyS'); await page.waitForTimeout(30); }
  await page.keyboard.press('Enter'); await page.waitForTimeout(espera);
};

// índices: 5 mundo + 6 biomas + 4 cavernas + 3 (minério/escavação/fóssil) = 18
// depois: venda(18) bruna(19) nilo(20) baú(21) dormir(22) encher(23) zerar bolsa(24)
// mochila(25) diário(26) bestiário(27) armadura(28) zerar melhorias(29)
// +2h(30) 23:00(31) 05:30(32) casa do Ancião(33) falar com o Ancião(34)
await acao(31, 1500);
await page.screenshot({ path: `${dir}/10-noite-23h.png` });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/11-noite-dinos.png` });
await acao(32, 1500);
await page.screenshot({ path: `${dir}/12-amanheceu.png` });

// a casa do Ancião, lá no leste
await acao(33, 1600);
await page.screenshot({ path: `${dir}/20-casa-anciao.png` });

// o final completo
await acao(34, 2200);
await page.screenshot({ path: `${dir}/30-final-anciao.png` });
const avancar = async (n, espera = 700) => {
  for (let i = 0; i < n; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(espera); }
};
// com 2,2 s por toque cada fala termina de digitar sozinha, então um toque
// avança exatamente uma fala — o teste fica determinístico.
const LENTO = 2200;
await avancar(6, LENTO);                       // entrega da Cronolita
await page.screenshot({ path: `${dir}/31-final-cabana.png` });
await avancar(3, LENTO);                       // entrada na cabana
await avancar(4, 600);                         // as quatro batidas do conserto
await page.screenshot({ path: `${dir}/32-final-conserto.png` });
await avancar(3, LENTO);                       // falas com a máquina pronta
await page.screenshot({ path: `${dir}/33-final-maquina.png` });
await page.keyboard.press('KeyE');             // ligar a máquina
await page.waitForTimeout(1800);
await page.screenshot({ path: `${dir}/34-final-tunel.png` });
await page.waitForTimeout(5000);               // o túnel dura cinco segundos
await page.screenshot({ path: `${dir}/35-final-galpao.png` });
await avancar(6, LENTO);                       // o reencontro
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/36-conclusao.png` });

// ZERAR -> créditos -> confirmação
await page.keyboard.press('KeyS');
await page.waitForTimeout(200);
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${dir}/37-creditos.png` });
await page.keyboard.press('Space');
await page.waitForTimeout(900);
await page.screenshot({ path: `${dir}/38-confirmacao.png` });
// cancela (mantém a partida) e confere que voltou à conclusão
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
await page.screenshot({ path: `${dir}/39-cancelou.png` });

const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const loop = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(loop); else res(Math.round((n * 1000) / (performance.now() - t0))); };
  requestAnimationFrame(loop);
}));
console.log('FPS:', fps);
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros de console');
await browser.close();
server.close();
