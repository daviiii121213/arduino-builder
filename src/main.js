// Boot: warm every procedural art cache behind a loading bar, then run the game loop.

import { Game } from './game.js';
import { Input } from './core/input.js';
import { itemIcon } from './art/icons.js';
import { machineSprite } from './art/machines.js';
import { propSprite, PROPS } from './art/props.js';
import { characterSheet, ROLE_STYLE } from './art/characters.js';
import { glyph, panelTexture } from './art/ui.js';
import { ITEMS } from './data/items.js';
import { BUILDABLES } from './data/buildables.js';
import { P, rgba } from './art/palette.js';
import { engraved, hazard, plate, rr, glow } from './art/draw.js';

const canvas = document.getElementById('game');
const boot = document.getElementById('boot');
const bootFill = document.getElementById('bootfill');
const bootMsg = document.getElementById('bootmsg');

function resize() {
  // cap the backing-store scale: beyond ~2M CSS pixels the extra fill rate costs more
  // than the sharpness is worth, especially on integrated GPUs.
  const area = innerWidth * innerHeight;
  const cap = area > 2_200_000 ? 1.25 : area > 1_200_000 ? 1.5 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, cap);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
}
addEventListener('resize', resize);
resize();

// ---- boot logo -------------------------------------------------------------
function drawLogo() {
  const c = document.getElementById('bootlogo');
  if (!c) return;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  plate(g, 10, 14, 400, 76, '#2b313a', { r: 6 });
  hazard(g, 14, 78, 392, 8, P.paintYellow, P.steelDark, 8);
  engraved(g, 'IRONWORKS', 210, 58, 'bold 46px Georgia, serif', P.uiTrimHi, 'center');
  engraved(g, 'a factory RPG', 210, 74, '13px "Segoe UI", sans-serif', P.uiDim, 'center');
  glow(g, 210, 50, 120, P.uiTrim, 0.12);
}
drawLogo();

// ---- staged asset warm-up --------------------------------------------------
const tasks = [];
tasks.push(['Mixing pigments', () => { for (let i = 0; i < 12; i++) glyph(['money', 'xp', 'power', 'wrench', 'box', 'flask', 'map', 'mission', 'gearIcon', 'clock', 'heart', 'people'][i], 20); }]);
tasks.push(['Illustrating materials', () => { for (const id of Object.keys(ITEMS)) itemIcon(id); }]);
for (const id of Object.keys(BUILDABLES)) {
  tasks.push([`Fabricating ${BUILDABLES[id].name}`, () => { machineSprite(id, 0); machineSprite(id, 1); }]);
}
tasks.push(['Planting the forest', () => { for (const t of Object.keys(PROPS)) { propSprite(t, 0); propSprite(t, 1); propSprite(t, 2); } }]);
tasks.push(['Tailoring uniforms', () => { for (const role of Object.keys(ROLE_STYLE)) for (let s = 0; s < 4; s++) characterSheet(role, s); }]);
tasks.push(['Riveting the interface', () => { panelTexture(760, 520); panelTexture(700, 500); }]);

let game = null;
tasks.push(['Surveying the land', () => {
  const input = new Input(canvas);
  game = new Game(canvas, input);
  window.game = game;
}]);

let taskIdx = 0;
function step() {
  if (taskIdx < tasks.length) {
    const [msg, fn] = tasks[taskIdx++];
    bootMsg.textContent = msg + '…';
    bootFill.style.width = Math.round((taskIdx / tasks.length) * 100) + '%';
    try { fn(); } catch (err) { console.error('boot task failed:', msg, err); }
    requestAnimationFrame(step);
    return;
  }
  bootFill.style.width = '100%';
  bootMsg.textContent = 'Click to start your shift';
  boot.classList.add('hidden');
  setTimeout(() => { boot.style.display = 'none'; }, 700);
  start();
}
requestAnimationFrame(step);

// ---- main loop -------------------------------------------------------------
function start() {
  let last = performance.now();
  let started = false;

  const kick = () => {
    if (started) return;
    started = true;
    game.audio.init();
    game.audio.resume();
    game.notify('Welcome to Ironworks. Press B to build, Tab to manage.', 'info');
  };
  addEventListener('pointerdown', kick, { once: true });
  addEventListener('keydown', kick, { once: true });

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    try {
      game.update(dt);
      game.draw(dt);
      game.endFrame();
    } catch (err) {
      console.error(err);
      const g = canvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgba(0,0,0,0.8)'; g.fillRect(0, 0, canvas.width, 80);
      g.fillStyle = '#d4604e'; g.font = '14px monospace';
      g.fillText('Error: ' + err.message, 20, 40);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
