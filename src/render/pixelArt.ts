import type { CarDef } from '../data/types';

/** Original procedural pixel-art sprite generator.
 * Every sprite is authored as chunky "pixel" blocks drawn onto a small
 * offscreen canvas (no anti-aliasing), then scaled up in-world with
 * `image-rendering: pixelated` for a consistent arcade pixel-art identity.
 * Sprites are cached so each is only generated once. */

const cache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function px(ctx: CanvasRenderingContext2D, gx: number, gy: number, gw: number, gh: number, color: string, u: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(gx * u), Math.round(gy * u), Math.round(gw * u), Math.round(gh * u));
}

function cached(key: string, build: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = build();
    cache.set(key, c);
  }
  return c;
}

/** Car sprite, facing +x (right), authored in a 24x12 pixel grid. */
export function carSprite(def: CarDef): HTMLCanvasElement {
  return cached('car_' + def.id, () => {
    const u = 4;
    const gw = 26, gh = 13;
    const { canvas, ctx } = makeCanvas(gw * u, gh * u);
    const { color, colorDark, colorAccent } = def;

    // shadow base
    px(ctx, 2, 2, 21, 9, colorDark, u);
    // main body
    px(ctx, 2, 1, 21, 8, color, u);
    // nose taper (front, right side)
    px(ctx, 21, 2, 4, 6, color, u);
    px(ctx, 24, 3, 1, 4, colorDark, u);
    // tail taper
    px(ctx, 1, 3, 1, 4, colorDark, u);

    // top highlight
    px(ctx, 3, 1, 18, 1, lighten(color), u);

    // cabin / windshield
    px(ctx, 12, 2, 7, 6, '#1c2733', u);
    px(ctx, 13, 3, 5, 1, '#4a6a82', u);

    // racing stripe
    px(ctx, 2, 5, 22, 1, colorAccent, u);

    // wheels (top and bottom arches)
    px(ctx, 6, 0, 3, 2, '#111', u);
    px(ctx, 6, 9, 3, 2, '#111', u);
    px(ctx, 17, 0, 3, 2, '#111', u);
    px(ctx, 17, 9, 3, 2, '#111', u);

    // headlights
    px(ctx, 23, 2, 1, 1, '#fff6c8', u);
    px(ctx, 23, 7, 1, 1, '#fff6c8', u);
    // taillights
    px(ctx, 2, 2, 1, 1, '#ff3b30', u);
    px(ctx, 2, 7, 1, 1, '#ff3b30', u);

    // outline
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(2 * u, 1 * u, 21 * u, 8 * u);
    return canvas;
  });
}

export function treeSprite(variant: number): HTMLCanvasElement {
  return cached('tree_' + variant, () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(14 * u, 16 * u);
    const foliage = variant % 2 === 0 ? '#2f6b3a' : '#356e3f';
    const foliageDark = '#204a29';
    px(ctx, 6, 11, 2, 5, '#5a3d22', u);
    px(ctx, 3, 3, 8, 8, foliageDark, u);
    px(ctx, 2, 4, 10, 6, foliage, u);
    px(ctx, 4, 1, 6, 4, foliage, u);
    px(ctx, 5, 0, 4, 2, lighten(foliage), u);
    return canvas;
  });
}

export function houseSprite(kind: 'casa' | 'fazenda_casa'): HTMLCanvasElement {
  return cached('house_' + kind, () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(20 * u, 16 * u);
    const wall = kind === 'fazenda_casa' ? '#d8c39a' : '#c9b18a';
    const roof = '#8a3b2c';
    px(ctx, 2, 6, 16, 9, wall, u);
    px(ctx, 0, 3, 20, 4, roof, u);
    px(ctx, 0, 6, 20, 1, '#5c2015', u);
    px(ctx, 8, 10, 4, 5, '#4a2a15', u);
    px(ctx, 4, 8, 3, 3, '#bfe0ea', u);
    px(ctx, 13, 8, 3, 3, '#bfe0ea', u);
    px(ctx, 8, 1, 3, 3, '#5c2015', u); // chimney
    return canvas;
  });
}

export function barnSprite(): HTMLCanvasElement {
  return cached('barn', () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(22 * u, 18 * u);
    px(ctx, 2, 7, 18, 10, '#8f2a24', u);
    px(ctx, 0, 3, 22, 5, '#5c1a17', u);
    px(ctx, 1, 6, 20, 1, '#3a100e', u);
    px(ctx, 8, 11, 6, 6, '#2a1a10', u);
    px(ctx, 3, 8, 4, 3, '#e8d9a0', u);
    px(ctx, 15, 8, 4, 3, '#e8d9a0', u);
    return canvas;
  });
}

export function siloSprite(): HTMLCanvasElement {
  return cached('silo', () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(10 * u, 20 * u);
    px(ctx, 1, 3, 8, 16, '#b7bfc6', u);
    px(ctx, 1, 3, 2, 16, '#8d949a', u);
    px(ctx, 0, 0, 10, 4, '#7a8288', u);
    px(ctx, 4, 6, 2, 10, '#8d949a', u);
    return canvas;
  });
}

export function fenceSprite(): HTMLCanvasElement {
  return cached('fence', () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(20 * u, 6 * u);
    px(ctx, 0, 1, 20, 1, '#caa572', u);
    px(ctx, 0, 3, 20, 1, '#caa572', u);
    for (let i = 0; i < 5; i++) px(ctx, i * 4, 0, 1, 6, '#8a6a40', u);
    return canvas;
  });
}

export function grandstandSprite(): HTMLCanvasElement {
  return cached('arquibancada', () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(28 * u, 12 * u);
    px(ctx, 0, 6, 28, 6, '#3a4552', u);
    px(ctx, 0, 3, 28, 4, '#465264', u);
    px(ctx, 0, 0, 28, 4, '#54627a', u);
    for (let i = 0; i < 14; i++) {
      const c = i % 3 === 0 ? '#ff5a3c' : i % 3 === 1 ? '#e9eef3' : '#3ce6ff';
      px(ctx, i * 2, 1, 1, 1, c, u);
    }
    return canvas;
  });
}

export function boxesSprite(): HTMLCanvasElement {
  return cached('boxes', () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(24 * u, 14 * u);
    px(ctx, 1, 5, 22, 9, '#c7ccd1', u);
    px(ctx, 0, 2, 24, 4, '#e34b3f', u);
    px(ctx, 3, 8, 5, 6, '#2a2f36', u);
    px(ctx, 10, 8, 5, 6, '#2a2f36', u);
    px(ctx, 17, 8, 5, 6, '#2a2f36', u);
    return canvas;
  });
}

export function bridgeSprite(): HTMLCanvasElement {
  return cached('ponte', () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(34 * u, 20 * u);
    px(ctx, 0, 8, 34, 6, '#8a6a3e', u);
    for (let i = 0; i < 17; i++) px(ctx, i * 2, 8, 1, 6, '#5c4526', u);
    px(ctx, 0, 6, 34, 2, '#6b4d2a', u);
    px(ctx, 0, 14, 34, 2, '#6b4d2a', u);
    return canvas;
  });
}

export function barrierSprite(): HTMLCanvasElement {
  return cached('barreira', () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(10 * u, 5 * u);
    for (let i = 0; i < 5; i++) {
      px(ctx, i * 2, 1, 1, 3, i % 2 === 0 ? '#e6e6e6' : '#d1332b', u);
    }
    px(ctx, 0, 0, 10, 1, '#333', u);
    return canvas;
  });
}

export function signSprite(label: string): HTMLCanvasElement {
  return cached('placa_' + label, () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(10 * u, 14 * u);
    px(ctx, 4, 6, 2, 8, '#7a7a7a', u);
    px(ctx, 0, 0, 10, 7, '#f2c200', u);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = u * 0.5;
    ctx.strokeRect(0, 0, 10 * u, 7 * u);
    ctx.fillStyle = '#111';
    ctx.font = `bold ${u * 3.4}px sans-serif`;
    ctx.textAlign = 'center';
    const glyph = label === 'ponte' ? '≈' : label === 'terra' ? '▲' : '↰';
    ctx.fillText(glyph, 5 * u, 5.2 * u);
    return canvas;
  });
}

export function gasStationSprite(): HTMLCanvasElement {
  return cached('posto', () => {
    const u = 4;
    const { canvas, ctx } = makeCanvas(26 * u, 16 * u);
    px(ctx, 2, 2, 22, 2, '#d1332b', u);
    px(ctx, 3, 4, 2, 10, '#888', u);
    px(ctx, 21, 4, 2, 10, '#888', u);
    px(ctx, 8, 9, 3, 5, '#c7ccd1', u);
    px(ctx, 15, 9, 3, 5, '#c7ccd1', u);
    px(ctx, 0, 12, 26, 4, '#2a2f36', u);
    return canvas;
  });
}

function lighten(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return hex;
  const r = Math.min(255, parseInt(c.slice(0, 2), 16) + 45);
  const g = Math.min(255, parseInt(c.slice(2, 4), 16) + 45);
  const b = Math.min(255, parseInt(c.slice(4, 6), 16) + 45);
  return `rgb(${r},${g},${b})`;
}

export function decorationSprite(type: string): HTMLCanvasElement {
  switch (type) {
    case 'arvore': return treeSprite(0);
    case 'casa': return houseSprite('casa');
    case 'fazenda_casa': return houseSprite('fazenda_casa');
    case 'fazenda_celeiro': return barnSprite();
    case 'silo': return siloSprite();
    case 'cerca': return fenceSprite();
    case 'arquibancada': return grandstandSprite();
    case 'boxes': return boxesSprite();
    case 'ponte': return bridgeSprite();
    case 'barreira': return barrierSprite();
    case 'posto': return gasStationSprite();
    default:
      if (type.startsWith('placa_')) return signSprite(type.slice(6));
      return treeSprite(1);
  }
}
