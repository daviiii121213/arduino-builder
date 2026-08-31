/** Small helpers for building pixel art at runtime: no external assets. */

/** Deterministic PRNG (mulberry32) so textures look identical every run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Palette = Record<string, string | null>;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas context unavailable');
  g.imageSmoothingEnabled = false;
  return g;
}

/**
 * Turns a hand-drawn character map into a sprite canvas, one char = one pixel.
 * '.' (and any char missing from the palette) is transparent.
 */
export function spriteFromMap(map: string[], palette: Palette): HTMLCanvasElement {
  const h = map.length;
  const w = map.reduce((m, row) => Math.max(m, row.length), 0);
  const cv = makeCanvas(w, h);
  const g = ctx2d(cv);
  for (let y = 0; y < h; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

/** Seamless speckled ground texture: flat base colour plus scattered pixels. */
export function noiseTile(
  size: number,
  base: string,
  specks: Array<{ color: string; density: number }>,
  seed: number,
): HTMLCanvasElement {
  const cv = makeCanvas(size, size);
  const g = ctx2d(cv);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const rand = rng(seed);
  for (const s of specks) {
    g.fillStyle = s.color;
    const count = Math.round(size * size * s.density);
    for (let i = 0; i < count; i++) {
      g.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 1, 1);
    }
  }
  return cv;
}

/** Grass tile with little tufts so the field is not a flat colour field. */
export function grassTile(seed: number): HTMLCanvasElement {
  const size = 32;
  const cv = noiseTile(
    size,
    '#3c7a34',
    [
      { color: '#458c3c', density: 0.16 },
      { color: '#336b2c', density: 0.14 },
      { color: '#2c5c26', density: 0.05 },
    ],
    seed,
  );
  const g = ctx2d(cv);
  const rand = rng(seed + 917);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    g.fillStyle = rand() < 0.5 ? '#54a145' : '#2f6428';
    g.fillRect(x, y, 1, 2);
    g.fillRect((x + 1) % size, y + 1, 1, 1);
  }
  return cv;
}

export function makePattern(tile: HTMLCanvasElement, g: CanvasRenderingContext2D): CanvasPattern {
  const p = g.createPattern(tile, 'repeat');
  if (!p) throw new Error('failed to create pattern');
  return p;
}
