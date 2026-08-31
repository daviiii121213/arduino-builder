/**
 * Bundles the built game into one self-contained HTML file with no external
 * requests apart from the web font: open it straight from disk, drop it on any
 * static host, or publish it as an artifact.
 *
 *   npm run build:standalone   ->  dist/pixel-racer.html
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'dist', 'assets');

const pick = (ext) => {
  const file = readdirSync(assets).find((f) => f.endsWith(ext));
  if (!file) throw new Error(`no ${ext} bundle in dist/assets — run "npm run build" first`);
  return readFileSync(join(assets, file), 'utf8');
};

const js = pick('.js');
const shell = readFileSync(join(root, 'standalone', 'shell.html'), 'utf8');

// Only the script is inlined: src/style.css sizes the canvas to the whole
// viewport, which is exactly what the shell overrides, so it is dropped.
// Replace with a function: the minified bundle can contain "$&" and friends,
// which a string replacement would treat as substitution patterns.
const out = shell.replace('  /*GAME*/', () => js.trim());

if (out.includes('/*GAME*/')) throw new Error('failed to inline the game bundle');

const target = join(root, 'dist', 'pixel-racer.html');
writeFileSync(target, out);
console.log(`wrote ${target} (${(out.length / 1024).toFixed(1)} kB)`);
