import { Game } from './core/Game.js';
import './style.css';

const overlay = document.getElementById('start-overlay');
const status = document.getElementById('start-status');

async function boot() {
  try {
    const game = await Game.create({
      canvasParent: document.getElementById('app'),
      hudRoot: document.getElementById('hud'),
    });
    game.start();
    if (import.meta.env.DEV) window.__game = game;
    status.textContent = 'Clique para jogar';
    overlay.classList.add('ready');
    const begin = () => {
      game.audio.start();
      game.input.requestPointerLock();
    };
    overlay.addEventListener('click', begin);
    game.renderer.domElement.addEventListener('click', begin);
    document.addEventListener('pointerlockchange', () => {
      overlay.classList.toggle('hidden', document.pointerLockElement === game.renderer.domElement);
    });
  } catch (err) {
    console.error(err);
    status.textContent = 'Falha ao iniciar: ' + err.message;
  }
}

boot();
