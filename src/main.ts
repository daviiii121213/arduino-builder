import { Game, preloadArt } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas missing');

preloadArt();
const game = new Game(canvas);
game.start();

if (import.meta.env.DEV) {
  // Handle used by the automated browser smoke test.
  (window as unknown as { __game: Game }).__game = game;
}
