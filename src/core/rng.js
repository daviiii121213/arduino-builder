// Deterministic RNG + value noise. Every sprite is generated from a fixed seed so
// the art is identical across runs (and across machines of the same type).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function rngFor(str) { return mulberry32(hashStr(str)); }

/** Classic 2D value noise with smooth interpolation, seeded. */
export class Noise2D {
  constructor(seed = 1337) {
    this.p = new Uint8Array(512);
    const rnd = mulberry32(seed);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }
  grad(hash, x, y) {
    switch (hash & 3) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y;
    }
  }
  at(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const p = this.p;
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    const x1 = aa / 255 + u * (ba / 255 - aa / 255);
    const x2 = ab / 255 + u * (bb / 255 - ab / 255);
    return x1 + v * (x2 - x1);
  }
  fbm(x, y, oct = 4, gain = 0.5, lac = 2) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += a * this.at(x * f, y * f); norm += a; a *= gain; f *= lac; }
    return sum / norm;
  }
}
