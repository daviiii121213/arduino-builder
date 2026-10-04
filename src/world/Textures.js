import * as THREE from 'three';
import { createRng } from '../core/math.js';

/**
 * All surface textures are painted procedurally on canvases so the project ships
 * no third-party image assets. Each texture is cached by key.
 */
const cache = new Map();
let maxAnisotropy = 4;

export function setMaxAnisotropy(value) {
  maxAnisotropy = value;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { srgb = true, repeat = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

const hex = (c) => '#' + new THREE.Color(c).getHexString();

function shade(color, amount) {
  const c = new THREE.Color(color);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return hex(c);
}

/** Per-pixel grain applied on top of whatever is already drawn. */
function addGrain(ctx, w, h, strength, rng) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng.next() - 0.5) * strength;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx, w, h, count, color, alphaMax, sizeMin, sizeMax, rng) {
  for (let i = 0; i < count; i++) {
    const r = rng.range(sizeMin, sizeMax);
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', String(rng.range(0, alphaMax))));
    g.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = g;
    // Draw wrapped copies so the texture tiles seamlessly.
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- ground

export const asphaltTexture = () => cached('asphalt', () => {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = createRng(11);
  ctx.fillStyle = '#323335';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, s, 40, 'rgba(20,20,22,A)', 0.25, 20, 90, rng);
  blotches(ctx, s, s, 30, 'rgba(90,90,92,A)', 0.12, 10, 60, rng);
  // Aggregate speckles.
  for (let i = 0; i < 9000; i++) {
    const v = rng.int(40, 120);
    ctx.fillStyle = `rgba(${v},${v},${v + 3},${rng.range(0.25, 0.7)})`;
    ctx.fillRect(rng.range(0, s), rng.range(0, s), rng.range(0.7, 2), rng.range(0.7, 2));
  }
  // Hairline cracks.
  ctx.strokeStyle = 'rgba(15,15,15,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = rng.range(0, s);
    let y = rng.range(0, s);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += rng.range(-18, 18);
      y += rng.range(-18, 18);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  addGrain(ctx, s, s, 14, rng);
  return toTexture(c);
});

export const sidewalkTexture = () => cached('sidewalk', () => {
  // One canvas = 2m x 2m (four 1m slabs).
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = createRng(21);
  ctx.fillStyle = '#7a766f';
  ctx.fillRect(0, 0, s, s);
  const slab = s / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = rng.int(-10, 10);
    ctx.fillStyle = `rgb(${128 + v},${124 + v},${117 + v})`;
    ctx.fillRect(i * slab + 2, j * slab + 2, slab - 4, slab - 4);
  }
  blotches(ctx, s, s, 25, 'rgba(70,65,60,A)', 0.12, 15, 70, rng);
  ctx.fillStyle = 'rgba(60,58,55,0.8)';
  for (let k = 0; k <= 2; k++) {
    ctx.fillRect(k * slab - 2, 0, 4, s);
    ctx.fillRect(0, k * slab - 2, s, 4);
  }
  addGrain(ctx, s, s, 16, rng);
  return toTexture(c);
});

export const plazaTexture = () => cached('plaza', () => {
  // Herringbone-ish pavers, one canvas = 2m.
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = createRng(31);
  ctx.fillStyle = '#6f6359';
  ctx.fillRect(0, 0, s, s);
  const bw = 64;
  const bh = 32;
  for (let y = 0; y < s; y += bh) {
    const off = (y / bh) % 2 ? bw / 2 : 0;
    for (let x = -bw; x < s + bw; x += bw) {
      const v = rng.int(-14, 14);
      ctx.fillStyle = `rgb(${150 + v},${128 + v},${110 + v})`;
      ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
    }
  }
  blotches(ctx, s, s, 20, 'rgba(50,40,35,A)', 0.15, 20, 80, rng);
  addGrain(ctx, s, s, 12, rng);
  return toTexture(c);
});

export const grassTexture = () => cached('grass', () => {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = createRng(41);
  ctx.fillStyle = '#4c6b2f';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, s, 50, 'rgba(95,120,50,A)', 0.4, 20, 80, rng);
  blotches(ctx, s, s, 30, 'rgba(40,55,25,A)', 0.4, 20, 70, rng);
  for (let i = 0; i < 14000; i++) {
    const g = rng.int(70, 140);
    ctx.strokeStyle = `rgba(${g * 0.6},${g},${g * 0.35},0.55)`;
    const x = rng.range(0, s);
    const y = rng.range(0, s);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rng.range(-2, 2), y - rng.range(2, 6));
    ctx.stroke();
  }
  return toTexture(c);
});

export const roofTexture = () => cached('roof', () => {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = createRng(51);
  ctx.fillStyle = '#5d5b58';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, s, 20, 'rgba(30,30,30,A)', 0.3, 10, 50, rng);
  for (let i = 0; i < 5000; i++) {
    const v = rng.int(60, 140);
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(rng.range(0, s), rng.range(0, s), 1.5, 1.5);
  }
  return toTexture(c);
});

export const concreteTexture = () => cached('concrete', () => {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = createRng(61);
  ctx.fillStyle = '#85827c';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, s, 25, 'rgba(60,58,55,A)', 0.18, 10, 60, rng);
  blotches(ctx, s, s, 15, 'rgba(200,198,190,A)', 0.12, 10, 50, rng);
  addGrain(ctx, s, s, 18, rng);
  return toTexture(c);
});

// ---------------------------------------------------------------- facades

export const BAY_WIDTH = 3;
export const FLOOR_HEIGHT = 3.2;
export const GROUND_FLOOR_HEIGHT = 4.2;
/** A facade texture tile covers this many bays horizontally and floors vertically. */
export const FACADE_TILE_BAYS = 4;
export const FACADE_TILE_FLOORS = 2;

export const FACADE_STYLES = {
  brickRed: { wall: 'brick', color: '#8c4a36', mortar: '#b9a898', frame: '#e6e1d6', glass: '#2b3c48', window: 'tall' },
  brickBrown: { wall: 'brick', color: '#6a4535', mortar: '#a39484', frame: '#2a2a2a', glass: '#27353d', window: 'tall' },
  plasterCream: { wall: 'plaster', color: '#d8c9a8', frame: '#5a4f45', glass: '#33434d', window: 'shutter', shutter: '#5f7a64' },
  plasterSage: { wall: 'plaster', color: '#a9b49a', frame: '#efeae0', glass: '#2e3e46', window: 'tall' },
  plasterTerracotta: { wall: 'plaster', color: '#c08a68', frame: '#efe6d8', glass: '#2c3a44', window: 'shutter', shutter: '#6b4a3a' },
  concreteGray: { wall: 'concrete', color: '#8f8d88', frame: '#3a3d40', glass: '#3a4f5e', window: 'band' },
  glassOffice: { wall: 'curtain', color: '#4d6470', frame: '#2c3236', glass: '#5d7f92', window: 'curtain' },
  stoneBeige: { wall: 'stone', color: '#b8aa90', mortar: '#8f8470', frame: '#3b3f42', glass: '#30414c', window: 'tall' },
};

function drawWall(ctx, w, h, style, rng) {
  ctx.fillStyle = style.color;
  ctx.fillRect(0, 0, w, h);
  if (style.wall === 'brick') {
    ctx.fillStyle = style.mortar;
    ctx.fillRect(0, 0, w, h);
    const bw = 22;
    const bh = 8;
    for (let y = 0, row = 0; y < h; y += bh, row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        ctx.fillStyle = shade(style.color, rng.range(-0.06, 0.06));
        ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
      }
    }
  } else if (style.wall === 'stone') {
    ctx.fillStyle = style.mortar;
    ctx.fillRect(0, 0, w, h);
    const bh = 24;
    for (let y = 0, row = 0; y < h; y += bh, row++) {
      let x = row % 2 ? -30 : 0;
      while (x < w) {
        const bw = rng.range(40, 70);
        ctx.fillStyle = shade(style.color, rng.range(-0.05, 0.05));
        ctx.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        x += bw;
      }
    }
  } else if (style.wall === 'concrete') {
    blotches(ctx, w, h, 30, 'rgba(50,50,50,A)', 0.12, 10, 50, rng);
    ctx.fillStyle = 'rgba(40,40,40,0.35)';
    for (let x = 0; x < w; x += w / FACADE_TILE_BAYS) ctx.fillRect(x, 0, 2, h);
  } else {
    blotches(ctx, w, h, 30, 'rgba(255,255,255,A)', 0.08, 10, 60, rng);
    blotches(ctx, w, h, 30, 'rgba(60,50,40,A)', 0.08, 10, 60, rng);
  }
}

// While painting facades, lit windows are also drawn into this emissive canvas (night lighting).
let emitCtx = null;
let litChance = 0;
const LIT_COLORS = ['#ffcf8a', '#ffe2b0', '#fff2d6', '#cfe0ff', '#ffbf70'];

function drawGlass(ctx, rough, x, y, w, h, style, rng) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  const base = new THREE.Color(style.glass);
  g.addColorStop(0, hex(base.clone().offsetHSL(0, 0, 0.12)));
  g.addColorStop(0.5, style.glass);
  g.addColorStop(1, hex(base.clone().offsetHSL(0, 0, -0.08)));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Interior hints: blinds or curtains at random heights.
  const kind = rng.next();
  if (kind < 0.35) {
    const drop = rng.range(0.15, 0.7) * h;
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(225,215,190,0.75)' : 'rgba(170,175,175,0.7)';
    ctx.fillRect(x, y, w, drop);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let k = y + 3; k < y + drop; k += 4) ctx.fillRect(x, k, w, 1);
  } else if (kind < 0.55) {
    ctx.fillStyle = 'rgba(190,160,130,0.55)';
    ctx.fillRect(x, y, w * 0.28, h);
    ctx.fillRect(x + w * 0.72, y, w * 0.28, h);
  }
  // Glass reflects (low roughness) except where blinds are.
  rough.fillStyle = kind < 0.35 ? '#555' : '#1a1a1a';
  rough.fillRect(x, y, w, h);
  if (emitCtx && rng.next() < litChance) {
    const g = emitCtx.createLinearGradient(x, y, x, y + h);
    const c = LIT_COLORS[Math.floor(rng.next() * LIT_COLORS.length)];
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(120,80,40,0.6)');
    emitCtx.fillStyle = g;
    emitCtx.fillRect(x, y, w, h);
  }
}

function emissiveCanvas(w, h) {
  const c = makeCanvas(w, h);
  const e = c.getContext('2d');
  e.fillStyle = '#000';
  e.fillRect(0, 0, w, h);
  return c;
}

function drawWindowUnit(ctx, rough, x, y, bw, fh, style, rng) {
  if (style.window === 'curtain') {
    ctx.fillStyle = style.frame;
    ctx.fillRect(x, y, bw, fh);
    drawGlass(ctx, rough, x + 3, y + 3, bw - 6, fh * 0.78, style, rng);
    // Spandrel panel.
    ctx.fillStyle = shade(style.color, -0.05);
    ctx.fillRect(x + 3, y + fh * 0.78 + 5, bw - 6, fh * 0.22 - 8);
    return;
  }
  if (style.window === 'band') {
    const wy = y + fh * 0.22;
    const wh = fh * 0.5;
    ctx.fillStyle = style.frame;
    ctx.fillRect(x, wy - 3, bw, wh + 6);
    drawGlass(ctx, rough, x + 2, wy, bw - 4, wh, style, rng);
    return;
  }
  const ww = bw * (style.window === 'shutter' ? 0.42 : 0.5);
  const wh = fh * 0.58;
  const wx = x + (bw - ww) / 2;
  const wy = y + fh * 0.17;
  if (style.window === 'shutter') {
    ctx.fillStyle = style.shutter;
    ctx.fillRect(wx - ww * 0.45, wy, ww * 0.42, wh);
    ctx.fillRect(wx + ww * 1.03, wy, ww * 0.42, wh);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = wy + 4; k < wy + wh; k += 6) {
      ctx.fillRect(wx - ww * 0.45, k, ww * 0.42, 1.5);
      ctx.fillRect(wx + ww * 1.03, k, ww * 0.42, 1.5);
    }
  }
  // Lintel and sill give a sense of depth.
  ctx.fillStyle = shade(style.color, 0.12);
  ctx.fillRect(wx - 6, wy - 9, ww + 12, 7);
  ctx.fillStyle = shade(style.color, 0.15);
  ctx.fillRect(wx - 5, wy + wh + 2, ww + 10, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(wx - 5, wy + wh + 8, ww + 10, 3);
  ctx.fillStyle = style.frame;
  ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  drawGlass(ctx, rough, wx, wy, ww, wh, style, rng);
  ctx.fillStyle = style.frame;
  ctx.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
  ctx.fillRect(wx, wy + wh * 0.38, ww, 3);
  // Inner shadow at top of the opening.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(wx, wy, ww, 4);
}

export function facadeTextures(styleName) {
  return cached('facade:' + styleName, () => {
    const style = FACADE_STYLES[styleName];
    const w = 512;
    const h = Math.round((w * FACADE_TILE_FLOORS * FLOOR_HEIGHT) / (FACADE_TILE_BAYS * BAY_WIDTH));
    const c = makeCanvas(w, h);
    const r = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rough = r.getContext('2d');
    const rng = createRng(styleName.length * 977 + styleName.charCodeAt(0));
    rough.fillStyle = '#e0e0e0';
    rough.fillRect(0, 0, w, h);
    const e = emissiveCanvas(w, h);
    emitCtx = e.getContext('2d');
    litChance = 0.42;
    drawWall(ctx, w, h, style, rng);
    const bw = w / FACADE_TILE_BAYS;
    const fh = h / FACADE_TILE_FLOORS;
    for (let f = 0; f < FACADE_TILE_FLOORS; f++) {
      for (let b = 0; b < FACADE_TILE_BAYS; b++) {
        drawWindowUnit(ctx, rough, b * bw, f * fh, bw, fh, style, rng);
      }
      // Subtle floor slab line.
      if (style.wall !== 'curtain') {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(0, f * fh, w, 2);
      }
    }
    addGrain(ctx, w, h, 8, rng);
    emitCtx = null;
    return { map: toTexture(c), roughnessMap: toTexture(r, { srgb: false }), emissiveMap: toTexture(e) };
  });
}

export const STOREFRONT_STYLES = {
  cafe: { sign: '#7b2f2a', frame: '#2a2622', wall: '#d9cfbd', glass: '#3a4a52' },
  market: { sign: '#2f5e4a', frame: '#e8e3d8', wall: '#8e8a83', glass: '#36474f' },
  boutique: { sign: '#25364d', frame: '#1e1e1e', wall: '#c9c1b6', glass: '#33444e' },
  bakery: { sign: '#b07a2a', frame: '#4a3524', wall: '#e3d6c0', glass: '#38474e' },
  service: { sign: '#59606a', frame: '#3a3d40', wall: '#a8a49c', glass: '#344651' },
};
export const STOREFRONT_TILE_BAYS = 3;

export function storefrontTextures(styleName) {
  return cached('store:' + styleName, () => {
    const style = STOREFRONT_STYLES[styleName];
    const w = 384;
    const h = Math.round((w * GROUND_FLOOR_HEIGHT) / (STOREFRONT_TILE_BAYS * BAY_WIDTH));
    const c = makeCanvas(w, h);
    const r = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rough = r.getContext('2d');
    const rng = createRng(styleName.length * 131 + 7);
    rough.fillStyle = '#d8d8d8';
    rough.fillRect(0, 0, w, h);
    const e = emissiveCanvas(w, h);
    emitCtx = e.getContext('2d');
    litChance = 0.95;
    ctx.fillStyle = style.wall;
    ctx.fillRect(0, 0, w, h);
    const signH = h * 0.17;
    ctx.fillStyle = style.sign;
    ctx.fillRect(0, 0, w, signH);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, signH - 4, w, 4);
    const bw = w / STOREFRONT_TILE_BAYS;
    for (let b = 0; b < STOREFRONT_TILE_BAYS; b++) {
      const x = b * bw;
      const isDoor = b === 1;
      const top = signH + 10;
      const bottom = isDoor ? h : h - 18;
      ctx.fillStyle = style.frame;
      ctx.fillRect(x + 6, top - 4, bw - 12, bottom - top + 4);
      drawGlass(ctx, rough, x + 11, top, bw - 22, bottom - top - (isDoor ? 0 : 5), { ...style, color: style.wall }, rng);
      if (isDoor) {
        ctx.fillStyle = style.frame;
        ctx.fillRect(x + bw / 2 - 2, top, 4, h - top);
        ctx.fillStyle = '#c9c4b8';
        ctx.fillRect(x + bw / 2 - 12, top + (h - top) * 0.5, 6, 18);
        ctx.fillRect(x + bw / 2 + 6, top + (h - top) * 0.5, 6, 18);
      } else {
        // Display shelves seen through the glass.
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = `rgba(${rng.int(120, 220)},${rng.int(100, 200)},${rng.int(80, 180)},0.35)`;
          ctx.fillRect(x + 16, bottom - 30 - k * 26, bw - 32, 10);
        }
        ctx.fillStyle = shade(style.wall, -0.2);
        ctx.fillRect(x + 6, h - 18, bw - 12, 18);
      }
    }
    addGrain(ctx, w, h, 8, rng);
    emitCtx = null;
    return { map: toTexture(c), roughnessMap: toTexture(r, { srgb: false }), emissiveMap: toTexture(e) };
  });
}

// ---------------------------------------------------------------- misc

/** Soft radial sprite used for muzzle flashes, dust and glows. */
export const glowTexture = () => cached('glow', () => {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return toTexture(c, { repeat: false });
});

export const flashTexture = () => cached('flash', () => {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 2);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.3, 'rgba(255,190,90,0.8)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(s / 2, 0);
    ctx.lineTo(0, 6);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c, { repeat: false });
});

export const bulletHoleTexture = () => cached('hole', () => {
  const s = 64;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(10,10,10,0.95)');
  g.addColorStop(0.25, 'rgba(30,28,26,0.85)');
  g.addColorStop(0.5, 'rgba(60,55,50,0.35)');
  g.addColorStop(1, 'rgba(60,55,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return toTexture(c, { repeat: false });
});

/** Corrugated metal siding (vertical ridges), one canvas = 2 m wide. */
export const corrugatedTexture = () => cached('corrugated', () => {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = createRng(91);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, '#9a9a9a');
    g.addColorStop(0.5, '#f4f4f4');
    g.addColorStop(1, '#a8a8a8');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 16, s);
  }
  blotches(ctx, s, s, 15, 'rgba(90,70,50,A)', 0.15, 10, 50, rng);
  return toTexture(c);
});

/** See-through bar fence/gate (alpha-tested), one canvas = 2 m wide x 2 m tall. */
export const fenceTexture = () => cached('fence', () => {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#3c4045';
  ctx.fillRect(0, 0, s, 12);
  ctx.fillRect(0, s - 12, s, 12);
  ctx.fillRect(0, s / 2 - 5, s, 10);
  for (let x = 6; x < s; x += 21) ctx.fillRect(x, 0, 6, s);
  return toTexture(c);
});

/** Reusable small canvas texture with a painted text label (shop signs). */
export function signTexture(text, bg, fg) {
  return cached(`sign:${text}:${bg}:${fg}`, () => {
    const c = makeCanvas(512, 96);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = fg;
    let size = 54;
    do {
      ctx.font = `bold ${size}px "Trebuchet MS", Arial, sans-serif`;
      size -= 2;
    } while (ctx.measureText(text).width > 470 && size > 20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 52);
    return toTexture(c, { repeat: false });
  });
}
